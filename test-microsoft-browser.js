'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createMicrosoftRecovery}=require('./microsoft-recovery');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=2000){const max=Date.now()+ms;while(Date.now()<max){if(await fn())return;await delay(25)}throw new Error('Browser OAuth response did not complete')}
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eagle-browser-oauth-'));
 const mockClient='8b7eaf34-9c31-4764-8e2d-20f975f53e11';
 let opened='',identity='owner-identity',resetCount=0,unlockCount=0,tokenCount=0;
 const safeStorage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('encrypted:'+Buffer.from(s).toString('base64')),decryptString:b=>Buffer.from(b.toString().slice(10),'base64').toString()};
 const origFetch=global.fetch;
 const response=(status,v)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(v)});
 global.fetch=async(url,opts={})=>{
  const s=String(url);
  if(s.includes('/oauth2/v2.0/token')){
   const form=new URLSearchParams(opts.body);
   assert.equal(form.get('grant_type'),'authorization_code');
   assert.equal(form.get('client_id'),mockClient);
   assert(form.get('code_verifier')?.length>20);
   assert(form.get('redirect_uri')?.startsWith('http://localhost:'));
   tokenCount++;
   return response(200,{access_token:'fake-access-'+tokenCount,refresh_token:'fake-refresh',expires_in:3600});
  }
  if(s.startsWith('https://graph.microsoft.com/v1.0/me?'))return response(200,{id:identity,mail:'owner@example.com',displayName:'Test'});
  return origFetch(url,opts);
 };
 const shell={openExternal:async url=>{opened=url;}};
 const m=createMicrosoftRecovery({app:{getPath:()=>root},safeStorage,configuredClientId:mockClient,shell,
   requireUnlocked:()=>{},passwordMatches:async p=>p==='correct-master',isUnlocked:()=>true,
   resetPin:async p=>{resetCount++;return {ok:p.length>=8,codes:['test-recovery']};},
   onVerifiedUnlock:async()=>{unlockCount++;},logger:{warn:()=>{}}});
 try{
  assert.equal((await m.begin('link','wrong')).ok,false);
  assert.equal((await m.accountStatus()).linked,false);
  let result=await m.begin('link','correct-master');
  assert(result.ok);assert.equal(result.mode,'browser');assert(!result.userCode,'Browser sign-in must not create a manual device code');
  let url=new URL(opened);assert.equal(url.hostname,'login.microsoftonline.com');
  assert.equal(url.pathname,'/consumers/oauth2/v2.0/authorize');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('response_type'),'code');
  assert.equal(url.searchParams.get('client_id'),mockClient);
  let redirect=url.searchParams.get('redirect_uri');assert(redirect.startsWith('http://localhost:'));
  let state=url.searchParams.get('state');assert(state.length>25);
  let target=new URL(redirect);target.hostname='127.0.0.1';
  let bad=new URL(target);bad.searchParams.set('state','different');bad.searchParams.set('code','dummy');
  let badresp=await origFetch(bad.toString());assert.equal(badresp.status,400);
  assert.equal((await m.accountStatus()).flow.phase,'waiting');
  let approved=new URL(target);approved.searchParams.set('state',state);approved.searchParams.set('code','fake-code');
  assert.equal((await origFetch(approved.toString())).status,200);
  await until(async()=>((await m.accountStatus()).flow?.phase==='verified'));
  assert.equal((await m.accountStatus()).linked,true);
  assert.equal((await m.openSignIn()).ok,false,'Old sign-in URLs should not reopen after verification');
  // Only the previously linked identity can reset an EAGLE password.
  result=await m.begin('recover');assert(result.ok);url=new URL(opened);redirect=url.searchParams.get('redirect_uri');
  state=url.searchParams.get('state');target=new URL(redirect);target.hostname='127.0.0.1';identity='different-account';
  approved=new URL(target);approved.searchParams.set('state',state);approved.searchParams.set('code','fake-code');
  assert.equal((await origFetch(approved.toString())).status,200);
  await until(async()=>((await m.accountStatus()).flow?.phase==='failed'));
  assert.equal((await m.finishRecovery('New-password-123')).ok,false);
  assert.equal(resetCount,0);
  identity='owner-identity';
  result=await m.begin('recover');assert(result.ok);
  url=new URL(opened);target=new URL(url.searchParams.get('redirect_uri'));target.hostname='127.0.0.1';
  approved=new URL(target);approved.searchParams.set('state',url.searchParams.get('state'));approved.searchParams.set('code','fake-code');
  assert.equal((await origFetch(approved.toString())).status,200);
  await until(async()=>((await m.accountStatus()).flow?.phase==='verified'));
  assert.equal((await m.finishRecovery('New-password-123')).ok,true);assert.equal(resetCount,1);
  assert.equal((await m.finishRecovery('New-password-123')).ok,false,'one-time reset grant');
  result=await m.begin('unlock');assert(result.ok);assert.equal((await m.openSignIn()).ok,true);
  url=new URL(opened);target=new URL(url.searchParams.get('redirect_uri'));target.hostname='127.0.0.1';
  approved=new URL(target);approved.searchParams.set('state',url.searchParams.get('state'));approved.searchParams.set('code','fake-code');
  await origFetch(approved.toString());await until(async()=>((await m.accountStatus()).flow?.phase==='verified'));
  assert.equal(unlockCount,1);
  result=await m.begin('unlock');assert(result.ok);
  assert.equal(m.cancel().ok,true);assert.equal((await m.accountStatus()).flow,null);
  assert.equal(fs.existsSync(path.join(root,'microsoft-linked-account.dpapi')),true);
  console.log('Microsoft browser PKCE tests passed: localhost callback, state, token exchange, linked identity, wrong-account rejection, reset grants, unlock, cancel.');
 }finally{m.cancel();global.fetch=origFetch;fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
