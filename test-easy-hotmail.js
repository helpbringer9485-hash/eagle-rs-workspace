'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createMicrosoftRecovery}=require('./microsoft-recovery');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('renderer.js','utf8');
const main=fs.readFileSync('main.js','utf8');
const config=JSON.parse(fs.readFileSync('microsoft-auth-config.json','utf8'));
const pkg=require('./package.json');
assert.equal(pkg.version,'3.25.0');
assert.match(config.clientId,/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i);
for(const id of ['microsoftQuickRecover','microsoftLink','microsoftMasterPass','microsoftLinkedBadge','microsoftManageDetails','microsoftBackupDetails','microsoftRecoverStart'])assert(html.includes(`id="${id}"`),'Missing '+id);
assert.match(html,/Recover with Microsoft/);
assert.match(html,/Link my Hotmail \/ Outlook/);
assert.match(html,/Cloud backup|settings to OneDrive/i);
assert.match(js,/microsoftQuickRecover'\)\.onclick=/);
assert.match(js,/startMicrosoftFlow\('recover'\)/);
assert.match(js,/await window\.desktop\.microsoftBegin\(purpose,pass\)/);
assert.match(js,/microsoftDisconnect\(\$\('microsoftMasterPass'\)\.value\)/,'Unlink must check adjacent master passphrase');
assert.match(main,/security:microsoft-status/);
assert.match(main,/security:microsoft-begin/);
assert.match(main,/persist:tg_session_/);
assert.doesNotMatch(main,/clearStorageData\(/);
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eagle-v320-'));
 try{
  const app={getPath:()=>root};
  const recovery=createMicrosoftRecovery({app, safeStorage:{isEncryptionAvailable:()=>true, encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()},readState:async()=>({accounts:[]}),writeState:async()=>{},requireUnlocked:()=>{},passwordMatches:async p=>p==='master-password',resetPin:async()=>({ok:true})});
  const state=await recovery.accountStatus();
  assert.equal(state.available,true,'Client ID should be preconfigured for the owner');
  assert.equal(state.developerSetupRequired,false,'No registration screen should be shown to owner');
  assert.equal(state.linked,false,'Do not claim a linked Hotmail account before verification');
  assert.equal((await recovery.begin('link','wrong-password')).ok,false,'Must confirm master password when linking recovery');
  assert(!fs.existsSync(path.join(root,'microsoft-linked-account.dpapi')),'Do not create unverified linked identity');
  console.log('Easy Hotmail v3.20: preconfigured public ID, simplified UI, same-account recovery flow, no auth bypass, and untouched session partition checks passed.');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1});
