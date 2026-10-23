'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createMicrosoftRecovery,encryptCloudState,decryptCloudState,validClientId}=require('./microsoft-recovery');
(async()=>{
 assert(!validClientId(''));assert(validClientId('8b7eaf34-9c31-4764-8e2d-20f975f53e11'));
 const id='alice-microsoft-id';
 const key=crypto.randomBytes(32),payload={createdAt:'2026-10-16',state:{accounts:[{id:'wa-1',name:'Personal'}]}};
 const sealed=encryptCloudState(payload,key,id);
 assert(!JSON.stringify(sealed).includes('Personal'));
 assert.deepEqual(decryptCloudState(sealed,key,id),payload);
 assert.throws(()=>decryptCloudState(sealed,key,'different-user'));
 assert.throws(()=>decryptCloudState({...sealed,data:'bad'},key,id));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eagle-ms-test-'));
 const oldFetch=global.fetch;
 const cloud=new Map();let currentMicrosoftId=id,userEmail='owner@hotmail.com',unlocked=true,resetCount=0,saveCount=0,unlockCount=0;
 const sampleState={accounts:[{id:'wa-1',name:'Personal'},{id:'wa-22',name:'Family'}],telegramAccounts:[{id:'tg-1',name:'Telegram 1'}],signalSlots:[{id:1,name:'Signal 1'}],reminders:[{id:'rem-1',title:'Call'}],missedCalls:[],templates:[],ui:{themeId:'obsidian-gold'}};
 let savedState=structuredClone(sampleState);
 const mk=(status,obj)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(obj)});
 global.fetch=async(url,opts={})=>{
  const u=String(url);if(u.endsWith('/devicecode'))return mk(200,{device_code:'fake-device-code',user_code:'ABCD-EFGH',verification_uri:'https://microsoft.com/devicelogin',interval:5,expires_in:900});
  if(u.endsWith('/token'))return mk(200,{access_token:'fake-access-token',refresh_token:'fake-refresh-token',expires_in:3600});
  if(u.includes('/me?$select='))return mk(200,{id:currentMicrosoftId,mail:userEmail,displayName:'Example'});
  if(u.endsWith('/me/drive/special/approot'))return mk(200,{id:'app-folder'});
  if(u.includes('/approot:/')){
   if(opts.method==='PUT'){const body=JSON.parse(opts.body);cloud.set(u,body);return mk(201,body);}
   return cloud.has(u)?mk(200,cloud.get(u)):mk(404,{error:'itemNotFound'});
  }
  throw new Error('Unexpected network endpoint '+u);
 };
 const safeStorage={isEncryptionAvailable:()=>true,encryptString:val=>Buffer.from('SEALED:'+Buffer.from(val).toString('base64')),decryptString:val=>Buffer.from(String(val).slice(7),'base64').toString()};
 const dependencies={app:{getPath:()=>root},safeStorage,readState:async()=>savedState,
  writeState:async state=>{savedState=state;saveCount++},requireUnlocked:()=>{if(!unlocked)throw new Error('locked')},
  passwordMatches:async pass=>pass==='Current secure passphrase',isUnlocked:()=>unlocked,onVerifiedUnlock:async()=>{unlocked=true;unlockCount++},
  resetPin:async pass=>{resetCount++;return {ok:pass.length>=8,codes:['ERS-TEST-CODE'],message:'Reset'}},
  wait:async()=>new Promise(resolve=>setImmediate(resolve)),logger:{warn(){}}};
 const tick=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setTimeout(resolve,15));};
 try{
  const unavailable=createMicrosoftRecovery({...dependencies,configuredClientId:''});
  assert.equal((await unavailable.begin('link','Current secure passphrase')).ok,false);
  assert.equal(fs.existsSync(path.join(root,'microsoft-linked-account.dpapi')),false);
  const ms=createMicrosoftRecovery({...dependencies,configuredClientId:'8b7eaf34-9c31-4764-8e2d-20f975f53e11'});
  assert.equal((await ms.begin('link','wrong password')).ok,false);
  const started=await ms.begin('link','Current secure passphrase');assert(started.ok);assert.equal(started.userCode,'ABCD-EFGH');
  await tick();assert.equal((await ms.accountStatus(false)).linked,true);
  assert(!fs.readFileSync(path.join(root,'microsoft-linked-account.dpapi'),'utf8').includes('owner@hotmail.com'));
  assert.equal((await ms.accountStatus(true)).account,undefined,'Do not leak linked email while locked');
  const backed=await ms.uploadBackup();assert(backed.ok,backed.message);
  const preview=await ms.backupPreview();assert(preview.ok,preview.message);assert.equal(preview.whatsapp,2);
  const stored=Array.from(cloud.values()).find(x=>x.format==='EAGLE-RS-OneDrive-Settings-AES-256-GCM');
  assert(stored && !JSON.stringify(stored).includes('Personal'));
  // Restore merges settings; does not erase local profiles or touch login partitions.
  savedState={...sampleState,accounts:[{id:'wa-1',name:'Current local account'}],reminders:[],telegramAccounts:[],signalSlots:[]};
  const rest=await ms.restoreBackup();assert(rest.ok,rest.message);assert.equal(saveCount,1);
  assert.equal(savedState.accounts[0].name,'Current local account');assert(savedState.accounts.some(a=>a.id==='wa-22'));
  assert(savedState.telegramAccounts.some(x=>x.id==='tg-1'));assert(savedState.reminders.some(x=>x.id==='rem-1'));
  unlocked=false;currentMicrosoftId='attacker-id';
  assert((await ms.begin('recover')).ok);await tick();
  assert.equal((await ms.accountStatus(true)).flow.phase,'failed');
  assert.equal((await ms.finishRecovery('New secure passphrase')).ok,false);assert.equal(resetCount,0);
  currentMicrosoftId=id;assert((await ms.begin('recover')).ok);await tick();
  assert.equal((await ms.accountStatus(true)).verifiedRecovery,true);
  assert.equal((await ms.finishRecovery('New secure passphrase')).ok,true);assert.equal(resetCount,1);
  assert.equal((await ms.finishRecovery('Another secure passphrase')).ok,false,'Microsoft recovery can be used once');
  unlocked=false;currentMicrosoftId='intruder-id';assert((await ms.begin('unlock')).ok);await tick();
  assert.equal(unlockCount,0,'Wrong Microsoft account cannot unlock EAGLE RS');
  currentMicrosoftId=id;assert((await ms.begin('unlock')).ok);await tick();
  assert.equal(unlockCount,1,'Previously linked Microsoft account can unlock once verified');
  assert.equal(unlocked,true);
  const disconnected=await ms.disconnect('Current secure passphrase');assert(disconnected.ok);
  assert.equal((await ms.accountStatus(false)).linked,false);
  assert(cloud.size>=2,'Unlinking does not delete OneDrive backups');
  console.log('EAGLE RS v3.19 Microsoft device authorization, same-account reset, no password bypass, OneDrive AES-GCM settings snapshots, safe restore merge, and DPAPI identity tests passed.');
 }finally{global.fetch=oldFetch;fs.rmSync(root,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1});
