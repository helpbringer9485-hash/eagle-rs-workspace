'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('renderer.js','utf8');
const css=fs.readFileSync('living-smoke.css','utf8');
const pkg=require('./package.json');
assert.equal(pkg.version,'3.25.0');
assert(/<video[^>]+id="vaultSmokeVideo"[^>]*src="living-smoke\.webm"/.test(html));
for(const token of ['autoplay','muted','playsinline','loop','preload="none"'])assert(html.includes(token),'Missing video attribute '+token);
for(const marker of ['function syncVaultSmoke()',"$('lockOverlay')",'vid.pause()','vid.play()','prefers-reduced-motion: reduce','visibilitychange','MutationObserver'])assert(js.includes(marker),'Missing smoke lifecycle '+marker);
assert(css.includes('mix-blend-mode:screen'));
assert(css.includes('html.vault-motion-off'));
assert(css.includes('prefers-reduced-motion:reduce'));
assert(css.includes('pointer-events:none'));
const smoke=fs.readFileSync('living-smoke.webm');
assert(smoke.byteLength>50000 && smoke.byteLength<5e6,'Video must be small enough for login screen');
assert.deepEqual([...smoke.subarray(0,4)],[0x1a,0x45,0xdf,0xa3],'Video must be actual WebM binary');
const ico=fs.readFileSync('eagle-rs.ico');
assert(ico.length>10000 && ico.readUInt16LE(2)===1 && ico.readUInt16LE(4)>=5,'Multi-size Windows desktop icon required');
for(const theme of ['obsidian-gold','chatgpt-slate','pitch-black','titanium-silver','emerald-green','royal-sapphire']){
 for(const type of ['desktop-eagle-'+theme+'.png','desktop-eagle-'+theme+'.svg','tray-'+theme+'.ico','notification-'+theme+'.png'])assert(fs.existsSync(path.join('theme-assets',type)),'Missing theme icon '+type);
 const png=fs.readFileSync(path.join('theme-assets',`desktop-eagle-${theme}.png`));
 assert.equal(png[25],6,'Desktop PNG must preserve alpha channel');
}
assert(js.includes('syncVaultSmoke();'));
assert(fs.readFileSync('main.js','utf8').includes('persist:tg_session_'));
assert(fs.readFileSync('main.js','utf8').includes('persist:mm3-'));
console.log('Living smoke WebM/CPU-friendly pause, reduced motion, alpha icon, six themes, and session safety tests passed.');
