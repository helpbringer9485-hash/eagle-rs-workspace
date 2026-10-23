'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createMicrosoftRecovery}=require('./microsoft-recovery');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eagle-public-id-'));
 let unlocked=true;
 const expected='8b7eaf34-9c31-4764-8e2d-20f975f53e11';
 const app={getPath:()=>root};
 const base={app,safeStorage:{isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()},readState:async()=>({accounts:[]}),writeState:async()=>{},requireUnlocked:()=>{if(!unlocked)throw Error('Locked')},passwordMatches:async pass=>pass==='right master password',resetPin:async()=>({ok:true})};
 try{
  const feature=createMicrosoftRecovery(base);
  assert.equal((await feature.accountStatus()).available,true,'Bundled publisher ID should be available');
  assert.equal((await feature.configureClientId('owner@hotmail.com','right master password')).ok,false);
  assert.equal((await feature.configureClientId(expected,'wrong')).ok,false);
  unlocked=false;await assert.rejects(()=>feature.configureClientId(expected,'right master password'));
  unlocked=true;
  assert.equal((await feature.configureClientId(expected,'right master password')).ok,false,'Bundled public ID should not be silently changed');
  assert.equal(fs.existsSync(path.join(root,'microsoft-public-client.json')),false,'Do not rewrite runtime configuration when bundled ID exists');
  const restarted=createMicrosoftRecovery(base);
  assert.equal((await restarted.accountStatus()).available,true,'Bundled public ID must persist after restart');
  assert(!fs.existsSync(path.join(root,'accounts.secure.json')),'Activation should not touch messaging profiles');
  console.log('EAGLE RS 3.19.1: guided activation, unlock guard, ID validation, persistent public configuration, and no-session-write tests passed.');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
