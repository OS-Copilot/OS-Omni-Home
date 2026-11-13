/* Pixel-style controls for the browser-local Android device. */
window.OSOmniAndroidControls=function(root){
  const key='osomni.browser.v2.android.device.controls',defaults={wifi:true,mobile:true,bluetooth:false,airplane:false,saver:false,brightness:85,volume:70,battery:78};
  let state;try{state=Object.assign({},defaults,JSON.parse(localStorage.getItem(key)||'{}'));}catch(_){state={...defaults};}
  const screen=root.querySelector('.bp-screen'),status=root.querySelector('.bp-status'),icons=root.querySelector('.bp-status-icons'),originalIcons=icons.innerHTML;
  const shade=document.createElement('section');shade.className='bp-quick-settings';shade.hidden=true;shade.setAttribute('aria-label','Android quick settings');
  shade.innerHTML='<header><span>Quick settings</span><button type="button" aria-label="Close quick settings">×</button></header><p class="bp-power-label"></p><label class="bp-qs-slider">☀ Brightness<input type="range" min="5" max="100" data-setting="brightness" aria-label="Screen brightness"></label><div class="bp-qs-tiles"></div><label class="bp-qs-slider">♪ Media volume<input type="range" min="0" max="100" data-setting="volume" aria-label="Media volume"></label><p class="bp-qs-notice">No new notifications</p><button class="bp-shade-handle" type="button" aria-label="Collapse quick settings"><span></span></button>';
  screen.appendChild(shade);const dimmer=document.createElement('div');dimmer.className='bp-device-dimmer';root.querySelector('.bp-display').appendChild(dimmer);
  const svg=(body)=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+body+'</svg>';
  function networkIcons(){
    const wifi=state.wifi?svg('<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="20" r="1.6" fill="currentColor"/>'):'';
    const cell=state.airplane?svg('<path d="m2 12 8-2V3l2-2 2 2v7l8 2v3l-8-1v5l3 2v1l-5-1-5 1v-1l3-2v-5l-8 1z" fill="currentColor"/>'):svg('<path d="M3 21 21 3v18z" fill="'+(state.mobile?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.6"/>'+(state.mobile?'':'<path d="m5 5 14 14" stroke="currentColor" stroke-width="2"/>'));
    const battery=svg('<rect x="7" y="5" width="10" height="17" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 2h4v3h-4z" fill="currentColor"/><rect x="9" y="'+(20-13*state.battery/100)+'" width="6" height="'+(13*state.battery/100)+'" fill="currentColor"/>'+(state.saver?'<path d="M12 9v8M9 13h6" stroke="#dd8c00" stroke-width="2"/>':''));
    return wifi+cell+battery+'<span>'+state.battery+'%</span>';
  }
  const tiles=[['wifi','Wi-Fi','Connected','Off','⌁'],['mobile','Mobile data','Connected','Off','▴'],['bluetooth','Bluetooth','On','Off','ᛒ'],['airplane','Airplane mode','On','Off','✈'],['saver','Battery saver','On','Off','▱']];
  function broadcast(){root.querySelectorAll('iframe[data-platform=android]').forEach(frame=>{frame.dataset.deviceSettings=JSON.stringify(state);frame.contentWindow.postMessage({type:'osomni:device-settings',settings:state},location.origin);});}
  function render(persist=true){
    const android=root.dataset.platform==='android';
    icons.innerHTML=android?networkIcons():originalIcons;icons.setAttribute('aria-hidden',android?'false':'true');icons.setAttribute('aria-label',android?`${state.wifi?'Wi-Fi connected, ':''}${state.airplane?'Airplane mode, ':state.mobile?'Mobile signal strong, ':'Mobile data off, '}Battery ${state.battery}%`:'');
    dimmer.style.opacity=android?(1-state.brightness/100)*.75:0;
    shade.querySelector('.bp-power-label').textContent=`${state.battery}% battery${state.saver?' · Battery saver enabled':''}`;
    shade.querySelector('.bp-qs-tiles').innerHTML=tiles.map(([id,label,on,off,icon])=>`<button type="button" data-toggle="${id}" aria-pressed="${state[id]}"><span aria-hidden="true">${icon}</span><strong>${label}</strong><small>${state[id]?on:off}</small></button>`).join('');
    shade.querySelectorAll('[data-setting]').forEach(input=>input.value=state[input.dataset.setting]);
    if(persist)localStorage.setItem(key,JSON.stringify(state));broadcast();
  }
  function close(){shade.hidden=true;}
  function open(){if(root.dataset.platform==='android'){shade.hidden=false;render(false);}}
  shade.querySelector('header button').onclick=close;shade.querySelector('.bp-shade-handle').onclick=close;
  shade.addEventListener('click',event=>{const tile=event.target.closest('[data-toggle]');if(!tile)return;const setting=tile.dataset.toggle;state[setting]=!state[setting];if(setting==='airplane'&&state.airplane){state.wifi=false;state.mobile=false;state.bluetooth=false;}if(setting==='mobile'&&state.mobile)state.airplane=false;render();});
  shade.addEventListener('input',event=>{const setting=event.target.dataset.setting;if(!setting)return;state[setting]=Number(event.target.value);render();});
  let drag=null;
  status.addEventListener('pointerdown',event=>{if(root.dataset.platform!=='android'||event.button!==0)return;drag={id:event.pointerId,y:event.clientY};status.setPointerCapture(event.pointerId);});
  status.addEventListener('pointermove',event=>{if(drag&&event.pointerId===drag.id&&event.clientY-drag.y>24)open();});
  status.addEventListener('pointerup',event=>{if(drag&&drag.id===event.pointerId){if(event.clientY-drag.y>24)open();drag=null;}});status.addEventListener('pointercancel',()=>drag=null);
  icons.addEventListener('click',open);icons.tabIndex=0;icons.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  let collapse=null;shade.querySelector('.bp-shade-handle').addEventListener('pointerdown',event=>{collapse=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);});shade.querySelector('.bp-shade-handle').addEventListener('pointerup',event=>{if(collapse!==null&&collapse-event.clientY>20)close();collapse=null;});
  new MutationObserver(()=>{close();render(false);}).observe(root,{attributes:true,attributeFilter:['data-platform']});
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='osomni:browser-ready')broadcast();});
  window.addEventListener('osomni:reset-device',event=>{if(event.detail==='android'){state={...defaults};close();render(false);}});
  render(false);
};
