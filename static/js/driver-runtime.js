/* Run the original demo backend in each iframe, using browser-local storage. */
(function () {
  "use strict";
  var modules = {}, factories = window.OSOmniDriverModules, originalFetch = window.fetch.bind(window);
  var assets={},assetURL=new URL('./opendriver/routing.json.gz',document.currentScript.src);
  var assetsReady=originalFetch(assetURL).then(function(r){if(!r.ok)throw new Error('Image routing data unavailable');return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();}).then(function(data){assets=data;}).catch(function(){assets={};});
  function relative(p){for(var name of ['road-graphs','route-cache','search-index']){var marker='/'+name,index=p.indexOf(marker);if(index>=0)return p.slice(index+1);}return null;}
  var path = { join: function(){return Array.from(arguments).join("/");}, resolve:function(){return Array.from(arguments).join("/");}, extname:function(p){return p.slice(p.lastIndexOf("."));}, basename:function(p){return p.split("/").pop();}, dirname:function(p){return p.slice(0,p.lastIndexOf("/"));}, normalize:function(p){return p;} };
  var fs={mkdirSync:function(){},existsSync:function(p){if(p.endsWith('opendriver-db.json'))return !!localStorage.getItem('driver.database');var rel=relative(p);return !!rel&&(assets[rel]!==undefined||Object.keys(assets).some(function(k){return k.startsWith(rel+'/');}));},readFileSync:function(p){if(p.endsWith('opendriver-db.json'))return localStorage.getItem('driver.database');var rel=relative(p);if(rel&&assets[rel]!==undefined)return assets[rel];throw new Error('Image asset unavailable');},writeFileSync:function(p,s){if(p.endsWith('opendriver-db.json'))localStorage.setItem('driver.database',s);else{var rel=relative(p);if(rel)assets[rel]=String(s);}},readdirSync:function(p){var rel=relative(p);return rel?Array.from(new Set(Object.keys(assets).filter(function(k){return k.startsWith(rel+'/');}).map(function(k){return k.slice(rel.length+1).split('/')[0];}))):[];},statSync:function(p){var rel=relative(p),file=rel&&assets[rel]!==undefined;return {size:file?assets[rel].length:0,mtimeMs:0,isFile:function(){return !!file;},isDirectory:function(){return !file;}};}};

  var shims = {fs:fs,path:path,http:{},https:{},zlib:{},"jpeg-js":{},url:{URL:URL},crypto:{randomBytes:function(n){var bytes=crypto.getRandomValues(new Uint8Array(n));return {toString:function(){return Array.from(bytes,function(b){return b.toString(16).padStart(2,"0");}).join("");}};}}};
  function require(name) { if(shims[name])return shims[name];if(modules[name])return modules[name].exports;var m=modules[name]={exports:{}};if(!factories[name])throw new Error("Unknown demo module: "+name);factories[name](require,m,m.exports,{env:{OPENDRIVER_ONLINE_MAPS:"false",OPENDRIVER_ONLINE_ROUTES:"false"}},"/browser/driver");return m.exports; }
  var handler = require("server").handle;
  async function request(url,options){
    options=Object.assign({},options);
    if (options.body instanceof Blob) options.body=await options.body.text();
    else if (options.body instanceof ArrayBuffer || ArrayBuffer.isView(options.body)) options.body=new TextDecoder().decode(options.body);
    var u=new URL(url,location.href),headers={host:"localhost"};
    if (u.pathname.startsWith("/map/tiles/")) {
      var tile=u.pathname.match(/\/map\/tiles\/(\d+)\/(\d+)\/(\d+)/);
      try { return new Response(await OSOmniMapTiles.get(+tile[1],+tile[2],+tile[3]),{headers:{'Content-Type':'image/png'}}); }
      catch (_) { return new Response('Map tile unavailable',{status:503}); }
    }
    new Headers(options.headers||{}).forEach(function(v,k){headers[k.toLowerCase()]=v;});
    await assetsReady;
    return new Promise(function(resolve){var status=200,responseHeaders={};var req={url:u.pathname+u.search,method:options.method||"GET",headers:headers,on:function(event,cb){if(event==="data")queueMicrotask(function(){if(options.body)cb(options.body);});if(event==="end")queueMicrotask(cb);}};
      var res={writeHead:function(s,h){status=s;responseHeaders=h||{};},end:function(body){resolve(new Response(body||"",{status:status,headers:responseHeaders}));},setHeader:function(k,v){responseHeaders[k]=v;}};
      Promise.resolve(handler(req,res)).catch(function(e){status=500;res.end(JSON.stringify({success:false,error:{code:"BROWSER_ERROR",message:e.message}}));});
    });
  }
  function local(url){var u=new URL(url,location.href);return ['127.0.0.1','localhost'].includes(u.hostname)&&['4320','4300','4310'].includes(u.port);}
  window.fetch=function(url,options){return local(typeof url==="string"?url:url.url)?request(typeof url==="string"?url:url.url,options):originalFetch(url,options);};
  var NativeXHR=window.XMLHttpRequest;
  class LocalXHR extends NativeXHR {
    open(method,url){this.localURL=local(url)?url:null;this.localMethod=method;if(!this.localURL)return super.open.apply(this,arguments);this.localHeaders={};}
    setRequestHeader(k,v){if(this.localURL)this.localHeaders[k]=v;else super.setRequestHeader(k,v);}
    send(body){if(!this.localURL)return super.send(body);var self=this;request(this.localURL,{method:this.localMethod,headers:this.localHeaders,body:body}).then(async function(r){var buffer=await r.arrayBuffer(), text=new TextDecoder().decode(buffer);Object.defineProperties(self,{status:{configurable:true,value:r.status},readyState:{configurable:true,value:4},responseText:{configurable:true,value:text},response:{configurable:true,value:self.responseType==='arraybuffer'?buffer:self.responseType==='blob'?new Blob([buffer],{type:r.headers.get('content-type')||'application/octet-stream'}):text}});self.dispatchEvent(new Event("readystatechange"));self.dispatchEvent(new ProgressEvent("load"));self.dispatchEvent(new ProgressEvent("loadend"));});}
    getAllResponseHeaders(){return this.localURL?'content-type: application/json\r\n':super.getAllResponseHeaders();}
  }
  window.XMLHttpRequest=LocalXHR;
  window.OSOmniDriverRequest=request;
})();
