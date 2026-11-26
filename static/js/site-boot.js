/* The document is usable before optional resources and modules are ready. */
(function(global){
  'use strict';
  var state=new Map(),errors=new Map(),released=false,resolveEntry;
  var finished=new Promise(function(resolve){resolveEntry=resolve;});
  var base=new URL('../../',document.currentScript.src);
  function announce(id,status){global.dispatchEvent(new CustomEvent('osomni:module-'+status,{detail:{id:id}}));}
  function ready(id){state.set(id,'ready');errors.delete(id);announce(id,'ready');}
  function fail(id,message){state.set(id,'failed');errors.set(id,String(message||'This section could not load.'));announce(id,'failed');}
  function snapshot(){return{released:released,ready:Array.from(state.values()).filter(function(s){return s==='ready';}).length,total:state.size,errors:Array.from(errors.values()),pending:Array.from(state).filter(function(p){return p[1]!=='ready';}).map(function(p){return p[0];})};}
  global.OSOmniBoot={ready:ready,fail:fail,snapshot:snapshot,finished:finished,get released(){return released;}};
  function enter(){
    if(released)return;released=true;
    document.documentElement.classList.remove('site-loading');document.documentElement.classList.add('site-entered');
    document.body.setAttribute('aria-busy','false');
    var overlay=document.getElementById('site-loader');if(overlay)overlay.hidden=true;
    global.dispatchEvent(new CustomEvent('osomni:app-enter',{detail:{limited:false}}));
    document.dispatchEvent(new CustomEvent('osomni:app-enter',{detail:{limited:false}}));
    resolveEntry({limited:false});
    // Packaged application resources prepare in the background, never the homepage.
    if('serviceWorker' in navigator){
      var register=function(){navigator.serviceWorker.register(new URL('osomni-pages-sw.js',base).href,{scope:base.pathname,updateViaCache:'none'}).catch(function(error){fail('resources',error.message);});};
      if(global.requestIdleCallback)global.requestIdleCallback(register,{timeout:2000});else global.setTimeout(register,0);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enter,{once:true});else enter();
})(window);
