'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createMicrosoftRecovery}=require('./microsoft-recovery');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,ms=3000){const until=Date.now()+ms;while(Date.now()<until){if(await fn())return;await pause(15)}throw new Error('Microsoft sign-in did not complete')}
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eagle-outlook-mail-'));
 const clientId='8b7eaf34-9c31-4764-8e2d-20f975f53e11';
 const safeStorage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('protected:'+Buffer.from(s).toString('base64')),
   decryptString:b=>Buffer.from(b.toString().slice(10),'base64').toString()};
 const originalFetch=global.fetch;
 let browserUrl='',postedMail=null,sendCount=0,resetCount=0,mailStatus=202,identity='test-owner-id';
 const response=(status,data)=>({status,ok:status>=200&&status<300,text:async()=>data===null?'':JSON.stringify(data)});
 global.fetch=async(url,options={})=>{
  const uri=String(url);
  if(uri.endsWith('/oauth2/v2.0/token'))return response(200,{access_token:'mock-graph-token',refresh_token:'mock-refresh',scope:'openid profile email offline_access User.Read Mail.Send Files.ReadWrite.AppFolder',expires_in:3600});
  if(uri.includes('graph.microsoft.com/v1.0/me?$select='))return response(200,{id:identity,mail:'owner@hotmail.com',userPrincipalName:'owner@hotmail.com',displayName:'Owner'});
  if(uri==='https://graph.microsoft.com/v1.0/me/sendMail'){
   sendCount++;
   assert.equal(options.method,'POST');
   assert.equal(options.headers.Authorization,'Bearer mock-graph-token');
   postedMail=JSON.parse(options.body);
   assert.equal(postedMail.message.toRecipients.length,1);
   assert.equal(postedMail.message.toRecipients[0].emailAddress.address,'owner@hotmail.com','only verified linked address may receive recovery code');
   assert.equal(postedMail.saveToSentItems,false);
   return response(mailStatus,mailStatus===202?null:{error:'not granted'});
  }
  return originalFetch(url,options);
 };
 const make=()=>createMicrosoftRecovery({app:{getPath:()=>root},safeStorage,configuredClientId:clientId,
   shell:{openExternal:async u=>{browserUrl=u;}},requireUnlocked:()=>{},passwordMatches:async p=>p==='old-master',isUnlocked:()=>true,
   resetPin:async p=>{resetCount++;return {ok:p.length>=8,codes:['saved-code'],message:'Password updated'};},logger:{warn:()=>{}}});
 try{
  const app=make();
  let result=await app.requestEmailCode();assert.equal(result.ok,false);
  assert.equal(sendCount,0);
  result=await app.begin('link','old-master');assert(result.ok);assert.equal(result.mode,'browser');
  const callback=new URL(new URL(browserUrl).searchParams.get('redirect_uri'));
  callback.hostname='127.0.0.1';callback.searchParams.set('state',new URL(browserUrl).searchParams.get('state'));callback.searchParams.set('code','example-authorization-code');
  const accepted=await originalFetch(callback.toString());assert.equal(accepted.status,200);
  await waitFor(async()=>(await app.accountStatus()).linked);
  let status=await app.emailRecoveryStatus();assert.equal(status.ready,true);assert(!status.account.includes('owner@hotmail.com'));
  result=await app.requestEmailCode();assert.equal(result.ok,true,result.message);assert.equal(sendCount,1);
  assert(!JSON.stringify(result).includes('mock-graph-token'),'No access token should reach the renderer');
  const mailBody=postedMail.message.body.content;
  const match=mailBody.match(/code is: (\d{8})/);assert(match,'An eight-digit code must be included in the actual mail body');
  assert(!JSON.stringify(result).includes(match[1]),'The OTP must never be included in the IPC result');
  assert.equal((await app.requestEmailCode()).ok,false,'Repeated send must be throttled');assert.equal(sendCount,1);
  assert.equal((await app.finishEmailReset('00000000','New-Password-123')).ok,false);
  assert.equal(resetCount,0,'A wrong code must not reset the password');
  result=await app.finishEmailReset(match[1],'New-Password-123');assert.equal(result.ok,true);
  assert.equal(resetCount,1);
  assert.equal((await app.finishEmailReset(match[1],'New-Password-123')).ok,false,'OTP must be one-time use');
  // Restarting EAGLE RS must not reset the send-rate counter.
  const restarted=make();
  assert.equal((await restarted.requestEmailCode()).ok,false);
  assert.equal(sendCount,1);
  // Expired OTP is rejected, even if the emailed digits are correct.
  const realNow=Date.now;
  try{
   const shift=realNow();
   Date.now=()=>shift+100_000;
   const another=await app.requestEmailCode();assert.equal(another.ok,true,another.message);
   const expiredMail=postedMail.message.body.content.match(/code is: (\d{8})/)[1];
   Date.now=()=>shift+13*60_000;
   const expired=await app.finishEmailReset(expiredMail,'New-Password-123');
   assert.equal(expired.ok,false,'Code must expire after 10 minutes');
   assert.equal(resetCount,1,'Expired code must not change password');
  }finally{Date.now=realNow;}
  // Failed Microsoft permission checks must never create a usable OTP.
  try{
   const shift=realNow();Date.now=()=>shift+15*60_000;
   mailStatus=403;
   const denied=await app.requestEmailCode();
   assert.equal(denied.ok,false);
   assert.match(denied.message,/Send mail permission/);
   assert.equal((await app.finishEmailReset('12345678','New-Password-123')).ok,false);
   assert.equal(resetCount,1);
  }finally{Date.now=realNow;mailStatus=202;}
  // Unlinking must prevent password reset by any previously generated code.
  assert.equal((await app.disconnect('old-master')).ok,true);
  status=await app.emailRecoveryStatus();assert.equal(status.ready,false);
  assert.equal((await app.requestEmailCode()).ok,false);
  assert.equal(sendCount,3);
  console.log('Direct Outlook email tests passed: permission-scoped Graph sendMail, masked recipient, OTP never exposed to UI, wrong-code rejection, one-time reset, persistent throttle, unlink protection.');
 }finally{global.fetch=originalFetch;fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
