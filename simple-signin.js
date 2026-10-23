'use strict';
// Simple personal sign-in UX layered over the existing secure main-process auth.
// This file never handles provider passwords or authentication tokens.
(()=>{
 const $=id=>document.getElementById(id);
 const settingsHost=document.querySelector('#settingsModal .recovery-settings');
 const lockHost=$('existingLock');
 if(!settingsHost||!lockHost||!window.desktop)return;
 const svg=(kind)=>kind==='google'?`<svg class="simple-auth-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.4 12.2c0-.74-.07-1.27-.21-1.82H12v3.44h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.79-4.29 2.79-7.14z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.22-2.49a6 6 0 0 1-8.18-2.25H3.9v2.58A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M7.21 14.82a5.98 5.98 0 0 1 0-5.64V6.6H3.9a10 10 0 0 0 0 10.8l3.31-2.58z"/><path fill="#EA4335" d="M12 5.96c1.43 0 2.71.5 3.72 1.46l2.78-2.78A9.99 9.99 0 0 0 3.9 6.6l3.31 2.58A6 6 0 0 1 12 5.96z"/></svg>`:`<svg class="simple-auth-icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="11" height="11" x="1" y="1" fill="#f25022"/><rect width="11" height="11" x="12" y="1" fill="#7fba00"/><rect width="11" height="11" x="1" y="12" fill="#00a4ef"/><rect width="11" height="11" x="12" y="12" fill="#ffb900"/></svg>`;
 settingsHost.insertAdjacentHTML('afterbegin',`
 <section id="simpleAuthCard" class="simple-auth-card" aria-label="Easy email recovery">
  <div class="simple-auth-heading"><span class="simple-auth-seal" aria-hidden="true">✦</span><div><h3>Easy account recovery</h3><p>Link Hotmail once. Later get an actual recovery code by email.</p></div></div>
  <div class="simple-auth-status" id="simpleAuthStatus" role="status" aria-live="polite">Checking linked account…</div>
  <div class="simple-auth-pass-wrap" id="simpleAuthPasswordWrap"><label for="simpleAuthPassword">Confirm your current EAGLE RS password (one time)</label><input id="simpleAuthPassword" type="password" autocomplete="current-password" placeholder="Your workspace password — not your email password"></div>
  <div class="simple-auth-providers">
   <button type="button" class="simple-auth-provider" id="simpleAuthMicrosoft">${svg('microsoft')}<span>Continue with Hotmail / Outlook</span></button>
   <button type="button" class="simple-auth-provider" id="simpleAuthGoogle">${svg('google')}<span>Continue with Google</span></button>
  </div>
  <p class="simple-auth-info" id="simpleAuthHelp">Approve Microsoft sending a recovery email from your own Outlook inbox. No Resend or third-party email platform.</p><div class="simple-auth-actions"><button id="simpleAuthReconnect" type="button" hidden>Allow Outlook email codes</button><button id="simpleAuthTestMail" type="button" hidden>Send a test code to my inbox</button></div>
  <div id="simpleAuthFlow" class="simple-auth-flow" hidden>
   <strong id="simpleAuthFlowTitle">Verify your account</strong>
   <p class="simple-auth-info" id="simpleAuthFlowText" role="status" aria-live="polite"></p>
   <code id="simpleAuthCode" class="simple-auth-code" hidden></code>
   <div class="simple-auth-actions"><button type="button" id="simpleAuthOpen" hidden>Open verification page</button><button type="button" id="simpleAuthCopy" hidden>Copy code</button><button type="button" id="simpleAuthCancel">Cancel / try again</button></div>
  </div>
  <details class="simple-auth-secondary"><summary>Backup recovery &amp; settings</summary><p>Use one-time recovery codes if your email account is unavailable. Only workspace settings can be saved to OneDrive; private WhatsApp/Telegram/Signal chat databases aren't part of cloud recovery.</p><label class="simple-auth-pass-wrap" for="simpleBackupPassword">Current EAGLE RS password (for generating recovery codes)</label><input id="simpleBackupPassword" type="password" autocomplete="current-password" placeholder="Your workspace password">
  <div class="simple-auth-actions"><button type="button" id="simpleAuthCodes">Generate backup codes</button><button type="button" id="simpleAuthCloud">Back up settings to OneDrive</button></div><pre id="simpleBackupCodes" class="simple-auth-code" hidden></pre><p class="simple-auth-info" id="simpleBackupStatus" role="status"></p></details>
 </section>`);
 lockHost.insertAdjacentHTML('beforeend',`
 <section id="simpleLockProviders" aria-label="Recover access using a linked account">
  <h4>Forgot your password?</h4>
  <button id="simpleLockMicrosoft" class="simple-auth-provider" type="button" hidden>${svg('microsoft')}<span>Continue with Hotmail / Outlook</span></button>
  <button id="simpleLockGoogle" class="simple-auth-provider" type="button" hidden>${svg('google')}<span>Continue with Google</span></button>
  <button id="simpleLockEmail" class="simple-auth-provider" type="button" hidden><span>✉</span><span>Send recovery code to my email</span></button>
  <button id="simpleLockResetMicrosoft" type="button" hidden>Forgot your password? Reset with Microsoft</button>
  <button id="simpleLockResetGoogle" type="button" hidden>Reset with linked Google account</button>
  <button id="simpleLockBackup" type="button">Use a saved recovery code</button>
  <div id="simpleLockFeedback" role="status" aria-live="polite"></div>
  <section id="simpleLockRecovery" class="simple-auth-recover" hidden>
   <h4 id="simpleLockRecoveryTitle">Verify your account</h4><p id="simpleLockRecoveryStatus" aria-live="polite"></p>
   <code id="simpleLockCode" class="simple-auth-code" hidden></code>
   <div id="simpleLockEmailBox" hidden><p class="simple-auth-info">Check your linked Hotmail / Outlook inbox and junk folder. Each code works for 10 minutes.</p><button id="simpleLockEmailSend" type="button">Send 8-digit email code</button><label for="simpleLockEmailCode">Code from your email</label><input id="simpleLockEmailCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="8-digit code" spellcheck="false"></div>
   <div id="simpleLockLinkRow" class="simple-auth-actions" hidden><button type="button" id="simpleLockOpen">Open Microsoft website</button><button type="button" id="simpleLockCopy">Copy code</button></div>
   <div id="simpleLockNewPassword" hidden>
    <label for="simpleNewPass">New EAGLE RS password</label><input type="password" id="simpleNewPass" autocomplete="new-password" placeholder="At least 8 characters">
    <label for="simpleNewPassConfirm">Repeat new password</label><input type="password" id="simpleNewPassConfirm" autocomplete="new-password" placeholder="Confirm new password">
    <button id="simpleCompleteReset" type="button">Save new password</button>
   </div>
   <div id="simpleLockCodesBlock" hidden><strong>Save these one-time recovery codes now</strong><pre id="simpleLockCodes"></pre><button id="simpleLockCodesDone" type="button">I saved my codes</button></div>
   <button id="simpleLockCancel" type="button">Back to unlock</button>
  </section>
 </section>`);
 const operations=new Set();let activeFlow=null;let timer=null;let emailResetMode=false;
 const setText=(id,s)=>{const el=$(id);if(el)el.textContent=s;};
 async function guarded(button,task){if(operations.has(button))return;operations.add(button);button.disabled=true;try{await task()}catch(e){setText('simpleAuthStatus',e?.message||'Something went wrong. Try again.');setText('simpleLockRecoveryStatus',e?.message||'Could not verify account.')}finally{button.disabled=false;operations.delete(button)}}
 async function accountStatus(){
  const [m,g,e]=await Promise.all([window.desktop.microsoftStatus(),window.desktop.googleStatus(),window.desktop.outlookEmailStatus()]);
  const msReady=!!(m.available&&m.linked),googleReady=!!(g.available&&g.linked);
  $('simpleLockMicrosoft').hidden=!msReady;$('simpleLockGoogle').hidden=!googleReady;
  $('simpleLockResetMicrosoft').hidden=!msReady;$('simpleLockResetGoogle').hidden=!googleReady;
  $('simpleLockEmail').hidden=!e.ready;
  $('simpleAuthReconnect').hidden=!msReady||e.ready;
  $('simpleAuthTestMail').hidden=!e.ready;
  $('simpleAuthMicrosoft').disabled=!m.available||msReady;
  $('simpleAuthGoogle').hidden=!g.available;
  $('simpleAuthGoogle').disabled=!g.available||googleReady;
  $('simpleAuthGoogle').title=g.available?'Connect with your verified Google account':'Google sign-in is not active until the software publisher registers the Google OAuth application.';
  $('simpleAuthPasswordWrap').hidden=(!m.available||msReady)&&(!g.available||googleReady)&&e.ready;
  setText('simpleAuthStatus',e.ready?'Outlook linked for email codes: '+(e.account||'linked Hotmail / Outlook')+' · Send a test code to confirm delivery':
   msReady?'Hotmail linked, but email codes need one-time Send mail permission. Click Allow Outlook email codes.':
   googleReady?'✓ Google linked (Google recovery is separate). Link Hotmail for emailed codes.':'No recovery email linked yet. Connect Hotmail / Outlook once.');
  setText('simpleAuthHelp',e.ready?'EAGLE RS sends a one-time code directly through your own Microsoft mailbox, to the same linked address. No Resend account or sender API key.':
   'Connect your personal Hotmail / Outlook once in Microsoft’s official browser window and approve Send mail. Later, receive an 8-digit EAGLE RS reset code in your inbox; no device-code entry is needed.');
  return {m,g,e};
 }
 const nowFlow=()=>activeFlow;
 function stopPolling(){if(timer){clearTimeout(timer);timer=null}activeFlow=null;}
 function displayFlow(kind,location,reply){
  emailResetMode=false;$('simpleLockEmailBox').hidden=true;
  const isLock=location==='lock';
  const parent=isLock?'simpleLockRecovery':'simpleAuthFlow';$(parent).hidden=false;
  setText(isLock?'simpleLockRecoveryStatus':'simpleAuthFlowText',reply.message||'Complete verification in your browser.');
  setText(isLock?'simpleLockRecoveryTitle':'simpleAuthFlowTitle',kind==='microsoft'?'Microsoft verification':'Google verification');
  const codeEl=$(isLock?'simpleLockCode':'simpleAuthCode');
  codeEl.hidden=!reply.userCode;codeEl.textContent=reply.userCode||'';
  $(isLock?'simpleLockLinkRow':'simpleAuthOpen').hidden=kind!=='microsoft';
  if(!isLock){$('simpleAuthOpen').hidden=kind!=='microsoft';$('simpleAuthCopy').hidden=kind!=='microsoft'||reply.mode==='browser'; $('simpleAuthOpen').textContent=reply.mode==='browser'?'Reopen Microsoft sign-in':'Open Microsoft verification page';}
  if(isLock){$('simpleLockCopy').hidden=reply.mode==='browser';$('simpleLockOpen').textContent=reply.mode==='browser'?'Reopen Microsoft sign-in':'Open Microsoft verification page';}
  $('simpleLockNewPassword').hidden=true;
 }
 async function watchFlow(kind,purpose,location,expiresIn=300){
  stopPolling();const token={kind,purpose,location,expires:Date.now()+Math.min(600000,(Number(expiresIn)||300)*1000+10000)};activeFlow=token;
  const label=location==='lock'?'simpleLockRecoveryStatus':'simpleAuthFlowText';
  const check=async()=>{
   if(nowFlow()!==token)return;
   let data;
   try{data=kind==='microsoft'?await window.desktop.microsoftStatus():await window.desktop.googleStatus()}
   catch(e){setText(label,'Could not check verification: '+e.message);stopPolling();return}
   const phase=data.flow?.phase||'waiting';
   if(data.flow?.message)setText(label,data.flow.message);
   if(phase==='verified'){
    stopPolling();if(purpose==='unlock'){
     setText(label,'Identity verified. Opening EAGLE RS workspace…');
    }else if(purpose==='recover'){
     $('simpleLockNewPassword').hidden=false;
     setText(label,'Verified. Choose your new EAGLE RS password.');
     $('simpleNewPass').focus();
    }else{await accountStatus();$('simpleAuthFlow').hidden=true;setText('simpleAuthStatus','✓ Your account has been verified and linked for future recovery.');}
    return;
   }
   if(phase==='failed'||Date.now()>token.expires){stopPolling();setText(label,data.flow?.message||'Sign-in expired. Try again.');return;}
   timer=setTimeout(check,1800);
  };
  timer=setTimeout(check,1800);
 }
 async function begin(kind,purpose,location){
  const needsPassword=purpose==='link'||purpose==='reconnect';
  const password=needsPassword?$('simpleAuthPassword').value:'';
  if(needsPassword&&!password){setText('simpleAuthStatus','Enter your existing EAGLE RS workspace password once to protect your recovery setup.');$('simpleAuthPassword').focus();return}
  const answer=kind==='microsoft'?await window.desktop.microsoftBegin(purpose,password):await window.desktop.googleBegin(purpose,password);
  if(!answer.ok){setText(location==='lock'?'simpleLockFeedback':'simpleAuthStatus',answer.message||'Unable to start sign-in.');return}
  $('simpleAuthPassword').value='';
  displayFlow(kind,location,answer);
  if(kind==='microsoft'&&answer.mode==='browser'){setText(location==='lock'?'simpleLockRecoveryStatus':'simpleAuthFlowText','Microsoft opened in your browser. Sign in there, then return to EAGLE RS. If Microsoft shows a redirect URI error, add http://localhost under Entra → Authentication → Mobile and desktop applications.');}
  if(kind==='microsoft'&&answer.mode!=='browser'){
   try{await window.desktop.microsoftOpenSignIn()}catch(e){setText(location==='lock'?'simpleLockRecoveryStatus':'simpleAuthFlowText','Could not open the Microsoft verification page.');}
  }
  await watchFlow(kind,purpose,location,answer.expiresIn);
 }
 $('simpleAuthMicrosoft').onclick=()=>guarded($('simpleAuthMicrosoft'),()=>begin('microsoft','link','settings'));
 $('simpleAuthGoogle').onclick=()=>guarded($('simpleAuthGoogle'),()=>begin('google','link','settings'));
 $('simpleAuthReconnect').onclick=()=>guarded($('simpleAuthReconnect'),()=>begin('microsoft','reconnect','settings'));
 $('simpleAuthTestMail').onclick=()=>guarded($('simpleAuthTestMail'),async()=>{const r=await window.desktop.outlookEmailRequest();setText('simpleAuthStatus',r.message||'Could not send email.');});
 $('simpleLockEmail').onclick=()=>{stopPolling();emailResetMode=true;$('simpleLockRecovery').hidden=false;$('simpleLockEmailBox').hidden=false;$('simpleLockLinkRow').hidden=true;$('simpleLockCode').hidden=true;$('simpleLockNewPassword').hidden=true;$('simpleLockEmailCode').value='';setText('simpleLockRecoveryTitle','Email recovery code');setText('simpleLockRecoveryStatus','Press Send code. Microsoft will send an 8-digit code to your linked Outlook mailbox.');};
 $('simpleLockEmailSend').onclick=()=>guarded($('simpleLockEmailSend'),async()=>{const r=await window.desktop.outlookEmailRequest();setText('simpleLockRecoveryStatus',r.message||'Could not send email.');if(r.ok){$('simpleLockNewPassword').hidden=false;$('simpleLockEmailCode').focus();}});
 $('simpleLockMicrosoft').onclick=()=>guarded($('simpleLockMicrosoft'),()=>begin('microsoft','unlock','lock'));
 $('simpleLockGoogle').onclick=()=>guarded($('simpleLockGoogle'),()=>begin('google','unlock','lock'));
 $('simpleLockResetMicrosoft').onclick=()=>guarded($('simpleLockResetMicrosoft'),()=>begin('microsoft','recover','lock'));
 $('simpleLockResetGoogle').onclick=()=>guarded($('simpleLockResetGoogle'),()=>begin('google','recover','lock'));
 $('simpleLockBackup').onclick=()=>{stopPolling();$('forgotPass').click();};
 $('simpleAuthOpen').onclick=$('simpleLockOpen').onclick=()=>void window.desktop.microsoftOpenSignIn().then(r=>{if(!r.ok)setText('simpleAuthFlowText',r.message)}).catch(e=>setText('simpleAuthFlowText',e.message));
 function copyCode(id){const code=$(id).textContent;if(code)void navigator.clipboard.writeText(code).catch(()=>setText('simpleAuthFlowText','Select and copy the code displayed.'));}
 $('simpleAuthCopy').onclick=()=>copyCode('simpleAuthCode');$('simpleLockCopy').onclick=()=>copyCode('simpleLockCode');
 $('simpleAuthCodes').onclick=()=>guarded($('simpleAuthCodes'),async()=>{
  const pass=$('simpleBackupPassword').value;
  $('simpleBackupPassword').value='';
  if(!pass){setText('simpleBackupStatus','Enter your EAGLE RS password to create new recovery codes.');return;}
  const r=await window.desktop.recoveryRotate(pass);
  setText('simpleBackupStatus',r.message||'Could not create recovery codes.');
  $('simpleBackupCodes').hidden=!r.ok||!r.codes?.length;
  $('simpleBackupCodes').textContent=r.ok?(r.codes||[]).join('\n'):'';
 });
 $('simpleAuthCloud').onclick=()=>guarded($('simpleAuthCloud'),async()=>{
  const m=await window.desktop.microsoftStatus();
  if(!m.linked){setText('simpleBackupStatus','Connect Hotmail / Outlook before backing up settings.');return;}
  const r=await window.desktop.microsoftBackupNow();setText('simpleBackupStatus',r.message||'Backup unavailable.');
 });
 $('simpleAuthCancel').onclick=()=>{stopPolling();void window.desktop.microsoftCancel().catch(()=>{});$('simpleAuthFlow').hidden=true;setText('simpleAuthStatus','Sign-in cancelled. Enter your EAGLE RS password again to start a fresh sign-in.');};
 $('simpleLockCancel').onclick=()=>{void window.desktop.microsoftCancel().catch(()=>{});stopPolling();emailResetMode=false;$('simpleLockEmailBox').hidden=true;$('simpleLockEmailCode').value='';$('simpleLockRecovery').hidden=true;$('simpleNewPass').value='';$('simpleNewPassConfirm').value='';};
 $('simpleLockCodesDone').onclick=()=>{$('simpleLockCodes').textContent='';$('simpleLockRecovery').hidden=true;$('simpleNewPass').value='';$('simpleNewPassConfirm').value='';setText('simpleLockFeedback','Your new password is ready. Enter it above to unlock.');};
 $('simpleCompleteReset').onclick=()=>guarded($('simpleCompleteReset'),async()=>{
  const pass=$('simpleNewPass').value,confirm=$('simpleNewPassConfirm').value;
  if(pass.length<8||pass!==confirm){setText('simpleLockRecoveryStatus','Choose at least 8 characters and enter the same new password twice.');return}
  const kind=$('simpleLockRecoveryTitle').textContent.includes('Google')?'google':'microsoft';
  const result=emailResetMode?await window.desktop.outlookEmailReset($('simpleLockEmailCode').value,pass):kind==='google'?await window.desktop.googleReset(pass):await window.desktop.microsoftReset(pass);
  $('simpleNewPass').value='';$('simpleNewPassConfirm').value='';
  if(!result.ok){setText('simpleLockRecoveryStatus',result.message||'Could not reset password.');return}
  $('simpleLockNewPassword').hidden=true;
  $('simpleLockEmailCode').value='';$('simpleLockEmailBox').hidden=true;emailResetMode=false;
  $('simpleLockLinkRow').hidden=true;
  $('simpleLockCode').hidden=true;
  $('simpleLockCodesBlock').hidden=!result.codes?.length;
  $('simpleLockCodes').textContent=(result.codes||[]).join('\n');
  setText('simpleLockRecoveryStatus','Password reset successful. Save the new one-time recovery codes.');
 });
 // The popup only refreshes presentation state. Credentials remain main-process-only.
 const settings=$('settingsModal');
 new MutationObserver(()=>{if(settings.classList.contains('show'))void accountStatus().catch(e=>setText('simpleAuthStatus',e.message));else{$('simpleAuthPassword').value='';$('simpleAuthFlow').hidden=true;stopPolling();}}).observe(settings,{attributes:true,attributeFilter:['class']});
 const lock=$('lockOverlay');
 new MutationObserver(()=>{
  if(lock.hidden){emailResetMode=false;$('simpleLockEmailCode').value='';$('simpleLockEmailBox').hidden=true;$('simpleLockRecovery').hidden=true;$('simpleNewPass').value='';$('simpleNewPassConfirm').value='';stopPolling()}
  else void accountStatus().catch(()=>{});
 }).observe(lock,{attributes:true,attributeFilter:['hidden']});
 void accountStatus().catch(e=>setText('simpleAuthStatus','Recovery status unavailable: '+e.message));
})();
