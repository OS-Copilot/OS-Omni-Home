(function () {
  "use strict";
  // The original editor enumerates Storage keys, not only getItem/setItem.
  function scopedStorage(target) {
    var prefix="osomni.browser.v2."+OSOmniDevice.platform+"."+OSOmniDevice.app+".";
    function keys(){var list=[];for(var i=0;i<target.length;i++){var key=target.key(i);if(key.startsWith(prefix))list.push(key.slice(prefix.length));}return list;}
    return new Proxy(target,{
      get:function(store,property){if(property==='length')return keys().length;if(property==='key')return function(i){return keys()[i]||null;};if(property==='clear')return function(){keys().forEach(function(k){store.removeItem(k);});};var value=Reflect.get(store,property,store);if(typeof value==='function')return value.bind(store);if(value!==undefined)return value;return store.getItem(property);},
      ownKeys:keys,
      getOwnPropertyDescriptor:function(store,key){return {enumerable:true,configurable:true,value:store.getItem(key)};},
      set:function(store,key,value){store.setItem(key,value);return true;},
      deleteProperty:function(store,key){store.removeItem(key);return true;}
    });
  }
  var factory=window.indexedDB,connections=[],open=factory.open.bind(factory),drop=factory.deleteDatabase.bind(factory),dbPrefix="osomni.browser.v2."+OSOmniDevice.platform+"."+OSOmniDevice.app+".";
  Object.defineProperty(window,'indexedDB',{configurable:true,value:new Proxy(factory,{get:function(target,key){if(key==='open')return function(name,version){var req=version===undefined?open(dbPrefix+name):open(dbPrefix+name,version);req.addEventListener('success',function(){connections.push(req.result);});return req;};if(key==='deleteDatabase')return function(name){return drop(dbPrefix+name);};var value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}})});
  window.addEventListener('pagehide',function(){connections.forEach(function(db){db.close();});});
  Object.defineProperty(window,'localStorage' ,{value:scopedStorage(window.localStorage),configurable:true});
  Object.defineProperty(window,'sessionStorage',{value:scopedStorage(window.sessionStorage),configurable:true});
})();
