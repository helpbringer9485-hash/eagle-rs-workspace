'use strict';
// Pure validator: do not trust arbitrary subdomains, plain HTTP, or other permissions.
function allowProviderNotification(permission, requestingUrl, expectedHost, optedIn){
 if(!optedIn||permission!=='notifications')return false;
 if(!['web.whatsapp.com','web.telegram.org'].includes(expectedHost))return false;
 try{
  const u=new URL(String(requestingUrl||''));
  return u.protocol==='https:' && u.hostname===expectedHost && (u.port===''||u.port==='443') && !u.username && !u.password;
 }catch{return false;}
}
module.exports={allowProviderNotification};
