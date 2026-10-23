'use strict';
// Static regression test: theme allowlist, style tokens and secure legacy configuration.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pkg=require('./package.json');
const html=fs.readFileSync('index.html','utf8');
const style=fs.readFileSync('theme-engine.css','utf8');
const renderer=fs.readFileSync('renderer.js','utf8');
const main=fs.readFileSync('main.js','utf8');
const ids=['obsidian-gold','chatgpt-slate','pitch-black','titanium-silver','emerald-green','royal-sapphire'];
assert.equal(pkg.version,'3.25.0');
assert.equal(pkg.build.appId,'com.eaglers.workspace');
assert.match(html,/<link rel="stylesheet" href="theme-engine\.css">/);
for(const id of ids){
  assert.ok(style.includes(`html[data-theme="${id}"]`),`missing stylesheet: ${id}`);
  assert.ok(html.includes(`value="${id}"`),`missing menu option: ${id}`);
  assert.ok(renderer.includes(`id:'${id}'`),`missing selectable option: ${id}`);
  assert.ok(main.includes(`'${id}'`),`missing secure allowlist: ${id}`);
}
for(const variable of ['--bg-main','--bg-panel','--border-color','--text-primary','--text-secondary','--accent-color','--accent-glow','--accent-gradient','--accent-foreground']){
  assert.ok(style.includes(variable+':'),`theme token not defined: ${variable}`);
}
for(const selector of ['.masthead','.sidebar','.right','.stat','.dialog','.lock-card','.tabs','.tool-tabs','.view-container']){
  assert.ok(style.includes(selector),`coverage missing for ${selector}`);
}
assert.match(style,/linear-gradient\(135deg,#FFF1B0 0%,#D4AF37 50%,#AA7C11 100%\)/);
assert.match(style,/html\[data-theme="chatgpt-slate"\]/);
assert.match(style,/html\[data-theme="titanium-silver"\]/);
assert.doesNotMatch(main,/\.clearStorageData\s*\(/);
assert.doesNotMatch(main,/\.clearCache\s*\(/);
assert.doesNotMatch(renderer,/sendSync\(/);
assert.ok(main.includes('safeStorage.encryptString'));
assert.ok(main.includes('aes-256-gcm'));
assert.ok(renderer.includes('applyPanelVisibility'));
assert.ok(renderer.includes('selectSignal'));
assert.ok(renderer.includes('expandedProfile'));
assert.ok(renderer.includes('async function startWhatsappBatch'));
console.log('EAGLE RS v3.6 six-theme and persistence/security regression checks passed.');
