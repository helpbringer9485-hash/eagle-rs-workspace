'use strict';
const {app, BrowserWindow, ipcMain, session, shell, Notification, Tray, Menu, nativeImage, safeStorage, powerMonitor} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const {createMicrosoftRecovery} = require('./microsoft-recovery');
const {createGoogleRecovery} = require('./google-recovery');
const {createGeminiAssistant} = require('./gemini-assistant');
const {createSignalDock}=require('./signal-dock');
const {createChatCapture} = require('./chat-capture');
const {spawn, execFile} = require('node:child_process');
const {allowProviderNotification} = require('./notification-permissions');
let win, tray, sessionKey = '', isQuitting = false;
// Explicit opt-in for official provider web notifications. Never grant microphone, camera or other permissions automatically.
let providerNotificationsEnabled = false;
const trackedSignal = new Map();
const APP_BG='#05080E';
let lastActivityAt=Date.now(), hadWindowShown=false, idleClock=null;
let signalDock;
const appLock=()=>{authorized=false;void signalDock?.hide();try{win?.webContents?.send('app:locked');}catch{}};
const idleHours=async()=>{try{const s=await loadAsync();return s.ui?.idleHours===2?2:1;}catch{return 1;}};
// Only one process may use a Chromium profile: concurrent writers risk session/database damage.
const hasInstanceLock=app.requestSingleInstanceLock();
if(!hasInstanceLock) app.quit();
else app.on('second-instance',()=>{if(win&&!win.isDestroyed()){win.show();win.focus();}});
signalDock=createSignalDock({getWindow:()=>win,isUnlocked:()=>authorized});
app.enableSandbox();
// Debugging switches cannot provide a secure session; reject them on startup.
for(const forbidden of ['remote-debugging-port','remote-debugging-pipe','inspect','inspect-brk']){
 try{if(app.commandLine.hasSwitch(forbidden))app.commandLine.removeSwitch(forbidden);}catch{}
}

let reminderTimer = null;
// Never change appId/productName/userData or existing account partition IDs across updates.
const statePath = () => path.join(app.getPath('userData'), 'accounts.json'); // legacy plain config, migrated only after secure write verifies.
const backupPath = () => path.join(app.getPath('userData'), 'accounts.json.previous');
const secureStatePath=()=>path.join(app.getPath('userData'),'accounts.secure.json');
const secureBackupPath=()=>path.join(app.getPath('userData'),'accounts.secure.previous');
const stateKeyPath=()=>path.join(app.getPath('userData'),'accounts.key.dpapi');
let cachedStateKey=null;
function canProtectConfig(){return safeStorage.isEncryptionAvailable();}
async function configKey(){
 if(cachedStateKey)return cachedStateKey;
 if(!canProtectConfig())throw new Error('Windows encrypted storage is unavailable; do not overwrite encrypted account settings.');
 if(fs.existsSync(stateKeyPath())){
  const key=safeStorage.decryptString(await fs.promises.readFile(stateKeyPath()));
  const bytes=Buffer.from(key,'base64');if(bytes.length!==32)throw new Error('Saved configuration key is invalid.');
  cachedStateKey=bytes;return bytes;
 }
 if(fs.existsSync(secureStatePath()))throw new Error('Saved account settings exist, but their encryption key is missing. Keep your existing data; do not create a new profile.');
 const bytes=crypto.randomBytes(32);
 await fs.promises.mkdir(app.getPath('userData'),{recursive:true});
 const sealed=safeStorage.encryptString(bytes.toString('base64'));
 await fs.promises.writeFile(stateKeyPath(),sealed,{flag:'wx',mode:0o600});
 cachedStateKey=bytes;return bytes;
}
async function encryptState(state){
 const key=await configKey(),nonce=crypto.randomBytes(12);
 const cipher=crypto.createCipheriv('aes-256-gcm',key,nonce);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(state),'utf8'),cipher.final()]);
 return JSON.stringify({version:1,format:'AES-256-GCM+Windows-DPAPI',nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')});
}
async function decryptState(raw){
 const v=JSON.parse(raw);if(v.version!==1||v.format!=='AES-256-GCM+Windows-DPAPI')throw new Error('Unrecognized encrypted configuration.');
 const decipher=crypto.createDecipheriv('aes-256-gcm',await configKey(),Buffer.from(v.nonce,'base64'));
 decipher.setAuthTag(Buffer.from(v.tag,'base64'));
 return JSON.parse(Buffer.concat([decipher.update(Buffer.from(v.data,'base64')),decipher.final()]).toString('utf8'));
}

const pinPath=()=>path.join(app.getPath('userData'),'app-lock.json');
const recoveryMailPath=()=>path.join(app.getPath('userData'),'verified-recovery-email.dpapi');
let authorized=false,failedAttempts=0,lockedUntil=0;
let pendingEmailEnrollment=null,pendingEmailReset=null,lastEmailSend=0,emailsSentToday=0,emailDay='';
function requireUnlocked(){if(!authorized)throw new Error('Unlock the workspace first.');}
async function derive(pass,salt){return new Promise((resolve,reject)=>crypto.scrypt(pass,salt,64,{N:16384,r:8,p:1},(err,key)=>err?reject(err):resolve(key)));}
async function writePin(v){
 const dest=pinPath(),tmp=dest+'.new-'+crypto.randomBytes(6).toString('hex');
 await fs.promises.mkdir(app.getPath('userData'),{recursive:true});
 try{await fs.promises.writeFile(tmp,JSON.stringify(v),{mode:0o600,flag:'wx'});await fs.promises.rename(tmp,dest)}
 finally{await fs.promises.rm(tmp,{force:true}).catch(()=>{})}
}
async function readPin(){return JSON.parse(await fs.promises.readFile(pinPath(),'utf8'));}
function acceptablePass(pass){return typeof pass==='string' && pass.trim().length>=8&&pass.length<=200;}
function lockoutMessage(){return 'Too many attempts. Please wait before trying again.';}
function noteFailedAttempt(){failedAttempts++;if(failedAttempts>=5){lockedUntil=Date.now()+60000;failedAttempts=0;}}
async function passwordMatches(pass){
 try{const v=await readPin();const derived=await derive(String(pass||''),Buffer.from(v.salt,'hex'));const expected=Buffer.from(v.hash,'hex');return expected.length===derived.length&&crypto.timingSafeEqual(derived,expected)}catch{return false}
}
async function recoverySet(){
 const codes=[],recovery=[];
 for(let i=0;i<6;i++){
  const raw=crypto.randomBytes(12).toString('hex').toUpperCase();
  const code='ERS-'+raw.match(/.{1,4}/g).join('-');
  const salt=crypto.randomBytes(16);
  recovery.push({salt:salt.toString('hex'),hash:(await derive(code,salt)).toString('hex')});
  codes.push(code);
 }
 return {codes,recovery};
}
async function updatedPinRecord(pass){
 const salt=crypto.randomBytes(16),hash=await derive(pass,salt),{codes,recovery}=await recoverySet();
 return {record:{version:2,salt:salt.toString('hex'),hash:hash.toString('hex'),recovery},codes};
}
function maskEmail(email){const [name,domain]=String(email).split('@');return name&&domain?name.slice(0,2)+'***@'+domain:'Verified email';}
function emailConfigured(){return canProtectConfig()&&fs.existsSync(recoveryMailPath());}
function lockInfo(){return {configured:fs.existsSync(pinPath()),locked:!authorized,waitSeconds:Math.max(0,Math.ceil((lockedUntil-Date.now())/1000)), emailConfigured:emailConfigured()};}
async function recoveryStatus(){
 let hasCodes=false;try{const v=await readPin();hasCodes=Array.isArray(v.recovery)&&v.recovery.length>0}catch{}
 // The destination is intentionally not displayed while the workspace is locked.
 return {emailConfigured:emailConfigured(),hasCodes,emailProvider:'Resend (requires verified sender domain)'};
}
async function setPassphrase(pass){
 if(fs.existsSync(pinPath()))requireUnlocked();
 if(!acceptablePass(pass))return {ok:false,message:'Use at least 8 characters for the local app passphrase.'};
 const {record,codes}=await updatedPinRecord(pass);await writePin(record);
 pendingEmailReset=null;appLock();
 return {ok:true,codes,message:'Master lock enabled. Save these one-time recovery codes offline now. They will not be shown again.'};
}
async function unlock(pass){
 if(Date.now()<lockedUntil)return {ok:false,message:lockoutMessage()};
 if(!fs.existsSync(pinPath()))return {ok:false,message:'Set a master passphrase before opening this workspace.'};
 if(await passwordMatches(pass)){authorized=true;lastActivityAt=Date.now();failedAttempts=0;return {ok:true};}
 noteFailedAttempt();return {ok:false,message:'Incorrect passphrase. Your saved messaging data was not changed.'};
}
async function rotateRecoveryCodes(currentPass){
 requireUnlocked();if(!await passwordMatches(currentPass)){noteFailedAttempt();return {ok:false,message:'Your current passphrase is incorrect.'};}
 const record=await readPin(),{recovery,codes}=await recoverySet();record.version=2;record.recovery=recovery;
 await writePin(record);return {ok:true,codes,message:'New one-time recovery codes generated. Old unused codes no longer work.'};
}
async function useRecoveryCode(code,newPass){
 if(Date.now()<lockedUntil)return {ok:false,message:lockoutMessage()};
 if(!acceptablePass(newPass))return {ok:false,message:'Choose a new master passphrase of at least 8 characters.'};
 const normalized=String(code||'').trim().toUpperCase();
 if(!/^ERS-(?:[A-F0-9]{4}-){5}[A-F0-9]{4}$/.test(normalized)){noteFailedAttempt();return {ok:false,message:'Invalid recovery code.'};}
 const old=await readPin();let match=false;
 for(const item of Array.isArray(old.recovery)?old.recovery:[]){
  try{const result=await derive(normalized,Buffer.from(item.salt,'hex'));const expected=Buffer.from(item.hash,'hex');if(result.length===expected.length&&crypto.timingSafeEqual(result,expected))match=true}catch{}
 }
 if(!match){noteFailedAttempt();return {ok:false,message:'Invalid or already-used recovery code.'};}
 const {record,codes}=await updatedPinRecord(newPass);await writePin(record);pendingEmailReset=null;failedAttempts=0;
 return {ok:true,codes,message:'Passphrase changed. Save your replacement recovery codes. Existing account partitions were not modified.'};
}
function validEmail(s){return typeof s==='string'&&s.length<255&&/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(s);}
function emailCode(){return String(crypto.randomInt(0,100000000)).padStart(8,'0');}
function checkEmailCode(pending,submitted){
 if(!pending||Date.now()>pending.expires||pending.attempts>=5)return false;
 const v=String(submitted||'').trim();if(!/^\d{8}$/.test(v)){pending.attempts++;return false;}
 const expected=Buffer.from(pending.hash,'hex'),value=crypto.createHash('sha256').update(v).digest();
 pending.attempts++;return crypto.timingSafeEqual(expected,value);
}
function sendLimit(){
 const today=new Date().toISOString().slice(0,10);if(emailDay!==today){emailDay=today;emailsSentToday=0;}
 if(Date.now()-lastEmailSend<90000)return 'Wait at least 90 seconds before requesting another email.';
 if(emailsSentToday>=12)return 'The daily email recovery limit has been reached.';
 lastEmailSend=Date.now();emailsSentToday++;return '';
}
async function sendViaResend(config,to,code,reason){
 const body=JSON.stringify({from:config.from,to:[to],subject:'EAGLE RS Workspace — '+reason,
  text:'EAGLE RS Workspace '+reason+' code: '+code+'\n\nThis code expires after 10 minutes. If you did not request it, ignore this email. Never share the code.'});
 return new Promise((resolve,reject)=>{
  const req=https.request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:15000},res=>{
   let response='';res.setEncoding('utf8');res.on('data',chunk=>{if(response.length<3000)response+=chunk});res.on('end',()=>{if(res.statusCode>=200&&res.statusCode<300)resolve();else reject(new Error('Email provider rejected the request ('+res.statusCode+'). Check your verified sender and provider account.'));});
  });req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Email provider timed out.')));req.write(body);req.end();
 });
}
function codeChallenge(code){return {hash:crypto.createHash('sha256').update(code).digest('hex'),expires:Date.now()+10*60*1000,attempts:0};}
async function emailEnroll({currentPass,email,from,apiKey}={}){
 requireUnlocked();
 if(!await passwordMatches(currentPass))return {ok:false,message:'Enter your current master passphrase to configure recovery email.'};
 if(!canProtectConfig())return {ok:false,message:'Windows secure storage unavailable. Email credentials were not saved.'};
 if(!validEmail(email)||!validEmail(from)||typeof apiKey!=='string'||!/^re_[A-Za-z0-9_\-]{10,}$/.test(apiKey))return {ok:false,message:'Enter a valid recovery email, verified sender email, and Resend API key.'};
 const limited=sendLimit();if(limited)return {ok:false,message:limited};
 const config={email:email.trim(),from:from.trim(),apiKey:apiKey.trim()};const code=emailCode();
 pendingEmailEnrollment={...codeChallenge(code),config};
 try{await sendViaResend(config,config.email,code,'verify recovery email');return {ok:true,message:'Verification code sent to your recovery email. Enter it within 10 minutes.'};}
 catch(e){pendingEmailEnrollment=null;return {ok:false,message:e.message};}
}
async function emailConfirm(code){
 requireUnlocked();if(!checkEmailCode(pendingEmailEnrollment,code))return {ok:false,message:'Invalid or expired verification code.'};
 const config=pendingEmailEnrollment.config;
 const encrypted=safeStorage.encryptString(JSON.stringify({version:1,...config}));
 const dest=recoveryMailPath(),tmp=dest+'.new-'+crypto.randomBytes(5).toString('hex');
 try{await fs.promises.writeFile(tmp,encrypted,{mode:0o600,flag:'wx'});await fs.promises.rename(tmp,dest)}
 finally{await fs.promises.rm(tmp,{force:true}).catch(()=>{})}
 pendingEmailEnrollment=null;return {ok:true,message:'Recovery email verified and secured. You can request an email reset after the workspace is locked.'};
}
async function storedRecoveryEmail(){
 if(!canProtectConfig()||!fs.existsSync(recoveryMailPath()))throw new Error('Verified email recovery has not been configured yet.');
 const config=JSON.parse(safeStorage.decryptString(await fs.promises.readFile(recoveryMailPath())));
 if(config.version!==1||!validEmail(config.email)||!validEmail(config.from))throw new Error('Saved recovery email is invalid.');
 return config;
}
async function requestEmailRecovery(){
 if(Date.now()<lockedUntil)return {ok:false,message:lockoutMessage()};
 const limited=sendLimit();if(limited)return {ok:false,message:limited};
 let config;try{config=await storedRecoveryEmail()}catch(e){return {ok:false,message:e.message};}
 const code=emailCode();pendingEmailReset={...codeChallenge(code)};
 try{await sendViaResend(config,config.email,code,'reset passphrase');return {ok:true,message:'An 8-digit code was sent to your previously verified recovery email ('+maskEmail(config.email)+').'};}
 catch(e){pendingEmailReset=null;return {ok:false,message:e.message};}
}
async function emailReset(code,newPass){
 if(Date.now()<lockedUntil)return {ok:false,message:lockoutMessage()};
 if(!acceptablePass(newPass))return {ok:false,message:'Choose a new master passphrase of at least 8 characters.'};
 if(!checkEmailCode(pendingEmailReset,code)){noteFailedAttempt();return {ok:false,message:'Invalid or expired email verification code.'};}
 pendingEmailReset=null;const {record,codes}=await updatedPinRecord(newPass);await writePin(record);failedAttempts=0;
 return {ok:true,codes,message:'Passphrase reset using verified email. Save your new recovery codes; messaging data was not modified.'};
}
async function revokeEmailRecovery(currentPass){requireUnlocked();if(!await passwordMatches(currentPass))return {ok:false,message:'Current passphrase is required to remove recovery email.'};await fs.promises.rm(recoveryMailPath(),{force:true});pendingEmailEnrollment=null;pendingEmailReset=null;return {ok:true,message:'Verified recovery email disabled.'};}

const keyPath = () => path.join(app.getPath('userData'), 'gemini-key.enc');
const oldKeyPath = () => path.join(app.getPath('userData'), 'openai-key.enc');
const defaults = () => ({
 ui:{leftCollapsed:false,geminiCollapsed:false,idleHours:1,lockWhenHidden:true,themeId:'obsidian-gold',fontId:'segoe',lockOnBlur:false,captureGuard:false,backgroundDrawerOpen:false,arrangeMode:false,lowMemoryMode:false,popupTimeoutMinutes:1,ambientMotion:true},
 platformOrder:['signal','wa','tg'], openGroups:{signal:false,wa:true,tg:false}, nextId:11, nextTgId:1, nextSignalId:11, telegramAccounts:[], accounts:Array.from({length:10},(_,i)=>({id:`wa-${i+1}`,name:`WhatsApp ${i+1}`,pin:false,color:'green',followup:false})),
 signalSlots:Array.from({length:10},(_,i)=>({id:i+1,name:`Signal ${i+1}`})),
 prefs:{sound:true,desktop:true,remind:true,providerNotifications:false,reminderMinutes:15},reminders:[],missedCalls:[],templates:[
 {id:'tpl-welcome',title:'Friendly hello',body:'Hey! I hope your day is going well. How have you been?'},
 {id:'tpl-details',title:'Ask a little more',body:'I understand what you mean. Tell me a little more so I can understand you better.'},
 {id:'tpl-quote',title:'Warm check-in',body:'Hey, just checking in. How has your day been going?'},
 {id:'tpl-pending',title:'Thoughtful reply',body:'I read what you said, and I want to give you a thoughtful answer. I will write back when I can give you my full attention.'},
 {id:'tpl-thanks',title:'Sweet goodnight',body:'Good night. I hope you sleep peacefully and wake up with a beautiful smile.'}
 ]
});
const goodColor = v => ['green','gold','blue','rose'].includes(v) ? v : 'green';
function clean(input){
 if(!input || !Array.isArray(input.accounts)) return defaults();
 const d=defaults(), seen=new Set(), accounts=[];
 for(const a of input.accounts){
  if(a && /^wa-[1-9]\d*$/.test(a.id) && !seen.has(a.id) ){
   seen.add(a.id); accounts.push({id:a.id,name:String(a.name||a.id).trim().slice(0,48)||a.id,
    pin:!!a.pin,color:goodColor(a.color),followup:!!a.followup,active:a.active!==false,
    partition: /^persist:(mm3-wa-|wa_session_|whatsapp_session_)[1-9]\d*$/.test(a.partition||'') && a.partition.endsWith(a.id.slice(3)) ? a.partition : `persist:mm3-${a.id}`});
  }
 }
 const validAccount=(a,prefix)=>a && typeof a.id==='string' && new RegExp('^'+prefix+'-[1-9]\\d*$').test(a.id);
 const telegramAccounts=[], tgSeen=new Set();
 for(const a of Array.isArray(input.telegramAccounts)?input.telegramAccounts:[]){
  if(!validAccount(a,'tg') || tgSeen.has(a.id))continue;
  tgSeen.add(a.id);telegramAccounts.push({id:a.id,name:String(a.name||a.id).trim().slice(0,48)||a.id,
   pin:!!a.pin,color:goodColor(a.color),followup:!!a.followup,active:a.active!==false,
    partition: /^persist:tg_session_[1-9]\d*$/.test(a.partition||'') && a.partition.endsWith(a.id.slice(3)) ? a.partition : `persist:tg_session_${a.id.slice(3)}`});
 }
 const signalSlots=[], signalSeen=new Set();
 for(const a of Array.isArray(input.signalSlots)?input.signalSlots:d.signalSlots){
  const n=Number(a?.id);if(!Number.isSafeInteger(n)||n<1||signalSeen.has(n))continue;
  signalSeen.add(n);signalSlots.push({id:n,name:String(a.name||`Signal ${n}`).trim().slice(0,48)||`Signal ${n}`,active:a.active!==false});
 }

 const prefs={...d.prefs};for(const k of ['sound','desktop','remind','providerNotifications'])if(typeof input.prefs?.[k]==='boolean')prefs[k]=input.prefs[k];
 if([5,10,15,30,60].includes(input.prefs?.reminderMinutes))prefs.reminderMinutes=input.prefs.reminderMinutes;
 const reminders=Array.isArray(input.reminders)?input.reminders.filter(r=>r && typeof r.id==='string' && typeof r.title==='string' && Number.isFinite(r.due) && r.due>0).slice(0,300).map(r=>({
  id:r.id.slice(0,60),title:r.title.trim().slice(0,160),contact:String(r.contact||'').trim().slice(0,80),
  accountId:String(r.accountId||'').slice(0,30),due:r.due,done:!!r.done,
  repeatMinutes:[0,5,10,15,30,60].includes(r.repeatMinutes)?r.repeatMinutes:15,
  nextNotifyAt:Number.isFinite(r.nextNotifyAt)&&r.nextNotifyAt>0?r.nextNotifyAt:r.due,
  lastNotified:Number.isFinite(r.lastNotified)?r.lastNotified:0
 })):[];
 // Human-entered missed-call records only. No scraping of WhatsApp or Signal private call history.
 const validCallAccount=id => /^(?:wa|tg)-[1-9]\d*$/.test(id)||/^signal-[1-9]\d*$/.test(id);
 const knownCallAccount=id => accounts.some(a=>a.id===id)||telegramAccounts.some(a=>a.id===id)||signalSlots.some(s=>id===`signal-${s.id}`);
 const missedCalls=Array.isArray(input.missedCalls)?input.missedCalls.filter(r=>r&&typeof r.id==='string'&&validCallAccount(r.accountId)&&knownCallAccount(r.accountId)&&Number.isFinite(r.time)&&r.time>0).slice(0,500).map(r=>({
  id:r.id.slice(0,80),accountId:r.accountId,caller:String(r.caller||'Unknown caller').trim().slice(0,90)||'Unknown caller',
  time:r.time,kind:['voice','video'].includes(r.kind)?r.kind:'unknown',note:String(r.note||'').slice(0,250),status:['pending','reviewed','called-back'].includes(r.status)?r.status:'pending',source:r.source==='user-pasted'?'user-pasted':'manual',
  outcome:['missed','incoming','answered','declined','outgoing','ended'].includes(r.outcome)?r.outcome:'missed',
  answeredAt:Number.isFinite(r.answeredAt)&&r.answeredAt>0?r.answeredAt:0,endedAt:Number.isFinite(r.endedAt)&&r.endedAt>0?r.endedAt:0,updatedAt:Number.isFinite(r.updatedAt)?r.updatedAt:r.time
 })):[];
 const oldStockTexts = {
  'tpl-welcome':'Hello! Thank you for contacting EAGLE RS. How may we help you today?',
  'tpl-details':'Thank you for your message. Could you please share a little more detail so we can assist you accurately?',
  'tpl-quote':'Hello! I am following up regarding your quotation. Please let me know if you have any questions.',
  'tpl-pending':'Thank you for your patience. We are reviewing your request and will update you once we have confirmed information.',
  'tpl-thanks':'Thank you for choosing EAGLE RS. We appreciate your time and look forward to assisting you again.'
 };
 const templates = Array.isArray(input.templates) ? input.templates.filter(t=>t && typeof t.id==='string' && typeof t.title==='string' && typeof t.body==='string').slice(0,60).map(t=>{
  // Migrate only untouched, previously shipped corporate stock templates.
  const updated=d.templates.find(x=>x.id===t.id);
  if(updated && t.body===oldStockTexts[t.id])return {...updated};
  return {id:t.id.slice(0,70),title:t.title.trim().slice(0,60),body:t.body.slice(0,1200)};
 }) : d.templates;
 const platformOrder = Array.isArray(input.platformOrder) ? [...new Set(input.platformOrder.filter(k=>['signal','wa','tg'].includes(k)))] : d.platformOrder.slice();
 for (const k of ['signal','wa','tg']) if(!platformOrder.includes(k))platformOrder.push(k);
 const openGroups={...d.openGroups};for(const k of ['signal','wa','tg'])if(typeof input.openGroups?.[k]==='boolean')openGroups[k]=input.openGroups[k];
 const ui={...d.ui};for(const k of ['leftCollapsed','geminiCollapsed','lockWhenHidden','lockOnBlur','captureGuard','backgroundDrawerOpen','arrangeMode','lowMemoryMode','ambientMotion'])if(typeof input.ui?.[k]==='boolean')ui[k]=input.ui[k];if([1,2].includes(input.ui?.idleHours))ui.idleHours=input.ui.idleHours;if([1,2,3].includes(input.ui?.popupTimeoutMinutes))ui.popupTimeoutMinutes=input.ui.popupTimeoutMinutes;
 // Migrate only the appearance token; preserve all messaging accounts, partitions and lock records.
 const themeAliases={
  'titanium':'pitch-black','graphite':'titanium-silver','blackout':'pitch-black',
  'emerald':'emerald-green','arctic':'titanium-silver','sapphire':'royal-sapphire',
  'amethyst':'royal-sapphire','copper':'obsidian-gold','burgundy':'obsidian-gold',
  'glacier':'royal-sapphire','smoked-glass':'royal-sapphire',
  'executive-gray':'titanium-silver'
 };
 const requestedTheme=input.ui?.themeId;
 const resolvedTheme=themeAliases[requestedTheme]||requestedTheme;
 if(['obsidian-gold','chatgpt-slate','pitch-black','titanium-silver','emerald-green','royal-sapphire'].includes(resolvedTheme))ui.themeId=resolvedTheme;
 if(['segoe','aptos','inter','calibri','arial','verdana','tahoma','trebuchet','georgia','consolas'].includes(input.ui?.fontId))ui.fontId=input.ui.fontId;
 return {ui,nextId:accounts.reduce((m,a)=>Math.max(m,Number(a.id.slice(3))+1),Math.max(11,Number.isSafeInteger(input.nextId)?input.nextId:1)),
  nextTgId:telegramAccounts.reduce((m,a)=>Math.max(m,Number(a.id.slice(3))+1),Math.max(1,Number.isSafeInteger(input.nextTgId)?input.nextTgId:1)),
  nextSignalId:signalSlots.reduce((m,a)=>Math.max(m,a.id+1),Math.max(1,Number.isSafeInteger(input.nextSignalId)?input.nextSignalId:1)),
  platformOrder,openGroups,accounts,telegramAccounts,signalSlots,prefs,reminders,missedCalls,templates};
}
// Legacy accounts.json is never overwritten during migration until encrypted state is committed.
// A failed decryption raises an error; silently returning defaults would hide existing sessions.
let saveChain=Promise.resolve();
async function readLegacy(){
 for(const file of [statePath(),backupPath()]){
  try{const raw=JSON.parse(await fs.promises.readFile(file,'utf8'));if(raw&&Array.isArray(raw.accounts))return clean(raw);}catch(e){if(e.code!=='ENOENT')console.warn('Legacy settings read:',e.message);}
 }
 throw new Error('Legacy account settings are corrupt. Stop and restore from a backup instead of re-scanning accounts.');
}
async function loadAsync(){
 await saveChain.catch(()=>{});
 for(const filename of [secureStatePath(),secureBackupPath()]){
  if(!fs.existsSync(filename))continue;
  try{return clean(await decryptState(await fs.promises.readFile(filename,'utf8')))}
  catch(err){console.error('Secure state read failure:',filename,err.message);if(filename===secureBackupPath())throw new Error('Unable to unlock encrypted account settings. Keep this Windows profile and your backup: '+err.message);}
 }
 if(fs.existsSync(secureStatePath()))throw new Error('Encrypted account settings could not be opened. Saved sessions may still exist. DO NOT clear them.');
 if(fs.existsSync(statePath())||fs.existsSync(backupPath()))return readLegacy();
 return defaults();
}
async function writeEncrypted(state){
 const root=app.getPath('userData');await fs.promises.mkdir(root,{recursive:true});
 const envelope=await encryptState(state),file=secureStatePath(),temp=file+'.next';
 if(fs.existsSync(file))await fs.promises.copyFile(file,secureBackupPath());
 await fs.promises.writeFile(temp,envelope,{mode:0o600});
 // Check the authentication tag before replacing any previous settings.
 await decryptState(await fs.promises.readFile(temp,'utf8'));
 await fs.promises.rename(temp,file);
 return state;
}
async function saveAsync(raw){
 const state=clean(structuredClone(raw));
 const write=async()=>{
  if(canProtectConfig()){
   const result=await writeEncrypted(state);
   // If migrating from old plaintext, remove it ONLY AFTER verifying the encrypted replacement.
   // Leave a *.previous file for one-time manual recovery, with explicit warning in README.
   if(fs.existsSync(statePath())){
    try{await fs.promises.rename(statePath(),statePath()+'.migrated-unencrypted');}catch(e){console.warn('Old state archival:',e.message)}
   }
   return result;
  }
  if(fs.existsSync(secureStatePath()))throw new Error('Cannot save: encrypted account storage is not available on this Windows session.');
  const file=statePath(),temp=file+'.next';await fs.promises.mkdir(path.dirname(file),{recursive:true});
  if(fs.existsSync(file))await fs.promises.copyFile(file,backupPath());
  await fs.promises.writeFile(temp,JSON.stringify(state,null,2),{mode:0o600});await fs.promises.rename(temp,file);return state;
 };
 saveChain=saveChain.catch(()=>{}).then(write);return saveChain;
}
// A browser-verified, previously-linked provider can unlock this workspace.
// This is NOT an account-linking or new-user enrollment bypass.
async function verifiedAccountUnlock(){
 if(!fs.existsSync(pinPath()))throw new Error('Create an EAGLE RS master passphrase before linking an external account.');
 if(Date.now()<lockedUntil)throw new Error('Security lockout is active. Please wait.');
 authorized=true;failedAttempts=0;lastActivityAt=Date.now();
 try{win?.webContents?.send('app:unlocked')}catch{}
}
// Optional Microsoft account verification and OneDrive settings backup. No Resend or SMTP key.
// A developer must register and configure the public Microsoft client ID before release.
const microsoftRecovery=createMicrosoftRecovery({app,safeStorage,readState:loadAsync,writeState:saveAsync,requireUnlocked,
  passwordMatches,isUnlocked:()=>authorized,onVerifiedUnlock:verifiedAccountUnlock,shell,resetPin:async pass=>{
   if(!acceptablePass(pass))return {ok:false,message:'Use a new master passphrase of at least 8 characters.'};
   const {record,codes}=await updatedPinRecord(pass);await writePin(record);failedAttempts=0;appLock();
   return {ok:true,codes,message:'Microsoft account verified. Your master passphrase was reset without deleting messaging partitions. Save the new recovery codes.'};
  }});

// Optional publisher-registered Google OAuth Desktop flow. No client secret is embedded.
const googleRecovery=createGoogleRecovery({app,safeStorage,shell,requireUnlocked,passwordMatches,
  isUnlocked:()=>authorized,onVerifiedUnlock:verifiedAccountUnlock,resetPin:async pass=>{
   if(!acceptablePass(pass))return {ok:false,message:'Use at least 8 characters for your new master passphrase.'};
   const {record,codes}=await updatedPinRecord(pass);await writePin(record);failedAttempts=0;appLock();
   return {ok:true,codes,message:'Your master passphrase was reset. Save your new recovery codes.'};
  }});

async function storageStatus(){
 const root=app.getPath('userData'),records=await loadAsync();
 const accounts=records.accounts.map(a=>({id:a.id,partition:a.partition})).concat(records.telegramAccounts.map(a=>({id:a.id,partition:a.partition})));
 const partitions=accounts.map(a=>{
  try{const ses=session.fromPartition(a.partition);const store=ses.getStoragePath?.()||'';return {...a,hasDiskStore:!!(store&&fs.existsSync(store))};}catch{return {...a,hasDiskStore:false}}
 });
 return {root,encryptedConfig:fs.existsSync(secureStatePath()),secureAvailable:canProtectConfig(),backupExists:fs.existsSync(secureBackupPath())||fs.existsSync(backupPath()),accounts:partitions,
  message:'Web session data is stored under Electron Chromium profiles. API credentials/config are separately encrypted; web session stores are NOT automatically all AES-256 encrypted. Preserve these partitions and your Windows profile. The provider can expire/revoke any login.'};
}
function allowedMessagingURL(raw){try{const u=new URL(raw);return u.protocol==='https:' && ['web.whatsapp.com','web.telegram.org'].includes(u.hostname)}catch{return false}}
function chromeUA(){return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;}
function show(){if(!win || win.isDestroyed())return;win.show();if(win.isMinimized())win.restore();win.focus();}
async function applySecurityPreferences(s){
 if(!win || win.isDestroyed())return;
 // Best-effort native Windows capture protection. Not a substitute for BitLocker or device security.
 if(typeof win.setContentProtection==='function')win.setContentProtection(Boolean(s?.ui?.captureGuard));
}
function create(){
 win=new BrowserWindow({width:1600,height:970,minWidth:1110,minHeight:700,title:'EAGLE RS COMPANY (Kings 2) | Screenshot Chat & Translation v3.25.0',
  icon:path.join(__dirname,'eagle-rs.ico'),backgroundColor:APP_BG,autoHideMenuBar:true,
  webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:true,backgroundThrottling:false}});
 win.on('close',e=>{if(!isQuitting && tray && !tray.isDestroyed()){e.preventDefault();appLock();win.hide();}});
 win.on('hide',()=>appLock());
 // Optional extra lock for shared workspaces: the app locks when focus moves away.
 win.on('blur',async()=>{if(!authorized)return;try{const s=await loadAsync();if(authorized && s.ui?.lockOnBlur)appLock();}catch(error){console.warn('Focus-lock preference read failed:',error.message);}});
 // Keyboard shortcut works when the workspace shell (not an embedded provider) has focus.
 win.webContents.on('before-input-event',(e,key)=>{if(key.control&&key.shift&&key.key?.toLowerCase()==='l'&&key.type==='keyDown'){e.preventDefault();appLock();}});
 void loadAsync().then(applySecurityPreferences).catch(error=>console.warn('Capture-protection preference unavailable:',error.message));
 win.on('show',()=>{if(hadWindowShown)appLock();hadWindowShown=true;});
 win.webContents.session.webRequest.onHeadersReceived((details,cb)=>{
  if(details.webContentsId!==win.webContents.id)return cb({responseHeaders:details.responseHeaders});
  cb({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src https://web.whatsapp.com https://web.telegram.org; object-src 'none'; frame-ancestors 'none'"]}});
 });
 win.loadFile(path.join(__dirname,'index.html'));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL())event.preventDefault();});
 win.webContents.on('will-attach-webview',(event,prefs,params)=>{
  const wa=/^persist:(mm3-wa-|wa_session_|whatsapp_session_)[1-9]\d*$/.test(params.partition||'');
  const tg=/^persist:tg_session_[1-9]\d*$/.test(params.partition||'');
  const expectedHost=wa?'web.whatsapp.com':tg?'web.telegram.org':'';
  if(tg || !allowedMessagingURL(params.src||'') || new URL(params.src).hostname!==expectedHost){event.preventDefault();return;}
  delete prefs.preload; prefs.nodeIntegration=false;prefs.contextIsolation=true;prefs.sandbox=true;prefs.webSecurity=true;prefs.backgroundThrottling=false;
  const ses=session.fromPartition(params.partition); // persist: guarantees Chromium-backed persistent session on disk
  ses.setUserAgent(chromeUA());
  // Never invoke clearStorageData, clearCache, flushStorageData or partition deletion automatically.
  // Web notifications originate from the messaging provider, NOT from our manual call log.
  // Only approved HTTPS origins may request the notifications permission, and only when opted in.
  ses.setPermissionRequestHandler((contents,permission,cb,details)=>{
   const requestURL=details?.requestingUrl||contents?.getURL?.()||'';
   cb(allowProviderNotification(permission,requestURL,expectedHost,providerNotificationsEnabled));
  });
  ses.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>
   allowProviderNotification(permission,requestingOrigin||details?.requestingUrl||contents?.getURL?.()||'',expectedHost,providerNotificationsEnabled));

 });
}
function createTray(){
 try{
  tray=new Tray(path.join(__dirname,'theme-assets',`tray-${currentArtworkTheme}.ico`));
  tray.setToolTip('EAGLE RS COMPANY (Kings 2)');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Open EAGLE RS Workspace',click:show},{type:'separator'},{label:'Quit EAGLE RS (stop reminders)',click:()=>{isQuitting=true;app.quit()}}]));
  tray.on('double-click',show);
 }catch(err){console.warn('Tray not available:',err.message)}
}
// Visual themes are allowlisted and only control the app/tray/toast artwork.
// The Windows app identity and persistent partitions are never modified.
const artworkThemes=new Set(['obsidian-gold','chatgpt-slate','pitch-black','titanium-silver','emerald-green','royal-sapphire']);
let currentArtworkTheme='obsidian-gold';
function updateNativeArtwork(theme){
 const next=artworkThemes.has(theme)?theme:'obsidian-gold';
 if(currentArtworkTheme===next)return;
 currentArtworkTheme=next;
 if(tray && !tray.isDestroyed()){
  try{tray.setImage(path.join(__dirname,'theme-assets',`tray-${next}.ico`));}
  catch(error){console.warn('Could not update tray artwork:',error.message)}
 }
}
function notificationArtwork(){return path.join(__dirname,'theme-assets',`notification-${currentArtworkTheme}.png`);}
const lastBackgroundAlert=new Map();
function showNotification(_event,args){
 if(!Notification.isSupported() || !args || typeof args.title!=='string' || typeof args.body!=='string')return {ok:false};
 const accountId=/^(wa|tg)-[1-9]\d*$/.test(args.accountId)?args.accountId:null;
 // When locked, accept only a generic per-account message alert from the trusted UI.
 // Do NOT display a sender, message excerpt, or caller-supplied text on the lock screen.
 if(!authorized && !accountId)return {ok:false,message:'Unlock to send a manual test notification.'};
 let title=args.title.slice(0,90),body=args.body.slice(0,240);
 if(!authorized){
  const previous=lastBackgroundAlert.get(accountId)||0;
  if(Date.now()-previous<30000)return {ok:false,message:'Alert rate limited'};
  lastBackgroundAlert.set(accountId,Date.now());
  title=`EAGLE RS · ${accountId.startsWith('wa-')?'WhatsApp':'Telegram'} ${accountId.slice(3)}`;
  body='New unread activity. Unlock EAGLE RS to review this profile.';
 }
 const n=new Notification({title,body,silent:!args.sound,icon:notificationArtwork()});
 n.on('click',()=>{show();if(accountId&&authorized)win.webContents.send('app:open-account',accountId);});n.show();return {ok:true};
}
// Customer reply reminders are based on tasks the operator creates, not on
// reading private WhatsApp chat content. They run from the main process even
// when the application window is hidden in the Windows notification area.
let reminderTickActive=false;
async function replyQueueTick(){
 if(reminderTickActive)return;reminderTickActive=true;
 try{
  const s=await loadAsync(),now=Date.now(),due=s.reminders.filter(r=>!r.done&&r.due<=now);
 const reminderSource=id=>{if(/^signal-\d+$/.test(id||'')){const slot=s.signalSlots.find(x=>String(x.id)===id.slice(7));return {platform:'Signal',name:slot?.name||'Signal account'};}const a=[...s.accounts,...s.telegramAccounts].find(x=>x.id===id);return {platform:id?.startsWith('tg-')?'Telegram':'WhatsApp',name:a?.name||'Account'};};
  if(tray && !tray.isDestroyed())tray.setToolTip(`EAGLE RS COMPANY (Kings 2) — ${due.length} due reply reminders`);
  let changed=false;
  for(const r of due){
   if(!authorized || r.nextNotifyAt>now || !s.prefs.desktop || !Notification.isSupported())continue;
   {
    const account=reminderSource(r.accountId);
    const n=new Notification({title:`${account.platform} · ${account.name} · Reply reminder`.slice(0,90),body:`${r.contact||'Your contact'} — ${r.title}`.slice(0,220),silent:!s.prefs.sound,icon:notificationArtwork()});
    n.on('click',()=>{show();if(win&&!win.isDestroyed())win.webContents.send('app:open-reply-queue',r.id,r.accountId);});
    n.show();
   }
   r.lastNotified=now;
   r.nextNotifyAt=r.repeatMinutes>0 ? now+r.repeatMinutes*60000 : 8640000000000000;
   changed=true;
  }
  if(changed){await saveAsync(s);if(authorized && win && !win.isDestroyed())win.webContents.send('app:queue-updated');}
 }catch(err){console.warn('Reminder check error:',err.message)}finally{reminderTickActive=false;}
}
function readApiKey(){
 if(sessionKey)return sessionKey;
 try{
  if(safeStorage.isEncryptionAvailable() && fs.existsSync(keyPath())){
   const key=safeStorage.decryptString(fs.readFileSync(keyPath())).trim();
   if(/^[\x21-\x7e]{18,512}$/.test(key)){sessionKey=key;return key;}
  }
 }catch{}
 return '';
}
function storeApiKey(value){
 if(typeof value!=='string' || (value.trim() && !/^[\x21-\x7e]{18,512}$/.test(value.trim())))return {ok:false,message:'Enter your Google AI Studio API key (without spaces).'};
 const key=value.trim();
 if(!key){
  try{fs.rmSync(keyPath(),{force:true});sessionKey='';return {ok:true,stored:false};}
  catch{return {ok:false,message:'The saved API key could not be removed. Close other workspace instances and try again.'};}
 }
 if(!safeStorage.isEncryptionAvailable()){
  sessionKey=key;return {ok:true,stored:false,message:'Key will remain in memory for this session only. Encrypted storage is not available.'};
 }
 const temporary=keyPath()+'.new-'+crypto.randomBytes(6).toString('hex');
 try{
  fs.mkdirSync(app.getPath('userData'),{recursive:true});
  fs.writeFileSync(temporary,safeStorage.encryptString(key),{mode:0o600,flag:'wx'});
  fs.renameSync(temporary,keyPath());sessionKey=key;
  return {ok:true,stored:true};
 }catch{return {ok:false,message:'Secure API key storage failed. Your previous key was kept. Please try again.'};}
 finally{try{fs.rmSync(temporary,{force:true})}catch{}}
}
function removeOldOpenAIKey(){
 try { fs.rmSync(oldKeyPath(),{force:true}); return {ok:true}; }
 catch(err){ return {ok:false,message:'Unable to delete old OpenAI key: '+err.message}; }
}
// All provider requests and API keys stay in the trusted Electron main process.
const geminiAssistant=createGeminiAssistant({nativeImage});
async function aiProcess(_event,args){
 const result=await geminiAssistant.run(args,readApiKey());
 // A request can finish while the workspace is locked. Never deliver its draft then.
 requireUnlocked();
 return result;
}
function findSignalExe(){
 if(process.platform!=='win32')return null;
 const loc=process.env.LOCALAPPDATA||'',pf=process.env.PROGRAMFILES||'',pf86=process.env['PROGRAMFILES(X86)']||'';
 const candidates=[path.join(loc,'Programs','signal-desktop','Signal.exe'),path.join(loc,'Programs','Signal','Signal.exe'),path.join(pf,'Signal','Signal.exe'),path.join(pf86,'Signal','Signal.exe')];
 return candidates.find(p=>path.isAbsolute(p) && fs.existsSync(p))||null;
}
async function launchSignal(_event,id){
 const slot=Number(id);if(!Number.isSafeInteger(slot)||slot<1||slot>10000)return {ok:false,message:'Invalid Signal launcher number.'};
 if(process.platform!=='win32')return {ok:false,message:'Signal Desktop is Windows-only in this launcher.'};
 const exe=findSignalExe();if(!exe)return {ok:false,message:'Signal Desktop not found. Install it from signal.org/download.'};
 const legacy=path.join(app.getPath('appData'),'EAGLE-RS-Signal-Profiles',`Signal-${slot}`);
 const dir=slot===1?null:(fs.existsSync(legacy)?legacy:path.join(app.getPath('userData'),'signal-sessions',`sig_${slot}`));
 try{
  if(dir)await fs.promises.mkdir(dir,{recursive:true});
  const child=spawn(exe,dir?[`--user-data-dir=${dir}`]:[],{detached:false,stdio:'ignore',windowsHide:false});
  const result=await new Promise(resolve=>{child.once('error',err=>resolve({ok:false,message:err.message}));child.once('spawn',()=>resolve({ok:true}))});
  if(result.ok){trackedSignal.set(slot,child);child.once('exit',()=>{if(trackedSignal.get(slot)===child)trackedSignal.delete(slot)});}
  return result.ok?{ok:true,message:slot===1?'Opened official Signal Desktop.':`Attempted Signal ${slot}. Check that it opens a DIFFERENT QR code; multiple independent Signal profiles are unsupported and may redirect to the existing account.`}:result;
 }catch(err){return {ok:false,message:'Signal launch failed: '+err.message};}
}
async function stopSignal(slot){
 const n=Number(slot),child=trackedSignal.get(n);
 if(!child || child.exitCode!==null || !child.pid)return {ok:false,message:'No Signal launcher process under EAGLE RS control for this slot. Existing Signal Desktop may still be running.'};
 try{child.kill();trackedSignal.delete(n);return {ok:true,message:'Stop requested for the tracked Signal launcher only; Signal Desktop can keep a separate existing process running.'}}
 catch(e){return {ok:false,message:'Could not stop Signal launcher: '+e.message}}
}
async function stopAllSignal(){const ids=[...trackedSignal.keys()];const results=await Promise.all(ids.map(id=>stopSignal(id)));return {ok:true,requested:ids.length,stopped:results.filter(r=>r.ok).length,message:'Stopped only tracked launcher processes. This does not forcibly terminate unrelated or pre-existing Signal Desktop windows.'};}
async function telegramDesktop(){
 if(process.platform!=='win32')return {ok:false,message:'Native Telegram launcher is supported on Windows.'};
 try{await shell.openExternal('tg://');return {ok:true,message:'Sent Telegram Desktop launch request.'}}
 catch(e){const loc=process.env.APPDATA||'',exe=path.join(loc,'Telegram Desktop','Telegram.exe');if(fs.existsSync(exe)){try{const child=spawn(exe,[],{detached:true,stdio:'ignore'});child.unref();return {ok:true,message:'Telegram Desktop launched.'};}catch{}}
 return {ok:false,message:'Telegram Desktop could not be opened. Install official Telegram Desktop and register the tg:// link handler.'};}
}

// Read-only Windows drive encryption check: NEVER alters protectors, volumes, or recovery keys.
async function getDriveEncryptionStatus(){
 if(process.platform!=='win32')return {ok:false,message:'Windows Device Encryption check is available only on Windows.'};
 const systemRoot=process.env.SystemRoot||'C:\\Windows';
 const binary=path.join(systemRoot,'System32','manage-bde.exe');
 const drives=[String(process.env.SystemDrive||'C:').slice(0,2)];
 if(fs.existsSync('D:\\')&&!drives.includes('D:'))drives.push('D:');
 async function inspect(drive){
  return new Promise(resolve=>execFile(binary,['-status',drive],{timeout:12000,windowsHide:true,maxBuffer:65536},(error,stdout,stderr)=>{
   const output=String(stdout||'')+'\n'+String(stderr||'');
   if(error)return resolve({drive,protected:null,status:'Unknown (check Windows Settings)'});
   const lines=output.split(/\r?\n/);
   const protectorLine=lines.find(l=>/^\s*Protection Status\s*:/i.test(l));
   const conversionLine=lines.find(l=>/^\s*Conversion Status\s*:/i.test(l));
   const protector=(protectorLine||'').split(':').slice(1).join(':').trim();
   const conversion=(conversionLine||'').split(':').slice(1).join(':').trim();
   const on=/Protection On/i.test(protector)&&/Fully Encrypted/i.test(conversion);
   const off=/Protection Off/i.test(protector)||/Fully Decrypted/i.test(conversion);
   return resolve({drive,protected:on?true:off?false:null,status:on?'Encrypted · protection on':off?'Not fully protected':'Unverified — check Windows Settings'});
  }));
 }
 return {ok:true,drives:await Promise.all(drives.map(inspect))};
}
async function openEncryptionSettings(target){
 if(process.platform!=='win32')return {ok:false,message:'These settings require Windows.'};
 if(target==='device'){
  try{await shell.openExternal('ms-settings:deviceencryption');return {ok:true}}catch{return {ok:false,message:'Open Windows Settings → Privacy & security → Device encryption.'}}
 }
 if(target==='bitlocker'){
  try{const child=spawn('control.exe',['/name','Microsoft.BitLockerDriveEncryption'],{detached:true,stdio:'ignore',windowsHide:false});child.unref();return {ok:true}}
  catch{return {ok:false,message:'Search Windows Start for Manage BitLocker. Feature availability depends on Windows edition.'}}
 }
 return {ok:false,message:'Unsupported Windows security setting.'};
}

function trustedHandle(channel,callback){
 ipcMain.handle(channel,(event,...args)=>{
  if(!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)
   throw new Error('Rejected untrusted application request');
  return callback(event,...args);
 });
}
app.whenReady().then(async()=>{
 if(!hasInstanceLock)return;
 app.setAppUserModelId('com.eaglers.workspace');authorized=false;
 void loadAsync().then(s=>{providerNotificationsEnabled=false;updateNativeArtwork(s.ui?.themeId);}).catch(err=>console.warn('Provider notification preference unavailable:',err.message));
 // Security: every main-process IPC handler is sender-validated.
 app.on('web-contents-created',(_e,contents)=>{
  if(contents.getType()==='webview')contents.setWindowOpenHandler(()=>({action:'deny'}));
 });
 session.defaultSession.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));
 trustedHandle('security:disk-status',()=>{requireUnlocked();return getDriveEncryptionStatus()});
 trustedHandle('security:open-encryption',(_e,target)=>{requireUnlocked();if(!['bitlocker','device'].includes(target))throw new Error('Unsupported encryption settings');return openEncryptionSettings(target)});
 trustedHandle('security:status',async()=>{
  // Only disclose an allowlisted presentation preference while locked.
  // Decryption occurs inside the main process and account data is never returned here.
  let themeId='obsidian-gold',ambientMotion=true;
  try{const data=await loadAsync();themeId=data.ui.themeId;ambientMotion=data.ui.ambientMotion!==false;}catch(error){console.warn('Visual preferences unavailable while locked:',error.message);}
  return {...lockInfo(),themeId,ambientMotion};
 });
 trustedHandle('security:unlock',(_e,pass)=>unlock(pass));
 trustedHandle('security:set-pin',(_e,pass)=>setPassphrase(pass));
 trustedHandle('security:recovery-status',()=>recoveryStatus());
 trustedHandle('security:recovery-code',(_e,code,next)=>useRecoveryCode(code,next));
 trustedHandle('security:recovery-rotate',(_e,pass)=>rotateRecoveryCodes(pass));
 trustedHandle('security:email-enroll',(_e,args)=>emailEnroll(args));
 trustedHandle('security:email-confirm',(_e,code)=>emailConfirm(code));
 trustedHandle('security:email-request',()=>requestEmailRecovery());
 trustedHandle('security:email-reset',(_e,code,next)=>emailReset(code,next));
 trustedHandle('security:email-revoke',(_e,pass)=>revokeEmailRecovery(pass));
 trustedHandle('security:google-status',()=>googleRecovery.status(!authorized));
 trustedHandle('security:google-begin',(_e,purpose,pass)=>googleRecovery.begin(purpose,pass));
 trustedHandle('security:google-reset',(_e,newPass)=>googleRecovery.reset(newPass));
 trustedHandle('security:microsoft-status',()=>microsoftRecovery.accountStatus(!authorized));
 trustedHandle('security:microsoft-open-signin',()=>microsoftRecovery.openSignIn());
 trustedHandle('security:microsoft-open-registration',()=>{requireUnlocked();return shell.openExternal('https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app').then(()=>({ok:true}));});
 trustedHandle('security:microsoft-configure',(_e,id,pass)=>microsoftRecovery.configureClientId(id,pass));
 trustedHandle('security:microsoft-begin',(_e,purpose,pass)=>microsoftRecovery.begin(purpose,pass));
 trustedHandle('security:microsoft-reset',(_e,nextPass)=>microsoftRecovery.finishRecovery(nextPass));
 trustedHandle('security:outlook-email-status',()=>microsoftRecovery.emailRecoveryStatus());
 trustedHandle('security:outlook-email-request',()=>microsoftRecovery.requestEmailCode());
 trustedHandle('security:outlook-email-reset',(_e,code,nextPass)=>microsoftRecovery.finishEmailReset(code,nextPass));
  trustedHandle('security:microsoft-cancel',()=>microsoftRecovery.cancel());
 trustedHandle('security:microsoft-disconnect',(_e,pass)=>microsoftRecovery.disconnect(pass));
 trustedHandle('security:microsoft-backup-now',()=>microsoftRecovery.uploadBackup());
 trustedHandle('security:microsoft-backup-preview',()=>microsoftRecovery.backupPreview());
 trustedHandle('security:microsoft-backup-restore',()=>microsoftRecovery.restoreBackup());
 trustedHandle('security:microsoft-autobackup',(_e,on)=>microsoftRecovery.setAutoBackup(on));
 trustedHandle('security:lock',()=>{appLock();return lockInfo();});
 trustedHandle('activity:ping',()=>{if(authorized)lastActivityAt=Date.now();return {ok:true};});
 powerMonitor.on('lock-screen',appLock);powerMonitor.on('suspend',appLock);
 trustedHandle('state:load',()=>{requireUnlocked();return loadAsync()});trustedHandle('state:save',async(_e,s)=>{requireUnlocked();const saved=await saveAsync(s);providerNotificationsEnabled=false;updateNativeArtwork(saved.ui?.themeId);await applySecurityPreferences(saved);setTimeout(replyQueueTick,50);microsoftRecovery.scheduleBackup();return saved;});
 trustedHandle('storage:status',()=>{requireUnlocked();return storageStatus()});
 trustedHandle('storage:open',()=>{requireUnlocked();return shell.openPath(app.getPath('userData'))});
 trustedHandle('session:verify',(_e,partition)=>{requireUnlocked();
  if(typeof partition!=='string'||!/^persist:(mm3-wa-|wa_session_|whatsapp_session_|tg_session_)[1-9]\d*$/.test(partition))return {ok:false,message:'Invalid session partition'};
  try{const s=session.fromPartition(partition);return {ok:true,persistent:true,path:typeof s.getStoragePath==='function'?s.getStoragePath():null}}catch(e){return {ok:false,message:e.message}}
 });
 trustedHandle('signal:dock-list',()=>{requireUnlocked();return signalDock.list()});
 trustedHandle('signal:dock-attach',async(_e,id,handle)=>{requireUnlocked();const s=await loadAsync();if(!s.signalSlots.some(x=>x.id===Number(id)))return {ok:false,message:'Unknown Signal account.'};return signalDock.attach(id,handle)});
 trustedHandle('signal:dock-show',(_e,id,rect)=>{requireUnlocked();return signalDock.show(id,rect)});
 trustedHandle('signal:dock-hide',()=>signalDock.hide());
 trustedHandle('signal:dock-detach',(_e,id)=>{requireUnlocked();return signalDock.detach(id)});
 trustedHandle('signal:status',(_e,id)=>{requireUnlocked();const n=Number(id),proc=trackedSignal.get(n);const legacy=path.join(app.getPath('appData'),'EAGLE-RS-Signal-Profiles',`Signal-${n}`);return {running:!!(proc&&proc.exitCode===null&&proc.pid),pid:proc?.pid||null,profileDirectory:n===1?'Official Signal default profile':fs.existsSync(legacy)?legacy:path.join(app.getPath('userData'),'signal-sessions',`sig_${n}`)};});
 trustedHandle('signal:relaunch',async(e,id)=>{requireUnlocked();await stopSignal(id);return launchSignal(e,id);});
 trustedHandle('signal:stop',(_e,id)=>{requireUnlocked();return stopSignal(id)});
 trustedHandle('signal:stop-all',()=>{requireUnlocked();return stopAllSignal()});
 trustedHandle('signal:soft-reset',async()=>{const result=await stopAllSignal();return {...result,message:'Launcher tracking reset. No Signal account files or login data were deleted.'};});
 trustedHandle('telegram:desktop',()=>{requireUnlocked();return {ok:false,message:'Telegram has been removed from this workspace.'}});
 trustedHandle('whatsapp:desktop',async()=>{requireUnlocked();try{await shell.openExternal('whatsapp://');return {ok:true}}catch(err){return {ok:false,message:err.message}}});
 trustedHandle('signal:launch',(e,id)=>{requireUnlocked();return launchSignal(e,id)});
 trustedHandle('alerts:notify',(e,opt)=>{requireUnlocked();return showNotification(e,opt)});
 trustedHandle('ai:status',()=>{requireUnlocked();return {hasKey:!!readApiKey(),secureAvailable:safeStorage.isEncryptionAvailable()}});
 trustedHandle('ai:set-key',(_e,value)=>{requireUnlocked();return storeApiKey(value)});
 trustedHandle('ai:remove-old-key',()=>{requireUnlocked();return removeOldOpenAIKey()});
 trustedHandle('ai:run',(e,args)=>{requireUnlocked();return aiProcess(e,args)});
 trustedHandle('chat:capture',createChatCapture({webContents:require('electron').webContents,getWindow:()=>win,requireUnlocked}));
 trustedHandle('external:open',(_e,target)=>{requireUnlocked();
  if(target==='signal')return shell.openExternal('https://signal.org/download/');
  if(target==='apikey')return shell.openExternal('https://aistudio.google.com/app/apikey');
  if(target==='pricing')return shell.openExternal('https://ai.google.dev/gemini-api/docs/pricing');
  if(target==='googletranslate')return shell.openExternal('https://translate.google.com/');
 });
 // One-time metadata migration (never copies, wipes or renames Chromium web session directories).
 try{
  if(canProtectConfig()&&!fs.existsSync(secureStatePath())&&(fs.existsSync(statePath())||fs.existsSync(backupPath())))
   await saveAsync(await readLegacy());
 }catch(error){console.warn('Account configuration migration deferred; old settings were not deleted:',error.message)}
 create();createTray();idleClock=setInterval(async()=>{if(!authorized)return;const ms=(await idleHours())*3600000;const osIdle=Math.max(0,powerMonitor.getSystemIdleTime())*1000;if(Date.now()-lastActivityAt>=ms||osIdle>=ms)appLock();},30000);reminderTimer=setInterval(replyQueueTick,15000);setTimeout(replyQueueTick,1500);app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)create()});
});
let dockQuitReady=false;
app.on('before-quit',event=>{if(!dockQuitReady){event.preventDefault();void signalDock.stop().finally(()=>{dockQuitReady=true;app.quit()});return;}isQuitting=true;if(reminderTimer)clearInterval(reminderTimer);if(idleClock)clearInterval(idleClock)});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
