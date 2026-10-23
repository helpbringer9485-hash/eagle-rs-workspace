// Regression for setup flow UX; authentication is still independently tested.
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const src=fs.readFileSync('renderer.js','utf8');
const css=fs.readFileSync('microsoft-recovery.css','utf8');
assert.match(html, /id="microsoftMasterPass"[^>]*type="password"/);
assert.match(html, /existing <strong>EAGLE RS unlock password<\/strong>/);
assert.ok(html.indexOf('id="microsoftMasterPass"') > html.indexOf('id="microsoftClientId"'));
assert.ok(html.indexOf('id="microsoftMasterPass"') < html.indexOf('id="microsoftSaveClientId"'));
assert.match(src, /const pass=onLock\?'':\$\('microsoftMasterPass'\)\.value/);
assert.match(src, /await window\.desktop\.microsoftConfigure\(value,pass\)/);
assert.match(src, /await startMicrosoftFlow\('link'\)/);
assert.match(src, /if\(!pass\.trim\(\)\)/);
assert.match(css,/\.ms-master-confirm/);
assert.doesNotMatch(src, /microsoftConfigure\(value,\$\('recoveryCurrentPass'\)\.value\)/);
console.log('Hotmail Connect v3.19.2: adjacent passphrase, one-action activation, and visible error wiring checks passed.');
