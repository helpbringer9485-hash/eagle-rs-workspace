'use strict';
// Optional Google OAuth for an installed desktop application. Disabled until the
// publisher supplies a real public OAuth "Desktop app" client ID.
// Never ask the user for their Google password. No webview authentication.
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const GOOGLE_AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
const GOOGLE_PROFILE='https://openidconnect.googleapis.com/v1/userinfo';
const validClientId=id=>/^\d{8,}-[\w-]+\.apps\.googleusercontent\.com$/.test(String(id||''));
const safeError=e=>String(e?.message||e||'Sign-in failed').slice(0,250);
const mask=address=>{const s=String(address||'');const at=s.indexOf('@');return at>1?s.slice(0,2)+'***'+s.slice(at):'Linked Google account'};

function createGoogleRecovery({app,safeStorage,shell,requireUnlocked,passwordMatches,resetPin,isUnlocked=()=>true,onVerifiedUnlock=async()=>{},logger=console,configuredClientId=null}){
 const configFile=path.join(__dirname,'google-auth-config.json');
 function clientId(){
  let val=configuredClientId;
  if(val===null){try{val=JSON.parse(fs.readFileSync(configFile,'utf8')).clientId}catch{val=''}}
  return validClientId(val)?val:'';
 }
 const linkedPath=()=>path.join(app.getPath('userData'),'google-linked-account.dpapi');
 let current=null,grantExpires=0;
 async function saveLinked(v){
  if(!safeStorage.isEncryptionAvailable())throw Error('Windows protected storage is required before linking Google.');
  await fs.promises.mkdir(app.getPath('userData'),{recursive:true});
  const file=linkedPath(),tmp=file+'.new-'+crypto.randomBytes(5).toString('hex');
  try{await fs.promises.writeFile(tmp,safeStorage.encryptString(JSON.stringify(v)),{mode:0o600,flag:'wx'});await fs.promises.rename(tmp,file)}finally{await fs.promises.rm(tmp,{force:true}).catch(()=>{})}
 }
 async function linked(){
  try{const file=linkedPath();if(!fs.existsSync(file))return null;
   if(!safeStorage.isEncryptionAvailable())throw Error('Windows secure storage is unavailable.');
   const obj=JSON.parse(safeStorage.decryptString(await fs.promises.readFile(file)));
   return obj&&typeof obj.sub==='string'&&obj.sub?obj:null;
  }catch(e){logger.warn('Google recovery protected record:',safeError(e));throw Error('Could not open protected Google recovery information. Keep your backup.');}
 }
 async function status(locked=false){
  const account=await linked();return {available:!!clientId(),linked:!!account,flow:current?{phase:current.phase,message:current.message}:null,...(locked?{}:{email:account?mask(account.email):''})};
 }
 function finish(job,phase,message){
  if(current!==job)return;job.phase=phase;job.message=message;
  try{job.server.close()}catch{}
  if(job.expiry)clearTimeout(job.expiry);
  // Keep result briefly for UI polling, but no credentials remain in it.
  setTimeout(()=>{if(current===job)current=null},35000).unref?.();
 }
 async function begin(purpose,masterPass=''){
  if(!clientId())return {ok:false,message:'Google sign-in is not activated by the software publisher yet. Use Hotmail/Outlook or your recovery code.'};
  if(!['link','recover','unlock'].includes(purpose))return {ok:false,message:'Unsupported sign-in action.'};
  if(current && current.phase==='waiting')return {ok:false,message:'Finish the Google sign-in already open in your browser.'};
  const previous=await linked();
  if((purpose==='recover'||purpose==='unlock')&&!previous)return {ok:false,message:'Link Google while your workspace is unlocked before it can be used for recovery.'};
  if(purpose==='link'){
   requireUnlocked();if(!await passwordMatches(masterPass))return {ok:false,message:'Confirm your EAGLE RS unlock password before linking Google.'};
   if(previous)return {ok:false,message:'A Google account is already linked.'};
  }
  const state=crypto.randomBytes(28).toString('base64url');
  const verifier=crypto.randomBytes(48).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const job={purpose,state,verifier,phase:'waiting',message:'Complete sign-in in your browser.',server:null,expiry:null};
  let server;
  try{
   server=http.createServer((req,res)=>{
    const fail=(code,body)=>{res.writeHead(code,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"});res.end('<!doctype html><meta charset="utf-8"><title>EAGLE RS</title><body style="background:#10131b;color:#f5e5bb;font:16px Segoe UI,sans-serif;padding:40px"><h2>'+body+'</h2><p>You can close this tab and return to EAGLE RS.</p></body>')};
    if(current!==job || job.phase!=='waiting')return fail(409,'Verification expired');
    const target=new URL(req.url||'/',`http://127.0.0.1`);
    if(req.method!=='GET'||target.pathname!=='/callback')return fail(404,'Unknown page');
    if(target.searchParams.get('state')!==state){logger.warn('Google auth: mismatched state');return fail(400,'Invalid verification request')}
    const code=target.searchParams.get('code');
    if(!code||code.length>2048){finish(job,'failed','Google sign-in was cancelled or no code was returned.');return fail(400,'Verification cancelled')}
    job.phase='exchanging';
    fail(200,'Checking your Google account…');
    void (async()=>{
     try{
      const redirect=job.redirect;
      const response=await fetch(GOOGLE_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId(),code,code_verifier:verifier,redirect_uri:redirect,grant_type:'authorization_code'}),signal:AbortSignal.timeout(20000)});
      const body=await response.json();
      if(!response.ok||typeof body.access_token!=='string')throw Error('Google did not accept this sign-in.');
      const profileResponse=await fetch(GOOGLE_PROFILE,{headers:{Authorization:'Bearer '+body.access_token},signal:AbortSignal.timeout(15000)});
      const profile=await profileResponse.json();
      if(!profileResponse.ok||!profile.sub||profile.email_verified!==true)throw Error('Google account identity could not be verified.');
      if((purpose==='recover'||purpose==='unlock')&&profile.sub!==previous.sub)throw Error('This is not the Google account you originally linked. No password changed.');
      if(purpose==='link'){
       if(!isUnlocked())throw Error('Workspace was locked during enrollment. Unlock and try again.');
       await saveLinked({sub:String(profile.sub),email:String(profile.email||''),linkedAt:new Date().toISOString()});
       finish(job,'verified','Google recovery linked: '+mask(String(profile.email||'')));
      }else if(purpose==='unlock'){await onVerifiedUnlock();finish(job,'verified','Google account verified. EAGLE RS workspace unlocked.');}else{grantExpires=Date.now()+5*60*1000;finish(job,'verified','Google identity verified. Set a new EAGLE RS passphrase within five minutes.');}
     }catch(e){finish(job,'failed',safeError(e));logger.warn('Google sign-in:',safeError(e));}
    })();
   });
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
   job.server=server;job.redirect=`http://127.0.0.1:${server.address().port}/callback`;
   current=job;
   job.expiry=setTimeout(()=>finish(job,'failed','Google sign-in timed out. Please try again.'),180000);job.expiry.unref?.();
   const u=new URL(GOOGLE_AUTH);
   for(const [k,v] of Object.entries({client_id:clientId(),redirect_uri:job.redirect,response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}))u.searchParams.set(k,v);
   await shell.openExternal(u.toString());
   return {ok:true,message:'Continue in the Google browser window. EAGLE RS never receives your Google password.'};
  }catch(e){if(server)try{server.close()}catch{};if(current===job)current=null;return {ok:false,message:'Could not start browser verification: '+safeError(e)};}
 }
 async function reset(newPass){if(Date.now()>grantExpires)return {ok:false,message:'Verify the linked Google account again to reset your password.'};const result=await resetPin(newPass);if(result.ok)grantExpires=0;return result;}
 return {status,begin,reset};
}
module.exports={createGoogleRecovery,validClientId};
