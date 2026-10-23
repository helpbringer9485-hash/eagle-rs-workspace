'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const pkg=require('./package.json');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('renderer.js','utf8');
const main=fs.readFileSync('main.js','utf8');
const preload=fs.readFileSync('preload.js','utf8');
const themes=fs.readFileSync('theme-engine.css','utf8');
assert.equal(pkg.version,'3.25.0');

// Theme Studio and extra privacy controls must survive encrypted settings migration.
for(const id of ['themePicker','themeStatus','themeTagline','themesShortcut','lockOnBlur','captureGuard'])assert.ok(html.includes(`id="${id}"`),`Theme/Security control missing: ${id}`);
for(const theme of ['obsidian-gold','chatgpt-slate','pitch-black','titanium-silver','emerald-green','royal-sapphire']){
 assert.ok(themes.includes(`data-theme="${theme}"`),`Missing CSS palette ${theme}`);
 assert.ok(js.includes(`id:'${theme}'`),`Missing theme preview ${theme}`);
}
// Manual call-desk and font features must not alter session paths or claim hidden provider APIs.
for(const id of ['statMissedCalls','panelCalls','toolCalls','callAccount','callCaller','callWhen','callNote','callFilterPlatform','callFilterStatus','callList','addMissedCall','workspaceFont','fontPreview'])assert.ok(html.includes(`id="${id}"`),'Missing call/font UI: '+id);
assert.match(main,/missedCalls/);assert.match(js,/renderMissedCalls/);assert.match(js,/applyWorkspaceFont/);
assert.match(html,/manual tracker/i);
assert.match(main,/setContentProtection/,'Native Windows capture protection missing');
assert.match(main,/lockOnBlur/,'Optional focus-loss lock missing');
assert.match(js,/applyWorkspaceTheme\(/);
for(const id of ['checkDiskProtection','manageBitLocker','manageDeviceEncryption','diskProtectionStatus','diskProtectionBadge'])assert.ok(html.includes(`id="${id}"`),'Windows protection UI missing '+id);
assert.match(main,/getDriveEncryptionStatus/);assert.match(main,/manage-bde\.exe/);assert.match(main,/security:disk-status/);assert.match(main,/security:open-encryption/);
assert.match(preload,/diskProtectionStatus/);assert.match(preload,/openEncryptionSettings/);
assert.match(html,/theme-workspace-preview/);assert.match(js,/theme-workspace-preview/);

assert.match(js,/Ctrl\+Shift\+L/);
assert.equal(pkg.build.appId,'com.eaglers.workspace','Keep appId to preserve existing messaging profile storage');

for(const id of ['lockOverlay','unlockPhrase','unlockNow','setAppPassphrase','apiKey','aiTone','groupWa','groupSignal','groupTelegram','pauseCurrent','activeCurrent','refreshAll','storageInfo']){
 assert.ok(html.includes(`id="${id}"`),`missing element ${id}`);
}
assert.ok(html.includes('gemini-emblem.svg'));
assert.ok(fs.existsSync('gemini-emblem.svg'));assert.ok(fs.existsSync('neural-eagle.svg'));assert.ok(fs.existsSync('eagle-rs.ico'));
for(const pattern of [/contextIsolation:true/,/nodeIntegration:false/,/sandbox:true/,/setPermissionRequestHandler/,/trustedHandle\(/,/event.sender!==win.webContents/,/aes-256-gcm/,/safeStorage\.encryptString/,/safeStorage\.decryptString/,/loadAsync/,/secureStatePath/,/mm3-wa-/,/tg_session_/,/requestSingleInstanceLock\(/])assert.match(main,pattern);
for(const pattern of [/signalProfileDashboard/,/applyPanelVisibility/,/showLockScreen/,/statDrawer/,/renderWebAccounts/,/releaseView\(/,/handleWebviewCrash/,/setProfileActive\(/,/refreshActiveLoaded\(/,/crashBackoff/,/createView\(/,/aiTone/,/lockOverlay/])assert.match(js,pattern);
assert.doesNotMatch(main,/\.clearStorageData\s*\(/,'No cache or storage wipe');
assert.doesNotMatch(main,/\.clearCache\s*\(/,'No cache wipe');
for(const id of ['forgotPass','recoveryForm','recoveryCode','recoveryMode','recoveryNewPass','recoveryCodesText','rotateRecovery','microsoftLink','microsoftRecoverStart','microsoftAutoBackup'])assert.ok(html.includes('id="'+id+'"'),'Missing recovery UI: '+id);
for(const endpoint of ['security:recovery-code','security:recovery-rotate','security:email-enroll','security:email-confirm','security:email-request','security:email-reset'])assert.ok(main.includes(endpoint)&&preload.includes(endpoint),'Missing secure IPC bridge: '+endpoint);
assert.ok(!html.includes('mailto:') && !main.includes('mailto:'),'Do not fake verified-email reset with mailto links');

// Always-On regression checks: switching platforms and locking must not destroy
// web sessions; explicit pause/Stop All can terminate renderers without clearing storage.
for(const id of ['startWhatsAppAll','stopWhatsAppAll','waRunningLabel'])assert.ok(html.includes(`id="${id}"`),`always-on control missing: ${id}`);
const changeSelectedBody=js.match(/async function changeSelected\(id\)\{([\s\S]*?)\n\}\nfunction createView/);
assert.ok(changeSelectedBody,'missing account router');
assert.match(changeSelectedBody[1],/if\(state\.ui\?\.lowMemoryMode\).*releaseView\(/s,'only user-enabled Low RAM mode may unload background views when switching');
const signalBody=js.match(/async function selectSignal\(id\)\{([\s\S]*?)\n\}\nasync function openSignal/);
assert.ok(signalBody,'missing Signal controller');
assert.match(signalBody[1],/if\(state\.ui\?\.lowMemoryMode\).*releaseView\(/s,'only user-enabled Low RAM mode may unload background views when opening Signal');
const lockBody=js.match(/function showLockScreen\(\)\{([\s\S]*?)\n\}/);
assert.ok(lockBody,'missing lock screen');
assert.doesNotMatch(lockBody[1],/releaseView\(/,'locking must not log out running WhatsApp webviews');
assert.match(main,/backgroundThrottling:false/,'background views must not be globally throttled');
assert.match(js,/async function startWhatsappBatch/,'missing staggered always-on startup');
assert.match(js,/async function stopWhatsappBatch/,'missing explicit stop-all');
assert.doesNotMatch(main,/\.clearStorageData\s*\(/);
assert.ok(!preload.includes('sendSync'),'no synchronous IPC');
assert.ok(!js.includes('sendSync'),'no synchronous IPC in renderer');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'eagle-secure-test-'));
let capturedEmail='';
const {EventEmitter}=require('node:events');
const fakeHttps={request:(_url,_opts,onResponse)=>{
 const req=new EventEmitter();let sent='';
 req.write=part=>{sent+=String(part)};
 req.end=()=>{const email=JSON.parse(sent);capturedEmail=email.text;const res=new EventEmitter();res.statusCode=200;res.setEncoding=()=>{};process.nextTick(()=>{onResponse(res);res.emit('end')});};
 req.destroy=err=>req.emit('error',err);
 return req;
}};

const fakeElectron={
 app:{requestSingleInstanceLock:()=>true,enableSandbox(){},commandLine:{hasSwitch:()=>false,removeSwitch(){}},whenReady:()=>({then(){}}),on(){},getPath:()=>dir},
 safeStorage:{isEncryptionAvailable:()=>true,encryptString:x=>Buffer.from('MOCKED-DPAPI:'+Buffer.from(x).toString('base64')),decryptString:b=>Buffer.from(b.toString().slice('MOCKED-DPAPI:'.length),'base64').toString()},
 ipcMain:{},session:{},shell:{},Notification:{},Tray:class{},Menu:{},nativeImage:{},BrowserWindow:class{},powerMonitor:{on(){},getSystemIdleTime:()=>0}
};
const sandbox={console,Buffer,URL,process,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,
 require:name=>name==='electron'?fakeElectron:name==='node:https'?fakeHttps:require(name)};
vm.runInNewContext(main+'\n;globalThis.testExports={clean,defaults,saveAsync,loadAsync,configKey,encryptState,decryptState,secureStatePath,secureBackupPath,setPassphrase,unlock,useRecoveryCode,rotateRecoveryCodes, recoveryStatus,appLock,emailEnroll,emailConfirm,emailReset,requestEmailRecovery, storedRecoveryEmail,resetEmailLimiter:()=>{lastEmailSend=0}};',sandbox,{filename:'main.js'});
(async()=>{
 const t=sandbox.testExports;
 const d=t.defaults();
 assert.equal(d.ui.themeId,'obsidian-gold');assert.equal(d.ui.captureGuard,false);assert.equal(d.ui.lockOnBlur,false);
 const custom=t.clean({...d,ui:{...d.ui,themeId:'obsidian-gold',captureGuard:true,lockOnBlur:true}});
 assert.equal(custom.ui.themeId,'obsidian-gold');assert.equal(custom.ui.captureGuard,true);assert.equal(custom.ui.lockOnBlur,true);
 assert.equal(t.clean({...d,ui:{themeId:'untrusted-external-theme'}}).ui.themeId,'obsidian-gold');
 assert.equal(d.missedCalls.length,0);assert.equal(d.ui.fontId,'segoe');
 const recorded=t.clean({...d,ui:{...d.ui,fontId:'georgia'},missedCalls:[{id:'call-test',accountId:'wa-1',caller:'Friend',time:Date.now(),status:'pending',note:'Call back'}]});
 assert.equal(recorded.missedCalls.length,1);assert.equal(recorded.ui.fontId,'georgia');assert.equal(recorded.missedCalls[0].accountId,'wa-1');
 assert.equal(t.clean({...d,missedCalls:[{id:'bad',accountId:'ghost-1',caller:'Fake',time:Date.now()}]}).missedCalls.length,0);
assert.equal(d.accounts.length,10);assert.equal(d.signalSlots.length,10);assert.equal(d.ui.idleHours,1);assert.equal(d.ui.geminiCollapsed,false);
 const many=t.clean({...d,accounts:Array.from({length:120},(_,i)=>({id:`wa-${i+1}`,name:`WhatsApp ${i+1}`})),telegramAccounts:Array.from({length:70},(_,i)=>({id:`tg-${i+1}`,name:`Telegram ${i+1}`}))});
 assert.equal(many.accounts.length,120);assert.equal(many.telegramAccounts.length,70);
 assert.equal(t.clean({...d,ui:{leftCollapsed:true,geminiCollapsed:true,idleHours:2}}).ui.geminiCollapsed,true);
 const example=t.clean({...d,ui:{leftCollapsed:true,geminiCollapsed:true,idleHours:2},accounts:[{id:'wa-1',name:'Personal Secret',partition:'persist:wa_session_1'}, {id:'wa-2',name:'Work Session',partition:'persist:mm3-wa-2'}]});
 assert.equal(example.accounts[0].partition,'persist:wa_session_1');
 example.missedCalls.push({id:'call-encrypted-check',accountId:'wa-1',caller:'Private Caller',time:Date.now(),note:'Return call',status:'pending',source:'manual'});
 example.ui.fontId='verdana';
 await t.saveAsync(example);
 assert.ok(fs.existsSync(t.secureStatePath()),'encrypted config written');
 assert.equal(fs.readFileSync(t.secureStatePath(),'utf8').includes('Personal Secret'),false,'plaintext not exposed in encrypted config');
 assert.equal(fs.readFileSync(t.secureStatePath(),'utf8').includes('Private Caller'),false,'manual call records must not leak in encrypted settings');
 let loaded=await t.loadAsync();assert.equal(loaded.accounts[0].name,'Personal Secret');assert.equal(loaded.ui.geminiCollapsed,true);
 assert.equal(loaded.missedCalls[0].caller,'Private Caller');assert.equal(loaded.ui.fontId,'verdana');
 await t.saveAsync({...loaded, accounts:[...loaded.accounts,{id:'wa-3',name:'Third Account'}]});
 assert.ok(fs.existsSync(t.secureBackupPath()));
 fs.writeFileSync(t.secureStatePath(),'bad file');
 loaded=await t.loadAsync();assert.equal(loaded.accounts[0].name,'Personal Secret','recover from backup after bad config');
 const originalSecureState=fs.readFileSync(t.secureBackupPath());
 const first=await t.setPassphrase('Correct Horse Sail 472!');
 assert.equal(first.ok,true);assert.equal(first.codes.length,6);
 assert.equal(fs.readFileSync(path.join(dir,'app-lock.json'),'utf8').includes(first.codes[0]),false,'Recovery codes must not be saved in plaintext');
 assert.equal((await t.unlock('wrong')).ok,false);
 assert.equal((await t.useRecoveryCode('ERS-FAKE','New Pass 1234')).ok,false);
 const byCode=await t.useRecoveryCode(first.codes[0],'New Pass 1234');
 assert.equal(byCode.ok,true);assert.equal(byCode.codes.length,6);
 assert.equal((await t.useRecoveryCode(first.codes[0],'Third Pass 5678')).ok,false,'one-time recovery token cannot be reused');
 assert.equal((await t.unlock('Correct Horse Sail 472!')).ok,false,'old master must no longer work');
 assert.equal((await t.unlock('New Pass 1234')).ok,true);
 const rotate=await t.rotateRecoveryCodes('New Pass 1234');assert.equal(rotate.ok,true);assert.equal(rotate.codes.length,6);
 const begin=await t.emailEnroll({currentPass:'New Pass 1234',email:'owner@example.com',from:'security@verified.example',apiKey:'re_thisisatestapikeyonly'});
 assert.equal(begin.ok,true,begin.message);
 assert.match(capturedEmail,/verify recovery email code: \d{8}/);
 let otp=capturedEmail.match(/code: (\d{8})/)[1];
 assert.equal((await t.emailConfirm('00000000')).ok,false,'invalid enrollment token must be rejected');
 assert.equal((await t.emailConfirm(otp)).ok,true);
 assert.equal((await t.storedRecoveryEmail()).email,'owner@example.com');
 assert.equal(fs.readFileSync(path.join(dir,'verified-recovery-email.dpapi'),'utf8').includes('owner@example.com'),false,'email config should be OS protected');
 t.appLock();t.resetEmailLimiter();
 const requested=await t.requestEmailRecovery();assert.equal(requested.ok,true,requested.message);
 otp=capturedEmail.match(/code: (\d{8})/)[1];
 assert.equal((await t.emailReset('11111111','After Email Reset!')).ok,false,'invalid email token must not reset');
 const recovered=await t.emailReset(otp,'After Email Reset!');
 assert.equal(recovered.ok,true);assert.equal(recovered.codes.length,6);
 assert.equal((await t.unlock('After Email Reset!')).ok,true);
 assert.deepEqual(fs.readFileSync(t.secureBackupPath()),originalSecureState,'lock recovery may not touch encrypted messaging account state');
 console.log('EAGLE RS v3.19: full-surface theme studio, optional privacy, always-on routing, syntax, partition persistence, encrypted config, backup-code reset, simulated verified-email reset and no-session-wipe checks passed.');
 fs.rmSync(dir,{recursive:true,force:true});
})().catch(err=>{console.error(err);fs.rmSync(dir,{recursive:true,force:true});process.exitCode=1});
