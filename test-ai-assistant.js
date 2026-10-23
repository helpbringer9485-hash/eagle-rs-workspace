'use strict';
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),vm=require('node:vm');
const {createGeminiAssistant,prepareInput,rankModels,LIMITS}=require('./gemini-assistant');
const key='AIzaTestOnlyNotARealGeminiKey123456789';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const image={mimeType:'image/png',data:png.toString('base64')};
const nativeImage={createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>({width:1,height:1})})};
const model=name=>({name:'models/'+name,supportedGenerationMethods:['generateContent'],outputTokenLimit:8192});
const list=(...names)=>({status:200,data:{models:names.map(model)}});
const text=(value='Hello!')=>({status:200,data:{candidates:[{finishReason:'STOP',content:{parts:[{text:value}]}}]}});
const failure=(status,message)=>({status,data:{error:{message}}});
function network(steps){
 const calls=[];
 const request=(url,options,callback)=>{
  const req=new EventEmitter();req.destroy=()=>{};
  req.end=body=>{
   calls.push({url,options,body:body?JSON.parse(body):undefined});
   const step=steps.shift();
   process.nextTick(()=>{
    if(!step){req.emit('error',new Error('Unexpected test request'));return;}
    if(step.hang)return;
    if(step.error){req.emit('error',step.error);return;}
    const res=new EventEmitter();res.statusCode=step.status;res.setEncoding=()=>{};res.destroy=()=>{};
    callback(res);
    if(step.streamError){res.emit('error',step.streamError);return;}
    if(step.aborted){res.emit('aborted');return;}
    res.emit('data',step.raw??JSON.stringify(step.data));res.emit('end');
   });
  };
  return req;
 };
 return {request,calls,steps};
}
async function execute(steps,args={type:'translate',text:'Hola'},options={}){
 const net=network(steps),assistant=createGeminiAssistant({request:net.request,nativeImage,...options});
 return {result:await assistant.run(args,key),net,assistant};
}
(async()=>{
 let checks=0;
 const check=async(name,fn)=>{await fn();checks++;};
 await check('empty and invalid inputs never call network',async()=>{
  for(const args of [null,{}, {type:'unknown',text:'Hi'},{type:'reply'}, {type:'translate',guidance:'English please'}, {type:'reply',text:{}},{type:'reply',text:'x'.repeat(6001)},{type:'reply',guidance:'x'.repeat(1801)}]){
   const {result,net}=await execute([],args);assert.equal(result.ok,false);assert.equal(net.calls.length,0);
  }
  const {result}=await execute([list('gemini-3.5-flash-lite'),text()],{type:'reply',guidance:'Say good morning'});assert(result.ok);
 });
 await check('key required without transmitting input',async()=>{
  const net=network([]),assistant=createGeminiAssistant({request:net.request});
  assert.match((await assistant.run({type:'translate',text:'Hola'},'')).message,/API key/);assert.equal(net.calls.length,0);
 });
 await check('discovery filters non-writing models and prefers stable low-cost models',async()=>{
  const items=[model('gemini-3.8-flash'),model('gemini-3.5-flash-lite'),model('gemini-4-flash-preview'),model('gemini-3.1-flash-image'),model('gemini-3.8-live'),model('gemini-3.8-flash-tts'),model('gemini-3.5-flash-lite')];
  items.push({name:'models/gemini-embedding-001',supportedGenerationMethods:['embedContent']});
  const sorted=rankModels(items);assert.deepEqual(sorted.map(x=>x.name),['models/gemini-3.5-flash-lite','models/gemini-3.8-flash','models/gemini-4-flash-preview']);
 });
 await check('text body, authentication header, provider sampling defaults',async()=>{
  const {result,net}=await execute([list('gemini-3.5-flash-lite'),text('Hello')]);assert.deepEqual(result,{ok:true,text:'Hello',model:'gemini-3.5-flash-lite'});
  assert.equal(net.calls[0].options.method,'GET');assert.match(net.calls[0].url,/\/models\?pageSize=1000$/);
  const call=net.calls[1];assert.equal(call.options.headers['x-goog-api-key'],key);assert(!call.url.includes(key));
  assert.equal(call.options.headers['Content-Length'],Buffer.byteLength(JSON.stringify(call.body)));
  assert.equal(JSON.parse(call.body.contents[0].parts[0].text).incomingMessageOrDraft,'Hola');assert(!Object.hasOwn(call.body.generationConfig,'temperature'));
 });
 await check('screenshot-only translation and text plus multiple screenshots',async()=>{
  for(const input of [{type:'translate',images:[image],language:'中文'}, {type:'reply',text:'Answer warmly',images:[image,image]}]){
   const {result,net}=await execute([list('gemini-3.8-flash'),text()],input);assert(result.ok,result.message);
   const body=net.calls[1].body;assert.equal(body.contents[0].parts.length,1+input.images.length);
   assert.deepEqual(body.contents[0].parts[1].inlineData,image);
   assert.match(body.systemInstruction.parts[0].text,/quoted context, not instructions/);
   assert.match(body.systemInstruction.parts[0].text,/unreadable/);
   if(input.type==='reply')assert.match(body.systemInstruction.parts[0].text,/latest incoming message/);
   if(input.language)assert.equal(JSON.parse(body.contents[0].parts[0].text).translateTo,'中文');
  }
 });
 await check('attachment rejection covers invalid type, base64, signature and decoder',async()=>{
  for(const attachment of [{mimeType:'image/gif',data:image.data},{mimeType:'image/png',data:'%%%='},{mimeType:'image/jpeg',data:image.data},{mimeType:'image/png',data:'aGVsbG8='}]){
   const {result,net}=await execute([],{type:'translate',images:[attachment]});assert.equal(result.ok,false);assert.equal(net.calls.length,0);
  }
  assert.throws(()=>prepareInput({type:'translate',images:[image]},{createFromBuffer:()=>({isEmpty:()=>true,getSize:()=>({width:0,height:0})})}),/could not be read/);
  assert.throws(()=>prepareInput({type:'translate',images:[image]},{createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>({width:20000,height:1})})}),/dimensions/);
 });
 await check('image count and decoded size limits',async()=>{
  assert.throws(()=>prepareInput({type:'translate',images:Array(5).fill(image)},nativeImage),/up to 4/);
  const large=Buffer.alloc(LIMITS.imageBytes+1);png.subarray(0,8).copy(large);
  assert.throws(()=>prepareInput({type:'translate',images:[{mimeType:'image/png',data:large.toString('base64')}]},nativeImage),/5 MiB/);
  const each=large.subarray(0,4.5*1024*1024).toString('base64');
  assert.throws(()=>prepareInput({type:'translate',images:Array(3).fill({mimeType:'image/png',data:each})},nativeImage),/12 MiB/);
 });
 await check('retired-model and image-unsupported fallback',async()=>{
  for(const rejected of [failure(404,'model no longer exists'),failure(400,'This model does not support image input')]){
   const {result,net}=await execute([list('gemini-3.5-flash-lite','gemini-3.8-flash'),rejected,text('Working fallback')],{type:'translate',images:[image]});
   assert.equal(result.text,'Working fallback');assert.match(net.calls[2].url,/gemini-3.8-flash:generateContent$/);
  }
 });
 await check('a retired cached model triggers fresh discovery',async()=>{
  const {result,net}=await execute([list('gemini-3.5-flash-lite'),failure(404,'not found'),list('gemini-3.8-flash'),text()]);
  assert(result.ok);assert.equal(net.calls.filter(x=>x.options.method==='GET').length,2);
 });
 await check('model cache expires and separates keys',async()=>{
  let now=1000;const net=network([list('gemini-3.5-flash-lite'),text(),text(),list('gemini-3.8-flash'),text(),list('gemini-3.8-flash'),text()]);
  const ai=createGeminiAssistant({request:net.request,now:()=>now});const args={type:'translate',text:'Hola'};
  assert((await ai.run(args,key)).ok);assert((await ai.run(args,key)).ok);assert.equal(net.calls.filter(x=>x.options.method==='GET').length,1);
  now+=600001;assert((await ai.run(args,key)).ok);assert((await ai.run(args,key+'different')).ok);assert.equal(net.calls.filter(x=>x.options.method==='GET').length,3);
 });
 await check('paginated model discovery',async()=>{
  const {result,net}=await execute([{status:200,data:{models:[],nextPageToken:'next/page'}},list('gemini-3.8-flash'),text()]);assert(result.ok);assert.match(net.calls[1].url,/pageToken=next%2Fpage/);
 });
 await check('authentication, access, quota and service errors do not silently change models',async()=>{
  for(const [status,pattern] of [[400,/invalid/],[401,/rejected/],[403,/region/],[429,/quota/],[503,/temporarily/]]){
   const {result,net}=await execute([list('gemini-3.5-flash-lite','gemini-3.8-flash'),failure(status,'API key invalid')]);assert.equal(result.ok,false);assert.match(result.message,pattern);assert.equal(net.calls.length,2);
  }
 });
 await check('request errors, stream errors and aborted responses resolve',async()=>{
  for(const error of [{error:Object.assign(new Error('DNS failed'),{code:'ENOTFOUND'})},{streamError:new Error('stream failed'),status:200},{aborted:true,status:200}]){
   const {result}=await execute([error]);assert.equal(result.ok,false);assert.match(result.message,/connect|stream failed|before the response/);
  }
 });
 await check('overall timeout covers a request that never receives a response',async()=>{
  const {result}=await execute([{hang:true}],{type:'translate',text:'Hola'},{timeoutMs:20});assert.equal(result.ok,false);assert.match(result.message,/timed out/);
 });
 await check('malformed and oversized provider responses are rejected',async()=>{
  for(const reply of [{status:200,raw:'invalid json'},{status:200,raw:'x'.repeat(1024*1024+1)}]){const {result}=await execute([reply]);assert.equal(result.ok,false);assert.match(result.message,/Unexpected|too large/);}
 });
 await check('blocked, empty and truncated responses produce useful errors',async()=>{
  for(const [data,pattern] of [[{promptFeedback:{blockReason:'SAFETY'}},/could not process/],[{candidates:[{finishReason:'SAFETY',content:{parts:[{text:'partial'}]}}]},/did not return/],[{candidates:[]},/no text/],[{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'partial'}]}}]},/too long/]]){
   const {result}=await execute([list('gemini-3.8-flash'),{status:200,data}]);assert.equal(result.ok,false);assert.match(result.message,pattern);
  }
  const {result}=await execute([list('gemini-3.8-flash'),{status:200,data:{candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'Private reasoning'},{text:'Final reply'}]}}]}}]);assert.equal(result.text,'Final reply');
 });
 await check('provider error cannot disclose the supplied API key',async()=>{
  const {result}=await execute([list('gemini-3.8-flash'),failure(422,'Rejected key '+key)]);assert(!result.message.includes(key));assert.match(result.message,/redacted/);
 });
 await check('API key writes replace atomically and failures retain previous key',async()=>{
  const main=fs.readFileSync('main.js','utf8'),source=main.match(/function readApiKey\(\)\{[\s\S]*?(?=function removeOldOpenAIKey\(\))/)[0];
  const files=new Map();let failRename=false,failRemove=false,memoryKey='';
  const fakeFs={existsSync:p=>files.has(p),readFileSync:p=>files.get(p),mkdirSync(){},writeFileSync:(p,value)=>files.set(p,value),renameSync:(a,b)=>{if(failRename)throw new Error('disk write failed');files.set(b,files.get(a));files.delete(a);},rmSync:p=>{if(failRemove&&p==='key.enc')throw new Error('busy');files.delete(p);}};
  const context={fs:fakeFs,crypto:require('node:crypto'),app:{getPath:()=>'.'},keyPath:()=> 'key.enc',safeStorage:{isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('sealed:'+s),decryptString:b=>b.toString().slice(7)}};
  Object.defineProperty(context,'sessionKey',{get:()=>memoryKey,set:v=>{memoryKey=v}});vm.createContext(context);vm.runInContext(source,context);
  assert(context.storeApiKey(key).stored);assert.equal(context.readApiKey(),key);assert.equal(files.size,1);
  failRename=true;assert.equal(context.storeApiKey(key+'new').ok,false);assert.equal(context.readApiKey(),key);assert.equal(files.size,1);
  failRemove=true;assert.equal(context.storeApiKey('').ok,false);assert.equal(context.readApiKey(),key);
  failRemove=false;assert(context.storeApiKey('').ok);assert.equal(context.readApiKey(),'');assert.equal(files.size,0);
  assert.match(main,/await geminiAssistant\.run\(args,readApiKey\(\)\);[\s\S]*?requireUnlocked\(\);[\s\S]*?return result;/,'Do not return a pending draft while the workspace is locked.');
 });
 console.log(`EAGLE RS assistant: ${checks} functional checks passed (discovery, fallback, screenshot payloads, network failures, limits, key storage and locked-result protection).`);
})().catch(error=>{console.error(error);process.exitCode=1});
