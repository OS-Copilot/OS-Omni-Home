/* The entry gate tracks actual module readiness, never a simulated timer. */
(function(global){
  'use strict';
  var labels={playground:'Five platform workspaces',tasks:'Task Explorer',leaderboard:'Model results',pipeline:'Annotation walkthrough',replays:'Trajectory player',robot:'Interactive 3D robot',galaxy:'Interactive galaxy',navigation:'Page interactions',assets:'Device artwork and icons'};
  var state=new Map(Object.keys(labels).map(function(id){return[id,'pending'];})),errors=new Map(),released=false,started=false;
  document.documentElement.classList.add('site-loading');
  var finishPromise,resolveFinish;finishPromise=new Promise(function(resolve){resolveFinish=resolve;});
  var watchdog=setTimeout(function(){
    state.forEach(function(value,id){if(value==='pending'){state.set(id,'failed');errors.set(id,'Still waiting for '+labels[id]+'.');}});update();
  },45000);
  function snapshot(){return{released:released,ready:Array.from(state.values()).filter(function(s){return s==='ready';}).length,total:state.size,errors:Array.from(errors.values()),pending:Array.from(state).filter(function(p){return p[1]!=='ready';}).map(function(p){return p[0];})};}
  function update(){
    var status=snapshot(),bar=document.getElementById('site-boot-progress'),text=document.getElementById('site-boot-status'),count=document.getElementById('site-boot-count'),error=document.getElementById('site-boot-error');
    if(bar){bar.setAttribute('aria-valuenow',String(status.ready));bar.style.setProperty('--boot-progress',String(status.ready/status.total));}
    if(count)count.textContent=status.ready+' / '+status.total+' modules ready';
    if(text)text.textContent=status.errors.length?'Some features are not ready yet.':status.ready===status.total?'Your universe is ready.':'Preparing '+(labels[status.pending[0]]||'your workspace').toLowerCase()+'…';
    if(error){error.hidden=!status.errors.length;error.textContent=status.errors.slice(0,3).join(' ');}
    document.querySelectorAll('[data-boot-retry],[data-boot-continue]').forEach(function(button){button.hidden=!status.errors.length;});
    document.querySelectorAll('[data-boot-module]').forEach(function(row){var value=state.get(row.getAttribute('data-boot-module'));row.dataset.state=value;row.querySelector('small').textContent=value==='ready'?'Ready':value==='failed'?'Retry needed':'Preparing';});
    if(!released&&status.ready===status.total&&!errors.size)enter(false);
  }
  function ready(id){if(!state.has(id))return;state.set(id,'ready');errors.delete(id);update();}
  function fail(id,message){if(released)return;if(state.has(id))state.set(id,'failed');errors.set(id,String(message||'A page module could not be loaded.'));update();}
  function enter(limited){
    if(released)return;released=true;clearTimeout(watchdog);
    document.documentElement.classList.remove('site-loading');document.documentElement.classList.add('site-entered');
    document.body?.setAttribute('aria-busy','false');if(limited)document.body.dataset.bootLimited='true';
    var overlay=document.getElementById('site-loader');if(overlay)overlay.hidden=true;
    global.dispatchEvent(new CustomEvent('osomni:app-enter',{detail:{limited:limited}}));
    document.dispatchEvent(new CustomEvent('osomni:app-enter',{detail:{limited:limited}}));
    resolveFinish({limited:limited});
  }
  global.OSOmniBoot={ready:ready,fail:fail,snapshot:snapshot,finished:finishPromise,get released(){return released;}};
  function loadImage(url){return new Promise(function(resolve,reject){
    var image=new Image(),settled=false,timer=setTimeout(function(){done(new Error('Device artwork took too long to load.'));},15000);
    function done(error){if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve();}
    image.onload=function(){(image.decode?image.decode():Promise.resolve()).then(function(){done();},done);};
    image.onerror=function(){done(new Error('Device artwork could not be loaded.'));};image.src=url;
    if(image.complete&&image.naturalWidth)image.onload();
  });}
  async function assets(){
    var core=['public/favicon-512.png','static/images/linux-wallpaper.png','static/images/windows-wallpaper.jpg','static/images/macos-wallpaper.jpg','static/images/android-wallpaper.png','static/images/ios-home-wallpaper.jpg','static/images/ios-lock-wallpaper.jpg'];
    var icons=Array.from(new Set((global.OSOmniBrowserApps||[]).map(function(app){return app.icon;}).filter(function(url){return typeof url==='string'&&url.startsWith('static/');})));
    await Promise.all([
      Promise.all(core.map(loadImage)),
      Promise.allSettled(icons.map(loadImage)),
      Promise.all(['linux','windows','android'].map(async function(id){var response=await fetch('static/data/'+id+'-app-audit.json');if(!response.ok)throw Error('An application inventory could not be loaded.');await response.json();})),
      Promise.race([document.fonts?document.fonts.ready.catch(function(){}):Promise.resolve(),new Promise(function(resolve){setTimeout(resolve,8000);})])
    ]);
    ready('assets');
  }
  function start(){if(started)return;started=true;document.body.setAttribute('aria-busy',String(!released));update();assets().catch(function(error){fail('assets',error.message);});}
  document.addEventListener('click',function(event){
    if(event.target.closest?.('[data-boot-retry]'))global.location.reload();
    else if(event.target.closest?.('[data-boot-continue]'))enter(true);
  });
  global.addEventListener('error',function(event){
    if(released)return;
    if(event.target?.tagName==='SCRIPT'&&event.target.src)fail('scripts','An interaction script could not be downloaded. Please retry.');
    else if(event.filename&&event.filename.includes('/static/js/'))fail('scripts','A page module could not start. Please retry.');
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
