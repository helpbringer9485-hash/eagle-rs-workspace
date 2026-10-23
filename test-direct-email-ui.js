'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const txt=n=>fs.readFileSync(require('node:path').join(__dirname,n),'utf8');
const main=txt('main.js'),preload=txt('preload.js'),ms=txt('microsoft-recovery.js'),simple=txt('simple-signin.js'),renderer=txt('renderer.js'),html=txt('index.html');
for(const route of ['outlook-email-status','outlook-email-request','outlook-email-reset']){
 assert(main.includes('security:'+route));assert(preload.includes('security:'+route));
}
for(const name of ['outlookEmailStatus','outlookEmailRequest','outlookEmailReset']){
 assert(simple.includes('desktop.'+name));assert(preload.includes(name+':'));
}
assert(html.includes('<option value="outlookEmail">'));
assert(renderer.includes("value==='outlookEmail'"));
assert(simple.includes('simpleLockEmailSend') && simple.includes('simpleLockEmailCode'));
assert(ms.includes("/me/sendMail") && ms.includes("Mail.Send"));
assert(ms.includes('crypto.timingSafeEqual'));
assert(!simple.includes('api.resend.com'));
assert(!simple.includes('Mailgun'));
assert(!simple.includes('resendApiKey'));
console.log('EAGLE RS direct Outlook email code UI routing and main-process IPC checks passed.');
