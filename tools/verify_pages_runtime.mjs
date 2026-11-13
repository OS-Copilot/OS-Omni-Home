/* Exercise the production worker against an ordinary static HTTP server.
 * No browser UI automation; this verifies routing/streaming, not visual QA.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DecompressionStream} from 'node:stream/web';
import http from 'node:http';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Use the basic HTTP client so this HTTP/1.0 fixture does not depend on undici's
// streamed-response parser. Production uses the browser's native fetch.
function staticFetch(input,options={}){
  const url=typeof input==='string'?input:input.url;
  const method=options.method||(typeof input==='string'?'GET':input.method);
  return new Promise((resolve,reject)=>{
    const req=http.request(url,{method,agent:false},response=>{
      const chunks=[];
      response.on('data',chunk=>chunks.push(chunk));
      response.on('error',reject);
      response.on('end',()=>resolve(new Response(method==='HEAD'||[204,304].includes(response.statusCode)?null:Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));
    });
    req.on('error',reject);req.end();
  });
}

export async function verifyPagesRuntime(directory, origin = 'http://127.0.0.1:8915') {
  const report = JSON.parse(await fs.readFile(path.join(directory, 'pages-build-report.json'), 'utf8'));
  const manifest = JSON.parse(await fs.readFile(path.join(directory, report.manifest), 'utf8'));
  const main = path.join(directory, report.projects[0].directory);
  const worker = await fs.readFile(path.join(main, 'osomni-pages-sw.js'), 'utf8');
  const base = origin + manifest.base;
  const cacheStore = new Map([
    ['osomni-pages-manifest-obsolete', new Map()],
    ['user-app-cache-fixture', new Map()]
  ]);
  let unavailableBlob = '';
  const expectedErrors=[];
  let calls = 0;
  const networkFetch = async (input, options) => {
    calls++;
    const url = typeof input === 'string' ? input : input.url;
    assert.equal(new URL(url).origin, origin, 'Runtime attempted an unexpected external request');
    if (unavailableBlob && url.includes(unavailableBlob)) return new Response('Missing asset', {status:404});
    return staticFetch(input, options);
  };
  const fakeCaches = {
    async keys(){return [...cacheStore.keys()];},
    async delete(key){return cacheStore.delete(key);},
    async open(key){
      if(!cacheStore.has(key))cacheStore.set(key,new Map());
      const values=cacheStore.get(key);
      return {async match(url){return values.get(String(url))?.clone();},
              async put(url,response){values.set(String(url),response.clone());}};
    }
  };
  function startWorker(){
    const listeners=new Map();
    const lifecycle={installed:false,claimed:false};
    const self={location:{origin},addEventListener(type,fn){listeners.set(type,fn);},
      async skipWaiting(){lifecycle.installed=true;},clients:{async claim(){lifecycle.claimed=true;}}};
    const context=vm.createContext({self,caches:fakeCaches,fetch:networkFetch,Response,Request,Headers,URL,DecompressionStream,
      console:{...console,error(...args){expectedErrors.push(args.map(String).join(' '));}}});
    vm.runInContext(worker,context,{filename:'osomni-pages-sw.js'});
    const run=vm.runInContext('handleRequest',context);
    return {listeners,lifecycle,run};
  }
  const runtime=startWorker();
  for(const name of ['install','activate']){
    let pending;
    runtime.listeners.get(name)({waitUntil(promise){pending=promise;}});
    await pending;
  }
  assert(runtime.lifecycle.installed&&runtime.lifecycle.claimed);
  assert(cacheStore.has('user-app-cache-fixture'));
  assert(!cacheStore.has('osomni-pages-manifest-obsolete'));
  const request=(route,options={})=>new Request(new URL(route,base),options);
  const cases=JSON.parse(await fs.readFile(path.join(main,'static/data/case-studies.json'),'utf8')).cases;
  const selections=new Set(['index.html','static/js/browser-playground.js','static/data/case-studies.json']);
  for(const route of Object.keys(manifest.routes)){
    if(route.startsWith('public/playground/')&&(route.endsWith('/index.html')||route.endsWith('/system.html')))selections.add(route);
  }
  for(const item of cases){
    for(const shot of [item.steps[0].before,item.finalScreenshot]){
      selections.add(shot.src);selections.add(shot.preview.src);
    }
  }
  const virtual=Object.keys(manifest.routes).filter(route=>!manifest.physical.includes(route));
  for(const extension of ['.wasm','.pdf','.json','.woff2','.png','.css','.js','.webp']){
    const route=virtual.find(p=>p.endsWith(extension)&&manifest.blobs[manifest.routes[p]][2]<8*1024*1024);
    if(route)selections.add(route);
  }
  const queue=[...selections];
  let checked=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(queue.length){
      const route=queue.shift();
      const response=await runtime.run(request(route));
      assert.equal(response.status,200,route);
      const bytes=Buffer.from(await response.arrayBuffer());
      assert.equal(hash(bytes),manifest.routes[route],route);
      if(!manifest.physical.includes(route)&&route.endsWith('.webp'))assert.match(response.headers.get('Content-Type'),/^image\/webp/);
      if(!manifest.physical.includes(route)&&route.endsWith('.wasm'))assert.match(response.headers.get('Content-Type'),/^application\/wasm/);
      checked++;
    }
  }));
  const partialRoutes=['index.html',virtual.find(p=>p.endsWith('.webp')),virtual.find(p=>p.endsWith('.pdf'))];
  let protocolChecks=0;
  for(const route of partialRoutes){
    const original=Buffer.from(await(await runtime.run(request(route))).arrayBuffer());
    const digest=manifest.routes[route];
    let response=await runtime.run(request(route,{headers:{Range:'bytes=13-112'}}));
    assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),original.subarray(13,113));protocolChecks++;
    response=await runtime.run(request(route,{headers:{Range:'bytes=-64'}}));
    assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),original.subarray(-64));protocolChecks++;
    response=await runtime.run(request(route,{headers:{Range:'bytes=999999999999-'}}));
    assert.equal(response.status,416);assert.equal((await response.arrayBuffer()).byteLength,0);protocolChecks++;
    response=await runtime.run(request(route,{headers:{'If-None-Match':'"'+digest+'"'}}));
    assert.equal(response.status,304);protocolChecks++;
    response=await runtime.run(request(route,{headers:{Range:'bytes=13-112','If-Range':'"outdated"'}}));
    assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),digest);protocolChecks++;
    const beforeCalls=calls;
    response=await runtime.run(request(route,{method:'HEAD'}));
    assert.equal(response.status,200);assert.equal(Number(response.headers.get('Content-Length')),original.length);assert.equal((await response.arrayBuffer()).byteLength,0);assert.equal(calls,beforeCalls);protocolChecks++;
  }
  let response=await runtime.run(request('public/playground/apps/openbank?kept=yes'));
  assert.equal(response.status,301);assert.equal(response.headers.get('Location'),base+'public/playground/apps/openbank/?kept=yes');protocolChecks++;
  response=await runtime.run(request('public/playground/apps/openbank/?kept=yes'));
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),manifest.routes['public/playground/apps/openbank/index.html']);protocolChecks++;
  response=await runtime.run(request('INDEX.HTML'));
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),manifest.routes['index.html']);protocolChecks++;
  response=await runtime.run({url:origin+'/public/playground/apps/openbank/index.html?kept=yes',method:'GET',headers:new Headers(),mode:'navigate'});
  assert.equal(response.status,302);assert.equal(response.headers.get('Location'),base+'public/playground/apps/openbank/index.html?kept=yes');protocolChecks++;
  let pending;
  let routeFound;
  runtime.listeners.get('message')({data:{type:'OSOMNI_ROUTE_CHECK',url:base},ports:[{postMessage(value){routeFound=value.found;}}],waitUntil(promise){pending=promise;}});
  await pending;assert.equal(routeFound,true);protocolChecks++;
  runtime.listeners.get('message')({data:{type:'OSOMNI_ROUTE_CHECK',url:base+'missing-page.html'},ports:[{postMessage(value){routeFound=value.found;}}],waitUntil(promise){pending=promise;}});
  await pending;assert.equal(routeFound,false);protocolChecks++;
  const restarted=startWorker();
  response=await restarted.run(request('index.html'));
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),manifest.routes['index.html']);protocolChecks++;
  // Missing shards must report a failure, never a successful empty asset.
  unavailableBlob=manifest.routes[virtual.find(p=>p.endsWith('.webp'))];
  let result;
  runtime.listeners.get('fetch')({request:request(virtual.find(p=>p.endsWith('.webp'))),respondWith(promise){result=promise;}});
  response=await result;assert.equal(response.status,503);protocolChecks++;
  assert.equal(expectedErrors.length,1);assert.match(expectedErrors[0],/Resource unavailable/);
  unavailableBlob='';
  const cold=await staticFetch(base);
  assert.equal(cold.status,200);assert.match(await cold.text(),/navigator\.serviceWorker\.register/);protocolChecks++;
  const direct=await staticFetch(base+'public/playground/apps/openbank/index.html');
  assert.equal(direct.status,200);assert.match(await direct.text(),/navigator\.serviceWorker\.register/);protocolChecks++;
  // Flutter's own worker bypasses the parent worker: these need physical files.
  const tiles=JSON.parse(await(await staticFetch(base+'public/playground/apps/opennavigation/tiles/manifest.json')).text());
  assert(Array.isArray(tiles)&&tiles.length>0);
  response=await staticFetch(base+'public/playground/apps/opennavigation/tiles/'+tiles[0]);
  assert.equal(response.status,200);protocolChecks++;
  const output={status:'passed',resourceResponses:checked,protocolChecks,origin,staticServerOnly:true,
    installActivateHandlers:true,appCacheRetained:true,workerRestartWithCachedIndex:true,
    visualBrowserValidation:false};
  await fs.writeFile(path.join(directory,'pages-runtime-verification.json'),JSON.stringify(output,null,2));
  return output;
}
