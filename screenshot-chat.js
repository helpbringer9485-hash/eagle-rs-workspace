'use strict';
window.EagleScreenshots=Object.freeze({create({desktop,getTarget,toast,isLocked,onCapture}){
 const $=id=>document.getElementById(id),items=[];
 const maxCount=4,maxBytes=5*1024*1024,maxTotal=12*1024*1024;
 let epoch=0,working=false,sequence=0,importing=false;
 const permitted=new Set(['image/png','image/jpeg','image/webp']);
 function render(){
  $('screenshotList').replaceChildren();
  $('screenshotStatus').textContent=items.length?`${items.length} of ${maxCount} screenshots ready. Choose Write my reply or Translate.`:'Capture the visible chat, upload an image, or paste a screenshot here.';
  for(const item of items){
   const card=document.createElement('div');card.className='screenshot-card';
   const image=document.createElement('img');image.src=`data:${item.mimeType};base64,${item.data}`;image.alt=item.name;
   const label=document.createElement('span');label.textContent=item.name;
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.disabled=working;
   remove.setAttribute('aria-label','Remove '+item.name);
   remove.onclick=()=>{items.splice(items.indexOf(item),1);render();};
   card.append(image,label,remove);$('screenshotList').append(card);
  }
  for(const id of ['captureChat','captureCurrentChat','uploadScreenshot'])$(id).disabled=working||importing||items.length>=maxCount;
 }
 function append(image,name){
  if(isLocked())return;
  if(!permitted.has(image.mimeType)||typeof image.data!=='string')throw new Error('Use a PNG, JPEG, or WebP screenshot.');
  const bytes=Math.floor(image.data.length*3/4)-(image.data.endsWith('==')?2:image.data.endsWith('=')?1:0);
  if(!bytes||bytes>maxBytes)throw new Error('Each screenshot must be under 5 MB.');
  if(items.length>=maxCount)throw new Error('Attach up to four screenshots. Remove one to add another.');
  if(items.reduce((n,i)=>n+i.bytes,0)+bytes>maxTotal)throw new Error('Screenshots together must be under 12 MB.');
  items.push({id:++sequence,name,mimeType:image.mimeType,data:image.data,bytes});render();
 }
 async function addFiles(files){
  if(working||importing||isLocked())return;
  importing=true;render();const token=epoch;
  try{for(const file of Array.from(files)){
   if(token!==epoch||isLocked())break;
   if(!permitted.has(file.type))throw new Error('Use a PNG, JPEG, or WebP screenshot.');
   if(file.size>maxBytes)throw new Error('Each screenshot must be under 5 MB.');
   const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read this screenshot.'));reader.readAsDataURL(file);});
   await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth&&image.naturalHeight?resolve():reject(new Error('The screenshot is empty.'));image.onerror=()=>reject(new Error('This image could not be opened.'));image.src=dataUrl;});
   if(token!==epoch||isLocked())break;
   append({mimeType:file.type,data:dataUrl.slice(dataUrl.indexOf(',')+1)},file.name||'Pasted screenshot');
  }}catch(error){toast(error.message);}finally{importing=false;$('screenshotFiles').value='';render();}
 }
 async function capture(){
  if(working||importing||isLocked())return;
  const target=getTarget();if(!target)return toast('Select a loaded WhatsApp or Telegram chat. For Signal or other apps, upload or paste a screenshot.');
  importing=true;render();const token=epoch;
  try{
   const result=await desktop.captureChat(target.id);
   if(token!==epoch||isLocked())return;
   if(!result?.ok)throw new Error(result?.message||'Screenshot capture failed.');
   append(result.image,target.name+' · screenshot '+(items.length+1));onCapture();
   toast('Chat screenshot attached. Review it, then choose Reply or Translate.');
  }catch(error){toast(error.message);}finally{importing=false;render();}
 }
 $('captureChat').onclick=capture;$('captureCurrentChat').onclick=capture;
 $('uploadScreenshot').onclick=()=>{if(!working&&!importing)$('screenshotFiles').click();};
 $('screenshotFiles').onchange=()=>addFiles($('screenshotFiles').files);
 $('panelAi').addEventListener('paste',event=>{
  const files=Array.from(event.clipboardData?.items||[]).filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
  if(files.length){event.preventDefault();void addFiles(files);}
 });
 render();
 return Object.freeze({images:()=>items.map(({mimeType,data})=>({mimeType,data})),hasImages:()=>items.length>0,
  isImporting:()=>importing,clear(){epoch++;items.length=0;$('screenshotFiles').value='';render();},setWorking(value){working=value;render();}});
}});
