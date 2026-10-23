'use strict';
// Capture only a messaging guest owned by this workspace.
function createChatCapture({webContents,getWindow,requireUnlocked}){
 return async function captureChat(_event,id){
  requireUnlocked();
  try{
   const win=getWindow();
   const guest=Number.isSafeInteger(id)?webContents.fromId(id):null;
   if(!win||win.isDestroyed()||!guest||guest.isDestroyed()||guest.getType()!=='webview'||guest.hostWebContents!==win.webContents)
    return {ok:false,message:'Open a WhatsApp or Telegram chat in this workspace first.'};
   const url=new URL(guest.getURL());
   if(url.protocol!=='https:'||!['web.whatsapp.com','web.telegram.org'].includes(url.hostname))
    return {ok:false,message:'Only the selected WhatsApp or Telegram chat can be captured.'};
   let image=await guest.capturePage();
   requireUnlocked();
   if(guest.isDestroyed()||image.isEmpty())return {ok:false,message:'The chat has no visible image yet. Wait for it to load, then try again.'};
   const size=image.getSize(),maxDimension=2400;
   if(Math.max(size.width,size.height)>maxDimension){
    const ratio=maxDimension/Math.max(size.width,size.height);
    image=image.resize({width:Math.round(size.width*ratio),height:Math.round(size.height*ratio),quality:'best'});
   }
   let bytes=image.toPNG(),mimeType='image/png';
   if(bytes.length>5*1024*1024){bytes=image.toJPEG(90);mimeType='image/jpeg';}
   if(bytes.length>5*1024*1024)return {ok:false,message:'This screenshot is too large. Upload a cropped image under 5 MB.'};
   return {ok:true,image:{mimeType,data:bytes.toString('base64')},width:image.getSize().width,height:image.getSize().height};
  }catch(error){return {ok:false,message:'Could not capture the chat. Unlock the workspace and wait for the chat to load, or upload a screenshot. '+String(error.message||error).slice(0,150)};}
 };
}
module.exports={createChatCapture};
