'use strict';
const $ = id => document.getElementById(id);
const callActivity = window.EagleCallActivity;

// Six-theme Luxury Engine 3.6: themes are allowlisted; no remote styles or injected code.
const WORKSPACE_THEMES = Object.freeze([
 {id:'obsidian-gold',name:'Real Obsidian Gold',desc:'Matte onyx · champagne gold · warm glow',canvas:'#080A0F',surface:'#0F131D',accent:'#D4AF37'},
 {id:'chatgpt-slate',name:'ChatGPT Slate',desc:'Light alabaster · emerald · precision',canvas:'#F8FAFC',surface:'#FFFFFF',accent:'#10A37F'},
 {id:'pitch-black',name:'Pitch Black',desc:'True OLED black · monochrome silver',canvas:'#000000',surface:'#0A0A0A',accent:'#D3D7DC'},
 {id:'titanium-silver',name:'Titanium Silver',desc:'Brushed aluminum · polished slate',canvas:'#E2E8F0',surface:'#F8FAFC',accent:'#475569'},
 {id:'emerald-green',name:'Emerald Green',desc:'Executive forest · laser emerald',canvas:'#04120B',surface:'#081C10',accent:'#10B981'},
 {id:'royal-sapphire',name:'Royal Sapphire',desc:'Sapphire night · electric royal blue',canvas:'#070E1B',surface:'#0D1B2A',accent:'#2C6BED'}
]);
const THEME_IDS = new Set(WORKSPACE_THEMES.map(t=>t.id));
const WORKSPACE_FONTS=Object.freeze({
 segoe:"'Segoe UI', Arial, sans-serif",aptos:"Aptos, 'Segoe UI', Arial, sans-serif",
 inter:"Inter, 'Segoe UI', sans-serif",calibri:"Calibri, 'Segoe UI', sans-serif",
 arial:"Arial, sans-serif",verdana:"Verdana, Geneva, sans-serif",
 tahoma:"Tahoma, Geneva, sans-serif",trebuchet:"'Trebuchet MS', Arial, sans-serif",
 georgia:"Georgia, 'Times New Roman', serif",consolas:"Consolas, 'Courier New', monospace"
});
function applyWorkspaceFont(id){
 const fontId=Object.hasOwn(WORKSPACE_FONTS,id)?id:'segoe';
 document.documentElement.style.setProperty('--workspace-font',WORKSPACE_FONTS[fontId]);
 const picker=$('workspaceFont');if(picker)picker.value=fontId;
 return fontId;
}

// This is an actual muted local video, not an animated still image.
// Play only while the vault is visible and motion is explicitly permitted.
function syncVaultSmoke(){
 const vid=$('vaultSmokeVideo'), overlay=$('lockOverlay');
 if(!vid||!overlay)return;
 const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const enabled=!overlay.hidden && !document.hidden && !reduceMotion && !document.documentElement.classList.contains('vault-motion-off');
 if(!enabled){vid.pause();return;}
 if(vid.paused){void vid.play().catch(()=>{ /* Video failure leaves static marble background; never blocks unlocking. */ });}
}
window.addEventListener('pageshow',syncVaultSmoke);
document.addEventListener('visibilitychange',syncVaultSmoke);
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',syncVaultSmoke);
new MutationObserver(syncVaultSmoke).observe($('lockOverlay'),{attributes:true,attributeFilter:['hidden']});
new MutationObserver(syncVaultSmoke).observe(document.documentElement,{attributes:true,attributeFilter:['class']});

let motionBeforeUnlock=true;
function applyWorkspaceTheme(previewId){
 const stored=state?.ui?.themeId;
 const id=THEME_IDS.has(previewId)?previewId:(THEME_IDS.has(stored)?stored:'obsidian-gold');
 document.documentElement.setAttribute('data-theme',id);
 document.documentElement.classList.toggle('vault-motion-off',state?state.ui?.ambientMotion===false:!motionBeforeUnlock);
 syncVaultSmoke();
 const brandLogo=$('brandLogo'),lockEmblem=$('lockEmblem');
 if(brandLogo)brandLogo.src=`theme-assets/desktop-eagle-${id}.svg`;
 if(lockEmblem)lockEmblem.src=`theme-assets/desktop-eagle-${id}.svg`;
 applyWorkspaceFont(state?.ui?.fontId);
 const selectedTheme=WORKSPACE_THEMES.find(t=>t.id===id);
 const tagline=$('themeTagline');if(tagline)tagline.textContent=`${selectedTheme.name.toUpperCase()} · SECURE COMMUNICATIONS`;
 const status=$('themeStatus');if(status)status.textContent=`${selectedTheme.name} · saved in encrypted settings`;
 const quick=$('themeQuickSelect');if(quick)quick.value=id;
 document.querySelectorAll('.theme-option').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeId===id)));
}
function buildThemePicker(){
 const root=$('themePicker');if(!root)return;
 root.replaceChildren();
 for(const theme of WORKSPACE_THEMES){
  const btn=document.createElement('button');btn.type='button';btn.className='theme-option';btn.dataset.themeId=theme.id;btn.title=`Apply ${theme.name}`;
  const colors=document.createElement('div');colors.className='theme-swatch theme-workspace-preview';colors.setAttribute('aria-hidden','true');
  colors.style.setProperty('--preview-canvas',theme.canvas);colors.style.setProperty('--preview-surface',theme.surface);colors.style.setProperty('--preview-accent',theme.accent);
  for(const area of ['head','nav','main','aside']){const sw=document.createElement('span');sw.className='preview-'+area;colors.append(sw);}
  const heading=document.createElement('div');heading.className='theme-name';
  const name=document.createElement('strong');name.textContent=theme.name;
  const tick=document.createElement('span');tick.className='theme-tick';tick.textContent='✓';
  heading.append(name,tick);const subtitle=document.createElement('div');subtitle.className='theme-subtitle';subtitle.textContent=theme.desc;
  btn.append(colors,heading,subtitle);
  btn.onclick=()=>void busy(btn,()=>selectWorkspaceTheme(theme.id));
  root.append(btn);
 }
 applyWorkspaceTheme();
}
async function selectWorkspaceTheme(themeId){
 if(!THEME_IDS.has(themeId)||!state)return;
 const previous=state.ui.themeId;
 state.ui={...state.ui,themeId};applyWorkspaceTheme();
 try{await persist();toast(`Theme changed to ${WORKSPACE_THEMES.find(t=>t.id===themeId).name}.`);}
 catch(error){state.ui.themeId=previous;applyWorkspaceTheme();throw error;}
}

// A stale/moved optional panel must never abort account selection or live webview loading.
const missingUiNodes=new Set();
function setUiText(id,value){
 const node=$(id);
 if(!node){if(!missingUiNodes.has(id)){missingUiNodes.add(id);console.warn('[EAGLE RS] Optional UI node missing:',id)}return false;}
 node.textContent=String(value);return true;
}
function updateChildText(selector,value,parent){const node=parent?.querySelector(selector);if(node)node.textContent=String(value);return !!node;}

let state, selected = null, activeTool='Ai', filter='all', unreadCheckAt=new Map(), toastTimeout;
const views=new Map(), counts=new Map(), activity=[];
let queueFilter='pending';
let switchInFlight=false;let activeSignalSlot=null;const crashBackoff=new Map();const crashTimers=new Map();
const allWebAccounts=()=>[...(state?.accounts||[])];
const getAccount=id=>allWebAccounts().find(a=>a.id===id);
const isTelegram=id=>typeof id==='string'&&id.startsWith('tg-');
const platform=id=>isTelegram(id)?'tg':'wa';
const sourceName=id=>isTelegram(id)?'Telegram':'WhatsApp';
const platformColor=id=>isTelegram(id)?'#0088CC':'#10B981';
let expandedProfile=false;const dismissedAlerts=new Map();
const deferFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
let executiveInboxFrame=0,executiveInboxFilter="all";
// Timed transient surfaces only. Never close a form, unsent chat, Settings, or the master lock.
const transientTimers=new Map();
function popupTimeoutMs(){return ([1,2,3].includes(state?.ui?.popupTimeoutMinutes)?state.ui.popupTimeoutMinutes:1)*60_000;}
function closeTransient(name){
 const item=transientTimers.get(name);
 if(item){clearTimeout(item.timer);clearInterval(item.tick);transientTimers.delete(name);}
 if(name==='statDrawer'){$('statDrawer').hidden=true;}
 else if(name==='execInbox'){const popup=$('executiveInbox');if(popup)popup.hidden=true;$('bell')?.setAttribute('aria-expanded','false');}
 else if(name==='accountMenu'){
  const panel=$('profileMore'),popover=$('profileMoreMenu');if(panel)panel.open=false;
  if(popover){popover.classList.remove('menu-fallback-open');if(popover.matches?.(':popover-open')){try{popover.hidePopover()}catch{}}}
 }
}
function scheduleTransient(name,close,target){
 const prior=transientTimers.get(name);if(prior){clearTimeout(prior.timer);clearInterval(prior.tick);}
 const ms=popupTimeoutMs();let remaining=ms,started=performance.now();
 const panel=target || (name==='statDrawer'?$('statDrawer'):$('profileMoreMenu'));
 function update(){
  if(name!=='statDrawer'&&name!=='execInbox')return;
  const seconds=Math.ceil(remaining/1000),
        note=$(name==='execInbox'?'executiveInboxCountdown':'statDrawerCountdown'),
        bar=$(name==='execInbox'?'executiveInboxProgress':'statDrawerProgress');
  if(note)note.textContent='Closes in '+Math.max(0,Math.ceil(seconds/60))+' min'+(seconds%60?' '+String(seconds%60).padStart(2,'0')+' sec':'');
  if(bar)bar.style.width=Math.min(100,Math.max(0,remaining/ms*100))+'%';
 }
 let timer;
 const tick=setInterval(()=>{if(!transientTimers.has(name))return;if(document.hidden||panel?.matches(':hover')||panel?.contains(document.activeElement)){started=performance.now();return;}
  const now=performance.now();remaining-=now-started;started=now;update();if(remaining<=0){closeTransient(name);close?.();}
 },250);
 update();transientTimers.set(name,{timer,tick});
}
// Use at most one app-owned countdown interval per popup. Timer pauses while the
// user is reading or interacting with the panel to avoid closing mid-click.
function clearAllTransients(){for(const name of [...transientTimers.keys()])closeTransient(name);}
function refreshLockClock(){
 const clock=$('lockClock'),date=$('lockCalendar');if(!clock||!date)return;
 const now=new Date();clock.textContent=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(now);
 date.textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'}).format(now);
}
refreshLockClock();setInterval(()=>{if(!$('lockOverlay').hidden)refreshLockClock()},1000);

async function busy(button,action){
 if(button?.disabled)return;
 try{if(button){button.disabled=true;button.classList.add('is-busy');}await deferFrame();return await action();}
 catch(err){console.error('[EAGLE RS] Action failure:',err);toast('Action failed: '+(err?.message||err));}
 finally{if(button){button.disabled=false;button.classList.remove('is-busy');}}
}
function tooltip(el,text){el.title=text;el.dataset.tooltip=text;}

const groupInfo={wa:{element:'groupWa',button:'toggleWa',list:'waList',label:'WhatsApp'},signal:{element:'groupSignal',button:'toggleSignal',list:'signalList',label:'Signal'},tg:{element:'groupTelegram',button:'toggleTelegram',list:'telegramList',label:'Telegram'}};
function applyGroupOrder(){
 if(!state)return;
 const stack=$('platformGroups');
 const order=state.platformOrder||['signal','wa','tg'];
 // Avoid detaching/reinserting headers during every expand/collapse: each move triggers layout.
 for(let i=0;i<order.length;i++){
  const item=$(groupInfo[order[i]]?.element);
  if(item&&stack.children[i]!==item)stack.insertBefore(item,stack.children[i]||null);
 }
 for(const [key,info] of Object.entries(groupInfo)){
  const open=!!state.openGroups?.[key];$(info.list).classList.toggle('is-collapsed',!open);
  $(info.button)?.setAttribute('aria-expanded',String(open));
  if($(info.button)){const name=info.label+' accounts';const action=open?'Collapse':'Expand';$(info.button).title=action+' '+name;$(info.button).setAttribute('aria-label',action+' '+name);}
  const group=$(info.element);const pos=state.platformOrder.indexOf(key);
  group.querySelector('.group-move-up').disabled=pos===0;
  group.querySelector('.group-move-down').disabled=pos===state.platformOrder.length-1;
 }
}
async function setAccountGroup(group,trigger=null){
 if(!state||!groupInfo[group]||trigger?.disabled)return;
 const original=!!state.openGroups[group];
 state.openGroups[group]=!original;
 // Immediate paint; do NOT rerender all accounts, reminders, notifications and chats.
 applyGroupOrder();
 if(trigger)trigger.disabled=true;
 try{await window.desktop.save(state);}
 catch(error){state.openGroups[group]=original;applyGroupOrder();toast('Could not save panel position: '+error.message);}
 finally{if(trigger)trigger.disabled=false;}
}
async function movePlatformGroup(group,delta){
 if(!state||!groupInfo[group])return;
 const index=state.platformOrder.indexOf(group),target=index+delta;
 if(index<0||target<0||target>=state.platformOrder.length)return;
 state.platformOrder.splice(index,1);state.platformOrder.splice(target,0,group);
 applyGroupOrder();await persist();toast(`${groupInfo[group].label} moved ${delta<0?'up':'down'}.`);
}
for(const [key,info] of Object.entries(groupInfo)){
 const header=$(info.element).querySelector('.side-header');
 const controls=document.createElement('div');controls.className='group-order-actions';
 for(const [cls,arrow,delta] of [['group-move-up','↑',-1],['group-move-down','↓',1]]){
  const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=arrow;
  b.title=`Move ${info.label} group ${delta<0?'up':'down'}`;b.setAttribute('aria-label',b.title);
  b.onclick=()=>void busy(b,()=>movePlatformGroup(key,delta));controls.append(b);
 }
 header.insertBefore(controls,header.lastElementChild);
}
async function moveAccount(group,id,delta){
 const arr=group==='wa'?state.accounts:group==='tg'?state.telegramAccounts:state.signalSlots;
 const index=arr.findIndex(a=>String(a.id)===String(id));const dest=index+delta;
 if(index<0||dest<0||dest>=arr.length){toast('Already at the end of this group.');return;}
 const [item]=arr.splice(index,1);arr.splice(dest,0,item);
 await persist();toast(`${item.name} moved ${delta<0?'up':'down'} in ${groupInfo[group].label}.`);
}
async function reorderOnDrop(group,fromId,toId,before){
 const arr=group==='wa'?state.accounts:group==='tg'?state.telegramAccounts:state.signalSlots;
 const src=arr.findIndex(a=>String(a.id)===String(fromId)),dst=arr.findIndex(a=>String(a.id)===String(toId));
 if(src<0||dst<0||src===dst)return;
 const [moving]=arr.splice(src,1);let newIndex=arr.findIndex(a=>String(a.id)===String(toId));
 if(!before)newIndex++;arr.splice(newIndex,0,moving);
 await persist();toast(`${moving.name} moved. New order saved.`);
}
function bindAccountDrag(row,group,id){
 row.draggable=false;row.dataset.orderGroup=group;row.dataset.orderId=String(id);
 let origin=null,moved=false,lastTarget=null;
 const pointerMove=e=>{
  if(!origin||e.pointerId!==origin.pointerId)return;
  if(!moved&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>10){
   moved=true;row.classList.add('dragging');
  }
  if(!moved)return;
  const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-order-group]');
  if(lastTarget&&lastTarget!==hit)lastTarget.classList.remove('drag-target');
  lastTarget=hit?.dataset.orderGroup===group?hit:null;
  if(lastTarget&&lastTarget!==row)lastTarget.classList.add('drag-target');
 };
 const finish=e=>{
  if(!origin||e.pointerId!==origin.pointerId)return;
  const wasMoved=moved;origin=null;moved=false;
  document.removeEventListener('pointermove',pointerMove,true);
  document.removeEventListener('pointerup',finish,true);
  document.removeEventListener('pointercancel',finish,true);
  row.classList.remove('dragging');
  const target=lastTarget;lastTarget=null;if(target)target.classList.remove('drag-target');
  if(wasMoved){
   row.dataset.ignoreClick='yes';
   if(target&&target!==row&&e.type==='pointerup'){
    const rect=target.getBoundingClientRect();
    void reorderOnDrop(group,id,target.dataset.orderId,e.clientY<rect.top+rect.height/2).catch(err=>toast('Could not move account: '+err.message));
   }
  }
 };
 row.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.pointerType==='touch')return;
  origin={x:e.clientX,y:e.clientY,pointerId:e.pointerId};moved=false;
  document.addEventListener('pointermove',pointerMove,true);
  document.addEventListener('pointerup',finish,true);
  document.addEventListener('pointercancel',finish,true);
 });
}

const safeName=x=>String(x||'').trim().slice(0,48);
const nowText=()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
function toast(text){$('toast').textContent=String(text);$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),5500);}
function message(text){setUiText('statusText',text);}
function button(text,id,cls='',title=''){const b=document.createElement('button');b.textContent=text;b.className=cls;b.id=id||'';b.title=title;return b;}
// Keep action SVGs aligned with button labels when a status update changes text.
function setButtonText(id,label){const b=$(id), span=b?.querySelector('.button-label');if(span){span.textContent=label;}else if(b){b.textContent=label;}}
const ICON_PATHS={
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l-1.8 1.8a1.7 1.7 0 0 0-1.9-.3l-1.8.8v2.1H9.8v-2.1L8 18.4a1.7 1.7 0 0 0-1.9.3l-1.8-1.8a1.7 1.7 0 0 0 .3-1.9L3.8 13H2v-2h1.8l.8-2a1.7 1.7 0 0 0-.3-1.9l1.8-1.8a1.7 1.7 0 0 0 1.9.3l1.8-.8V2.7h4.4v2.1l1.8.8a1.7 1.7 0 0 0 1.9-.3l1.8 1.8a1.7 1.7 0 0 0-.3 1.9l.8 2H22v2h-1.8z"/>',
 edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.1 18.9 3 20l1.1-4.1z"/>',
 star:'<path d="m12 2 3.1 6.3 7 1-5.1 5 .9 7L12 18l-5.9 3.3.9-7-5.1-5 7-1z"/>',
 flag:'<path d="M4 22V4m0 0c5-3 9 3 16 0v12c-7 3-11-3-16 0"/>',
 reload:'<path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5"/>',
 sparkles:'<path d="m12 3 1.8 5.3L19 10l-5.2 1.7L12 17l-1.8-5.3L5 10l5.2-1.7z"/><path d="m20 17 .8 1.2 1.2.8-1.2.8-.8 1.2-.8-1.2-1.2-.8 1.2-.8z"/>',
 translate:'<path d="M5 7h14M12 4v3M7 10c1 3 4 6 8 8M15 10c-.4 4-3 7-8 9"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
 play:'<path d="m9 5 11 7-11 7z"/>',
 note:'<path d="M5 4h14v16H5zM8 9h8M8 13h8"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',
 phone:'<path d="M22 16.9v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72l.35 2.87a2 2 0 0 1-.57 1.66L7.7 9.4a16 16 0 0 0 6.9 6.9l1.15-1.18a2 2 0 0 1 1.66-.57l2.87.35A2 2 0 0 1 22 16.9z"/>',
 alert:'<path d="M12 2 2 20h20L12 2zM12 9v4M12 17h.01"/>',
 plus:'<path d="M12 5v14M5 12h14"/>'
};
function decorateButton(id,iconName,label){const b=$(id);if(!b)return;const path=ICON_PATHS[iconName];if(!path)return;
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.8');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');icon.setAttribute('aria-hidden','true');icon.classList.add('action-icon');icon.innerHTML=path;
 const span=document.createElement('span');span.className='button-label';span.textContent=label;b.replaceChildren(icon,span);
}
[
 ['bell','bell','Alerts 0'],['settings','settings','Settings'],['renameCurrent','edit','Rename'],
 ['quickMissedCalls','phone','Calls & notes'],
 ['followCurrent','star','Follow up'],['quickReply','flag','Remind'],['reloadCurrent','reload','Reload'],
 ['reply','sparkles','Write my reply'],['runAction','play','Apply'],['translate','translate','Translate'],
 ['openGoogleTranslate','globe','Google Translate'],['copyAi','copy','Copy result'],
 ['sendToTemplates','note','Saved replies'],['toolAi','sparkles','Gemini'],['toolTemplates','note','Saved texts'],
 ['toolActivity','alert','Alerts'],['toolReminders','flag','Reminders'],['toolCalls','phone','Calls & Notes'],
 ['startAll','play','Start all'],['startWhatsAppAll','play','Start all WhatsApp']
].forEach(([id,icon,label])=>decorateButton(id,icon,label));
const queueBadge=document.createElement('span');queueBadge.id='queueBadge';$('toolReminders').append(queueBadge);
const callBadge=document.createElement('span');callBadge.id='callBadge';$('toolCalls').append(callBadge);
const fmtDate=t=>new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function unreadCount(id){return counts.get(id)||0;}
function unreadTotal(){const usable=allWebAccounts().filter(a=>a.active!==false&&views.has(a.id)&&counts.has(a.id)).map(a=>counts.get(a.id)).filter(Number.isSafeInteger);return usable.length?usable.reduce((sum,x)=>sum+x,0):null;}
function checkTitle(title){const text=String(title||'').trim(),m=/^\((\d+)\)/.exec(text);if(m){const n=Number(m[1]);return Number.isSafeInteger(n)?n:null;}if(/^(whatsapp|telegram)\s*$/i.test(text))return 0;return null;}
function forgetUnread(id){counts.delete(id);unreadCheckAt.delete(id);dismissedAlerts.delete(id);}
function updateStats(){
 if(!state)return;
 setUiText('waNum',`(${state.accounts.length})`);
 setUiText('tgNum',`(${state.telegramAccounts.length})`);
 setUiText('signalNum',`(${state.signalSlots.length})`);
 setUiText('statSignal',state.signalSlots.length);
 setUiText('statLoaded',[...views.keys()].filter(id=>!isTelegram(id)).length);
 setUiText('statTelegram',[...views.keys()].filter(isTelegram).length);
 setUiText('statActive',views.size);
 alwaysOnStatus();
 setUiText('statUnread',unreadTotal()??'—');
 setUiText('statDue',state.reminders.filter(r=>!r.done&&r.due<=Date.now()).length);
 setUiText('statFollow',state.reminders.filter(r=>!r.done).length);
 const pendingCalls=(state.missedCalls||[]).filter(c=>c.status==='pending');
 setUiText('statMissedCalls',pendingCalls.length ? `${pendingCalls.length} notes` : 'Open');
 const byPlatform=Object.fromEntries(['whatsapp','signal','telegram'].map(p=>[p,pendingCalls.filter(c=>callPlatform(c.accountId)===p).length]));
 setUiText('statCallSources',pendingCalls.length ? `Recorded: WA ${byPlatform.whatsapp} · SIG ${byPlatform.signal} · TG ${byPlatform.telegram}` : 'Provider call history not synced');
 setUiText('callSidebarBadge',pendingCalls.length);
 $('quickMissedCalls')?.setAttribute('aria-label',`${pendingCalls.length} manually recorded callback notes. Provider calls not synced.`);
 setUiText('callBadge',pendingCalls.length||'');
 setUiText('queueBadge',state.reminders.filter(r=>!r.done).length||'');
 for(const row of document.querySelectorAll('.account-row[data-account-id],.telegram-row[data-account-id]')){
  row.querySelector('.account-avatar,.telegram-avatar')?.classList.toggle('session-live',views.has(row.dataset.accountId));
 }
 const runningWhatsapp=state.accounts.filter(a=>views.has(a.id)).length;
 setUiText('backgroundSessionSummary',`${runningWhatsapp}/${state.accounts.length} WA`);
 const knownUnread=unreadTotal(),due=state.reminders.filter(r=>!r.done&&r.due<=Date.now()).length;
 setButtonText('bell','Alerts '+(knownUnread===null&&due===0?'—':(knownUnread??0)+due));
 if(activeTool==='Activity')renderNotificationCenter();
 if(!$('executiveInbox')?.hidden && !executiveInboxFrame){ executiveInboxFrame=requestAnimationFrame(()=>{executiveInboxFrame=0;renderExecutiveInbox();}); }
 setUiText('tabUnread',unreadCount(selected)>0?` · ${unreadCount(selected)} unread`:'');
 setButtonText('followCurrent',getAccount(selected)?.followup?'Following up':'Follow up');
}

async function persist(){state=await window.desktop.save(state);applyGroupOrder();renderAccounts();renderTelegram();renderSignal();renderReminders();renderMissedCalls();updateStats();}
function updateRailSelectedState(){
 for(const row of document.querySelectorAll('.account-row[data-account-id],.telegram-row[data-account-id]')){
  row.classList.toggle('active',row.dataset.accountId===selected);
 }
 for(const row of document.querySelectorAll('.signal-row[data-slot-id]')){
  row.classList.toggle('active',row.dataset.slotId===String(activeSignalSlot));
 }
}
function applyCompactRailSettings(){
 const enabled=!!state?.ui?.arrangeMode;
 $('workspaceRoot')?.classList.toggle('arrange-mode',enabled);
 const toggle=$('toggleArrangeMode');if(toggle){toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?'✓ Finish arranging groups':'Arrange groups';}
}
async function changeSelected(id){
 await window.desktop.signalDockHide?.();
 if(switchInFlight||!getAccount(id))return;
 switchInFlight=true;
 try{
  message(`Opening ${getAccount(id).name}…`);
  await deferFrame();
  if($('profileMore'))$('profileMore').open=false;
  selected=id;activeSignalSlot=null;document.getElementById('signalDock').hidden=true;$('welcome').style.display='none';
  $('views').querySelectorAll('.paused-placeholder').forEach(e=>e.remove());
  for(const buttonId of ['renameCurrent','followCurrent','quickReply','reloadCurrent','pauseCurrent','activeCurrent'])$(buttonId).hidden=false;
  const grp=platform(id);
  // Always-On keeps sessions mounted; optional Low RAM mode unloads only the other
  // renderer views (NOT their persisted cookie/IndexedDB partitions).
  if(state.ui?.lowMemoryMode){for(const other of [...views.keys()])if(other!==id)releaseView(other);}
  for(const [other,view] of views)view.container.classList.toggle('active',other===id);
  $('signalProfileDashboard')?.remove();
  if(!state.openGroups[grp]&&!$('search').value.trim()){
   state.openGroups[grp]=true;applyGroupOrder();await window.desktop.save(state);
  }
  for(const [key,item] of views)item.container.classList.toggle('active',key===id);
  const account=getAccount(id);
  if(account.active!==false){const v=createView(id);v.container.classList.add('active');}
  else{showPausedPlaceholder(id);}
  setProfileControls(id);
  setUiText('tabName',account.name);
  $('tabCurrent').dataset.platform=grp;
  const tabIcon=$('tabCurrent')?.querySelector('img');if(tabIcon)tabIcon.src=grp==='tg'?'telegram-icon.svg':'whatsapp-icon.svg';
  const remind=$('reminderAccount');if([...remind.options].some(x=>x.value===id))remind.value=id;
  message(`Showing ${account.name} · independent ${sourceName(id)} web session`);
  updateRailSelectedState();updateStats();
 }catch(err){console.error('[EAGLE RS] Account selection failed:',err);toast('Account switch failed: '+err.message);}finally{switchInFlight=false;}
}
function createView(id){
 if(views.has(id))return views.get(id);
 const account=getAccount(id);if(!account)throw new Error('Account is missing.');
 if(account.active===false)throw new Error('This profile is paused. Turn Active on first.');
 const tg=isTelegram(id),container=document.createElement('div');container.className='pane';
 const loading=document.createElement('div');loading.className='view-loading';
 const pulse=document.createElement('span');pulse.className='load-ring';pulse.setAttribute('aria-hidden','true');
 const label=document.createElement('span');label.textContent=`Connecting ${account.name}…`;
 loading.append(pulse,label);container.append(loading);
 const web=document.createElement('webview');
 // Older WhatsApp partitions stay unchanged to preserve QR logins across updates.
 web.setAttribute('partition',account.partition || (tg?`persist:tg_session_${id.slice(3)}`:`persist:mm3-${id}`));
 web.setAttribute('src',tg?'https://web.telegram.org/a/':'https://web.whatsapp.com/');
 web.addEventListener('page-title-updated',e=>{if(views.get(id)?.web===web)handleTitle(id,e.title);});
 web.addEventListener('dom-ready',()=>{setTimeout(()=>{if(views.get(id)?.web===web)crashBackoff.delete(id)},60000);});
 web.addEventListener('render-process-gone',e=>{if(views.get(id)?.web===web)handleWebviewCrash(id,e);});
 web.addEventListener('destroyed',()=>{if(views.get(id)?.web===web)releaseView(id);});
 web.addEventListener('did-attach',()=>{void window.desktop.partitionCheck(web.getAttribute('partition')).then(result=>{if(!result?.ok)toast(`${account.name}: persistent storage verification failed.`)}).catch(()=>{});});
 web.addEventListener('did-start-loading',()=>{loading.classList.remove('is-hidden')});
 web.addEventListener('did-stop-loading',()=>{loading.classList.add('is-hidden')});
 web.addEventListener('did-fail-load',e=>{loading.classList.add('is-hidden');if(e.errorCode!==-3)toast(`${sourceName(id)} load issue: ${e.errorDescription}`);});
 web.addEventListener('will-navigate',e=>{try{const u=new URL(e.url),host=tg?'web.telegram.org':'web.whatsapp.com';if(u.protocol!=='https:'||u.hostname!==host)e.preventDefault();}catch{e.preventDefault();}});
 container.append(web);$('views').append(container);views.set(id,{container,web});updateStats();return views.get(id);
}
function releaseView(id){
 clearTimeout(crashTimers.get(id));crashTimers.delete(id);
 const v=views.get(id);forgetUnread(id);
 // Destroy only the webview renderer; the on-disk persistent partition stays untouched.
 views.delete(id);try{v?.container.remove()}catch{}renderAccounts();renderTelegram();updateStats();
}
function showPausedPlaceholder(id){
 const root=$('views');root.querySelectorAll('.paused-placeholder').forEach(e=>e.remove());
 const el=document.createElement('div');el.className='pane active paused-placeholder';
 const box=document.createElement('section');box.className='pause-card';
 box.innerHTML='<h3>Profile paused</h3><p>This account is inactive. Its webview is unloaded to reduce RAM usage. Your local login data has not been cleared.</p>';
 const resume=document.createElement('button');resume.textContent='Resume profile';resume.onclick=()=>void setProfileActive(id,true,resume);
 box.append(resume);el.append(box);root.append(el);
}
function setProfileControls(id){
 const a=getAccount(id),isActive=a?.active!==false;
 const toggle=$('activeCurrent');toggle.classList.toggle('inactive',!isActive);
 toggle.textContent=isActive?'● Active':'○ Inactive';toggle.setAttribute('aria-pressed',String(isActive));
 $('pauseCurrent').disabled=!isActive;$('reloadCurrent').disabled=!isActive;
}
async function setProfileActive(id,active,control){
 await busy(control,async()=>{
  const a=getAccount(id);if(!a)return;
  if(!active)releaseView(id);
  a.active=!!active;await persist();
  if(selected===id){for(const pane of $('views').children)pane.classList.remove('active');
   if(active){$('views').querySelectorAll('.paused-placeholder').forEach(e=>e.remove());createView(id).container.classList.add('active');}
   else showPausedPlaceholder(id);
  }
  setProfileControls(id);
  toast(`${a.name} ${active?'resumed':'paused'} — saved login partition preserved.`);
 });
}
function handleWebviewCrash(id,event){
 const a=getAccount(id);releaseView(id);
 if(!a||a.active===false)return;
 const count=(crashBackoff.get(id)||0)+1;crashBackoff.set(id,count);
 if(count>3){toast(`${a.name} crashed repeatedly. Resume it manually; login data is preserved.`);a.active=false;void persist();if(selected===id){showPausedPlaceholder(id);setProfileControls(id);}return;}
 const wait=Math.min(2000*count,10000);
 toast(`${a.name} renderer stopped (${event?.reason||'unknown'}). Retrying in ${wait/1000}s.`);
 clearTimeout(crashTimers.get(id));const timer=setTimeout(()=>{
  crashTimers.delete(id);if(!getAccount(id)||a.active===false||views.has(id))return;
  try{const v=createView(id);v.container.classList.toggle('active',selected===id&&activeSignalSlot===null);}catch(e){toast(e.message)}
 },wait);crashTimers.set(id,timer);
}
async function refreshActiveLoaded(){
 const entries=[...views.entries()].filter(([id])=>getAccount(id)?.active!==false);
 if(!entries.length)return toast('No active loaded webview to refresh.');
 for(const [id,v] of entries){if(!views.has(id))continue;try{v.web.reload()}catch(e){toast(`${getAccount(id)?.name||id}: ${e.message}`)}await new Promise(r=>setTimeout(r,300));}
 toast(`Refresh requested for ${entries.length} active webviews, one at a time.`);
}
function handleTitle(id,title){
 if(!getAccount(id)||getAccount(id).active===false||!views.has(id))return;
 const n=checkTitle(title),old=counts.has(id)?counts.get(id):null;
 if(n===null)forgetUnread(id);else counts.set(id,n);
 if(old!==null && n>old){
  const a=getAccount(id);const delta=n-old;
  activity.unshift({id,number:n,time:Date.now(),description:`${sourceName(id)} · ${a?.name||id}: reported unread +${delta} (now ${n})`});
  activity.splice(50);renderActivity();
  if(state.prefs.desktop)window.desktop.notify({title:`${sourceName(id)} · ${a?.name||id} · ${n} unread`,body:`${sourceName(id)} account ${a?.name||id} reports ${n} unread (previously ${old}). Open to review.`,accountId:id,sound:state.prefs.sound});
 }
 if(n>0){if(!unreadCheckAt.has(id)||n>old)unreadCheckAt.set(id,Date.now());}
 else unreadCheckAt.delete(id);
 // A newly unread account may be absent from the filtered rail entirely.
 if(filter==='unread'){renderAccounts();renderTelegram();}
 const row=document.querySelector(`[data-account-id="${CSS.escape(id)}"]`);
 if(row){
  const badge=row.querySelector('.badge');
  if(badge){badge.textContent=n>99?'99+':String(n??0);badge.hidden=n===null||n<1;}
  const account=getAccount(id);
  row.setAttribute('aria-label',`Open ${sourceName(id)} account ${account?.name||id}${n?' — '+n+' reported unread':''}`);
  tooltip(row,`${sourceName(id)} · ${account?.name||id} · Browser running · ${n===null?'Unread not available':n+' reported unread'} · drag to reorder · right-click Move up/down`);
 }
 updateStats();
}
function renderAccounts(){return renderWebAccounts('wa');}
function renderTelegram(){return renderWebAccounts('tg');}
function renderWebAccounts(group){
 const tg=group==='tg',root=$(tg?'telegramList':'waList');root.replaceChildren();if(!state)return;
 const term=$('search').value.trim().toLowerCase();
 const arr=(tg?state.telegramAccounts:state.accounts).filter(a=>a.name.toLowerCase().includes(term))
  .filter(a=>filter==='all'||(filter==='unread'?unreadCount(a.id)>0:a.followup))
;
 for(const a of arr){
  const flags=state.reminders.filter(r=>!r.done&&r.accountId===a.id).length;
  const row=document.createElement('div');row.className=(tg?'telegram-row':'account-row')+(a.id===selected?' active':'')+(flags?' flag-needs-reply':'');row.role='button';row.tabIndex=0;
  const avatar=document.createElement('span');avatar.className=tg?'telegram-avatar':'account-avatar';
  const icon=document.createElement('img');icon.className='circle';icon.src=tg?'telegram-icon.svg':'whatsapp-icon.svg';icon.alt='';icon.draggable=false;
  avatar.append(icon);avatar.classList.toggle('session-live',views.has(a.id));
  const n=unreadCount(a.id),badge=document.createElement('span');badge.className='badge';badge.textContent=n>99?'99+':String(n);badge.hidden=n<1;avatar.append(badge);
  if(flags){const flag=document.createElement('span');flag.className='task-count';flag.textContent=String(flags);flag.title=`${flags} reply reminders`;avatar.append(flag);}
  if(a.color==='gold')avatar.style.borderColor='#EAB308';
  if(a.color==='blue')avatar.style.borderColor='#6366F1';
  if(a.color==='rose')avatar.style.borderColor='#FB7185';
  const caption=document.createElement('span');caption.className='avatar-caption';caption.textContent=(a.pin?'★ ':'')+(tg?'TG ':'WA ')+a.id.slice(3);
  const name=document.createElement('span');name.className='nm';name.textContent=a.name;
  row.append(avatar,caption,name);
  row.dataset.accountId=a.id;row.setAttribute('aria-label',`Open ${sourceName(a.id)} account ${a.name}${n?' — '+n+' reported unread':''}`);
  tooltip(row,`${sourceName(a.id)} · ${a.name} · ${views.has(a.id)?'Browser running':'Browser not loaded'} · ${counts.has(a.id)?n+' reported unread':'Unread not available'} · drag to reorder · right-click Move up/down`);
  row.onclick=()=>{if(row.dataset.ignoreClick){delete row.dataset.ignoreClick;return;}return busy(row,()=>changeSelected(a.id));};row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}};
  row.ondblclick=()=>void rename(a);
  row.oncontextmenu=e=>{e.preventDefault();void manageAccount(a)};
  bindAccountDrag(row,group,a.id);root.append(row);
 }
 if(!arr.length){const hint=document.createElement('p');hint.className='empty-rail';hint.textContent=tg?'No Telegram accounts':'No matching accounts';root.append(hint);}
}
function renderSignal(){
 const root=$('signalList');root.replaceChildren();if(!state)return;
 const term=$('search').value.trim().toLowerCase();
 for(const slot of state.signalSlots.filter(s=>s.name.toLowerCase().includes(term))){
  const row=document.createElement('div');row.className='signal-row'+(activeSignalSlot===slot.id?' active':'');row.dataset.slotId=String(slot.id);row.role='button';row.tabIndex=0;const avatar=document.createElement('span');avatar.className='signal-avatar';
  const icon=document.createElement('img');icon.className='circle';icon.src='signal-icon.svg';icon.alt='';icon.draggable=false;avatar.append(icon);
  const manualPending=state.reminders.filter(r=>!r.done&&r.accountId===`signal-${slot.id}`).length;
  if(manualPending){const chip=document.createElement('span');chip.className='signal-badge';chip.textContent=manualPending>99?'99+':manualPending;chip.title=`${manualPending} manual reply reminders, NOT unread Signal messages`;avatar.append(chip);}
  const caption=document.createElement('span');caption.className='avatar-caption';caption.textContent='SIG '+slot.id;
  const name=document.createElement('span');name.className='nm';name.textContent=slot.name;row.append(avatar,caption,name);
  tooltip(row,`Signal · ${slot.name} · unread unavailable · ${manualPending} manual reminders · drag to reorder`);
  row.setAttribute('aria-label','Launch '+slot.name);
  row.onclick=()=>{if(row.dataset.ignoreClick){delete row.dataset.ignoreClick;return;}return busy(row,()=>selectSignal(slot.id));};row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}};
  row.ondblclick=()=>void renameSignal(slot);
  row.oncontextmenu=e=>{e.preventDefault();void manageSignal(slot);};
  bindAccountDrag(row,'signal',slot.id);root.append(row);
 }
}
async function selectSignal(id){
 await window.desktop.signalDockHide?.();
 const slot=state.signalSlots.find(x=>x.id===id);if(!slot)return;
  // Signal always renders its separate controller; independent web sessions stay mounted but hidden
  // so their background sync continues until explicitly paused/stopped.
 if(state.ui?.lowMemoryMode){for(const id of [...views.keys()])releaseView(id);}
 for(const view of views.values())view.container.classList.remove('active');
 $('views').querySelectorAll('.paused-placeholder').forEach(e=>e.remove());
 $('signalProfileDashboard')?.remove();
 selected=null;activeSignalSlot=id;$('welcome').style.display='none';
 $('signalDock').hidden=false;$('signalDockLabel').textContent=`Signal · ${slot.name}`;
 $('signalActive').textContent=slot.active===false?'○ Inactive':'● Active';
 $('signalOpen').disabled=slot.active===false;
 for(const buttonId of ['renameCurrent','followCurrent','quickReply','reloadCurrent','pauseCurrent','activeCurrent'])$(buttonId).hidden=true;
 const signalTabIcon=$('tabCurrent')?.querySelector('img');if(signalTabIcon)signalTabIcon.src='signal-icon.svg';setUiText('tabName',slot.name);
 if($('tabCurrent'))$('tabCurrent').dataset.platform='signal';setUiText('tabUnread','');
 const panel=document.createElement('div');panel.id='signalProfileDashboard';panel.className='signal-profile-dashboard';
 const body=document.createElement('section');body.className='signal-controller';
 const headline=document.createElement('h2'),symbol=document.createElement('img');symbol.src='signal-icon.svg';symbol.alt='';headline.append(symbol,document.createTextNode(slot.name));
 const help=document.createElement('p');help.textContent='Official Signal Desktop opens as a separate application. The launch control cannot guarantee different Signal accounts: Signal does not officially support arbitrary independent desktop profiles.';
 const pathHint=document.createElement('p');pathHint.textContent=`Requested local profile folder: signal-sessions/sig_${slot.id}`;
 const stateLine=document.createElement('p');stateLine.id='signalProcessState';stateLine.textContent='Checking whether this workspace is tracking a launched Signal process…';
 const controls=document.createElement('div');controls.className='control-row';
 for(const [label,idRef] of [['↗ Launch','signalOpen'],['↻ Relaunch','signalReload'],['■ Stop','signalStop'],['● Active / Inactive','signalActive']]){
  const b=document.createElement('button');b.textContent=label;b.onclick=()=>$(idRef).click();controls.append(b);
 }
 const warning=document.createElement('p');warning.className='warning';warning.textContent='A launcher slot is not proof of an independent Signal login. If the same Signal account opens, do not continue linking additional phones or erase existing Signal data.';
 body.append(headline,help,pathHint,stateLine,controls,warning);panel.append(body);$('views').append(panel);
 try{const info=await window.desktop.signalStatus(slot.id);if($('signalProcessState'))$('signalProcessState').textContent=(info.running?'Tracked Signal process running (PID '+info.pid+').':'No tracked Signal process running.')+' Requested data directory: '+(info.profileDirectory||'unknown')+' (not guaranteed to be used by Signal).';}catch{if($('signalProcessState'))$('signalProcessState').textContent='Signal process status unavailable.';}
 updateRailSelectedState();updateStats();
 window.EagleSignalDockUI?.open(id,slot.name);
}
async function openSignal(id){
 // The default Signal Desktop profile and experimental extra profiles are not web sessions.
 // The app never asserts that a launcher slot is a separately authenticated account.
 try{const r=await window.desktop.signal(id);toast(r.message||'Signal launch requested.');if(!r.ok)toast('Install official Signal Desktop from signal.org to use Signal slots.');}
 catch(e){toast('Signal launch failed: '+e.message);}
}

// Promise-driven, non-blocking inline dialogs: no alert/prompt/confirm in account operations.
let modalResolve=null;
function showAccountModal({title,value='',help='',kind='name'}){
 if(modalResolve)return Promise.resolve(null);
 return new Promise(resolve=>{
  modalResolve=resolve;
  $('accountModalTitle').textContent=title;
  $('accountModalHelp').textContent=help;
  $('accountNameFields').hidden=['manage','signal-manage'].includes(kind);$('accountManageFields').hidden=!['manage','signal-manage'].includes(kind);
  $('accountNameInput').value=value;$('accountManageAction').value='moveup';
  for(const opt of $('accountManageAction').options){opt.hidden=kind==='signal-manage'&&!['moveup','movedown','rename'].includes(opt.value);opt.disabled=opt.hidden;}
  $('accountModal').classList.add('show');
  $('accountSave').textContent=kind==='manage'?'Apply':'Save';
  requestAnimationFrame(()=>(kind==='manage'?$('accountManageAction'):$('accountNameInput')).focus());
 });
}
function finishAccountModal(ok){
 if(!modalResolve)return;
 const kind=$('accountManageFields').hidden?'name':'manage';
 const result=ok?(kind==='manage'?$('accountManageAction').value:safeName($('accountNameInput').value)):null;
 $('accountModal').classList.remove('show');const resolve=modalResolve;modalResolve=null;resolve(result);
}
$('accountCancel').onclick=()=>finishAccountModal(false);
$('accountSave').onclick=()=>finishAccountModal(true);
$('accountModal').onclick=e=>{if(e.target===$('accountModal'))finishAccountModal(false);};
$('accountNameInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();finishAccountModal(true);}if(e.key==='Escape')finishAccountModal(false);};
$('accountManageAction').onkeydown=e=>{if(e.key==='Escape')finishAccountModal(false);};
async function rename(a){
 try{const n=await showAccountModal({title:`Rename ${a.name}`,value:a.name,help:'The account name is a local label; it does not change the account login.'});
  if(!n)return;if(!getAccount(a.id))return;a.name=n;await persist();if(selected===a.id)$('tabName').textContent=a.name;
 }catch(err){toast('Rename failed: '+err.message);}
}
async function renameSignal(slot){
 try{const n=await showAccountModal({title:`Rename ${slot.name}`,value:slot.name,help:'This changes only the launcher label, not its Signal login.'});
  if(!n)return;slot.name=n;await persist();}catch(err){toast('Signal rename failed: '+err.message);}
}
async function manageAccount(a){
 try{const action=await showAccountModal({title:`Manage ${a.name}`,kind:'manage',help:'Select what you want to do with this account.'});
  if(!action||!getAccount(a.id))return;
  a=getAccount(a.id);const wasSelected=selected===a.id;
  if(action==='rename')return rename(a);
  if(action==='moveup'||action==='movedown')return moveAccount(platform(a.id),a.id,action==='moveup'?-1:1);
  if(action==='pin')a.pin=!a.pin;
  if(action==='follow')a.followup=!a.followup;
  if(['green','gold','blue','rose'].includes(action))a.color=action;
  if(action==='close'){releaseView(a.id);if(selected===a.id)selected=null;}
  if(action==='remove'){
   releaseView(a.id);
   const key=isTelegram(a.id)?'telegramAccounts':'accounts';state[key]=state[key].filter(x=>x.id!==a.id);
   if(selected===a.id)selected=null;
  }
  await persist();
  if(wasSelected&&['close','remove'].includes(action)){
   const next=allWebAccounts().find(account=>account.id!==a.id);
   if(next)await changeSelected(next.id);
   else{
    $('views').querySelectorAll('.paused-placeholder').forEach(el=>el.remove());$('welcome').style.display='grid';
    setUiText('tabName','Choose an account');setUiText('tabUnread','');
    for(const buttonId of ['renameCurrent','followCurrent','quickReply','reloadCurrent','pauseCurrent','activeCurrent'])$(buttonId).hidden=true;
   }
  }
  if(['close','remove'].includes(action))toast('Webview removed from the workspace; stored login data has not been deleted.');
 }catch(err){toast('Could not manage account: '+err.message);}
}
async function manageSignal(slot){
 try{const action=await showAccountModal({title:`Arrange ${slot.name}`,kind:'signal-manage',help:'Signal unread messages cannot be counted here. These are launcher labels only.'});
  if(action==='rename')return renameSignal(slot);
  if(action==='pause'){slot.active=false;await window.desktop.signalStop(slot.id);await persist();return selectSignal(slot.id);}
  if(action==='resume'){slot.active=true;await persist();return selectSignal(slot.id);}
  if(action==='stop'){const res=await window.desktop.signalStop(slot.id);toast(res.message);return;}
  if(action==='moveup'||action==='movedown')return moveAccount('signal',slot.id,action==='moveup'?-1:1);
 }catch(err){toast('Signal management failed: '+err.message);}
}
async function addAccount(group='wa',buttonRef=null){
 return busy(buttonRef,async()=>{
  const tg=group==='tg',sig=group==='signal';
  const next=sig?state.nextSignalId:tg?state.nextTgId:state.nextId;
  const suggested=(sig?'Signal ':tg?'Telegram ':'WhatsApp ')+next;
  const name=await showAccountModal({title:`Add ${sig?'Signal launcher':tg?'Telegram account':'Messaging account'}`,value:suggested,
   help:sig?'Signal is an external Desktop launcher, not an isolated web session.':`A new ${tg?'Telegram':'WhatsApp'} session will have its own browser storage and sign-in.`});
  if(!name)return;
  if(sig){state.signalSlots.push({id:next,name,active:true});state.nextSignalId=next+1;}
  else if(tg){state.telegramAccounts.push({id:'tg-'+next,name,pin:false,color:'blue',followup:false,active:true,partition:`persist:tg_session_${next}`});state.nextTgId=next+1;}
  else{state.accounts.push({id:'wa-'+next,name,pin:false,color:'green',followup:false,active:true,partition:`persist:wa_session_${next}`});state.nextId=next+1;}
  await persist();
  if(!sig){await changeSelected((tg?'tg-':'wa-')+next);}else toast('Signal launcher added. Separate account login is not guaranteed.');
 });
}
function platformLabel(group){return groupInfo[group]?.label||group;}
function reminderLabel(id){if(typeof id==='string'&&id.startsWith('signal-'))return 'Signal · '+(state.signalSlots.find(x=>String(x.id)===id.slice(7))?.name||id);const a=getAccount(id);return `${sourceName(id)} · ${a?.name||id}`;}
function renderNotificationCenter(){
 if(!state)return;
 const root=$('unreadAccountList');root.replaceChildren();
 const known=allWebAccounts().filter(a=>counts.has(a.id)), unread=allWebAccounts().filter(a=>unreadCount(a.id)>0);
 const reported=unread.reduce((sum,a)=>sum+unreadCount(a.id),0);
 const pending=state.reminders.filter(r=>!r.done),due=pending.filter(r=>r.due<=Date.now());
 const metric=(value,label)=>{const box=document.createElement('div');box.className='alert-metric';const strong=document.createElement('strong');strong.textContent=value;const small=document.createElement('small');small.textContent=label;box.append(strong,small);return box;};
 $('alertSummary').replaceChildren(metric(known.length?reported:'—','Reported unread · loaded web accounts'),metric(due.length,'Due reply reminders'));
 const block=(group,heading,icon,items,bottom)=>{
  const frame=document.createElement('div');frame.className='alert-group';const title=document.createElement('div');title.className='alert-group-title';
  const img=document.createElement('img');img.src=icon;img.alt='';const text=document.createElement('span');text.textContent=heading;
  const count=document.createElement('span');count.className='platform-subtotal';count.textContent=group==='signal'?`${items.length} tasks`:`${items.reduce((n,a)=>n+unreadCount(a.id),0)} reported`;
  title.append(img,text,count);frame.append(title);
  if(!items.length){const empty=document.createElement('div');empty.className='alert-empty';empty.textContent=bottom;frame.append(empty);}
  else for(const a of items){
   const row=document.createElement('button');row.className='alert-entry';const name=document.createElement('span');name.className='entry-name';name.textContent=a.name;
   const b=document.createElement('span');b.className=group==='signal'?'reminder-pill':'unread-pill';b.textContent=group==='signal'?`${a.manual} to reply`:unreadCount(a.id)+ ' unread';
   row.append(name,b);row.title=group==='signal'?'Show manually scheduled Signal reminders':`Open ${heading}: ${a.name}`;
   row.onclick=()=>{if(group==='signal'){selectTool('Reminders');}else void changeSelected(a.id);};frame.append(row);
  }
  root.append(frame);
 };
 block('wa','WhatsApp','whatsapp-icon.svg',state.accounts.filter(a=>unreadCount(a.id)>0).sort((a,b)=>unreadCount(b.id)-unreadCount(a.id)),'No reported unread for loaded WhatsApp accounts. Unloaded accounts are not checked.');
 block('tg','Telegram','telegram-icon.svg',state.telegramAccounts.filter(a=>unreadCount(a.id)>0).sort((a,b)=>unreadCount(b.id)-unreadCount(a.id)),'No reported unread for loaded Telegram accounts. Unloaded accounts are not checked.');
 const signalTasks=state.signalSlots.map(slot=>({...slot,manual:pending.filter(r=>r.accountId===`signal-${slot.id}`).length})).filter(x=>x.manual);
 block('signal','Signal · manual reminders','signal-icon.svg',signalTasks,'Signal Desktop unread counts are not available. Create manual reply reminders in the Reminders tab.');
}
// Executive v3.15 · One-click notification inbox. No provider DOM scraping or false read receipts.
function closeExecutiveInbox(){
 const root=$('executiveInbox');if(!root)return;
 root.hidden=true;$('bell')?.setAttribute('aria-expanded','false');
 closeTransient('execInbox');
}
function toggleExecutiveInbox(){
 if(!state || !$('lockOverlay').hidden)return;
 const root=$('executiveInbox');if(!root)return;
 if(!root.hidden){closeExecutiveInbox();return;}
 root.hidden=false;$('bell')?.setAttribute('aria-expanded','true');
 renderExecutiveInbox();scheduleTransient('execInbox',null,root);
}
function renderExecutiveInbox(){
 const root=$('executiveInboxItems');if(!root||!state||$('executiveInbox').hidden)return;
 root.replaceChildren();
 const filter=executiveInboxFilter;
 const addRow=(icon,title,subtitle,num,action)=>{
  const row=document.createElement('button');row.type='button';row.className='executive-alert-row';
  const img=document.createElement('img');img.src=icon;img.alt='';
  const mid=document.createElement('div');mid.style.minWidth='0';
  const name=document.createElement('div');name.className='exec-alert-name';name.textContent=title;
  const sub=document.createElement('div');sub.className='exec-alert-sub';sub.textContent=subtitle;
  const badge=document.createElement('span');badge.className='exec-alert-number';badge.textContent=String(num);
  mid.append(name,sub);row.append(img,mid,badge);
  row.onclick=async()=>{closeExecutiveInbox();try{await action()}catch(error){toast('Could not open account: '+error.message)}};
  root.append(row);
 };
 const wa=state.accounts.filter(a=>(counts.get(a.id)||0)>0&&dismissedAlerts.get(a.id)!==counts.get(a.id)),tg=state.telegramAccounts.filter(a=>(counts.get(a.id)||0)>0&&dismissedAlerts.get(a.id)!==counts.get(a.id));
 if(filter==='all'||filter==='wa')for(const a of wa){const n=unreadCount(a.id);addRow('whatsapp-icon.svg',a.name,'WhatsApp · reported unread (best effort)',n,()=>changeSelected(a.id));}
 if(filter==='all'||filter==='tg')for(const a of tg){const n=unreadCount(a.id);addRow('telegram-icon.svg',a.name,'Telegram · reported unread (best effort)',n,()=>changeSelected(a.id));}
 if(filter==='all'||filter==='signal'||filter==='reminders'){
  const pending=state.reminders.filter(r=>!r.done&&typeof r.accountId==='string'&&r.accountId.startsWith('signal-'));
  if(filter!=='reminders'||pending.length)for(const slot of state.signalSlots){const n=pending.filter(r=>r.accountId==='signal-'+slot.id).length;
   if(n)addRow('signal-icon.svg',slot.name,'Signal · scheduled follow-up (NOT live unread)',n,async()=>{await selectSignal(slot.id);selectTool('Reminders');});}
 }
 if(filter==='all'||filter==='reminders')for(const r of state.reminders.filter(r=>!r.done&&!String(r.accountId).startsWith('signal-')).slice(0,25)){
  const account=getAccount(r.accountId);if(account)addRow(isTelegram(account.id)?'telegram-icon.svg':'whatsapp-icon.svg',r.contact||account.name,sourceName(account.id)+' · '+account.name+' · reminder',1,async()=>{await changeSelected(account.id);selectTool('Reminders');});
 }
 if(!root.childElementCount){const empty=document.createElement('div');empty.className='exec-empty';empty.textContent=filter==='signal'?'No Signal reminders recorded. Signal messages and calls cannot be read by this launcher.':'No local items in this filter. Check the official messaging app for calls and unread messages.';root.append(empty);}
}
$('executiveInboxClose').onclick=closeExecutiveInbox;
$('executiveInboxFilters').addEventListener('click',event=>{
 const tab=event.target.closest('button[data-service]');if(!tab)return;
 executiveInboxFilter=tab.dataset.service;
 for(const b of $('executiveInboxFilters').querySelectorAll('button'))b.classList.toggle('active',b===tab);
 renderExecutiveInbox();
});
$('executiveInboxReminders').onclick=()=>{closeExecutiveInbox();selectTool('Reminders');if(state?.ui?.geminiCollapsed)void updatePanelSetting('geminiCollapsed',false);};
$('executiveInboxDismiss').onclick=()=>{for(const [id,n] of counts)dismissedAlerts.set(id,n);activity.length=0;renderActivity();closeExecutiveInbox();toast('These local alert counts were hidden until they change. No provider chats were marked read.');};
document.addEventListener('pointerdown',event=>{
 const root=$('executiveInbox');if(root&&!root.hidden&&!root.contains(event.target)&&!$('bell').contains(event.target))closeExecutiveInbox();
},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('executiveInbox').hidden){closeExecutiveInbox();event.stopPropagation();}},true);

function renderActivity(){const el=$('activityList');el.replaceChildren();if(!activity.length){const p=document.createElement('p');p.textContent='No unread-count changes detected yet. Load an account to receive best-effort alerts.';el.append(p);return;}
 for(const e of activity){const div=document.createElement('div');div.className='activity-entry';
  const line=document.createElement('div');line.textContent=e.description;
  const small=document.createElement('small');small.textContent=fmtDate(e.time);
  div.append(line,small);if(e.id){div.style.cursor='pointer';div.onclick=()=>changeSelected(e.id);}el.append(div);}}
function selectTool(id){if(id==='Calls')return;activeTool=id;if(id==='Activity')renderNotificationCenter();for(const t of ['Ai','Templates','Activity','Reminders','Calls']){$('panel'+t).classList.toggle('active',t===id);$('tool'+t).classList.toggle('selected',t===id);}}
// Call records are entered manually. We never claim to scrape private webview conversations.
function callPlatform(id){return id.startsWith('signal-')?'signal':isTelegram(id)?'telegram':'whatsapp';}
function callLabel(id){
 if(id.startsWith('signal-')){const s=state.signalSlots.find(x=>`signal-${x.id}`===id);return `Signal · ${s?.name||id}`;}
 const a=getAccount(id);return `${sourceName(id)} · ${a?.name||id}`;
}
function callAccountOptions(){
 const select=$('callAccount');const previous=select.value;select.replaceChildren();
 for(const a of allWebAccounts()){const option=document.createElement('option');option.value=a.id;option.textContent=`${sourceName(a.id)} · ${a.name}`;select.append(option);}
 for(const slot of state.signalSlots){const option=document.createElement('option');option.value=`signal-${slot.id}`;option.textContent=`Signal · ${slot.name} (manual)`;select.append(option);}
 if([...select.options].some(o=>o.value===previous))select.value=previous;
 else if(selected)select.value=selected;
 else if(activeSignalSlot)select.value=`signal-${activeSignalSlot}`;
}
function renderMissedCalls(){
 if(!state)return;callAccountOptions();const pending=(state.missedCalls||[]).filter(c=>c.status==='pending');
 $('callSummary').textContent=`${pending.length} callback notes pending · ${state.missedCalls.length} recorded locally (NOT synced call history)`;

 const summary=$('callPlatformSummary');summary.replaceChildren();
 for(const [p,title,icon] of [['whatsapp','WhatsApp','whatsapp-icon.svg'],['signal','Signal','signal-icon.svg'],['telegram','Telegram','telegram-icon.svg']]){
  const total=pending.filter(c=>callPlatform(c.accountId)===p).length;
  const chip=document.createElement('button');chip.type='button';chip.className='call-platform-chip platform-'+p;
  chip.title=`Show ${title} recorded missed calls`;
  const img=document.createElement('img');img.src=icon;img.alt='';img.width=20;img.height=20;
  const count=document.createElement('strong');count.textContent=String(total);
  const label=document.createElement('span');label.textContent=title;
  chip.append(img,label,count);chip.onclick=()=>{$('callFilterPlatform').value=p;renderMissedCalls();};summary.append(chip);
 }

 const platformChoice=$('callFilterPlatform').value,statusChoice=$('callFilterStatus').value,outcomeChoice=$('callFilterOutcome').value;
 const results=[...state.missedCalls].filter(c=>(platformChoice==='all'||platformChoice===callPlatform(c.accountId))&&(statusChoice==='all'||statusChoice===c.status)&&(outcomeChoice==='all'||(c.outcome||'missed')===outcomeChoice)).sort((a,b)=>b.time-a.time);
 const list=$('callList');list.replaceChildren();
 if(!results.length){const p=document.createElement('p');p.className='call-empty';p.textContent='No saved call activity matches this filter. Check the official app to confirm actual calls.';list.append(p);return;}
 for(const c of results){
  const card=document.createElement('article');card.className=`call-entry platform-${callPlatform(c.accountId)}`;
  const head=document.createElement('div');head.className='call-entry-head';
  const platform=callPlatform(c.accountId);
  const platformBadge=document.createElement('div');platformBadge.className='call-platform-identity';
  const serviceIcon=document.createElement('img');serviceIcon.src=({whatsapp:'whatsapp-icon.svg',telegram:'telegram-icon.svg',signal:'signal-icon.svg'})[platform];serviceIcon.alt='';serviceIcon.width=28;serviceIcon.height=28;
  const sourceTag=document.createElement('span');sourceTag.textContent=callLabel(c.accountId);
  platformBadge.append(serviceIcon,sourceTag);
  const name=document.createElement('strong');name.textContent=c.caller;
  const badge=document.createElement('span');badge.className=`call-status status-${c.status}`;badge.textContent=({pending:'Needs callback',reviewed:'Reviewed','called-back':'Called back'})[c.status];
  head.append(name,badge);
  const kindLabel=({voice:'Voice call',video:'Video call',unknown:'Call'})[c.kind]||'Call';
  const outcomeTag=document.createElement('span');outcomeTag.className=`call-outcome call-outcome-${c.outcome||'missed'}`;outcomeTag.textContent=callActivity.summary(c);
  const meta=document.createElement('small');meta.textContent=`${kindLabel} · ${fmtDate(c.time)} · ${c.source==='user-pasted'?'From text you pasted':'Entered by you'}${callActivity.elapsed(c)?' · '+callActivity.elapsed(c):''}`; 
  const note=document.createElement('p');note.textContent=c.note||'No notes';
  const actions=document.createElement('div');actions.className='call-entry-actions';
  const markAnswered=button('✓ Answered',null,'ghost','Confirm that this call was answered');markAnswered.disabled=c.outcome==='answered';markAnswered.onclick=async()=>{Object.assign(c,callActivity.advance(c,'answered'));await persist();toast('Call marked answered by you.');};
  const markMissed=button('↙ Missed',null,'ghost','Confirm this was a missed call');markMissed.disabled=c.outcome==='missed';markMissed.onclick=async()=>{Object.assign(c,callActivity.advance(c,'missed'));await persist();toast('Call marked missed by you.');};
  const markEnded=button('■ Ended',null,'ghost','Confirm the call ended');markEnded.disabled=c.outcome==='ended';markEnded.onclick=async()=>{Object.assign(c,callActivity.advance(c,'ended'));await persist();toast('Call end recorded by you.');};
  const open=button('↗ Open account',null,'ghost',`Switch to ${callLabel(c.accountId)}`);
  open.onclick=async()=>{if(c.accountId.startsWith('signal-')){await selectSignal(Number(c.accountId.slice(7)));}else if(getAccount(c.accountId)){await changeSelected(c.accountId);}toast('Open the call history in the official service to call back.');};
  const reviewed=button('✓ Reviewed',null,'ghost');reviewed.disabled=c.status==='reviewed';reviewed.onclick=async()=>{c.status='reviewed';await persist();toast('Call marked reviewed.');};
  const callback=button('☎ Called back',null,'ghost');callback.disabled=c.status==='called-back';callback.onclick=async()=>{c.status='called-back';await persist();toast('Callback recorded.');};
  const remind=button('◷ Remind',null,'ghost','Create a local call-back reminder');remind.onclick=async()=>{
   if(state.reminders.length>=300)return toast('Reply queue is full. Clear completed reminders first.');
   const due=Date.now()+15*60000;
   state.reminders.push({id:'call-reminder-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:'Return missed call',contact:c.caller,due,accountId:c.accountId,repeatMinutes:15,done:false,nextNotifyAt:due,lastNotified:0});
   await persist();toast(`Callback reminder saved for ${c.caller} in 15 minutes.`);
  };
  const remove=button('×',null,'ghost','Delete this manual call record');remove.onclick=async()=>{if(!await askConfirm('Delete this call record?'))return;state.missedCalls=state.missedCalls.filter(row=>row.id!==c.id);await persist();};
  actions.append(open,markAnswered,markMissed,markEnded,remind,reviewed,callback,remove);card.append(platformBadge,head,outcomeTag,meta,note,actions);list.append(card);
 }
}
$('addMissedCall').onclick=()=>void busy($('addMissedCall'),async()=>{
 const accountId=$('callAccount').value;
 if(!/^((wa|tg|signal)-[1-9]\d*)$/.test(accountId))return toast('Choose a WhatsApp, Telegram, or Signal account.');
 const caller=$('callCaller').value.trim().slice(0,90);
 if(!caller)return toast('Enter who called, or type Unknown caller.');
 const time=Date.parse($('callWhen').value);
 if(!Number.isFinite(time)||time<1||time>Date.now()+86400000)return toast('Choose a valid call date and time.');
 if(state.missedCalls.length>=500)return toast('Call tracker full (500). Remove old reviewed entries before adding more.');
 const outcome=$('callOutcome').value;
 state.missedCalls.push({id:'call-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),accountId,caller,time,kind:['voice','video'].includes($('callKind').value)?$('callKind').value:'unknown',note:$('callNote').value.trim().slice(0,250),status:'pending',source:$('callNoticeInput').dataset.suggested==='1'?'user-pasted':'manual',outcome:callActivity.outcomes.includes(outcome)?outcome:'missed',answeredAt:outcome==='answered'?time:0,endedAt:['missed','declined','ended'].includes(outcome)?time:0,updatedAt:Date.now()});
 $('callCaller').value='';$('callNote').value='';$('callNoticeInput').value='';$('callNoticeInput').dataset.suggested='0';$('callNoticeFeedback').textContent='Saved locally. This was not detected automatically.';$('callFilterStatus').value='pending';$('callFilterOutcome').value='all';await persist();selectTool('Calls');toast(`${callLabel(accountId)} · user-confirmed call activity saved.`);
});
$('callFilterPlatform').addEventListener('change',renderMissedCalls);
$('callFilterStatus').addEventListener('change',renderMissedCalls);
$('callFilterOutcome').addEventListener('change',renderMissedCalls);
$('interpretCallNotice').onclick=()=>{const suggestion=callActivity.suggest($('callNoticeInput').value);$('callNoticeFeedback').textContent=suggestion.message;if(suggestion.outcome)$('callOutcome').value=suggestion.outcome;if(suggestion.kind)$('callKind').value=suggestion.kind;$('callNoticeInput').dataset.suggested=suggestion.outcome?'1':'0';if(suggestion.outcome)toast('Suggested '+callActivity.summary({outcome:suggestion.outcome})+'. Confirm before saving.');};
$('callNoticeInput').addEventListener('input',()=>{$('callNoticeInput').dataset.suggested='0';});
$('openCallNotificationSettings').onclick=()=>{$('settings').click();requestAnimationFrame(()=>{const tab=[...document.querySelectorAll('.settings-tab-button')].find(b=>b.textContent.includes('Accounts'));tab?.click();$('prefProviderNotifications')?.scrollIntoView({block:'center',behavior:'instant'});});toast('Enable official web notifications for the account provider, then press Done to save.');};
// Never infer a missing call merely because the user did not manually record one.
$('checkProviderCalls').onclick=async()=>{
 const id=$('callAccount').value;
 if(id.startsWith('signal-')){await selectSignal(Number(id.slice(7)));toast('Open official Signal Desktop and check its call history. EAGLE RS cannot read it.');return;}
 if(getAccount(id)){await changeSelected(id);toast('Check the Calls tab or recent chats inside this messaging account for real calls.');}
 else toast('Select a valid account first.');
};
$('quickLogCurrentCall').onclick=()=>{
 const accountId=activeSignalSlot?`signal-${activeSignalSlot}`:selected;
 const option=[...$('callAccount').options].find(o=>o.value===accountId);
 if(option)$('callAccount').value=accountId;
 $('callKind').value='voice';$('callOutcome').value='missed';$('callWhen').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
 $('callCaller').focus();toast('Enter the caller from the official app, then save your callback note. No call was detected automatically.');
};

function renderReminders(){
 const list=$('reminderList');list.replaceChildren();const select=$('reminderAccount');const val=select.value;
 select.replaceChildren();for(const a of allWebAccounts()){const opt=document.createElement('option');opt.value=a.id;opt.textContent=`${sourceName(a.id)} · ${a.name}`;select.append(opt);}
 for(const slot of state.signalSlots){const opt=document.createElement('option');opt.value=`signal-${slot.id}`;opt.textContent=`Signal · ${slot.name} (manual)`;select.append(opt);}
 const availableIds=new Set([...select.options].map(option=>option.value));
 const preferred=[val,activeSignalSlot?`signal-${activeSignalSlot}`:null,selected].find(id=>availableIds.has(id));
 if(preferred)select.value=preferred;
 const pending=state.reminders.filter(r=>!r.done),overdue=pending.filter(r=>r.due<=Date.now());
 $('replyQueueSummary').textContent=`${pending.length} waiting for reply · ${overdue.length} overdue`;
 $('queuePending').classList.toggle('selected',queueFilter==='pending');$('queueAll').classList.toggle('selected',queueFilter==='all');
 const arr=[...state.reminders].filter(r=>queueFilter==='all'||!r.done).sort((a,b)=>Number(a.done)-Number(b.done)||a.due-b.due);
 if(!arr.length){const p=document.createElement('p');p.textContent=queueFilter==='all'?'No reply tasks yet.':'No pending replies. Create a task above when someone needs your response.';list.append(p);}
 for(const r of arr){
  const row=document.createElement('div');row.className='reminder-row'+(!r.done&&r.due<=Date.now()?' due':'');
  const label=document.createElement('div');label.className='label';label.textContent=(r.contact?r.contact+' — ':'')+r.title;
  const small=document.createElement('small');small.textContent=`${reminderLabel(r.accountId)} · ${fmtDate(r.due)} · ${r.done?'Replied':r.due<=Date.now()?'OVERDUE':'Pending'}${r.repeatMinutes?' · Repeat '+r.repeatMinutes+' min':''}`;
  label.append(small);row.append(label);
  const actions=document.createElement('div');actions.className='reminder-actions';
  const isSignalReminder=r.accountId.startsWith('signal-');
  const open=button(isSignalReminder?'↗ Signal / task':'↗ Open account',null,'ghost',isSignalReminder?'Open reminder; Signal accounts may share a desktop profile':'Open assigned WhatsApp or Telegram account');
  open.onclick=()=>{if(getAccount(r.accountId))void changeSelected(r.accountId);else if(isSignalReminder)void selectSignal(Number(r.accountId.slice(7)));else selectTool('Reminders');};
  const done=button(r.done?'↶ Reopen':'✓ Mark replied',null,r.done?'ghost':'gold');done.onclick=async()=>{r.done=!r.done;r.nextNotifyAt=r.done?8640000000000000:r.due;await persist();toast(r.done?'Marked as replied. Reminders stopped.':'Task reopened.');};
  const snooze=button('◷ +15 min',null,'ghost');snooze.disabled=r.done;snooze.onclick=async()=>{r.due=Date.now()+15*60000;r.nextNotifyAt=r.due;r.lastNotified=0;await persist();toast('Reply reminder snoozed for 15 minutes.');};
  const del=button('×',null,'ghost','Delete reply reminder');del.onclick=async()=>{if(!await askConfirm('Delete this reply task?'))return;state.reminders=state.reminders.filter(x=>x.id!==r.id);await persist();};
  actions.append(open,done,snooze,del);row.append(actions);list.append(row);
 }
 updateStats();
}
function reminderTick(){
 if(!state)return;
 // Unread count alerts: a changing account title is only a best-effort signal.
 // Real reply tasks are scheduled in Electron main, so they also work while hidden to tray.
 if(state.prefs.remind&&state.prefs.desktop){for(const [id,since] of unreadCheckAt){const interval=state.prefs.reminderMinutes*60000;
  if(unreadCount(id)>0&&Date.now()-since>=interval){unreadCheckAt.set(id,Date.now());const a=getAccount(id);
   window.desktop.notify({title:`${sourceName(id)} · ${a?.name||id} · Unread reminder`,body:`${sourceName(id)} account ${a?.name||id} still reports ${unreadCount(id)} unread. This does not prove a particular chat needs a reply.`,accountId:id,sound:state.prefs.sound});
  }
 }}
 renderReminders();
}
const screenshots=window.EagleScreenshots.create({desktop:window.desktop,toast,
 isLocked:()=>!$('lockOverlay').hidden,
 getTarget:()=>{const v=views.get(selected);if(!v||!v.container.classList.contains('active'))return null;try{return {id:v.web.getWebContentsId(),name:sourceName(selected)+' · '+(getAccount(selected)?.name||selected)};}catch{return null;}},
 onCapture:()=>{selectTool('Ai');if(state){state.ui.geminiCollapsed=false;applyPanelVisibility();}expandedProfile=false;applyPanelVisibility();$('screenshotList').scrollIntoView({block:'nearest'});}
});
let aiBusy=false,aiGeneration=0,aiResult='';
async function executeAi(type,btn){
 if(aiBusy)return;
 if(screenshots.isImporting())return toast('Wait for the screenshot to finish loading.');
 if(!$('lockOverlay').hidden)return;
 const text=$('aiInput').value.trim(),guidance=$('aiGuidance').value.trim(),images=screenshots.images();
 if(!text&&!images.length&&(!guidance||['translate','summarize','rewrite','concise','grammar'].includes(type)))return toast('Attach a chat screenshot, paste a message, or write your reply directions.');
 const generation=++aiGeneration;aiBusy=true;aiResult='';screenshots.setWorking(true);
 const buttons=['reply','runAction','translate'];const labels=buttons.map(id=>$(id)?.querySelector('.button-label')?.textContent||$(id).textContent);
 buttons.forEach(id=>$(id).disabled=true);if(btn)setButtonText(btn.id,'Working…');$('copyAi').disabled=true;$('aiOutput').textContent='Reading your message and screenshots…';
 try{
  const r=await window.desktop.aiRun({type,text,guidance,images,language:$('language').value,tone:$('aiTone').value});
  if(generation!==aiGeneration||!$('lockOverlay').hidden)return;
  if(r?.ok){aiResult=r.text;$('aiOutput').textContent=r.text;$('copyAi').disabled=false;}
  else{$('aiOutput').textContent='Error: '+(r?.message||'No response from the translation service.');toast(r?.message||'The request failed.');}
 }catch(e){if(generation===aiGeneration&&$('lockOverlay').hidden)$('aiOutput').textContent='Connection error: '+e.message;}
 finally{aiBusy=false;screenshots.setWorking(false);buttons.forEach((id,i)=>{$(id).disabled=false;setButtonText(id,labels[i]);});}
}
$('reply').onclick=()=>executeAi('reply',$('reply'));
$('runAction').onclick=()=>executeAi($('aiAction').value,$('runAction'));
$('translate').onclick=()=>executeAi('translate',$('translate'));
$('copyAi').disabled=true;
$('copyAi').onclick=async()=>{if(!aiResult)return toast('Generate a reply or translation first.');try{await navigator.clipboard.writeText(aiResult);toast('Result copied. Paste it into your conversation after reviewing.');}catch{toast('Could not copy automatically. Select the output text and press Ctrl+C.')}};
$('clearAi').onclick=()=>{aiGeneration++;aiResult='';$('aiInput').value='';$('aiGuidance').value='';screenshots.clear();$('copyAi').disabled=true;$('aiOutput').textContent='Ready for your next message or screenshot.';};
$('toolCalls').onclick=()=>selectTool('Calls');

$('toolAi').onclick=()=>selectTool('Ai');$('toolTemplates').onclick=()=>selectTool('Templates');$('sendToTemplates').onclick=()=>selectTool('Templates');$('toolActivity').onclick=()=>selectTool('Activity');$('toolReminders').onclick=()=>selectTool('Reminders');
$('queueStat').onclick=()=>selectTool('Reminders');
$('statMissedCalls').closest('.stat').title='Open locally saved, user-confirmed call activity by account. Not synchronized with provider call history.';
$('queuePending').onclick=()=>{queueFilter='pending';renderReminders();};
$('queueAll').onclick=()=>{queueFilter='all';renderReminders();};$('bell').onclick=()=>toggleExecutiveInbox();
$('testAlert').onclick=async()=>{const a=getAccount(selected),title=a?`${sourceName(a.id)} · ${a.name} · Test alert`:'EAGLE RS · Test alert';const r=await window.desktop.notify({title,body:'This is a test Windows notification. Future supported alerts will identify the exact platform and account.',accountId:a?.id,sound:state.prefs.sound});toast(r?.ok?'Test notification requested.':'Windows notifications not supported here.');};
$('clearActivity').onclick=()=>{activity.length=0;renderActivity();};
$('addAccount').onclick=()=>void addAccount('wa',$('addAccount'));
$('addTelegram').onclick=()=>void addAccount('tg',$('addTelegram'));
$('addSignal').onclick=()=>void addAccount('signal',$('addSignal'));
const sessionDrawer=$('backgroundSessionDetails');
sessionDrawer.addEventListener('toggle',()=>{
 if(!state||sessionDrawer.dataset.restoring==='1')return;
 state.ui={...state.ui,backgroundDrawerOpen:sessionDrawer.open};
 // Nonblocking, no DOM re-render while embedded browser instances are active.
 void window.desktop.save(state).catch(error=>console.warn('Could not save session drawer preference:',error));
});
$('lowMemoryMode').onchange=()=>void busy($('lowMemoryMode'),async()=>{
 const enabled=$('lowMemoryMode').checked;
 if(enabled){
  const okay=await askConfirm('Low RAM mode closes background browser views (keeps logins saved). Background account alerts will stop until those accounts are opened. Continue?');
  if(!okay){$('lowMemoryMode').checked=false;return;}
 }
 state.ui={...state.ui,lowMemoryMode:enabled};
 await window.desktop.save(state);
 if(enabled){
  ++backgroundStartGeneration;
  for(const id of [...views.keys()])if(id!==selected)releaseView(id);
  toast('Low RAM mode enabled: only the selected account stays loaded.');
 }else{
  toast('Always-On mode restored. Other active WhatsApp sessions will load gradually.');
  void startWhatsappBatch({auto:true});
 }
 updateStats();
});
$('toggleArrangeMode').onclick=()=>{
 if(!state)return;
 state.ui={...state.ui,arrangeMode:!state.ui.arrangeMode};
 applyCompactRailSettings();
 void window.desktop.save(state).catch(error=>toast('Could not save arrange mode: '+error.message));
};
$('toggleWa').onclick=()=>void setAccountGroup('wa',$('toggleWa'));
$('toggleTelegram').onclick=()=>void setAccountGroup('tg',$('toggleTelegram'));
$('toggleSignal').onclick=()=>void setAccountGroup('signal',$('toggleSignal'));
$('search').oninput=()=>{
 renderAccounts();renderTelegram();renderSignal();
 if($('search').value.trim()){
  for(const info of Object.values(groupInfo)){$(info.list).classList.remove('is-collapsed');$(info.button)?.setAttribute('aria-expanded','true');if($(info.button)){const name=info.label+' accounts';$(info.button).title='Collapse '+name;$(info.button).setAttribute('aria-label','Collapse '+name);}}
 }else applyGroupOrder();
};
$('renameCurrent').onclick=()=>{const a=getAccount(selected);if(a)void rename(a);};
$('followCurrent').onclick=()=>void busy($('followCurrent'),async()=>{const a=getAccount(selected);if(!a)return;a.followup=!a.followup;await persist();toast(a.followup?'Account marked for follow-up.':'Follow-up mark removed.');});
$('reloadCurrent').onclick=()=>void busy($('reloadCurrent'),async()=>{if(selected&&views.has(selected))views.get(selected).web.reload();});
$('pauseCurrent').onclick=()=>{if(selected)void setProfileActive(selected,false,$('pauseCurrent'));};
$('activeCurrent').onclick=()=>{if(selected){const a=getAccount(selected);void setProfileActive(selected,a?.active===false,$('activeCurrent'));}};
$('refreshAll').onclick=()=>void busy($('refreshAll'),refreshActiveLoaded);
$('openTelegramAccounts').onclick=()=>void busy($('openTelegramAccounts'),async()=>{
 // Telegram Web accounts are isolated in persistent tg_session partitions.
 // This action never launches or modifies an installed Telegram Desktop app.
 if(!state)return;
 state.openGroups.tg=true;
 if(state.ui?.leftCollapsed){state.ui.leftCollapsed=false;applyPanelVisibility();}
 applyGroupOrder();
 if(state.telegramAccounts.length){
  const target=state.telegramAccounts.find(a=>a.active!==false)||state.telegramAccounts[0];
  await changeSelected(target.id);
  toast(`Opened ${target.name} in EAGLE RS. Use Telegram + to add another profile.`);
 }else{
  toast('Create your first Telegram Web account. Each account has separate login storage.');
  await addAccount('tg',null);
 }
});
$('stopSignalAll').onclick=()=>void busy($('stopSignalAll'),async()=>{const res=await window.desktop.signalStopAll();toast(res.message)});
$('resetSignal').onclick=()=>void busy($('resetSignal'),async()=>{const res=await window.desktop.signalReset();toast(res.message)});
$('signalOpen').onclick=()=>{if(activeSignalSlot)void busy($('signalOpen'),()=>openSignal(activeSignalSlot));};
$('signalReload').onclick=()=>{if(activeSignalSlot)void busy($('signalReload'),async()=>{const result=await window.desktop.signalRelaunch(activeSignalSlot);toast(result.message||'Signal relaunch requested.');await selectSignal(activeSignalSlot);});};
$('signalStop').onclick=()=>{if(activeSignalSlot)void busy($('signalStop'),async()=>{const res=await window.desktop.signalStop(activeSignalSlot);toast(res.message);await selectSignal(activeSignalSlot)});};
$('signalActive').onclick=()=>{if(!activeSignalSlot)return;void busy($('signalActive'),async()=>{const slot=state.signalSlots.find(s=>s.id===activeSignalSlot);if(!slot)return;slot.active=slot.active===false;await persist();selectSignal(slot.id);if(!slot.active){const res=await window.desktop.signalStop(slot.id);toast(res.message)}});};
$('inspectStorage').onclick=()=>void busy($('inspectStorage'),async()=>{const res=await window.desktop.storageStatus();$('storageInfo').textContent=`Data: ${res.root}\nAccounts: ${res.accounts.length} saved partitions\nSettings backup: ${res.backupExists?'Yes':'Not yet'}\nDo not delete Partitions or IndexedDB folders.`;});
$('openStorage').onclick=()=>void busy($('openStorage'),async()=>{const result=await window.desktop.storageOpen();if(result)toast(result);});
// WhatsApp Always-On: load all opted-in WA profiles without displaying them.
// A persistent partition retains QR credentials but the webview must remain mounted
// for network activity. No background work is possible after the PC sleeps or exits.
let backgroundStartGeneration=0;
let batchStarting=false;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function startWhatsappBatch({enableAll=false,auto=false}={}){
 if(!state || batchStarting)return;
 if(state.ui?.lowMemoryMode){
  if(!auto)toast('Low RAM mode is on. Switch it off under Sessions → Advanced to load all accounts.');
  return;
 }
 batchStarting=true;const generation=++backgroundStartGeneration;
 try{
  if(enableAll){for(const a of state.accounts)a.active=true;await persist();}
  const accounts=state.accounts.filter(a=>a.active!==false&&!views.has(a.id));
  if(accounts.length)message(`Connecting ${accounts.length} WhatsApp profiles in the background…`);
  for(const account of accounts){
   if(backgroundStartGeneration!==generation || !$('lockOverlay').hidden)break;
   if(!getAccount(account.id) || account.active===false || views.has(account.id))continue;
   try{if(selected===account.id)$('views').querySelectorAll('.paused-placeholder').forEach(e=>e.remove());const v=createView(account.id);v.container.classList.toggle('active',selected===account.id&&activeSignalSlot===null);}
   catch(err){toast(`${account.name}: ${err.message}`);}
   updateStats();
   await delay(1400); // prioritize UI responsiveness over loading every Chromium renderer at once
  }
  if(backgroundStartGeneration===generation){
   updateStats();if(!auto)toast('WhatsApp accounts started. They stay loaded until you pause or stop them.');
  }
 }finally{batchStarting=false;}
}
async function stopWhatsappBatch(){
 ++backgroundStartGeneration;
 for(const a of state.accounts){a.active=false;releaseView(a.id);}
 await persist();
 if(selected && !isTelegram(selected))showPausedPlaceholder(selected);
 if(selected && getAccount(selected))setProfileControls(selected);
 updateStats();toast('All WhatsApp webviews stopped. Saved QR sessions were NOT deleted.');
}
const alwaysOnStatus=()=>{
 const running=state?.accounts.filter(a=>a.active!==false&&views.has(a.id)).length||0;
 const total=state?.accounts.filter(a=>a.active!==false).length||0;
 if($('waRunningLabel'))$('waRunningLabel').textContent=`WhatsApp: ${running}/${total} views running`;
};
$('startWhatsAppAll').onclick=()=>void busy($('startWhatsAppAll'),()=>startWhatsappBatch({enableAll:true}));
$('stopWhatsAppAll').onclick=()=>void busy($('stopWhatsAppAll'),stopWhatsappBatch);
$('startAll').onclick=()=>void busy($('startAll'),async()=>{
 if(state.ui?.lowMemoryMode){toast('Turn off Low RAM mode to load all web sessions at once.');return;}
 const accounts=allWebAccounts().filter(a=>a.active!==false&&!views.has(a.id));
 if(!accounts.length){toast('All saved WhatsApp and Telegram sessions are already loaded.');return;}
 toast(`Loading ${accounts.length} web sessions gradually. Many sessions can require substantial memory.`);
 for(const a of accounts){try{createView(a.id)}catch(e){toast(`${a.name}: ${e.message}`)}await new Promise(resolve=>setTimeout(resolve,350));}
 if(!selected&&allWebAccounts()[0])await changeSelected(allWebAccounts()[0].id);
 updateStats();toast('Web session loading requests completed.');
});
for(const [key,el] of [['all','filterAll'],['unread','filterUnread'],['follow','filterFollow']])$(el).onclick=()=>{
 filter=key;for(const [k,id] of [['all','filterAll'],['unread','filterUnread'],['follow','filterFollow']])$(id).classList.toggle('selected',k===key);renderAccounts();renderTelegram();};
$('addReminder').onclick=async()=>{
 const title=$('reminderTitle').value.trim().slice(0,160),contact=$('reminderContact').value.trim().slice(0,80);
 const due=Date.parse($('reminderDue').value),repeatMinutes=Number($('reminderRepeat').value);
 if(!title||!Number.isFinite(due)||due<Date.now())return toast('Enter what you need to reply about and a future deadline.');
 if(state.reminders.length>=300)return toast('Maximum 300 tasks. Delete old completed reminders first.');
 const accountId=$('reminderAccount').value;
 if(!getAccount(accountId)&&!state.signalSlots.some(slot=>accountId===`signal-${slot.id}`))return toast('Choose an account or Signal slot for this reply task.');
 const id='r-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
 state.reminders.push({id,title,contact,due,accountId,repeatMinutes,done:false,nextNotifyAt:due,lastNotified:0});
 $('reminderTitle').value='';$('reminderContact').value='';queueFilter='pending';await persist();toast('Reply task saved. Windows reminders repeat until you mark it replied.');
};
$('quickReply').onclick=()=>{
 selectTool('Reminders');if(selected)$('reminderAccount').value=selected;
 const date=new Date(Date.now()+15*60000),local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
 $('reminderDue').value=local;$('reminderContact').focus();toast('Enter the person and what you want to reply about.');
};
$('lockNow').onclick=()=>void busy($('lockNow'),async()=>{await window.desktop.securityLock();showLockScreen();toast('Workspace locked; active WhatsApp sessions continue syncing while the app runs.');});
$('setAppPassphrase').onclick=()=>void busy($('setAppPassphrase'),async()=>{const value=$('newPassphrase').value;if(value!==$('newPassphraseConfirm').value)return toast('The two passphrases do not match.');const r=await window.desktop.securitySetPin(value);$('newPassphrase').value='';$('newPassphraseConfirm').value='';toast(r.message||'Could not set passphrase.');if(r.ok&&r.codes)showNewCodes(r.codes,true);});
async function enterVerifiedWorkspace(){
 document.body.classList.remove('workspace-is-locked');$('lockOverlay').hidden=true;$('unlockResult').textContent='';applyPanelVisibility();
 if(!state)await initializeWorkspace();else if(selected)await changeSelected(selected);
 if(state?.ui?.keepWhatsappAlive!==false)void startWhatsappBatch({auto:true});
}
$('unlockNow').onclick=()=>void busy($('unlockNow'),async()=>{
 const r=await window.desktop.securityUnlock($('unlockPhrase').value);$('unlockPhrase').value='';
 if(!r.ok){$('unlockResult').textContent=r.message;return;}
 await enterVerifiedWorkspace();
});
// A previously-linked Microsoft/Google identity was verified in the main process.
// Renderer cannot mint this event through IPC; main validates the provider account ID.
window.desktop.onUnlocked(()=>{void enterVerifiedWorkspace().catch(e=>toast('Could not open the verified workspace: '+e.message))});
$('unlockPhrase').addEventListener('keydown',e=>{if(e.key==='Enter')$('unlockNow').click()});

// Read-only, validated Windows BitLocker/Device Encryption bridge. Never auto-enable or expose recovery keys.
async function refreshDiskProtection(){
 const output=$('diskProtectionStatus'),badge=$('diskProtectionBadge');
 output.textContent='Checking Windows disk protection…';badge.textContent='Checking';
 try{
  const result=await window.desktop.diskProtectionStatus();output.replaceChildren();
  if(!result.ok){badge.textContent='Not verified';output.textContent=result.message||'Windows could not confirm disk encryption.';return;}
  if(!result.drives.length){badge.textContent='Not verified';output.textContent='No volumes returned; open Windows encryption settings to verify manually.';return;}
  const protectedDrives=result.drives.filter(d=>d.protected===true).length;
  badge.textContent=`${protectedDrives}/${result.drives.length} protected`;
  for(const drive of result.drives){const row=document.createElement('div');row.className='drive-row';const driveName=document.createElement('b');driveName.textContent=drive.drive;const status=document.createElement('span');status.textContent=drive.status;row.append(driveName,status);output.append(row);}
  const note=document.createElement('p');note.textContent='Read-only diagnostic. Confirm the status in Windows Settings. Save your recovery key before changing encryption.';output.append(note);
 }catch(error){badge.textContent='Not verified';output.textContent=`Check unavailable: ${error.message}`;}
}
$('checkDiskProtection').onclick=()=>void busy($('checkDiskProtection'),refreshDiskProtection);
$('manageBitLocker').onclick=()=>void busy($('manageBitLocker'),async()=>{const r=await window.desktop.openEncryptionSettings('bitlocker');if(!r.ok)toast(r.message);});
$('manageDeviceEncryption').onclick=()=>void busy($('manageDeviceEncryption'),async()=>{const r=await window.desktop.openEncryptionSettings('device');if(!r.ok)toast(r.message);});

$('settings').onclick=async()=>{
 $('settingsModal').classList.add('show');void refreshMicrosoftStatus().catch(error=>{$('microsoftConnectionStatus').textContent=error.message;});buildThemePicker();applyWorkspaceFont(state?.ui?.fontId);void refreshDiskProtection();$('lockOnBlur').checked=!!state.ui?.lockOnBlur;$('captureGuard').checked=!!state.ui?.captureGuard;$('prefAmbientMotion').checked=state.ui?.ambientMotion!==false;$('idleHours').value=String(state.ui?.idleHours||1);$('leftCollapsedPref').checked=!!state.ui?.leftCollapsed;$('geminiCollapsedPref').checked=!!state.ui?.geminiCollapsed;$('prefDesktop').checked=state.prefs.desktop;$('prefProviderNotifications').checked=!!state.prefs.providerNotifications;$('prefSound').checked=state.prefs.sound;$('prefRemind').checked=state.prefs.remind;$('prefMinutes').value=state.prefs.reminderMinutes;
 try{const r=await window.desktop.aiStatus();$('keyStatus').textContent=r.hasKey?`Gemini key connected. ${r.secureAvailable?'Encrypted Windows storage available.':'Session-only key storage.'}`:`No Gemini API key connected. ${r.secureAvailable?'Windows encrypted storage available.':'Session-only storage.'}`;}catch(e){$('keyStatus').textContent=e.message;}
};
$('workspaceFont').addEventListener('change',()=>{
 applyWorkspaceFont($('workspaceFont').value);
 $('fontPreview').style.fontFamily=WORKSPACE_FONTS[$('workspaceFont').value];
});
$('themesShortcut').onclick=()=>{$('settings').click();requestAnimationFrame(()=>$('themePicker').scrollIntoView({behavior:'smooth',block:'center'}));};
$('themeQuickSelect').addEventListener('change',event=>void busy($('themeQuickSelect'),()=>selectWorkspaceTheme(event.target.value)));
$('settingsClose').onclick=async()=>{state.ui={...state.ui,fontId:applyWorkspaceFont($('workspaceFont').value),idleHours:Number($('idleHours').value)===2?2:1,leftCollapsed:$('leftCollapsedPref').checked,geminiCollapsed:$('geminiCollapsedPref').checked,lockWhenHidden:true,lockOnBlur:$('lockOnBlur').checked,captureGuard:$('captureGuard').checked,ambientMotion:$('prefAmbientMotion').checked};state.prefs={desktop:$('prefDesktop').checked,providerNotifications:$('prefProviderNotifications').checked,sound:$('prefSound').checked,remind:$('prefRemind').checked,reminderMinutes:Number($('prefMinutes').value)};await persist();applyWorkspaceTheme();applyPanelVisibility();$('settingsModal').classList.remove('show');$('microsoftMasterPass').value='';toast('Preferences saved.');};
$('settingsModal').onclick=e=>{if(e.target===$('settingsModal'))$('settingsClose').click();};
$('saveKey').onclick=async()=>{const key=$('apiKey').value;const result=await window.desktop.aiKey(key);$('apiKey').value='';toast(result.message|| (result.ok?'Gemini key saved.':'Could not save key.'));if(result.ok){$('keyStatus').textContent=result.stored?'Gemini key saved in encrypted Windows storage.':'Gemini key in memory for this session.';}};
$('removeKey').onclick=async()=>{const r=await window.desktop.aiKey('');$('apiKey').value='';$('keyStatus').textContent='No Gemini API key connected.';toast(r.ok?'Gemini API key removed from workspace storage.':r.message);};
$('openKeys').onclick=()=>window.desktop.openSite('apikey');$('openGoogleTranslate').onclick=()=>window.desktop.openSite('googletranslate');
window.desktop.onOpenAccount(id=>{if(getAccount(id))void changeSelected(id);});
window.desktop.onReplyQueue((_id,accountId)=>{if(getAccount(accountId))void changeSelected(accountId);else if(typeof accountId==='string'&&accountId.startsWith('signal-'))void selectSignal(Number(accountId.slice(7)));selectTool('Reminders');});
window.desktop.onQueueUpdated(async()=>{if(!state)return;const latest=await window.desktop.load();state.reminders=latest.reminders;renderReminders();renderAccounts();renderTelegram();renderSignal();});
let wasInitialized=false;
async function initializeWorkspace(){
 state=await window.desktop.load();
 if(!state.ui?.executiveLayoutConfigured){state.ui={...state.ui,executiveLayoutConfigured:true,overviewExpanded:true};try{await window.desktop.save(state)}catch(error){console.warn('Could not save executive layout preference',error)}}
 setupPopupLifetimePreferences();
 applyPremiumShellPreferences();
 const sessionDetails=$('backgroundSessionDetails');sessionDetails.dataset.restoring='1';
 sessionDetails.open=!!state.ui?.backgroundDrawerOpen;
 queueMicrotask(()=>delete sessionDetails.dataset.restoring);
 applyCompactRailSettings();$('lowMemoryMode').checked=!!state.ui?.lowMemoryMode;applyWorkspaceTheme();applyPanelVisibility();applyGroupOrder();renderAccounts();renderTelegram();renderSignal();renderActivity();renderReminders();renderMissedCalls();renderTemplates();
 const date=new Date(Date.now()+3600000);date.setMinutes(0,0,0);const local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);$('reminderDue').value=local;$('callWhen').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
 if(allWebAccounts().length)await changeSelected(allWebAccounts()[0].id);
 if(state.ui?.keepWhatsappAlive!==false&&!state.ui?.lowMemoryMode)void startWhatsappBatch({auto:true});
 if(!wasInitialized){wasInitialized=true;setInterval(reminderTick,30000)}
}
(async()=>{
 const r=await window.desktop.securityStatus();
 // Only theme and animation preferences are exposed before a master unlock.
 if(typeof r.ambientMotion==='boolean')motionBeforeUnlock=r.ambientMotion;
 if(r.themeId)applyWorkspaceTheme(r.themeId);
 if(r.locked){refreshLockClock();document.body.classList.add('workspace-is-locked');$('lockOverlay').hidden=false;$('firstTimeSetup').hidden=!!r.configured;$('existingLock').hidden=!r.configured;(r.configured?$('unlockPhrase'):$('firstPassphrase')).focus();void updateQuickMicrosoftRecovery();return;}
 await initializeWorkspace();
})().catch(e=>toast('Could not load workspace settings: '+e.message));

$('clearOldKey').onclick=async()=>{if(!await askConfirm('Delete the old OpenAI key from this computer? Your Gemini key will remain unchanged.'))return;const r=await window.desktop.removeOldKey();toast(r.ok?'Old OpenAI key file deleted.':r.message);};
$('openPricing').onclick=()=>window.desktop.openSite('pricing');

// Manual, local, reusable customer-service templates. They never read or send WhatsApp messages.
let chosenTemplate=null;
function renderTemplates(){
 if(!state)return;
 const root=$('templateList');root.replaceChildren();
 for(const template of state.templates||[]){
  const item=document.createElement('div');item.className='template-card';
  const title=document.createElement('div');title.className='template-title';title.textContent=template.title;
  const text=document.createElement('div');text.className='template-preview';text.textContent=template.body;
  const row=document.createElement('div');row.className='template-controls';
  const use=button('✎ Edit / use');use.onclick=()=>{chosenTemplate=template.id;$('templateTitle').value=template.title;$('templateBody').value=template.body;toast('Template loaded. Edit, copy, or save your changes.');};
  const copy=button('⧉ Copy');copy.onclick=()=>copyText(template.body);
  const del=button('× Delete');del.onclick=async()=>{if(!await askConfirm('Delete template "'+template.title+'"?'))return;state.templates=state.templates.filter(t=>t.id!==template.id);if(chosenTemplate===template.id)chosenTemplate=null;await persist();renderTemplates();};
  row.append(use,copy,del);item.append(title,text,row);root.append(item);
 }
 if(!state.templates?.length){const hint=document.createElement('p');hint.textContent='No saved replies yet. Create your first one below.';root.append(hint);}
}
async function copyText(value){try{await navigator.clipboard.writeText(value);toast('Reply copied. Review it and paste into the chat yourself.');}catch{toast('Copy unavailable. Select the text and press Ctrl+C.');}}
$('addTemplate').onclick=async()=>{
 const title=$('templateTitle').value.trim().slice(0,60),body=$('templateBody').value.trim().slice(0,1200);
 if(!title||!body)return toast('Enter both a title and some reply text.');
 if(chosenTemplate){const existing=state.templates.find(t=>t.id===chosenTemplate);if(existing){existing.title=title;existing.body=body;}}
 else{if(state.templates.length>=60)return toast('Maximum 60 saved templates.');state.templates.push({id:'tpl-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title,body});}
 chosenTemplate=null;$('templateTitle').value='';$('templateBody').value='';await persist();renderTemplates();toast('Template saved locally.');
};
$('copyTemplate').onclick=()=>{if(!$('templateBody').value.trim())return toast('Choose a template or write a reply first.');copyText($('templateBody').value);};
$('templateBody').addEventListener('input',()=>{if(chosenTemplate && !state.templates.some(t=>t.id===chosenTemplate))chosenTemplate=null;});
document.addEventListener('DOMContentLoaded',()=>{if(state)renderTemplates();});
for(const b of document.querySelectorAll('button[title]'))b.dataset.tooltip=b.title;



// Titanium Midnight: saved privacy panels, single platform router, and status drill-downs.
function applyPanelVisibility(){
 const workspace=$('workspaceRoot');if(!workspace||!state)return;
 workspace.classList.toggle('nav-collapsed',!!state.ui?.leftCollapsed);
 workspace.classList.toggle('gemini-collapsed',!!state.ui?.geminiCollapsed);
 workspace.classList.toggle('fullscreen-profile',expandedProfile);
 $('restoreWorkspace').hidden=!expandedProfile;
 $('revealNavigation').hidden=expandedProfile||!state.ui?.leftCollapsed;
 $('revealGemini').hidden=expandedProfile||!state.ui?.geminiCollapsed;
}
async function updatePanelSetting(key,value){
 const previous=state.ui?.[key];state.ui={...state.ui,[key]:value};applyPanelVisibility();
 try{await window.desktop.save(state);}catch(e){state.ui[key]=previous;applyPanelVisibility();toast('Could not save panel preference: '+e.message);}
}
$('toggleNav').onclick=()=>void busy($('toggleNav'),()=>updatePanelSetting('leftCollapsed',true));
$('toggleGemini').onclick=()=>void busy($('toggleGemini'),()=>updatePanelSetting('geminiCollapsed',true));
$('revealNavigation').onclick=()=>void busy($('revealNavigation'),()=>updatePanelSetting('leftCollapsed',false));
$('revealGemini').onclick=()=>void busy($('revealGemini'),()=>updatePanelSetting('geminiCollapsed',false));
$('expandProfile').onclick=()=>{expandedProfile=!expandedProfile;applyPanelVisibility()};
$('restoreWorkspace').onclick=()=>{expandedProfile=false;applyPanelVisibility()};
const statCards=[...document.querySelectorAll('.stats .stat')];
const metricTitles=['Reported unread','Call Activity · manually confirmed','WhatsApp profiles','Telegram profiles','Active webviews','Signal launcher slots','Waiting for reply','Due reminders'];
function openMetric(i){
 if(!$('lockOverlay').hidden)return;
 $('statDrawer').hidden=false;
 scheduleTransient('statDrawer');$('statDrawerTitle').textContent=metricTitles[i];const body=$('statDrawerBody');body.replaceChildren();
 const line=text=>{const p=document.createElement('p');p.textContent=text;body.append(p)};
 if(i===0){selectTool('Activity');line('Best-effort unread counts from loaded browser titles. These are not the underlying WhatsApp/Telegram chat records.');for(const a of allWebAccounts().filter(a=>(counts.get(a.id)||0)>0)){const b=document.createElement('button');b.textContent=sourceName(a.id)+' · '+a.name+': '+counts.get(a.id)+' reported unread';b.onclick=()=>{void changeSelected(a.id);$('statDrawer').hidden=true};body.append(b);}}
 if(i===2||i===3||i===5){const group=i===2?'wa':i===3?'tg':'signal';line('Select a profile from the navigation. Group filter is now active.');if(state){state.openGroups[group]=true;applyGroupOrder();if(state.ui?.leftCollapsed){state.ui.leftCollapsed=false;applyPanelVisibility();}void window.desktop.save(state);}}
 if(i===4){line('Loaded webviews: '+views.size+'. Active WhatsApp views remain mounted until paused or stopped.');for(const [id] of views)line('Active: '+(getAccount(id)?.name||id));}
 if(i===1){selectTool('Calls');line('Check real incoming and missed calls in each official messaging app. The EAGLE RS list below includes ONLY manually recorded callback notes; no provider call history is synchronized.');const pending=state.missedCalls.filter(c=>c.status==='pending');if(!pending.length)line('No manual callback notes. This does not mean there were no incoming or missed calls.');for(const c of pending.slice(0,30))line(`${callLabel(c.accountId)} · ${c.caller} · ${fmtDate(c.time)}`);}
 if(i===6||i===7){selectTool('Reminders');const reminders=state?.reminders?.filter(x=>!x.done&&(i===6||x.due<=Date.now()))||[];line(reminders.length?reminders.map(x=>(x.contact?x.contact+' · ':'')+x.title).join(' / '):'No matching reminders.');}
}
statCards.forEach((card,i)=>{card.tabIndex=0;card.role='button';card.setAttribute('aria-label','View '+metricTitles[i]);card.onclick=()=>openMetric(i);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMetric(i)}}});
$('statDrawerClose').onclick=()=>closeTransient('statDrawer');
$('ackAlerts').onclick=()=>{for(const [id,count] of counts)dismissedAlerts.set(id,count);activity.length=0;renderActivity();closeTransient('statDrawer');toast('Dashboard alerts dismissed locally. Messages remain unread until you open them in their messaging service.');};
function showLockScreen(){
 closeExecutiveInbox();clearAllTransients();refreshLockClock();
 // Lock must conceal existing sessions without discarding live Chromium renderers.
 // Password authentication and the overlay guard application controls.
 document.body.classList.add('workspace-is-locked');
 $('lockOverlay').hidden=false;$('unlockPhrase').value='';$('aiInput').value='';$('aiGuidance').value='';screenshots.clear();aiGeneration++;aiResult='';$('copyAi').disabled=true;$('aiOutput').textContent='Locked. Your draft and screenshots were removed from the screen.';
 $('accountModal').classList.remove('show');$('settingsModal').classList.remove('show');$('statDrawer').hidden=true;
 $('microsoftMasterPass').value=''; // Do not leave the verification passphrase in hidden Settings controls.
 void updateQuickMicrosoftRecovery();
}
window.desktop.onLocked(()=>showLockScreen());
let lastPing=0;for(const eventName of ['pointerdown','keydown','wheel'])document.addEventListener(eventName,()=>{
 if($('lockOverlay').hidden && Date.now()-lastPing>30000){lastPing=Date.now();void window.desktop.activityPing().catch(()=>{})}
},{passive:true});
$('createFirstPassphrase').onclick=()=>void busy($('createFirstPassphrase'),async()=>{
 const pass=$('firstPassphrase').value;if(pass!==$('firstPassphraseConfirm').value){$('unlockResult').textContent='Passphrases do not match.';return;}const result=await window.desktop.securitySetPin(pass);$('firstPassphrase').value='';$('firstPassphraseConfirm').value='';
 $('unlockResult').textContent=result.message||'';if(!result.ok)return;
 if(result.codes)showNewCodes(result.codes,false);else{$('firstTimeSetup').hidden=true;$('existingLock').hidden=false;$('unlockPhrase').focus();}
});


// Password recovery: no bypass for already locked installations without prior enrollment.
let codesPresentedFromSettings=false;
function showNewCodes(codes,fromSettings){
 if(!Array.isArray(codes)||!codes.length)return;
 codesPresentedFromSettings=!!fromSettings;
 $('lockOverlay').hidden=false;
 $('showRecoveryCodes').hidden=false;
 $('recoveryCodesText').textContent=codes.join('\n');
 $('existingLock').hidden=true;$('firstTimeSetup').hidden=true;$('recoveryForm').hidden=true;
 $('unlockResult').textContent='Codes shown once. Save them before closing this screen.';
}
$('copyRecoveryCodes').onclick=async()=>{
 try{await navigator.clipboard.writeText($('recoveryCodesText').textContent);$('unlockResult').textContent='Codes copied. Paste into a trusted password manager; clear your clipboard afterwards.';}
 catch{$('unlockResult').textContent='Clipboard unavailable. Save each code manually.';}
};
$('doneRecoveryCodes').onclick=()=>{
 $('recoveryCodesText').textContent='';$('showRecoveryCodes').hidden=true;
 $('unlockResult').textContent='';
 if(codesPresentedFromSettings){$('lockOverlay').hidden=true;codesPresentedFromSettings=false;return;}
 $('existingLock').hidden=false;$('firstTimeSetup').hidden=true;
 $('unlockResult').textContent='Enter your new master passphrase to unlock.';$('unlockPhrase').focus();
};
async function openRecovery(){
 $('existingLock').hidden=true;$('recoveryForm').hidden=false;
 $('unlockResult').textContent='';
 try{
  const r=await window.desktop.recoveryStatus();
  $('recoveryMode').querySelector('option[value=email]').disabled=!r.emailConfigured;
  $('recoveryMode').querySelector('option[value=email]').hidden=!r.emailConfigured;
  const microsoft=await window.desktop.microsoftStatus();
  const email=await window.desktop.outlookEmailStatus();
  $('recoveryMode').querySelector('option[value=outlookEmail]').disabled=!email.ready;
  $('recoveryMode').querySelector('option[value=microsoft]').disabled=!microsoft.linked||!microsoft.available;
  if(!r.emailConfigured&&!microsoft.linked){$('recoveryMode').value='code';$('unlockResult').textContent=r.hasCodes?'Use a recovery code you saved previously. Connect your Microsoft account while unlocked to use email recovery later.':'No recovery method was previously configured for this lock. Please use your original passphrase.';}
  else if(email.ready){$('recoveryMode').value='outlookEmail';}
  else if(microsoft.linked&&microsoft.available){$('recoveryMode').value='microsoft';}
 }catch(e){$('unlockResult').textContent='Recovery status unavailable: '+e.message;}
 $('recoveryMode').dispatchEvent(new Event('change'));
 ($('recoveryMode').value==='microsoft' ? $('microsoftRecoverStart') : $('recoveryCode')).focus();
}
async function updateQuickMicrosoftRecovery(){
 try{const info=await window.desktop.microsoftStatus();const email=await window.desktop.outlookEmailStatus();$('microsoftQuickRecover').hidden=!(info.available&&info.linked);$('microsoftQuickRecover').textContent=email.ready?'Send password reset code to email':'Recover with Microsoft';}catch{$('microsoftQuickRecover').hidden=true;}
}
$('forgotPass').onclick=()=>void openRecovery();
$('microsoftQuickRecover').onclick=()=>void busy($('microsoftQuickRecover'),async()=>{
 await openRecovery();
 if($('recoveryMode').value==='outlookEmail'){$('unlockResult').textContent='Click Send an 8-digit recovery code to my email, then check your inbox.';return;}
 if($('recoveryMode').value!=='microsoft'){$('unlockResult').textContent='Microsoft recovery was not previously linked. Use an offline recovery code instead.';return;}
 await startMicrosoftFlow('recover');
});
$('showUnlockPassword').onchange=()=>$('unlockPhrase').type=$('showUnlockPassword').checked?'text':'password';
$('unlockPhrase').onkeyup=e=>{$('capsWarning').hidden=!(e.getModifierState&&e.getModifierState('CapsLock'));};
$('cancelRecovery').onclick=()=>{
 $('recoveryForm').hidden=true;$('existingLock').hidden=false;
 $('recoveryCode').value='';$('recoveryNewPass').value='';$('recoveryNewPassConfirm').value='';$('unlockResult').textContent='';
 $('unlockPhrase').focus();
};
$('recoveryMode').onchange=()=>{
 const useEmail=$('recoveryMode').value==='email',useMicrosoft=$('recoveryMode').value==='microsoft';
 $('recoveryEmailRequest').hidden=!(useEmail||$('recoveryMode').value==='outlookEmail');
 $('microsoftRecoveryPanel').hidden=!useMicrosoft;
 $('recoveryCodeRow').hidden=useMicrosoft;
 $('recoveryCode').placeholder=(useEmail||$('recoveryMode').value==='outlookEmail')?'8-digit email code':'ERS-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX';
 if(useMicrosoft)$('microsoftRecoverStatus').textContent='Start Microsoft verification below. When verified, enter a new EAGLE RS passphrase. We never ask for your Hotmail password.';
};
$('showRecoveryPassword').onchange=()=>{const type=$('showRecoveryPassword').checked?'text':'password';$('recoveryNewPass').type=type;$('recoveryNewPassConfirm').type=type;};
$('requestEmailCode').onclick=()=>void busy($('requestEmailCode'),async()=>{
 const r=$('recoveryMode').value==='outlookEmail'?await window.desktop.outlookEmailRequest():await window.desktop.emailRequest();$('unlockResult').textContent=r.message||'Unable to request email reset.';
});
$('submitRecovery').onclick=()=>void busy($('submitRecovery'),async()=>{
 const code=$('recoveryCode').value.trim(),pass=$('recoveryNewPass').value;if(pass!==$('recoveryNewPassConfirm').value){$('unlockResult').textContent='New passphrases do not match.';return;}
 const mode=$('recoveryMode').value;
 const r=mode==='microsoft'?await window.desktop.microsoftReset(pass):mode==='outlookEmail'?await window.desktop.outlookEmailReset(code,pass):mode==='email'?await window.desktop.emailReset(code,pass):await window.desktop.recoveryWithCode(code,pass);
 $('recoveryCode').value='';$('recoveryNewPass').value='';$('recoveryNewPassConfirm').value='';$('unlockResult').textContent=r.message||'Unable to recover.';
 if(r.ok&&r.codes)showNewCodes(r.codes,false);
});
$('rotateRecovery').onclick=()=>void busy($('rotateRecovery'),async()=>{
 const pass=$('recoveryCurrentPass').value;
 const r=await window.desktop.recoveryRotate(pass);$('recoveryCurrentPass').value='';
 toast(r.message||'Could not rotate codes.');if(r.ok&&r.codes)showNewCodes(r.codes,true);
});
// Microsoft personal-account verification replaces the old Resend setup.
// Existing enrolled Resend users can still use their legacy email reset without deleting configuration.
let currentMicrosoftCode='',microsoftPollHandle=null,microsoftFlowPurpose='';
function stopMicrosoftPolling(){if(microsoftPollHandle){clearInterval(microsoftPollHandle);microsoftPollHandle=null;}}
async function refreshMicrosoftStatus(){
 const info=await window.desktop.microsoftStatus();
 const linked=info.linked,connected=$('microsoftConnectionStatus');
 if(connected)connected.textContent=info.developerSetupRequired
  ?'Microsoft application setup is unavailable. Existing offline recovery codes still work.'
  :linked?'✓ Recovery ready with '+(info.account||'your verified Microsoft account')+(info.lastBackupAt?' · Last settings backup: '+new Date(info.lastBackupAt).toLocaleString():' · Cloud backup is optional and currently separate')
  :'Not linked yet. Enter your current EAGLE RS password once, then choose Link my Hotmail / Outlook.';
 const auto=$('microsoftAutoBackup');if(auto){auto.checked=!!info.autoBackup;auto.disabled=!linked;}
 for(const id of ['microsoftBackupNow','microsoftPreviewBackup','microsoftRestoreBackup','microsoftUnlink'])$(id).disabled=!linked;
 const activation=$('microsoftActivation');
 if(activation)activation.hidden=!info.developerSetupRequired;
 $('microsoftLink').disabled=false;
 $('microsoftSaveClientId').hidden=!info.developerSetupRequired;
 $('microsoftLink').hidden=!!info.developerSetupRequired||!!linked;
 $('microsoftLinkedBadge').hidden=!linked;
 $('microsoftMasterPass').closest('.ms-master-confirm').hidden=!!linked;

 $('microsoftManageDetails').hidden=!linked;
 $('microsoftLink').textContent='Link my Hotmail / Outlook';
 $('microsoftReconnect').disabled=!linked||!info.available;
 return info;
}
async function startMicrosoftFlow(purpose){
 const onLock=purpose==='recover';const pass=onLock?'':$('microsoftMasterPass').value;
 if(!onLock&&!pass.trim()){
  $('microsoftConnectionStatus').textContent='For your security, enter the password used to unlock EAGLE RS. Do not enter your Hotmail password.';
  $('microsoftMasterPass').focus();return;
 }
 const r=await window.desktop.microsoftBegin(purpose,pass);
 const notice=$(onLock?'microsoftRecoveryInstructions':'microsoftConnectProgress');
 if(!r.ok){
  if(!onLock){$('microsoftConnectInstructions').hidden=false; $('microsoftConnectionStatus').textContent='Microsoft sign-in could not start: '+r.message;}
  if(notice)notice.textContent=r.message;else toast(r.message);return;
 }
 currentMicrosoftCode=r.userCode||'';microsoftFlowPurpose=purpose;const microsoftBrowserMode=r.mode==='browser';
 if(!onLock)$('microsoftMasterPass').value='';
 if(onLock){
  $('microsoftRecoveryInstructions').textContent=microsoftBrowserMode?'Sign in to Microsoft in your browser. Return here after verification.':'Enter this code on Microsoft sign-in: '+currentMicrosoftCode+'. A Microsoft sign-in page should open in your browser.';
  $('microsoftRecoverStatus').textContent='Waiting for your Microsoft account verification…';
 }else{
  $('microsoftConnectInstructions').hidden=false;
  $('microsoftDeviceCode').textContent=microsoftBrowserMode?'No code needed — complete Microsoft sign-in in your browser.':currentMicrosoftCode;
  $('microsoftConnectProgress').textContent='Waiting for Microsoft to verify your account…';
 }
 if(!microsoftBrowserMode)try{await window.desktop.microsoftOpenSignIn()}catch{if(notice)notice.textContent+=' Could not open Microsoft verification page.';}
 stopMicrosoftPolling();
 microsoftPollHandle=setInterval(async()=>{
  let status;try{status=await window.desktop.microsoftStatus()}catch{return;}
  const flow=status.flow;
  if(!flow||flow.purpose!==microsoftFlowPurpose)return;
  const isFinished=flow.phase==='verified'||flow.phase==='failed';
  const text=flow.message||'Waiting for verification';
  const label=$(onLock?'microsoftRecoverStatus':'microsoftConnectProgress');if(label)label.textContent=text;
  if(isFinished){stopMicrosoftPolling();if(!onLock){await refreshMicrosoftStatus();if(flow.phase==='verified'){$('microsoftConnectInstructions').hidden=true;$('microsoftMasterPass').value='';}}
   else if(flow.phase==='verified')$('unlockResult').textContent='Microsoft verified. Enter a new master passphrase and confirm it to finish recovery.';
  }
 },1800);
}
$('microsoftRecoverStart').onclick=()=>void busy($('microsoftRecoverStart'),()=>startMicrosoftFlow('recover'));
$('microsoftLink').onclick=()=>void busy($('microsoftLink'),async()=>{
 const info=await window.desktop.microsoftStatus();
 if(info.developerSetupRequired){
  $('microsoftActivation').hidden=false;
  $('microsoftActivationResult').textContent='Enter the Application (client) ID, then your existing EAGLE RS unlock passphrase in the nearby field. No Hotmail password is required here.';
  $('microsoftClientId').focus();return;
 }
 return startMicrosoftFlow('link');
});
$('microsoftRegistrationGuide').onclick=()=>void busy($('microsoftRegistrationGuide'),async()=>{await window.desktop.microsoftOpenRegistration();});
$('microsoftSaveClientId').onclick=()=>void busy($('microsoftSaveClientId'),async()=>{
 const value=$('microsoftClientId').value.trim();
 const pass=$('microsoftMasterPass').value;
 if(!pass.trim()){
  $('microsoftActivationResult').textContent='Enter your existing EAGLE RS master passphrase in the password field immediately below the Client ID before saving.';
  $('microsoftMasterPass').focus();return;
 }
 const result=await window.desktop.microsoftConfigure(value,pass);
 $('microsoftActivationResult').textContent=result.message;
 if(!result.ok){
  if(/passphrase/i.test(result.message))$('microsoftMasterPass').focus();
  return;
 }
 $('microsoftClientId').value='';
 await refreshMicrosoftStatus();
 $('microsoftConnectionStatus').textContent='Application ID saved. Starting Microsoft sign-in…';
 // The user requested Save ID & connect; continue to the real Microsoft device-code flow.
 await startMicrosoftFlow('link');
});
$('microsoftManageDetails').addEventListener('toggle',()=>{if(!$('microsoftManageDetails').hidden)$('microsoftMasterPass').closest('.ms-master-confirm').hidden=!$('microsoftManageDetails').open;});
$('microsoftReconnect').onclick=()=>void busy($('microsoftReconnect'),()=>startMicrosoftFlow('reconnect'));
$('microsoftOpenSignIn').onclick=()=>void window.desktop.microsoftOpenSignIn().catch(e=>toast(e.message));
$('microsoftCopyCode').onclick=()=>void navigator.clipboard.writeText(currentMicrosoftCode).then(()=>toast('Microsoft verification code copied.')).catch(()=>toast('Copy the code shown above manually.'));
$('microsoftUnlink').onclick=()=>void busy($('microsoftUnlink'),async()=>{
 if(!await askConfirm('Unlink Microsoft? Your existing cloud backup will remain in OneDrive, but email recovery on this PC will stop working.'))return;
 const r=await window.desktop.microsoftDisconnect($('microsoftMasterPass').value);$('microsoftMasterPass').value='';$('microsoftBackupStatus').textContent=r.message;await refreshMicrosoftStatus();
});
$('microsoftAutoBackup').onchange=()=>void busy($('microsoftAutoBackup'),async()=>{
 const next=$('microsoftAutoBackup').checked;
 if(next&&!await askConfirm('Enable optional cloud backups of account names, reminders and templates in OneDrive? No actual WhatsApp, Telegram or Signal sessions will be copied.')){$('microsoftAutoBackup').checked=false;return;}
 const r=await window.desktop.microsoftAutoBackup(next);$('microsoftBackupStatus').textContent=r.message;await refreshMicrosoftStatus();
});
$('microsoftBackupNow').onclick=()=>void busy($('microsoftBackupNow'),async()=>{const r=await window.desktop.microsoftBackupNow();$('microsoftBackupStatus').textContent=r.message;await refreshMicrosoftStatus();});
$('microsoftPreviewBackup').onclick=()=>void busy($('microsoftPreviewBackup'),async()=>{
 const r=await window.desktop.microsoftBackupPreview();$('microsoftBackupStatus').textContent=r.ok?
 `Backup ${new Date(r.at).toLocaleString()}: ${r.whatsapp} WhatsApp labels, ${r.telegram} Telegram profiles, ${r.signal} Signal slots. ${r.message}`:r.message;
});
$('microsoftRestoreBackup').onclick=()=>void busy($('microsoftRestoreBackup'),async()=>{
 const preview=await window.desktop.microsoftBackupPreview();if(!preview.ok){$('microsoftBackupStatus').textContent=preview.message;return;}
 if(!await askConfirm('Restore and merge saved OneDrive workspace settings? This does not bring back messaging sessions or automatically log in to WhatsApp/Signal. Local profile folders will not be erased.'))return;
 const r=await window.desktop.microsoftBackupRestore();$('microsoftBackupStatus').textContent=r.message;
});
// Refresh when Settings opens; this never transmits credentials to the webview.
$('settingsModal').addEventListener('click',event=>{if(event.target?.closest?.('.settings-tab-button'))void refreshMicrosoftStatus().catch(()=>{});});


// Four-section settings dashboard. Existing controls retain their original IDs and behavior.
function configureSettingsTabs(){
 const dialog=$('settingsModal')?.querySelector('.dialog');if(!dialog)return;
 const closeAction=dialog.querySelector(':scope > .dialog-actions');if(closeAction)closeAction.remove();
 const elements=Array.from(dialog.children);const segments=[[]];
 for(const el of elements){if(el.tagName==='HR'){el.remove();segments.push([])}else segments[segments.length-1].push(el);}
 if(segments.length<7){if(closeAction)dialog.append(closeAction);return;}
 const nav=document.createElement('nav');nav.className='settings-tab-nav';nav.setAttribute('aria-label','Settings sections');
 const names=['Security','Appearance','Accounts & Storage','AI & Gemini'];
 const groups=[[1,2],[3],[4,5],[6]];const pages=[];
 for(const [i,name] of names.entries()){
  const tab=document.createElement('button');tab.type='button';tab.textContent=name;tab.className='settings-tab-button';tab.setAttribute('role','tab');
  const page=document.createElement('section');page.className='settings-tab-page';page.setAttribute('role','tabpanel');page.hidden=i!==0;
  for(const group of groups[i])for(const el of segments[group]||[])page.append(el);
  tab.onclick=()=>{for(let j=0;j<pages.length;j++){pages[j].hidden=j!==i;nav.children[j].classList.toggle('selected',i===j);nav.children[j].setAttribute('aria-selected',String(i===j));}};
  if(i===0){tab.classList.add('selected');tab.setAttribute('aria-selected','true')}
  nav.append(tab);pages.push(page);
 }
 dialog.replaceChildren(...segments[0],nav,...pages,...(closeAction?[closeAction]:[]));
}
configureSettingsTabs();

// Lightweight nonblocking confirmation; never uses JavaScript alert()/confirm()/prompt().
function askConfirm(text){
 return new Promise(resolve=>{
  const shade=document.createElement('div');shade.className='ui-confirm-shade';
  const panel=document.createElement('div');panel.className='ui-confirm-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  const content=document.createElement('p');content.textContent=text;
  const buttons=document.createElement('div');buttons.className='dialog-actions';
  const cancel=document.createElement('button');cancel.textContent='Cancel';
  const okay=document.createElement('button');okay.textContent='Continue';okay.className='gold';
  const finish=value=>{shade.remove();resolve(value)};
  cancel.onclick=()=>finish(false);okay.onclick=()=>finish(true);
  shade.onclick=event=>{if(event.target===shade)finish(false)};
  shade.addEventListener('keydown',event=>{if(event.key==='Escape')finish(false)});
  buttons.append(cancel,okay);panel.append(content,buttons);shade.append(panel);document.body.append(shade);cancel.focus();
 });
}

// Ctrl+Shift+L: explicit local quick lock without closing provider sessions.
document.addEventListener('keydown',event=>{if(event.ctrlKey&&event.shiftKey&&event.code==='KeyL'&&!event.repeat&&!event.isComposing){event.preventDefault();void window.desktop.securityLock().then(showLockScreen).catch(err=>toast(err.message));}},true);


// v3.12 shell ergonomics: disclosure state lives in encrypted EAGLE RS configuration.
function applyPremiumShellPreferences(){
 if(!state)return;
 const open=!!state.ui?.overviewExpanded;
 const cards=$('workspaceStats'),trigger=$('overviewToggle');
 if(cards)cards.classList.toggle('is-compact',!open);
 if(trigger){trigger.setAttribute('aria-pressed',String(open));trigger.setAttribute('aria-label',open?'Show fewer dashboard cards':'Show all dashboard cards');trigger.querySelector('span').textContent=open?'⌃':'⌄';}
 const density=state.ui?.interfaceDensity==='compact'?'compact':'comfortable';
 document.documentElement.classList.toggle('density-compact',density==='compact');
 const picker=$('interfaceDensity');if(picker)picker.value=density;
}
function setupPopupLifetimePreferences(){
 const picker=$('popupTimeoutMinutes');if(!picker)return;
 picker.value=String(state?.ui?.popupTimeoutMinutes||1);
 picker.onchange=()=>void busy(picker,async()=>{
  if(!state)return;
  const next=Number(picker.value);if(![1,2,3].includes(next))return;
  const previous=state.ui.popupTimeoutMinutes||1;state.ui.popupTimeoutMinutes=next;
  try{await window.desktop.save(state);toast('Temporary panels now close after '+next+' minute'+(next>1?'s':'')+'.');}
  catch(error){state.ui.popupTimeoutMinutes=previous;picker.value=String(previous);throw error;}
 });
}
function installPremiumPreferences(){
 const appearance=document.querySelectorAll('.settings-tab-page')[1];
 setupPopupLifetimePreferences();
 if(appearance && !$('interfaceDensity')){
  const section=document.createElement('section');section.className='premium-density-setting';
  const label=document.createElement('label');label.htmlFor='interfaceDensity';label.textContent='Account navigation size';
  const select=document.createElement('select');select.id='interfaceDensity';select.className='txt';
  for(const [value,name] of [['comfortable','Comfortable · easier to read'],['compact','Compact · more accounts']]){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}
  select.addEventListener('change',()=>{void busy(select,async()=>{const prior=state.ui?.interfaceDensity;state.ui={...state.ui,interfaceDensity:select.value};applyPremiumShellPreferences();try{await window.desktop.save(state)}catch(e){state.ui.interfaceDensity=prior;applyPremiumShellPreferences();throw e}});});
  section.append(label,select);appearance.prepend(section);
 }
 const t=$('overviewToggle');if(t)t.onclick=()=>void busy(t,async()=>{if(!state)return;const prior=!!state.ui?.overviewExpanded;state.ui={...state.ui,overviewExpanded:!prior};applyPremiumShellPreferences();try{await window.desktop.save(state)}catch(e){state.ui.overviewExpanded=prior;applyPremiumShellPreferences();throw e;}});
 const more=$('profileMore'),menu=$('profileMoreMenu');
 if(more&&menu){
  const trigger=more.querySelector('summary');
  const isNative=typeof menu.showPopover==='function'&&typeof menu.hidePopover==='function';
  function positionAccountMenu(){
   if(!more.open)return;
   const anchor=trigger.getBoundingClientRect(),bounds=menu.getBoundingClientRect();
   const width=Math.max(bounds.width,208),height=Math.max(bounds.height,166);
   // Keep the menu alongside the button; flip it upward near the bottom of the window.
   const below=innerHeight-anchor.bottom>=height+14;
   const top=below?anchor.bottom+8:Math.max(8,anchor.top-height-8);
   const left=Math.max(8,Math.min(anchor.right-width,innerWidth-width-8));
   menu.style.setProperty('top',`${top}px`,'important');
   menu.style.setProperty('left',`${left}px`,'important');
  }
  function closeAccountMenu(restoreFocus=false){
   const item=transientTimers.get('accountMenu');if(item){clearTimeout(item.timer);clearInterval(item.tick);transientTimers.delete('accountMenu');}
   more.open=false;
   menu.classList.remove('menu-fallback-open');
   if(isNative&&menu.matches(':popover-open'))menu.hidePopover();
   trigger.setAttribute('aria-expanded','false');
   if(restoreFocus)trigger.focus();
  }
  more.addEventListener('toggle',()=>{
   trigger.setAttribute('aria-expanded',String(more.open));
   if(more.open){
    if(isNative){try{if(!menu.matches(':popover-open'))menu.showPopover();}
     catch(err){console.warn('[EAGLE RS] Account popover fallback:',err);menu.classList.add('menu-fallback-open');}}
    else menu.classList.add('menu-fallback-open');
    // Popover is in Chromium's top layer: no webview or toolbar can cover it.
    requestAnimationFrame(positionAccountMenu);
    scheduleTransient('accountMenu',null,menu);
   }else{
    const item=transientTimers.get('accountMenu');if(item){clearTimeout(item.timer);clearInterval(item.tick);transientTimers.delete('accountMenu');}
    menu.classList.remove('menu-fallback-open');
    if(isNative&&menu.matches(':popover-open'))menu.hidePopover();
   }
  });
  document.addEventListener('pointerdown',event=>{
   if(more.open&&!more.contains(event.target)&&!menu.contains(event.target))closeAccountMenu();
  },true);
  menu.addEventListener('click',event=>{
   if(event.target.closest('button'))closeAccountMenu();
  });
  trigger.addEventListener('keydown',event=>{
   if(event.key==='ArrowDown'){
    event.preventDefault();more.open=true;
    requestAnimationFrame(()=>menu.querySelector('button:not(:disabled)')?.focus());
   }
  });
  window.addEventListener('resize',positionAccountMenu,{passive:true});
  document.addEventListener('scroll',event=>{if(more.open&&!menu.contains(event.target))positionAccountMenu();},true);
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&more.open){event.preventDefault();event.stopPropagation();closeAccountMenu(true);}
  },true);
 }
 document.addEventListener('keydown',event=>{
  if(event.code==='Escape'){if(more)more.open=false;return;}
  if(event.ctrlKey&&!event.shiftKey&&event.code==='KeyK'&&!event.repeat){event.preventDefault();$('search')?.focus();$('search')?.select();}
  if(event.ctrlKey&&event.shiftKey&&event.code==='KeyF'&&!event.repeat){event.preventDefault();expandedProfile=!expandedProfile;applyPanelVisibility();}
 });
 applyPremiumShellPreferences();
}
installPremiumPreferences();
