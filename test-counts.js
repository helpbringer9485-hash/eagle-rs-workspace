'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('renderer.js','utf8').replace(/\r\n/g,'\n');

// Execute the shipped handlers against a small DOM: cover actual transitions,
// including events emitted by old webviews after an account is unloaded.
function functionSource(name){
 const pattern=new RegExp('(?:async )?function '+name+'\\('),match=pattern.exec(source);
 assert(match,'Missing renderer function '+name);
 const start=match.index,firstEnd=source.indexOf('\n',start),firstLine=source.slice(start,firstEnd);
 return firstLine.endsWith('}')?firstLine:source.slice(start,source.indexOf('\n}',firstEnd)+2);
}
class Element{
 constructor(tag='div',id=''){this.tagName=tag;this.id=id;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.className='';this._value='';this.textContent='';this.hidden=false;this.disabled=false;this.style={};
  this.classList={add:(name)=>this.toggleClass(name,true),remove:name=>this.toggleClass(name,false),toggle:(name,on)=>this.toggleClass(name,on),contains:name=>this.className.split(' ').includes(name)};
 }
 toggleClass(name,on){const names=new Set(this.className.split(' ').filter(Boolean));if(on===undefined)on=!names.has(name);if(on)names.add(name);else names.delete(name);this.className=[...names].join(' ');return on;}
 append(...nodes){for(const node of nodes){this.children.push(node);node.parent=this;}}
 replaceChildren(...nodes){this.children=[];this._value='';this.append(...nodes);}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name];}
 addEventListener(name,handler){this.listeners[name]=handler;}
 emit(name,event={}){return this.listeners[name]?.(event);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);for(const node of this.children)if(node.tagName==='webview')node.emit('destroyed');}
 get options(){return this.children.filter(node=>node.tagName==='option');}
 get value(){if(this.tagName==='select'){return this._value||this.options[0]?.value||'';}return this._value;}
 set value(value){this._value=String(value??'');}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){const all=this.children.flatMap(node=>[node,...node.querySelectorAll('*')]);if(selector==='*')return all;
  return all.filter(node=>selector.split(',').some(part=>{
   const trimmed=part.trim();if(trimmed.startsWith('.'))return node.className.split(' ').includes(trimmed.slice(1).split('[')[0]);
   return node.tagName===trimmed;
  }));
 }
}
const nodes=new Map();
const $=id=>{if(!nodes.has(id))nodes.set(id,new Element(id==='reminderAccount'?'select':'div',id));return nodes.get(id);};
const doc={createElement:tag=>new Element(tag),querySelector(selector){const id=/data-account-id="([^"]+)"/.exec(selector)?.[1];return [...$('waList').children,...$('telegramList').children].find(row=>row.dataset.accountId===id)||null;},querySelectorAll:selector=>[...nodes.values()].flatMap(node=>node.querySelectorAll(selector))};
const notifications=[],selectedRequests=[],signalRequests=[],messages=[];
const context={console,Map,Set,Number,String,Date,Math,URL,CSS:{escape:value=>value},document:doc,$,
 state:{accounts:[{id:'wa-1',name:'Personal',active:true},{id:'wa-2',name:'Second',active:true}],telegramAccounts:[{id:'tg-1',name:'Telegram',active:true}],signalSlots:[{id:1,name:'Signal'}],reminders:[],missedCalls:[],prefs:{desktop:true,sound:false,remind:true,reminderMinutes:15},ui:{}},
 views:new Map(),counts:new Map(),unreadCheckAt:new Map(),dismissedAlerts:new Map(),crashTimers:new Map(),activity:[],selected:'wa-1',activeSignalSlot:null,filter:'all',activeTool:'Ai',executiveInboxFrame:0,queueFilter:'pending',
 clearTimeout, setTimeout:()=>0,requestAnimationFrame:()=>0,
 setUiText:(id,value)=>{$(id).textContent=String(value);},setButtonText:(id,value)=>{$(id).textContent=String(value);},alwaysOnStatus(){},callPlatform:id=>id.startsWith('tg-')?'telegram':id.startsWith('signal-')?'signal':'whatsapp',
 renderActivity(){},renderNotificationCenter(){},renderExecutiveInbox(){},renderMissedCalls(){},renderSignal(){},applyGroupOrder(){},handleWebviewCrash(){},
 tooltip:(element,text)=>{element.title=text;},bindAccountDrag(){},busy:async(_control,action)=>action(),rename(){},selectTool:name=>{context.activeTool=name;},
 changeSelected:async id=>{selectedRequests.push(id);context.selected=id;context.activeSignalSlot=null;},selectSignal:async id=>{signalRequests.push(id);context.activeSignalSlot=id;context.selected=null;},
 toast:message=>messages.push(message),showAccountModal:async()=>null,askConfirm:async()=>true,
 sourceName:id=>id.startsWith('tg-')?'Telegram':'WhatsApp',isTelegram:id=>typeof id==='string'&&id.startsWith('tg-'),platform:id=>id.startsWith('tg-')?'tg':'wa',
 allWebAccounts:()=>[...context.state.accounts,...context.state.telegramAccounts],getAccount:id=>context.allWebAccounts().find(account=>account.id===id),
 fmtDate:value=>new Date(value).toISOString(),button:(text)=>{const element=new Element('button');element.textContent=text;return element;},
 window:{desktop:{notify:args=>notifications.push(args),save:async state=>structuredClone(state),partitionCheck:async()=>({ok:true})}}
};
vm.createContext(context);
for(const name of ['unreadCount','unreadTotal','checkTitle','forgetUnread','updateStats','createView','releaseView','handleTitle','renderAccounts','renderTelegram','renderWebAccounts','manageAccount','reminderLabel','renderReminders','reminderTick'])vm.runInContext(functionSource(name),context);
context.persist=async()=>{context.state=await context.window.desktop.save(context.state);context.renderAccounts();context.renderTelegram();context.renderReminders();};
$('executiveInbox').hidden=true;
function railIds(id){return $(id).children.map(row=>row.dataset.accountId).filter(Boolean);}

(async()=>{
 assert.equal(context.checkTitle(' (12) WhatsApp '),12);
 assert.equal(context.checkTitle('Telegram'),0);
 assert.equal(context.checkTitle('Connecting…'),null);
 assert.equal(context.checkTitle('(999999999999999999999999) WhatsApp'),null);
 const first=context.createView('wa-1'),second=context.createView('wa-2'),telegram=context.createView('tg-1');
 first.web.emit('page-title-updated',{title:'(4) WhatsApp'});
 telegram.web.emit('page-title-updated',{title:'(2) Telegram'});
 assert.equal(context.unreadTotal(),6);
 assert(context.unreadCheckAt.has('wa-1'),'Existing unread on initial load needs a reminder timer');
 assert.equal(notifications.length,0,'Initial load must not flood desktop alerts');
 first.web.emit('page-title-updated',{title:'(5) WhatsApp'});
 assert.equal(notifications.length,1,'A genuine increment produces one notification');
 assert.equal(context.activity.length,1);
 assert.equal($('statUnread').textContent,'7');
 assert.equal($('statLoaded').textContent,'2');assert.equal($('statTelegram').textContent,'1');

 context.filter='unread';context.renderAccounts();context.renderTelegram();
 assert.deepEqual(railIds('waList'),['wa-1']);assert.deepEqual(railIds('telegramList'),['tg-1']);
 second.web.emit('page-title-updated',{title:'(3) WhatsApp'});
 assert.deepEqual(railIds('waList'),['wa-1','wa-2'],'A previously absent row appears when it becomes unread');
 telegram.web.emit('page-title-updated',{title:'Telegram'});
 assert.deepEqual(railIds('telegramList'),[],'Telegram rows disappear from unread filter at zero');
 first.web.emit('page-title-updated',{title:'WhatsApp'});
 assert.deepEqual(railIds('waList'),['wa-2']);
 second.web.emit('page-title-updated',{title:'Connecting…'});
 assert.equal(context.counts.has('wa-2'),false,'Unknown titles cannot leave an old unread count on screen');
 assert.equal(context.unreadCheckAt.has('wa-2'),false);
 assert.deepEqual(railIds('waList'),[]);

 second.web.emit('page-title-updated',{title:'(8) WhatsApp'});context.dismissedAlerts.set('wa-2',8);
 second.web.emit('destroyed');
 assert.equal(context.views.has('wa-2'),false);assert.equal(context.counts.has('wa-2'),false);assert.equal(context.unreadCheckAt.has('wa-2'),false);assert.equal(context.dismissedAlerts.has('wa-2'),false);
 const replacement=context.createView('wa-2');replacement.web.emit('page-title-updated',{title:'(2) WhatsApp'});
 second.web.emit('page-title-updated',{title:'(99) WhatsApp'});second.web.emit('destroyed');second.web.emit('render-process-gone',{reason:'stale'});
 assert.equal(context.counts.get('wa-2'),2,'Late events from the old webview cannot change its replacement');assert(context.views.has('wa-2'));
 context.releaseView('wa-2');second.web.emit('page-title-updated',{title:'(77) WhatsApp'});
 assert.equal(context.counts.has('wa-2'),false);assert.equal(context.unreadCheckAt.has('wa-2'),false);
 context.counts.set('wa-deleted',100);context.unreadCheckAt.set('wa-deleted',1);context.releaseView('wa-deleted');
 assert.equal(context.counts.has('wa-deleted'),false,'Cleanup also works when a renderer is already gone');
 assert.equal(context.unreadTotal(),0,'Only current loaded accounts can contribute unread totals');
 context.counts.set('wa-deleted',100);assert.equal(context.unreadTotal(),0,'Orphan counts cannot inflate dashboard totals');

 const filterStart=source.indexOf("for(const [key,el] of [['all','filterAll']");
 const filterEnd=source.indexOf("$('addReminder').onclick",filterStart);
 vm.runInContext(source.slice(filterStart,filterEnd),context);
 $('filterAll').onclick();assert.deepEqual(railIds('telegramList'),['tg-1']);
 $('filterUnread').onclick();assert.deepEqual(railIds('telegramList'),[],'Global account filters also update Telegram');

 context.state.reminders=[{id:'signal-task',title:'Reply to friend',accountId:'signal-1',due:Date.now()-60000,done:false,repeatMinutes:15}];
 context.filter='all';$('reminderAccount').value='signal-1';context.renderReminders();
 assert.equal($('reminderAccount').value,'signal-1','Signal task assignment survives scheduled reminder redraws');
 assert.equal($('statFollow').textContent,'1');assert.equal($('statDue').textContent,'1');assert.equal($('queueBadge').textContent,'1');
 const taskRow=$('reminderList').children[0],openTask=taskRow.children[1].children[0];openTask.onclick();
 assert.deepEqual(signalRequests,[1],'Open on a Signal task selects its launcher dashboard');
 let openQueue;context.window.desktop.onReplyQueue=callback=>{openQueue=callback;};
 vm.runInContext(source.split('\n').find(line=>line.startsWith('window.desktop.onReplyQueue(')),context);
 context.activeSignalSlot=null;openQueue('signal-task','signal-1');
 assert.equal(context.activeSignalSlot,1,'A Signal reminder notification selects its own launcher dashboard');
 const markReplied=taskRow.children[1].children[1];await markReplied.onclick();
 assert.equal(context.state.reminders[0].done,true);assert.equal($('statFollow').textContent,'0');assert.equal($('statDue').textContent,'0');

 context.showAccountModal=async()=> 'close';context.selected='wa-1';context.activeSignalSlot=null;
 await context.manageAccount(context.getAccount('wa-1'));
 assert.equal(selectedRequests.at(-1),'wa-2','Closing the selected first account must not immediately reopen it');
 assert(!context.views.has('wa-1'));
 context.selected=null;context.activeSignalSlot=1;const switches=selectedRequests.length;
 await context.manageAccount(context.getAccount('tg-1'));
 assert.equal(selectedRequests.length,switches,'Closing a background account must preserve the selected Signal dashboard');
 context.state.accounts=[{id:'wa-1',name:'Personal',active:true}];context.state.telegramAccounts=[];context.selected='wa-1';context.activeSignalSlot=null;
 await context.manageAccount(context.getAccount('wa-1'));
 assert.equal(context.selected,null);assert.equal($('welcome').style.display,'grid');assert.equal($('tabName').textContent,'Choose an account');assert($('reloadCurrent').hidden);
 const addStart=source.indexOf("$('addReminder').onclick="),addEnd=source.indexOf("$('quickReply').onclick",addStart);
 vm.runInContext(source.slice(addStart,addEnd),context);
 context.state.accounts=[];context.state.signalSlots=[];context.state.reminders=[];
 $('reminderTitle').value='Reply to friend';$('reminderDue').value=new Date(Date.now()+3600000).toISOString();$('reminderRepeat').value='15';$('reminderAccount').value='';
 await $('addReminder').onclick();
 assert.equal(context.state.reminders.length,0,'A task without any current account must be rejected');
 assert.match(messages.at(-1),/Choose an account/);
 console.log('Count, view lifecycle, live rail filtering, account close, and reply reminder behavior checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
