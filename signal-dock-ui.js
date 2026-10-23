'use strict';
window.EagleSignalDockUI=(()=>{
 let current=null,viewport=null,status=null,inFlight=false,last='',attached=new Set();
 const $=id=>document.getElementById(id);
 const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;return b};
 async function open(id,name){
  current=id;last='';const panel=$('signalProfileDashboard');if(!panel)return;
  panel.replaceChildren();Object.assign(panel.style,{display:'flex',flexDirection:'column',alignItems:'stretch',justifyContent:'flex-start',padding:'12px',gap:'10px'});
  const bar=document.createElement('div');Object.assign(bar.style,{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'});
  const title=document.createElement('strong');title.textContent='Signal · '+name;
  status=document.createElement('span');status.textContent=attached.has(id)?'Connected for this session':'Choose the Signal window for this account.';status.style.fontSize='12px';
  const picker=document.createElement('select');picker.style.maxWidth='260px';picker.setAttribute('aria-label','Choose an existing Signal window');
  async function refresh(){await window.desktop.signalDockHide();last='';const result=await window.desktop.signalDockList();if(current!==id)return;picker.replaceChildren();if(!result.ok){status.textContent=result.message;return;}for(const w of result.windows||[]){const o=document.createElement('option');o.value=w.handle;o.textContent=w.title+' · '+w.handle;picker.append(o);}if(!picker.options.length)status.textContent='Open this account in Signal Desktop, then select Refresh windows.';}
  const connect=button('Connect this window',async()=>{if(!picker.value)return;connect.disabled=true;try{const r=await window.desktop.signalDockAttach(id,picker.value);if(current!==id)return;status.textContent=r.ok?'Connected · chat stays in this panel':r.message;if(r.ok)attached.add(id);last='';}catch(e){status.textContent=e.message}finally{connect.disabled=false}});
  const detach=button('Release window',async()=>{const r=await window.desktop.signalDockDetach(id);if(r.ok)attached.delete(id);last='';status.textContent=r.ok?'Released to Signal Desktop':r.message;});
  const refreshButton=button('Refresh windows',()=>void refresh().catch(e=>status.textContent=e.message));
  bar.append(title,status,picker,refreshButton,connect,detach);
  viewport=document.createElement('div');viewport.setAttribute('aria-label','Docked Signal chat');Object.assign(viewport.style,{flex:'1',minHeight:'160px',background:'#0b1018',borderRadius:'12px',border:'1px solid #46516a',display:'grid',placeItems:'center',textAlign:'center',padding:'16px'});
  const help=document.createElement('p');help.textContent='Experimental Signal docking. Open the correct linked Signal account, choose its window above, then Connect. Repeat for other accounts. Reconnect after restarting EAGLE RS. Your Signal login files are not changed.';help.style.maxWidth='520px';viewport.append(help);panel.append(bar,viewport);if(!attached.has(id))await refresh();
 }
 async function tick(){if(inFlight)return;inFlight=true;try{
  const blocked=!viewport?.isConnected||!$('lockOverlay').hidden||selected!==null||activeSignalSlot!==current||document.hidden||document.querySelector('.overlay.show, #settingsModal.show, #accountModal.show, #profileMore[open]')||!attached.has(current);
  if(blocked){if(last!=='hidden'){await window.desktop.signalDockHide();last='hidden'}return;}
  const r=viewport.getBoundingClientRect();const rect={x:r.x,y:r.y,width:r.width,height:r.height};const key=JSON.stringify([current,rect]);if(last===key)return;
  const result=await window.desktop.signalDockShow(current,rect);last=result.ok?key:'';if(!result.ok){status.textContent=result.message;attached.delete(current);}
 }catch(e){if(status)status.textContent=e.message;last=''}finally{inFlight=false}}
 setInterval(()=>void tick(),150);window.addEventListener('resize',()=>last='');document.addEventListener('visibilitychange',()=>last='');
 return Object.freeze({open});
})();
