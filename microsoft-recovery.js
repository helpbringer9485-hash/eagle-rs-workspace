'use strict';
// Microsoft personal-account identity + optional OneDrive METADATA backups.
// No SMTP/API sender secret, no embedded login form, no WhatsApp/Signal cookie upload.
// Requires a developer-registered Microsoft public-client application ID.
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const AUTH_ROOT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'openid profile email offline_access User.Read Mail.Send Files.ReadWrite.AppFolder';
const FILE_KEY = 'eagle-rs-recovery-key-v1.json';
const FILE_BACKUP = 'eagle-rs-settings-backup-v1.json';
const MAX_STATE_BYTES = 1_800_000;
const validClientId = v => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(String(v||''));
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const mask = address => {const s=String(address||'');const at=s.indexOf('@');return at>1?s.slice(0,2)+'***'+s.slice(at):'Linked Microsoft account';};
const userSafeMessage = e => String(e?.message||e||'Unknown error').replace(/(Bearer|refresh_token|access_token)\s*[:= ]+[^\s]+/ig,'[credential hidden]').slice(0,350);
async function parseResponse(response){
 const body=await response.text();if(body.length>3_100_000)throw new Error('Microsoft returned an unexpectedly large response.');
 try{return body?JSON.parse(body):{}}catch{throw new Error('Unexpected response from Microsoft. Please try again.');}
}
async function msPost(url, params){
 const r=await fetch(url,{method:'POST',body:new URLSearchParams(params),signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
 const data=await parseResponse(r);return {status:r.status,data};
}
async function graphRequest(accessToken,method,resource,body=null){
 if(!/^\/me\//.test(resource) && resource!=='/me?$select=id,mail,userPrincipalName,displayName')throw new Error('Microsoft Graph resource is not allowed.');
 const url=GRAPH_ROOT+resource;
 const response=await fetch(url,{method,headers:{Authorization:'Bearer '+accessToken,...(body?{'Content-Type':'application/json'}:{})},body:body===null?undefined:JSON.stringify(body),redirect:'follow',signal:AbortSignal.timeout(20000)});
 if(response.status===404)return null;
 if(!response.ok){throw new Error(`OneDrive request failed (${response.status}). Check Microsoft account permissions and connection.`);}
 const raw=await response.text();if(raw.length>3_100_000)throw new Error('Remote backup was too large.');
 try{return JSON.parse(raw)}catch{throw new Error('Unexpected Microsoft Graph response.');}
}
function encryptCloudState(plain,key,userId){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(userId,'utf8'));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(plain),'utf8'),cipher.final()]);
 return {format:'EAGLE-RS-OneDrive-Settings-AES-256-GCM',version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')};
}
function decryptCloudState(envelope,key,userId){
 if(envelope?.version!==1||envelope.format!=='EAGLE-RS-OneDrive-Settings-AES-256-GCM')throw new Error('OneDrive backup format is unsupported.');
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));
 decipher.setAAD(Buffer.from(userId,'utf8'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 const data=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString('utf8'));
 if(!data?.state||!Array.isArray(data.state.accounts))throw new Error('Backup does not contain valid EAGLE RS settings.');
 return data;
}
function createMicrosoftRecovery({app,safeStorage,readState,writeState,requireUnlocked,passwordMatches,resetPin,isUnlocked=()=>true,onVerifiedUnlock=async()=>{},wait=sleep,configuredClientId=null,shell=null,logger=console}){
 const file=n=>path.join(app.getPath('userData'),n);
 const linkedFile=()=>file('microsoft-linked-account.dpapi');
 const tokenFile=()=>file('microsoft-session.dpapi');
 const emailRateFile=()=>file('microsoft-email-recovery-rate.dpapi');
 const configFile=path.join(__dirname,'microsoft-auth-config.json');
 // The public OAuth client ID is not a password. Keep a per-user override outside
 // the packaged ASAR so the owner can activate the integration without rebuilding.
 const overrideFile=()=>file('microsoft-public-client.json');
 let pending=null,verifiedRecoveryUntil=0,backupTimer=null,backupWorking=false,oauthActive=false,lastError='';
 let emailChallenge=null,emailSending=false,emailResetWorking=false;
 let browserServer=null,browserExpiry=null;
 const clientId=()=>{
  if(configuredClientId!==null)return validClientId(configuredClientId)?configuredClientId:'';
  let config={};try{config=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{}
  // A known publisher registration takes precedence over potentially stale
  // local activation overrides from earlier builds. This public ID is not a secret.
  if(validClientId(config.clientId))return config.clientId;
  let override={};try{override=JSON.parse(fs.readFileSync(overrideFile(),'utf8'));}catch{}
  return validClientId(override.clientId)?override.clientId:'';
 };
 async function configureClientId(id,currentPass){
  requireUnlocked();
  if(configuredClientId!==null)return {ok:false,message:'This build manages its client ID centrally. Contact the publisher.'};
  let builtin={};try{builtin=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{}
  if(validClientId(builtin.clientId))return {ok:false,message:'This EAGLE RS build already includes its Microsoft public Client ID. Just select Link my Hotmail / Outlook.'};
  if(!validClientId(id))return {ok:false,message:'Enter an Application (client) ID from Microsoft Entra, formatted like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx. Do not enter a Hotmail address, password, or client secret.'};
  if(!await passwordMatches(currentPass))return {ok:false,message:'Enter your current EAGLE RS master passphrase above to activate sign-in.'};
  if(await getLinked())return {ok:false,message:'Microsoft is already linked. Unlink it with your master passphrase before changing the registered app ID.'};
  if(oauthActive)return {ok:false,message:'Finish the current Microsoft sign-in attempt before changing the application ID.'};
  await fs.promises.mkdir(app.getPath('userData'),{recursive:true});
  const tmp=overrideFile()+'.pending-'+crypto.randomBytes(5).toString('hex');
  try{
   await fs.promises.writeFile(tmp,JSON.stringify({clientId:id,version:1}),{mode:0o600,flag:'wx'});
   await fs.promises.rename(tmp,overrideFile());
  }finally{await fs.promises.rm(tmp,{force:true}).catch(()=>{});}
  return {ok:true,message:'Microsoft public application ID saved on this PC. You can now select Connect Hotmail / Outlook and verify your account on Microsoft’s website. No email password is stored in EAGLE RS.'};
 }
 const enabled=()=>!!clientId();
 async function saveSealed(target,value){
  if(!safeStorage.isEncryptionAvailable())throw new Error('Windows secure storage is unavailable. Cannot save your linked identity.');
  await fs.promises.mkdir(app.getPath('userData'),{recursive:true});
  const tmp=target+'.tmp-'+crypto.randomBytes(5).toString('hex');
  try{await fs.promises.writeFile(tmp,safeStorage.encryptString(JSON.stringify(value)),{mode:0o600,flag:'wx'});await fs.promises.rename(tmp,target)}
  finally{await fs.promises.rm(tmp,{force:true}).catch(()=>{})}
 }
 async function readSealed(target){
  if(!fs.existsSync(target))return null;
  if(!safeStorage.isEncryptionAvailable())throw new Error('Windows secure storage is unavailable. Keep existing application files.');
  return JSON.parse(safeStorage.decryptString(await fs.promises.readFile(target)));
 }
 const getLinked=()=>readSealed(linkedFile());
 const getSession=()=>readSealed(tokenFile());
 async function saveSession(tokens,identity){
  await saveSealed(tokenFile(),{version:1,accessToken:tokens.access_token,refreshToken:tokens.refresh_token||'',expiresAt:Date.now()+Math.max(60,(Number(tokens.expires_in)||3600)-120)*1000,identityId:identity.id,grantedScopes:String(tokens.scope||'')});
 }
 async function tokensFor(linked){
  const t=await getSession();if(!t||t.identityId!==linked.id)throw new Error('Please reconnect your Microsoft account before creating or restoring a backup.');
  if(t.expiresAt>Date.now()+120_000&&t.accessToken)return t.accessToken;
  if(!t.refreshToken)throw new Error('Microsoft sign-in expired. Please reconnect to resume cloud backups.');
  const response=await msPost(AUTH_ROOT+'/token',{client_id:clientId(),grant_type:'refresh_token',refresh_token:t.refreshToken,scope:SCOPES});
  if(response.status!==200||!response.data.access_token)throw new Error('Microsoft session expired. Reconnect your account to continue.');
  await saveSession(response.data,{id:linked.id});return response.data.access_token;
 }
 // EAGLE RS generates a one-time code locally and sends it to the SAME
 // linked Outlook mailbox through Microsoft's own Graph Mail.Send API.
 // No Resend/Mailgun/SMTP API key, no arbitrary recipient, no email password.
 function validLinkedMail(address){return typeof address==='string' && address.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)}
 function digestCode(code,nonce){return crypto.createHash('sha256').update(nonce+':'+code).digest();}
 async function emailRecoveryStatus(){
  const linked=await getLinked();const session=linked?await getSession():null;
  const scopes=String(session?.grantedScopes||'').split(/\s+/i).map(v=>v.toLowerCase());
  const allowed=!!(linked&&session?.identityId===linked.id&&scopes.includes('mail.send')&&validLinkedMail(linked.email));
  return {linked:!!linked,ready:allowed,account:linked?mask(linked.email):'',message:!linked?'Link your Hotmail / Outlook account once in Settings first.':allowed?'Outlook is linked with mail-sending permission. Send a test code and confirm delivery before relying on recovery.':'Reconnect Hotmail / Outlook once and approve the Send mail permission to enable email codes.'};
 }
 async function sendEmailViaMicrosoft(accessToken,to,code){
  const body={message:{subject:'EAGLE RS — your password recovery code',
   body:{contentType:'Text',content:'Your EAGLE RS Workspace password recovery code is: '+code+'\n\nThis code expires in 10 minutes. If you did not request it, ignore this message. Do not share it with anyone.'},
   toRecipients:[{emailAddress:{address:to}}]},saveToSentItems:false};
  const response=await fetch(GRAPH_ROOT+'/me/sendMail',{method:'POST',
   headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
   body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(18000)});
  if(response.status===202)return;
  // Do not leak raw token responses or Graph diagnostic content to the UI.
  if(response.status===401||response.status===403)throw new Error('Microsoft has not authorized sending recovery email. While unlocked, reconnect Hotmail / Outlook and approve the Send mail permission.');
  if(response.status===429)throw new Error('Microsoft is temporarily limiting email requests. Wait and try again later.');
  throw new Error('Microsoft did not accept this recovery email request (HTTP '+response.status+'). Try again later.');
 }
 async function requestEmailCode(){
  if(emailSending)return {ok:false,message:'A recovery email request is already running.'};
  emailSending=true;
  try{
   const status=await emailRecoveryStatus();
   if(!status.ready)return {ok:false,message:status.message};
   const linked=await getLinked();
   const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
   const counter=await readSealed(emailRateFile()).catch(()=>null);
   const count=counter?.day===day?Number(counter.count)||0:0;
   if(counter?.lastAt && now-Number(counter.lastAt)<90_000)return {ok:false,message:'Wait 90 seconds before requesting another recovery email.'};
   if(count>=10)return {ok:false,message:'The daily limit of 10 recovery emails has been reached. Try tomorrow or use a saved offline recovery code.'};
   // Persist rate limits across restarts. Sending fails closed if rate state cannot be saved.
   await saveSealed(emailRateFile(),{day,count:count+1,lastAt:now});
   emailChallenge=null; // invalidate the previous code before trying to send another
   const token=await tokensFor(linked);
   const code=String(crypto.randomInt(0,100_000_000)).padStart(8,'0');
   const nonce=crypto.randomBytes(16).toString('hex');
   await sendEmailViaMicrosoft(token,linked.email,code);
   emailChallenge={identityId:linked.id,nonce,hash:digestCode(code,nonce),expiresAt:Date.now()+10*60_000,attempts:0};
   return {ok:true,message:'Microsoft accepted the recovery email for '+mask(linked.email)+'. Check your inbox and junk folder. Enter the 8-digit code within 10 minutes.'};
  }catch(error){emailChallenge=null;return {ok:false,message:userSafeMessage(error)}}
  finally{emailSending=false;}
 }
 async function finishEmailReset(code,newPass){
  if(emailResetWorking)return {ok:false,message:'A password reset is already in progress.'};
  emailResetWorking=true;
  try{
   const challenge=emailChallenge,linked=await getLinked();
   if(!challenge||!linked||linked.id!==challenge.identityId)return {ok:false,message:'Request a new recovery email code first.'};
   if(Date.now()>=challenge.expiresAt||challenge.attempts>=5){emailChallenge=null;return {ok:false,message:'The email code expired or too many attempts were made. Request a new one.'};}
   challenge.attempts++;
   const submitted=String(code||'').trim();
   if(!/^\d{8}$/.test(submitted)||!crypto.timingSafeEqual(challenge.hash,digestCode(submitted,challenge.nonce)))return {ok:false,message:'The code is incorrect. Check your latest email. You have '+Math.max(0,5-challenge.attempts)+' tries remaining.'};
   if(typeof newPass!=='string'||newPass.length<8||newPass.length>2048)return {ok:false,message:'Choose a new EAGLE RS password of at least 8 characters.'};
   const outcome=await resetPin(newPass);
   if(outcome?.ok)emailChallenge=null;
   return outcome;
  }catch(error){return {ok:false,message:userSafeMessage(error)}}
  finally{emailResetWorking=false;}
 }
 async function me(accessToken){
  const info=await graphRequest(accessToken,'GET','/me?$select=id,mail,userPrincipalName,displayName');
  if(!info||typeof info.id!=='string'||!info.id)throw new Error('Could not verify the Microsoft account identity.');
  return {id:info.id,email:info.mail||info.userPrincipalName||'',displayName:info.displayName||''};
 }
 async function begin(purpose,currentPass=''){
  if(!enabled())return {ok:false,message:'Microsoft sign-in is not activated in this build. The software publisher must register a Microsoft public-client application once. No Resend account or API key is required.'};
  if(oauthActive)return {ok:false,message:'An account verification is already in progress.'};
  if(!['link','recover','reconnect','unlock'].includes(purpose))return {ok:false,message:'Invalid Microsoft action.'};
  if(purpose!=='recover'&&purpose!=='unlock'){
   requireUnlocked();if(!await passwordMatches(currentPass))return {ok:false,message:'Confirm your current EAGLE RS master passphrase to link or reconnect Microsoft.'};
  } else {
   if(!await getLinked())return {ok:false,message:'No Microsoft account was previously linked. Use an existing recovery code or master passphrase.'};
  }
  if(shell&&typeof shell.openExternal==='function')return beginBrowser(purpose);
  const response=await msPost(AUTH_ROOT+'/devicecode',{client_id:clientId(),scope:SCOPES});
  if(response.status!==200||!response.data.device_code)return {ok:false,message:'Microsoft could not start sign-in: '+(response.data.error_description||response.status)};
  const v=response.data;
  pending={purpose,deviceCode:v.device_code,started:Date.now(),expiresAt:Date.now()+Math.min(1200,Number(v.expires_in)||900)*1000,interval:Math.max(5,Number(v.interval)||5),phase:'waiting',message:'Approve the sign-in on the official Microsoft website.',code:v.user_code,uri:v.verification_uri};
  oauthActive=true;lastError='';
  void poll(pending).finally(()=>{oauthActive=false;});
  return {ok:true,verificationUrl:v.verification_uri,userCode:v.user_code,expiresIn:v.expires_in,message:'Open Microsoft sign-in, enter the code, and complete your Hotmail/Outlook verification. EAGLE RS never asks for your email password.'};
 }
 async function finalizeIdentity(job,tokens){
  if(pending!==job)throw new Error('This sign-in was cancelled or replaced.');
  const identity=await me(tokens.access_token),existing=await getLinked();
  if(pending!==job)throw new Error('This sign-in was cancelled or replaced.');
  if(job.purpose!=='recover'&&job.purpose!=='unlock'&&!isUnlocked())throw new Error('The workspace locked during Microsoft enrollment. Unlock EAGLE RS and try again.');
  if((job.purpose==='recover'||job.purpose==='unlock')&&(!existing||existing.id!==identity.id))throw new Error('This is not the Microsoft account originally linked to EAGLE RS. No password was changed.');
  if(job.purpose==='reconnect'&&existing&&existing.id!==identity.id)throw new Error('Sign in to the Microsoft account previously linked to this workspace.');
  if(job.purpose==='link'&&existing&&existing.id!==identity.id)throw new Error('A different account is already linked. Disconnect it while unlocked before linking another.');
  if(job.purpose==='link'||job.purpose==='reconnect')emailChallenge=null;
  if(job.purpose==='recover')verifiedRecoveryUntil=Date.now()+5*60*1000;
  else if(job.purpose==='unlock')await onVerifiedUnlock();
  else{
   const account={version:1,id:identity.id,email:identity.email,displayName:identity.displayName,autoBackup:existing?.autoBackup===true,lastBackupAt:existing?.lastBackupAt||null};
   await saveSealed(linkedFile(),account);await saveSession(tokens,identity);
  }
  job.phase='verified';job.message=job.purpose==='recover'?'Microsoft identity verified. Choose a new EAGLE RS password within five minutes.':job.purpose==='unlock'?'Microsoft account verified. EAGLE RS workspace unlocked.':'Microsoft account verified and linked: '+mask(identity.email);
  job.display=(job.purpose==='recover'||job.purpose==='unlock')?'Microsoft identity verified':mask(identity.email);
  job.deviceCode='';
 }
 function closeBrowser(){
  if(browserExpiry){clearTimeout(browserExpiry);browserExpiry=null;}
  if(browserServer){try{browserServer.close()}catch{}browserServer=null;}
 }
 async function beginBrowser(purpose){
  // Use the real Microsoft Authorization Code + PKCE browser flow.
  // The Entra app must have a Mobile/desktop redirect URI of http://localhost.
  const verifier=crypto.randomBytes(48).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const state=crypto.randomBytes(24).toString('base64url');
  const job={purpose,phase:'waiting',message:'Sign in on the Microsoft website. EAGLE RS is waiting for the secure browser response.',expiresAt:Date.now()+300000};
  let server;
  try{
   server=http.createServer((request,response)=>{
    response.setHeader('Content-Type','text/html; charset=utf-8');
    response.setHeader('Cache-Control','no-store');
    response.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'");
    function reply(code,message){response.statusCode=code;response.end('<!doctype html><meta charset="utf-8"><title>EAGLE RS sign-in</title><body style="background:#10131b;color:#f2e4b9;font:18px system-ui;padding:48px"><h2>'+message+'</h2><p>Return to EAGLE RS Workspace.</p></body>');}
    if(pending!==job||job.phase!=='waiting')return reply(409,'This sign-in request has expired.');
    if(request.method!=='GET')return reply(405,'Unsupported request.');
    const uri=new URL(request.url||'/',`http://localhost`);
    if(uri.pathname!=='/')return reply(404,'Not found.');
    if(uri.searchParams.get('state')!==state)return reply(400,'Invalid sign-in request.');
    const authError=uri.searchParams.get('error');
    if(authError){
     const description=(uri.searchParams.get('error_description')||authError).slice(0,260);
     job.phase='failed';job.message=/AADSTS50011|redirect_uri|reply URL/i.test(description)?'Microsoft needs one setting: in Entra → EAGLE RS Workspace → Authentication → Add a platform → Mobile and desktop applications, register http://localhost, then try again.':'Microsoft declined sign-in: '+description;
     oauthActive=false;closeBrowser();return reply(200,'Microsoft sign-in could not be completed.');
    }
    const code=uri.searchParams.get('code');
    if(!code||code.length>4096){job.phase='failed';job.message='Microsoft did not return an authorization code.';oauthActive=false;closeBrowser();return reply(400,'Microsoft did not return an authorization code.');}
    job.phase='verifying';job.message='Microsoft returned to EAGLE RS. Verifying your account…';
    reply(200,'Sign-in received. You can close this tab.');
    void (async()=>{
     try{
      const token=await msPost(AUTH_ROOT+'/token',{client_id:clientId(),grant_type:'authorization_code',code,redirect_uri:job.redirect,code_verifier:verifier,scope:SCOPES});
      if(token.status!==200||!token.data.access_token)throw new Error('Microsoft did not accept the browser response: '+String(token.data.error_description||token.data.error||token.status).slice(0,220));
      if(pending!==job)throw new Error('This sign-in attempt was replaced.');
      await finalizeIdentity(job,token.data);
     }catch(e){if(pending===job){job.phase='failed';job.message=userSafeMessage(e);lastError=job.message;}logger.warn('EAGLE RS Microsoft browser sign-in:',userSafeMessage(e))}
     finally{oauthActive=false;closeBrowser();}
    })();
   });
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
   browserServer=server;
   job.redirect='http://localhost:'+server.address().port+'/';
   pending=job;oauthActive=true;
   browserExpiry=setTimeout(()=>{if(pending===job&&job.phase==='waiting'){job.phase='failed';job.message='Microsoft sign-in timed out. Click Continue with Hotmail to try again.';}oauthActive=false;closeBrowser();},300000);
   browserExpiry.unref?.();
   const url=new URL(AUTH_ROOT+'/authorize');
   for(const [key,value] of Object.entries({client_id:clientId(),response_type:'code',redirect_uri:job.redirect,response_mode:'query',scope:SCOPES,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}))url.searchParams.set(key,value);
   job.authorizeUrl=url.toString();
   await shell.openExternal(job.authorizeUrl);
   return {ok:true,mode:'browser',expiresIn:300,message:'Continue on the official Microsoft page. After you sign in, this app will confirm your linked account automatically.'};
  }catch(e){if(server){try{server.close()}catch{}}closeBrowser();oauthActive=false;pending=null;return {ok:false,message:'Could not start Microsoft browser sign-in: '+userSafeMessage(e)};}
 }
 async function poll(job){
  try{
   while(pending===job&&Date.now()<job.expiresAt){
    await wait(job.interval*1000);
    if(pending!==job)break;
    const r=await msPost(AUTH_ROOT+'/token',{client_id:clientId(),grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:job.deviceCode});
    if(r.status===200&&r.data.access_token){
     await finalizeIdentity(job,r.data);return;
    }
    const err=r.data.error;
    if(err==='authorization_pending')continue;
    if(err==='slow_down'){job.interval=Math.min(30,job.interval+5);continue;}
    if(err==='authorization_declined')throw new Error('Microsoft sign-in was declined.');
    if(err==='expired_token')throw new Error('Microsoft verification expired. Start again.');
    throw new Error('Microsoft verification failed. '+String(r.data.error_description||err||'Please retry.').slice(0,160));
   }
   if(pending===job&&job.phase==='waiting'){job.phase='failed';job.message='Microsoft sign-in timed out. Start again.';}
  }catch(error){if(pending===job){job.phase='failed';job.message=userSafeMessage(error);lastError=job.message;}logger.warn('EAGLE RS Microsoft sign-in:',userSafeMessage(error));}
 }
 async function openSignIn(){
  if(!pending||pending.phase!=='waiting')return {ok:false,message:'Start a fresh Microsoft sign-in from EAGLE RS first.'};
  if(!shell||typeof shell.openExternal!=='function')return {ok:false,message:'Cannot open the system browser.'};
  let url='';
  if(pending.authorizeUrl)url=pending.authorizeUrl;
  else if(pending.uri){
   const parsed=new URL(pending.uri);
   if(parsed.protocol!=='https:'||!['microsoft.com','www.microsoft.com','login.microsoftonline.com'].includes(parsed.hostname))return {ok:false,message:'Microsoft supplied an unexpected verification address.'};
   url=parsed.toString();
  }
  if(!url)return {ok:false,message:'No current Microsoft verification address was returned.'};
  await shell.openExternal(url);return {ok:true};
 }
 function status(locked=false){
  const snapshot=pending?{mode:pending.redirect?'browser':'device',phase:pending.phase,purpose:pending.purpose,message:pending.message,expiresIn:Math.max(0,Math.ceil((pending.expiresAt-Date.now())/1000)),verifiedRecovery:verifiedRecoveryUntil>Date.now()}:null;
  return {available:enabled(),developerSetupRequired:!enabled(),flow:snapshot,locked};
 }
 async function accountStatus(locked=false){
  const linked=await getLinked();return {...status(locked),linked:!!linked,...(!locked&&linked?{account:mask(linked.email),autoBackup:!!linked.autoBackup,lastBackupAt:linked.lastBackupAt||null}:{}),verifiedRecovery:verifiedRecoveryUntil>Date.now()};
 }
 async function finishRecovery(pass){
  if(verifiedRecoveryUntil<=Date.now())return {ok:false,message:'Microsoft verification is required and expires after five minutes.'};
  // Consume the short-lived grant ONLY after successfully setting a valid passphrase.
  const result=await resetPin(pass);if(result?.ok)verifiedRecoveryUntil=0;
  return result;
 }
 async function disconnect(currentPass){
  requireUnlocked();if(!await passwordMatches(currentPass))return {ok:false,message:'Confirm your current EAGLE RS master passphrase.'};
  await fs.promises.rm(linkedFile(),{force:true});await fs.promises.rm(tokenFile(),{force:true});
  closeBrowser();oauthActive=false;pending=null;verifiedRecoveryUntil=0;emailChallenge=null;return {ok:true,message:'Microsoft account unlinked. Your OneDrive backups were not deleted.'};
 }
 const graphFile=name=>'/me/drive/special/approot:/'+name+':/content';
 async function cloudKey(token,create){
  const keyResponse=await graphRequest(token,'GET',graphFile(FILE_KEY));
  if(keyResponse?.version===1){const key=Buffer.from(keyResponse.key||'','base64');if(key.length!==32)throw new Error('OneDrive key is invalid. Do not overwrite your existing backup.');return key;}
  if(keyResponse!==null)throw new Error('OneDrive key format is unsupported.');
  if(!create)throw new Error('No cloud backup key exists yet.');
  const key=crypto.randomBytes(32);await graphRequest(token,'PUT',graphFile(FILE_KEY),{version:1,key:key.toString('base64')});return key;
 }
 async function uploadBackup(){
  requireUnlocked();if(backupWorking)return {ok:false,message:'Backup already running.'};
  backupWorking=true;
  try{
   const account=await getLinked();if(!account)throw new Error('Link a Microsoft account first.');
   const token=await tokensFor(account);
   await graphRequest(token,'GET','/me/drive/special/approot'); // Ensure app folder exists.
   const settings=await readState();
   const data={version:1,createdAt:new Date().toISOString(),state:settings};
   if(Buffer.byteLength(JSON.stringify(data))>MAX_STATE_BYTES)throw new Error('Workspace settings exceed the cloud backup size limit.');
   const key=await cloudKey(token,true),backup=encryptCloudState(data,key,account.id);
   await graphRequest(token,'PUT',graphFile(FILE_BACKUP),backup);
   account.lastBackupAt=data.createdAt;await saveSealed(linkedFile(),account);lastError='';
   return {ok:true,at:data.createdAt,message:'Workspace settings backed up to your Microsoft OneDrive app folder. Messaging login databases are not included.'};
  }catch(e){lastError=userSafeMessage(e);return {ok:false,message:lastError};}
  finally{backupWorking=false;}
 }
 async function retrieveBackup(){
  requireUnlocked();const account=await getLinked();if(!account)throw new Error('Link Microsoft before restoring.');
  const token=await tokensFor(account);
  await graphRequest(token,'GET','/me/drive/special/approot');
  const backup=await graphRequest(token,'GET',graphFile(FILE_BACKUP));
  if(!backup)throw new Error('No workspace backup found in this Microsoft OneDrive account.');
  const key=await cloudKey(token,false);return decryptCloudState(backup,key,account.id);
 }
 async function backupPreview(){
  try{const backup=await retrieveBackup();return {ok:true,at:backup.createdAt,whatsapp:backup.state.accounts.length,telegram:backup.state.telegramAccounts?.length||0,signal:backup.state.signalSlots?.length||0,message:'This contains app settings, names, reminders and templates — not provider messages, credentials, or WhatsApp/Signal login databases.'}}
  catch(e){return {ok:false,message:userSafeMessage(e)}}
 }
 async function restoreBackup(){
  requireUnlocked();const backup=await retrieveBackup();const current=await readState();
  // NEVER overwrite or remove existing local account mappings: an account's partition
  // may point to large live provider login databases. Merge metadata conservatively.
  const merged=structuredClone(current),incoming=backup.state;
  for(const key of ['accounts','telegramAccounts','signalSlots']){
   const existing=new Set((merged[key]||[]).map(x=>String(x.id)));
   for(const item of incoming[key]||[])if(item&&typeof item.id!=='undefined'&&!existing.has(String(item.id))){merged[key].push(item);existing.add(String(item.id));}
  }
  for(const key of ['reminders','missedCalls','templates']){
   const previous=new Set((merged[key]||[]).map(x=>String(x.id)));
   for(const item of incoming[key]||[])if(item?.id&&!previous.has(String(item.id))){merged[key].push(item);previous.add(String(item.id));}
  }
  await writeState(merged);
  return {ok:true,message:'Workspace metadata restored and merged. Existing browser sessions were not deleted; missing messaging sessions may require relinking with your phone. Restart EAGLE RS to refresh the account lists.'};
 }
 async function setAutoBackup(enabled){
  requireUnlocked();const account=await getLinked();if(!account)return {ok:false,message:'Link Microsoft first.'};
  account.autoBackup=enabled===true;await saveSealed(linkedFile(),account);
  if(account.autoBackup)scheduleBackup(true);
  else if(backupTimer){clearTimeout(backupTimer);backupTimer=null;}
  return {ok:true,autoBackup:account.autoBackup,message:account.autoBackup?'Automatic settings backups enabled. EAGLE RS will back up after changes when running and connected.':'Automatic cloud backups disabled.'};
 }
 function scheduleBackup(soon=false){
  if(backupTimer)clearTimeout(backupTimer);
  backupTimer=setTimeout(async()=>{
   backupTimer=null;
   try{const account=await getLinked();if(!account?.autoBackup)return;await uploadBackup();}catch(err){logger.warn('Scheduled backup:',userSafeMessage(err));}
  },soon?3000:5*60*1000);
  backupTimer.unref?.();
 }
 // Handle lock while a Microsoft verification is pending: it cannot silently authorize linking.
 function cancel(){closeBrowser();pending=null;oauthActive=false;verifiedRecoveryUntil=0;return {ok:true,message:'Microsoft sign-in cancelled. You may start again.'};}
 return {begin,openSignIn,accountStatus,status,configureClientId,finishRecovery,emailRecoveryStatus,requestEmailCode,finishEmailReset,disconnect,uploadBackup,backupPreview,restoreBackup,setAutoBackup,scheduleBackup,cancel,enabled,_test:{encryptCloudState,decryptCloudState,mask}};
}
module.exports={createMicrosoftRecovery,encryptCloudState,decryptCloudState,validClientId};
