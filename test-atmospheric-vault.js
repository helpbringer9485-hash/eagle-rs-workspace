'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('atmospheric-vault.css','utf8');
const r=fs.readFileSync('renderer.js','utf8'),main=fs.readFileSync('main.js','utf8');
const pkg=require('./package.json');
assert.equal(pkg.version,'3.25.0');
for(const selector of ['vault-atmosphere','lock-master-container','lock-hero-panel','lock-vault-panel','prefAmbientMotion','brandLogo','lockEmblem','executive-inbox-trigger'])assert(html.includes(selector),'Missing '+selector);
for(const id of ['obsidian-gold','chatgpt-slate','pitch-black','titanium-silver','emerald-green','royal-sapphire']){
 assert(css.includes(`data-theme="${id}"`),'Missing themed atmosphere: '+id);
 for(const prefix of ['eagle','notification','tray','veins'])assert(fs.existsSync(path.join('theme-assets',prefix+'-'+id+'.'+(prefix==='tray'?'ico':prefix==='notification'?'png':'svg'))),'Missing '+prefix+' '+id);
}
assert(css.includes('prefers-reduced-motion:reduce'));
assert(css.includes('html.vault-motion-off'));
assert(r.includes("vault-motion-off"));
assert(r.includes("$('prefAmbientMotion').checked"));
assert(main.includes("'ambientMotion'"));
assert(main.includes('themeId,ambientMotion'));
assert(r.includes('motionBeforeUnlock=r.ambientMotion'));
assert(r.includes('state?state.ui?.ambientMotion===false:!motionBeforeUnlock'));
assert(main.includes('notificationArtwork()'));
assert(main.includes('persist:mm3-')&&main.includes('persist:tg_session_'));
assert(!/await\s+.*clearStorageData\s*\(/.test(main));
assert(html.includes('id="unlockPhrase"')&&html.includes('id="recoveryForm"'));
assert(main.includes("setAppUserModelId('com.eaglers.workspace')"));
console.log('v3.17 atmospheres, six theme assets, native notification art, motion/recovery and partition preservation checks passed.');
