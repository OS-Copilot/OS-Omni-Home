/* One interactive device gallery. All launch targets come from its available App catalog. */
(function(global){
  'use strict';
  function init(){
    var root=document.getElementById('playground');if(!root||!root.osomniDevice)return;
    var api=root.osomniDevice,details=root.querySelector('.bp-details');
    var names={linux:'Linux',windows:'Windows',macos:'macOS',android:'Android',ios:'iOS'};
    details.querySelector('.eyebrow').textContent='The App catalog';
    details.querySelector('h3').innerHTML='An icon away.<br>A workspace to explore.';
    details.querySelector('p').textContent='Choose an App below to open it on this device. Your changes stay in this browser.';
    function highlight(id){root.querySelectorAll('.bp-app-list button').forEach(function(item){item.setAttribute('aria-pressed',String(item.dataset.app===id));});}
    function refresh(){details.querySelector('.bp-search-label').textContent='Applications on '+names[api.state().platform]+' · '+api.apps().length;highlight(api.state().activeApp);}
    root.addEventListener('osomni:platformchange',refresh);
    root.addEventListener('osomni:appchange',function(event){highlight(event.detail.app);});
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
