(function () {
  "use strict";
  var linuxAudit = null;
  fetch("static/data/linux-app-audit.json").then(function(r){return r.ok?r.json():null;}).then(function(data){linuxAudit=data;}).catch(function(){});
  var platformAudits={};
  ['android','windows'].forEach(function(platform){fetch('static/data/'+platform+'-app-audit.json').then(function(r){return r.ok?r.json():null;}).then(function(data){platformAudits[platform]=data;}).catch(function(){});});
  var profiles = window.OSOmniDeviceProfiles || {};
  var hardwareCount = 0;
  var catalog = window.OSOmniBrowserApps || [];
  var platforms = [
    { id: "linux", name: "Linux", device: "Ubuntu desktop", mark: "◉" },
    { id: "windows", name: "Windows", device: "Windows desktop", mark: "⊞" },
    { id: "macos", name: "macOS", device: "Mac desktop", mark: "⌘" },
    { id: "android", name: "Android", device: "Android phone", mobile: true, mark: "◆" },
    { id: "ios", name: "iOS", device: "iPhone", mobile: true, mark: "●" }
  ];
  function platformIcon(id){var shapes={ios:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M10 19h4"/>',android:'<path d="M6 9a6 6 0 0 1 12 0v8H6zM8 3 6 1M16 3l2-2M3 10v6M21 10v6M9 17v5M15 17v5"/><path d="M9 7h.01M15 7h.01"/>',windows:'<path d="M3 3h8v8H3zM14 3h8v8h-8zM3 14h8v8H3zM14 14h8v8h-8z"/>',macos:'<rect x="4" y="3" width="16" height="13" rx="2"/><path d="m4 16-2 4h20l-2-4M10 20h4"/>',linux:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m6 9 3 3-3 3M12 15h5"/>'};return '<svg class="bp-platform-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+shapes[id]+'</svg>';}

  function esc(value) { return String(value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icon(app) {
    if (app.icon) return '<img src="' + app.icon + '" alt="" loading="lazy">';
    var shapes = {
      calendar: '<rect width="48" height="48" rx="10" fill="#fff"/><path d="M0 0h48v15H0z" fill="#ef5964"/><text x="24" y="11" fill="white" font-size="7" text-anchor="middle">' + new Date().toLocaleDateString("en", { month: "short" }).toUpperCase() + '</text><text x="24" y="37" fill="#253043" font-size="24" font-weight="500" text-anchor="middle">' + new Date().getDate() + '</text>',
      contacts: '<rect width="48" height="48" rx="10" fill="#c8b8a2"/><circle cx="24" cy="17" r="7" fill="#f5efe7"/><path d="M10 39c0-15 28-15 28 0" fill="#f5efe7"/>',
      reminders: '<rect width="48" height="48" rx="10" fill="#fff"/><circle cx="12" cy="13" r="3" fill="#e77277"/><circle cx="12" cy="24" r="3" fill="#e8b151"/><circle cx="12" cy="35" r="3" fill="#549de0"/><path d="M20 13h19M20 24h19M20 35h19" stroke="#b8c1ce" stroke-width="2"/>',
      notes: '<rect width="48" height="48" rx="10" fill="#fff"/><path d="M0 0h48v14H0z" fill="#f0c948"/><path d="M9 23h30M9 30h30M9 37h21" stroke="#d2d6dc" stroke-width="1.5"/>',
      files: '<rect width="48" height="48" rx="10" fill="#f6fbff"/><path d="M6 15h15l4 5h17v20H6z" fill="#3e9ce9"/><path d="M6 20h36v20H6z" fill="#62b6f1"/>',
      calculator: '<rect width="48" height="48" rx="10" fill="#454b57"/><rect x="9" y="7" width="30" height="9" rx="2" fill="#b8c1cb"/><g fill="#87909d"><rect x="9" y="21" width="7" height="7" rx="2"/><rect x="20" y="21" width="7" height="7" rx="2"/><rect x="9" y="32" width="7" height="7" rx="2"/><rect x="20" y="32" width="7" height="7" rx="2"/></g><rect x="32" y="21" width="7" height="18" rx="2" fill="#ef9e45"/>',
      clock: '<rect width="48" height="48" rx="10" fill="#222832"/><circle cx="24" cy="24" r="18" fill="#fff"/><path d="M24 10v14l10 7" fill="none" stroke="#293340" stroke-width="2.6" stroke-linecap="round"/>',
      settings: '<rect width="48" height="48" rx="10" fill="#949fad"/><g fill="none" stroke="#f0f3f7" stroke-width="3"><circle cx="24" cy="24" r="13"/><circle cx="24" cy="24" r="6"/><path d="M24 5v7M24 36v7M5 24h7M36 24h7M10 10l5 5M33 33l5 5M10 38l5-5M33 15l5-5"/></g>'
    };
    return '<span class="bp-system-icon" style="background:' + app.color + '"><svg viewBox="0 0 48 48" aria-hidden="true">' + (shapes[app.id] || '<rect width="48" height="48" rx="10" fill="' + app.color + '"/><text x="24" y="32" fill="white" font-size="25" text-anchor="middle">' + esc(app.glyph) + '</text>') + '</svg></span>';
  }
  function mount(root, compact) {
    if (!root) return;
    var active = "linux", selectedApp = null, z = 10, sessions = {}, filters = "", drag = null;
    root.className = "bp" + (compact ? " bp-compact" : ""); root.dataset.platform = active;
    root.innerHTML = '<div class="bp-tabs" role="tablist" aria-label="Choose a device"></div><div class="bp-layout"><div class="bp-stage"><div class="bp-device"><div class="bp-camera" aria-hidden="true"></div><div class="bp-display"><div class="bp-screen"><div class="bp-status"><span class="bp-clock"></span><span class="bp-desktop-brand"></span><span class="bp-status-icons" aria-hidden="true">▂▃▅ ▰</span></div><div class="bp-surface"><div class="bp-wallpaper" aria-hidden="true"><i></i><i></i><i></i></div><div class="bp-launcher"><div class="bp-launcher-title"></div><div class="bp-grid"></div></div><div class="bp-windows"></div></div><div class="bp-dock"><button class="bp-start" type="button" aria-label="Home screen">⊞</button><span class="bp-running"></span><button type="button" class="bp-show-desktop" aria-label="Show desktop">▯</button></div><button class="bp-home-bar" type="button" aria-label="Go to home screen"><span></span></button></div></div></div><div class="bp-stand" aria-hidden="true"></div><div class="bp-device-tools"><button class="bp-reset" type="button">↻ Reset device</button><button class="bp-expand" type="button">⤢ Expand</button></div></div>' +
      (compact ? '' : '<aside class="bp-details"><span class="eyebrow">YOUR OWN WORKSPACE</span><h3>Explore the image.<br>Try its workflows.</h3><p>Each platform uses its own verified application inventory. Available browser implementations save your changes locally.</p><div class="bp-app-info"><div class="bp-info-icon"></div><h4 class="bp-info-title">Explore the applications</h4><p class="bp-info-description">Create a document, send a demo message, edit a photo, or organize your day.</p></div><label class="bp-search-label" for="bp-search-' + root.id + '">Find an application</label><input class="bp-search" id="bp-search-' + root.id + '" type="search" placeholder="Search apps"><div class="bp-app-list"></div><details class="bp-inventory"><summary>Image inventory</summary><div class="bp-inventory-body"></div></details><p class="bp-feedback" role="status" aria-live="polite">Your changes stay in this browser.</p><small>Browser implementations of OS-Omni workflows. Native-only application features are outside this playground.</small></aside>') + '</div>';
    var hardwareId='osomni-monitor-'+(++hardwareCount);
    root.querySelector('.bp-stand').innerHTML='<svg viewBox="0 0 260 100" focusable="false" aria-hidden="true"><defs><linearGradient id="'+hardwareId+'-neck" x1="0" x2="1"><stop offset="0" stop-color="#4c5764"/><stop offset=".42" stop-color="#bdc6ce"/><stop offset=".62" stop-color="#929eaa"/><stop offset="1" stop-color="#52606e"/></linearGradient><linearGradient id="'+hardwareId+'-foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd3da"/><stop offset=".45" stop-color="#8b97a4"/><stop offset="1" stop-color="#414d5b"/></linearGradient></defs><ellipse cx="130" cy="95" rx="110" ry="5" fill="#000" opacity=".2"/><path class="bp-stand-neck" d="M107-3h46l12 80H95Z" fill="url(#'+hardwareId+'-neck)"/><path d="M108 0h44l2 10h-48Z" fill="#15202d" opacity=".22"/><path class="bp-stand-foot" d="M52 78Q130 66 208 78l30 11q5 7-6 8H28q-11-1-6-8Z" fill="url(#'+hardwareId+'-foot)"/><path d="M52 79q78-12 156 0l20 7H32Z" fill="#d3dbe2" opacity=".3"/><path d="M29 94h202" stroke="#d4dde4" stroke-opacity=".3" stroke-linecap="round"/></svg>';
    var surface = root.querySelector(".bp-surface"), windows = root.querySelector(".bp-windows"), grid = root.querySelector(".bp-grid"), launcher = root.querySelector(".bp-launcher");
    var display = root.querySelector(".bp-display"), screen = root.querySelector(".bp-screen"), scale = 1;
    function fitDisplay() {
      var mobile = platform().mobile, displayProfile=profile().display || {}, width = displayProfile.width || (mobile ? 390 : 1440), height = displayProfile.height || (mobile ? 844 : 900);
      root.style.setProperty("--bp-width", width + "px"); root.style.setProperty("--bp-height", height + "px");
      display.style.aspectRatio = width + " / " + height;
      scale = display.clientWidth / width;
      screen.style.transform = "scale(" + scale + ")";
      root.dataset.resolution = width + "x" + height;
    }
    new ResizeObserver(fitDisplay).observe(display);
    var tabButtons = [];
    platforms.forEach(function (platform) {
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.platform = platform.id; b.innerHTML = platformIcon(platform.id)+'<span>'+platform.name+'</span>';
      b.addEventListener("click", function () { selectPlatform(platform.id); }); root.querySelector(".bp-tabs").appendChild(b); tabButtons.push(b);
    });
    root.querySelector(".bp-tabs").addEventListener("keydown", function (e) {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); var i = platforms.findIndex(function (p) { return p.id === active; });
      i = e.key === "Home" ? 0 : e.key === "End" ? platforms.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + platforms.length) % platforms.length;
      selectPlatform(platforms[i].id); tabButtons[i].focus();
    });
    function feedback(text) { var e = root.querySelector(".bp-feedback"); if (e) e.textContent = text; }
    function platform() { return platforms.find(function (p) { return p.id === active; }); }
    function profile() { return profiles[active] || {verified:false,applications:[],pending:[]}; }
    function apps() { return profile().verified ? profile().applications.map(function(entry){var app=catalog.find(function(a){return a.id===entry.id;});if(!app)return null;var copy=Object.assign({},app,{name:entry.name||app.name,window:entry.window||null,home_page:entry.home_page,home_position:entry.home_position,bundle:entry.bundle,desktop:entry.desktop,icon:/^open/.test(app.id)?app.icon:entry.icon||app.icon,url:entry.url||app.url,description:entry.description||app.description});var audit=active==='linux'?linuxAudit:platformAudits[active];if(audit)copy.audit=audit.applications.find(function(a){return a.id===entry.id;});if(entry.name&&copy.url.includes("system.html")) copy.url += "&title="+encodeURIComponent(entry.name);return copy;}).filter(Boolean) : []; }
    var iosSpringBoardOrder=['com.apple.mobilecal','com.apple.mobileslideshow','com.apple.reminders','com.apple.news','com.apple.Maps','com.apple.Health','com.apple.Passbook','com.apple.Preferences','com.apple.Fitness','com.apple.Bridge','com.apple.MobileAddressBook','com.apple.DocumentsApp','com.apple.Preview','com.apple.shortcuts','com.apple.Passwords','de.enough.maily','chat.delta','co.fluder.mobile.FSNotes-iOS','co.nazariizomko.Habit','mn.flow.flow','com.killt.openbank','com.killt.openshop','com.killt.opentrip','com.killt.opentwitter','com.killt.opennote','com.killt.opendriver','com.killt.openphotoedit','com.killt.opennavigation'];
    function launcherApps(){
      var result=apps().slice(),startOpen=root.classList.contains('bp-start-open');
      if(platform().mobile){
        var pinned=profile().pinned||[];result=result.filter(function(app){return !pinned.includes(app.id);});
        if(active==='ios')result.sort(function(a,b){var page=Number(a.home_page||0)-Number(b.home_page||0);if(page)return page;var ai=a.home_position!==undefined?Number(a.home_position):iosSpringBoardOrder.indexOf(a.bundle);var bi=b.home_position!==undefined?Number(b.home_position):iosSpringBoardOrder.indexOf(b.bundle);if(ai<0)ai=999;if(bi<0)bi=999;return ai-bi;});
        return result;
      }
      if(startOpen)return result;
      return result;
    }
    function running() { return sessions[active] || (sessions[active] = {}); }
    function setInfo(app) {
      root.dispatchEvent(new CustomEvent('osomni:appchange',{detail:{app:app?app.id:null}}));
      if (compact) return;
      root.querySelector(".bp-info-icon").innerHTML = app ? icon(app) : "";
      root.querySelector(".bp-info-title").textContent = app ? app.name : "Explore the applications";
      root.querySelector(".bp-info-description").textContent = app ? (app.audit ? (app.audit.status||app.audit.mode) + " · " + app.audit.known_gaps[0] : app.description) : (profile().verified ? profile().source : "No matching image inventory has been imported for this platform.");
    }
    var launcherCache={},androidHomePage=0;
    function androidPages(){
      var dots=launcher.querySelector('.bp-page-dots');
      var glance=launcher.querySelector('.bp-at-glance');
      if(!platform().mobile){if(dots)dots.remove();if(glance)glance.remove();return;}
      if(active==='android'){if(!glance){glance=document.createElement('div');glance.className='bp-at-glance';launcher.prepend(glance);}glance.textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:profile().display.timezone});}else if(glance)glance.remove();
      if(!dots){dots=document.createElement('nav');dots.className='bp-page-dots';dots.setAttribute('aria-label','Home screen pages');launcher.appendChild(dots);}
      androidHomePage=Math.min(androidHomePage,Math.max(0,grid.children.length-1));grid.scrollLeft=androidHomePage*grid.clientWidth;
      dots.replaceChildren();
      function pageControl(label,text,step){var button=document.createElement('button');button.type='button';button.className='bp-page-arrow';button.setAttribute('aria-label',label);button.textContent=text;button.onclick=function(){var page=Math.max(0,Math.min(grid.children.length-1,Math.round(grid.scrollLeft/grid.clientWidth)+step));grid.scrollTo({left:page*grid.clientWidth,behavior:'smooth'});};dots.appendChild(button);}
      pageControl('Previous home screen page','‹',-1);
      Array.from(grid.children).forEach(function(_,index){var dot=document.createElement('button');dot.type='button';dot.setAttribute('aria-label','Home screen page '+(index+1));dot.setAttribute('aria-current',String(index===androidHomePage));dot.onclick=function(){grid.scrollTo({left:index*grid.clientWidth,behavior:'smooth'});};dots.appendChild(dot);});
      var pageLabel=document.createElement('span');pageLabel.className='bp-page-label';pageLabel.textContent=(androidHomePage+1)+' / '+grid.children.length;dots.appendChild(pageLabel);
      pageControl('Next home screen page','›',1);
    }
    grid.addEventListener('scroll',function(){if(!platform().mobile||!grid.clientWidth)return;androidHomePage=Math.round(grid.scrollLeft/grid.clientWidth);launcher.querySelectorAll('.bp-page-dots button:not(.bp-page-arrow)').forEach(function(dot,index){dot.setAttribute('aria-current',String(index===androidHomePage));});var label=launcher.querySelector('.bp-page-label');if(label)label.textContent=(androidHomePage+1)+' / '+grid.children.length;},{passive:true});
    launcher.addEventListener('wheel',function(event){if(platform().mobile&&!launcher.hidden&&Math.abs(event.deltaY)>=Math.abs(event.deltaX))event.preventDefault();},{passive:false});
    var pageDrag=null,suppressAppClick=false;
    grid.addEventListener('pointerdown',function(event){if(platform().mobile&&event.pointerType==='mouse'&&event.button===0)pageDrag={id:event.pointerId,x:event.clientX,y:event.clientY,left:grid.scrollLeft,dragging:false};});
    grid.addEventListener('pointermove',function(event){if(!pageDrag||pageDrag.id!==event.pointerId)return;var dx=event.clientX-pageDrag.x,dy=event.clientY-pageDrag.y;if(!pageDrag.dragging&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){pageDrag.dragging=true;grid.setPointerCapture(event.pointerId);grid.style.scrollSnapType='none';suppressAppClick=true;}if(pageDrag.dragging){event.preventDefault();grid.scrollLeft=pageDrag.left-dx/scale;}});
    function finishPageDrag(event){if(!pageDrag||pageDrag.id!==event.pointerId)return;var drag=pageDrag;pageDrag=null;if(drag.dragging){var dx=(event.clientX-drag.x)/scale;var page=Math.round(drag.left/grid.clientWidth);if(Math.abs(dx)>45)page+=dx<0?1:-1;page=Math.max(0,Math.min(grid.children.length-1,page));grid.style.scrollSnapType='';grid.scrollTo({left:page*grid.clientWidth,behavior:'smooth'});if(grid.hasPointerCapture(event.pointerId))grid.releasePointerCapture(event.pointerId);setTimeout(function(){suppressAppClick=false;},400);}}
    grid.addEventListener('pointerup',finishPageDrag);grid.addEventListener('pointercancel',finishPageDrag);
    grid.addEventListener('click',function(event){if(suppressAppClick){event.preventDefault();event.stopImmediatePropagation();suppressAppClick=false;}},true);
    function renderApps() {
      var cacheKey=active+':'+root.classList.contains('bp-start-open'),cached=!filters&&launcherCache[cacheKey];
      if(cached){grid.replaceChildren.apply(grid,cached.grid);if(!compact){var cachedList=root.querySelector('.bp-app-list');cachedList.replaceChildren.apply(cachedList,cached.list);root.querySelector('.bp-inventory-body').innerHTML=cached.inventory;}androidPages();return;}
      grid.innerHTML = "";
      if(!profile().verified) { grid.innerHTML='<div class="bp-inventory-empty"><h3>Image inventory unavailable</h3><p>The application list for '+esc(platform().name)+' has not been imported.</p></div>'; }
      launcherApps().filter(function (a) { return !filters || (a.name + " " + a.description).toLowerCase().includes(filters); }).forEach(function (a) {
        var b = document.createElement("button"); b.type = "button"; b.className = "bp-app"; b.dataset.app = a.id; b.title = a.description;if(a.home_page!==undefined)b.dataset.homePage=a.home_page;
        b.innerHTML = icon(a) + '<span class="bp-app-name">' + esc(a.name) + '</span>';
        b.addEventListener("click", function () { open(a); }); grid.appendChild(b);
      });
      if(platform().mobile&&profile().verified){var buttons=Array.from(grid.children);grid.replaceChildren();var groups=[];if(active==='ios'&&!filters){buttons.forEach(function(button){var index=Number(button.dataset.homePage||0);(groups[index]||(groups[index]=[])).push(button);});}else{for(var offset=0;offset<buttons.length;offset+=16)groups.push(buttons.slice(offset,offset+16));}var fitted=[];groups.forEach(function(items){if(items)for(var offset=0;offset<items.length;offset+=24)fitted.push(items.slice(offset,offset+24));});groups=fitted;groups.forEach(function(items,index){if(!items)return;var page=document.createElement('section');page.className='bp-home-page';page.setAttribute('aria-label','Home screen page '+(index+1));items.forEach(function(button){page.appendChild(button);});grid.appendChild(page);});}
      androidPages();
      if (!compact) {
        var list = root.querySelector(".bp-app-list"); list.innerHTML = "";
        var inventory=root.querySelector(".bp-inventory-body");
        inventory.innerHTML=profile().verified?'<p>'+esc(profile().source)+'</p><p>'+apps().length+' browser implementations. These retain a limited feature scope.</p><p><a href="static/data/'+active+'-app-audit.json" target="_blank" rel="noopener">Full application audit</a></p><p>Image applications awaiting implementation:</p><ul>'+profile().pending.map(function(a){return '<li>'+esc(a.name)+' ? '+esc(a.status || 'not ported')+'</li>';}).join('')+'</ul>':'<p>No image inventory has been imported. This platform does not reuse another platform?s application list.</p>';
        apps().filter(function (a) { return (a.name + " " + a.description).toLowerCase().includes(filters); }).forEach(function (a) {
          var b = document.createElement("button"); b.type = "button"; b.dataset.app = a.id; b.innerHTML = icon(a) + '<span>' + esc(a.name) + '</span>';
          b.addEventListener("click", function () { unlockDevice();open(a); }); list.appendChild(b);
        });
      }
      if(!filters)launcherCache[cacheKey]={grid:Array.from(grid.childNodes),list:compact?null:Array.from(list.childNodes),inventory:compact?null:inventory.innerHTML};
    }
    function renderDock() {
      var area = root.querySelector(".bp-running"); area.innerHTML = "";
      var ids = platform().mobile ? (profile().pinned || apps().slice(0,4).map(function(a){return a.id;})) : Array.from(new Set((profile().pinned || []).concat(Object.keys(running()))));
      ids.forEach(function (id) {
        var a = apps().find(function (a) { return a.id === id; }); if(!a)return; var b = document.createElement("button"); b.type = "button";
        b.title = a.name; b.setAttribute("aria-label", "Switch to " + a.name); b.innerHTML = icon(a); b.className = id === selectedApp ? "active" : "";
        b.classList.toggle("running",!!running()[id]);
        b.addEventListener("click", function () { if (running()[id]) show(id); else open(a); }); area.appendChild(b);
      });
      var taskbarTime=root.querySelector('.bp-taskbar-time');
      if(active==='windows'&&!taskbarTime){taskbarTime=document.createElement('div');taskbarTime.className='bp-taskbar-time';taskbarTime.innerHTML='<time class="bp-clock"></time><span class="bp-taskbar-date"></span>';root.querySelector('.bp-dock').appendChild(taskbarTime);}
      else if(active!=='windows'&&taskbarTime)taskbarTime.remove();
      clock();
    }
    var standby=document.createElement('button');standby.type='button';standby.className='bp-standby';standby.setAttribute('aria-label','Enter device home screen');
    standby.innerHTML='<span class="bp-lock-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><span class="bp-standby-heading"></span><time class="bp-standby-time"></time><span class="bp-standby-date"></span><span class="bp-standby-hint"></span><span class="bp-lock-home" aria-hidden="true"></span>';
    screen.appendChild(standby);
    var boot=document.createElement('span');boot.className='bp-boot';
    boot.innerHTML='<span class="bp-boot-glow" aria-hidden="true"></span><span class="bp-boot-content"><span class="bp-boot-mark" aria-hidden="true"></span><span class="bp-boot-title"></span><span class="bp-boot-caption">Preparing your workspace</span><span class="bp-boot-track" aria-hidden="true"><span></span></span></span>';
    standby.appendChild(boot);
    var unlockAnimation=null,standbyGesture=null;
    function setLocked(locked){
      root.dataset.locked=String(locked);
      Array.from(screen.children).forEach(function(child){if(child!==standby)child.inert=locked;});
      // The external catalog stays usable: choosing an App starts the device.
      ['.bp-start'].forEach(function(selector){var element=root.querySelector(selector);if(element)element.inert=locked;});
    }
    function showStandby(){
      if(unlockAnimation){unlockAnimation.cancel();unlockAnimation=null;}
      root.dataset.booting='false';screen.setAttribute('aria-busy','false');
      standby.setAttribute('aria-label','Start '+platform().name+' workspace');
      standby.hidden=false;setLocked(true);
      var applePlatform=active==='macos'||active==='ios';
      boot.querySelector('.bp-boot-mark').innerHTML=applePlatform?'<svg class="bp-apple-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c.02 3.02 2.65 4.02 2.68 4.03-.02.07-.42 1.44-1.39 2.86-.84 1.23-1.72 2.46-3.09 2.49-1.34.03-1.78-.8-3.31-.8-1.54 0-2.01.77-3.28.83-1.32.05-2.33-1.33-3.17-2.55-1.72-2.5-3.04-7.07-1.28-10.15.88-1.53 2.45-2.5 4.15-2.52 1.3-.03 2.52.88 3.31.88.79 0 2.27-1.09 3.83-.93.66.03 2.5.27 3.69 2.01-.1.06-2.2 1.28-2.18 3.85ZM14.52 5.06c.7-.85 1.17-2.03 1.04-3.21-1.01.04-2.23.67-2.95 1.52-.65.75-1.22 1.96-1.06 3.11 1.12.09 2.27-.57 2.97-1.42Z"/></svg>':platformIcon(active);
      boot.querySelector('.bp-boot-title').textContent=platform().name;
      standby.querySelector('.bp-standby-heading').textContent=platform().device;
      standby.querySelector('.bp-standby-hint').textContent=platform().mobile?'Swipe up or tap to open':'Click or press Enter to open';
      clock();
    }
    function unlockDevice(){
      if(root.dataset.locked!=='true'||unlockAnimation)return;
      home();
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){standby.hidden=true;setLocked(false);return;}
      var unlockingPlatform=active;
      root.dataset.booting='true';screen.setAttribute('aria-busy','true');
      standby.setAttribute('aria-label','Starting '+platform().name+' workspace');
      unlockAnimation=standby.animate([{opacity:1,transform:'scale(1)',offset:0},{opacity:1,transform:'scale(1)',offset:.76},{opacity:0,transform:'scale(1.035)',offset:1}],{duration:2100,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      var animation=unlockAnimation;animation.finished.then(function(){if(unlockAnimation!==animation)return;if(active===unlockingPlatform){standby.hidden=true;setLocked(false);root.dataset.booting='false';screen.setAttribute('aria-busy','false');}animation.cancel();unlockAnimation=null;}).catch(function(){});
    }
    standby.addEventListener('click',unlockDevice);
    standby.addEventListener('pointerdown',function(e){standbyGesture={id:e.pointerId,y:e.clientY};standby.setPointerCapture(e.pointerId);});
    standby.addEventListener('pointerup',function(e){if(standbyGesture&&standbyGesture.id===e.pointerId&&standbyGesture.y-e.clientY>35)unlockDevice();standbyGesture=null;});
    standby.addEventListener('pointercancel',function(){standbyGesture=null;});
    var platformViews = {},hasSelectedPlatform=false,deviceTransition=null,switchVersion=0;
    var stage=root.querySelector('.bp-stage'),device=root.querySelector('.bp-device');
    var fx=document.createElement('div');fx.className='bp-transition-fx';fx.setAttribute('aria-hidden','true');
    fx.innerHTML='<i class="bp-orbit"></i><i class="bp-orbit bp-orbit-secondary"></i><i class="bp-light-sweep"></i>'+Array.from({length:24},function(_,i){return '<b style="--angle:'+(i*137.5)+'deg;--radius:'+(160+i%5*38)+'px;--delay:'+(i%7*22)+'ms"></b>';}).join('');stage.appendChild(fx);
    var fxAnimations=[];
    function selectPlatform(id) {
      if(!platforms.some(function(p){return p.id===id;}))return;
      if(hasSelectedPlatform&&id===active&&!deviceTransition)return;
      var version=++switchVersion;
      if(deviceTransition){if(deviceTransition.skipTransition)deviceTransition.skipTransition();else deviceTransition.cancel();deviceTransition=null;}
      fxAnimations.forEach(function(a){a.cancel();});fxAnimations=[];
      root.classList.remove('bp-switching');
      if(!hasSelectedPlatform||matchMedia('(prefers-reduced-motion: reduce)').matches){applyPlatform(id);return;}
      if(id===active)return;
      var direction=platforms.findIndex(function(p){return p.id===id;})>platforms.findIndex(function(p){return p.id===active;})?1:-1;
      document.documentElement.style.setProperty('--bp-switch-direction',direction);
      root.classList.add('bp-switching');
      function effects(){
        if(version!==switchVersion)return;
        fxAnimations.push(fx.animate([{opacity:0,transform:'scale(.65)'},{opacity:1,transform:'scale(1.05)',offset:.35},{opacity:0,transform:'scale(1.35)'}],{duration:1150,easing:'cubic-bezier(.2,.7,.2,1)'}));
        setTimeout(function(){if(version===switchVersion)root.classList.remove('bp-switching');},1200);
      }
      if(document.startViewTransition){
        deviceTransition=document.startViewTransition(function(){if(version===switchVersion){applyPlatform(id);fitDisplay();}});
        deviceTransition.ready.then(effects).catch(function(){});
        deviceTransition.finished.catch(function(){}).then(function(){if(version===switchVersion){deviceTransition=null;root.classList.remove('bp-switching');}});
      }else{
        // Keep live iframes mounted on browsers without snapshot transitions.
        deviceTransition=device.animate([{transform:'perspective(1600px) rotateY(0) scale(1)',opacity:1},{transform:'perspective(1600px) translateX('+(-direction*70)+'px) rotateY('+(-direction*12)+'deg) scale(.94)',opacity:0}],{duration:260,easing:'ease-in',fill:'forwards'});
        deviceTransition.finished.then(function(){if(version!==switchVersion)return;deviceTransition.cancel();applyPlatform(id);fitDisplay();effects();deviceTransition=device.animate([{transform:'perspective(1600px) translateX('+(direction*85)+'px) rotateY('+(direction*12)+'deg) scale(.94)',opacity:0},{transform:'none',opacity:1}],{duration:650,easing:'cubic-bezier(.16,1,.3,1)'});deviceTransition.finished.then(function(){if(version===switchVersion){deviceTransition=null;root.classList.remove('bp-switching');}}).catch(function(){});}).catch(function(){});
      }
    }
    function applyPlatform(id) {
      if(hasSelectedPlatform&&id===active && root.dataset.platform===id)return;
      if(hasSelectedPlatform){platformViews[active]={selected:selectedApp,visible:Object.keys(running()).filter(function(key){return !running()[key].el.hidden;}),launcher:!launcher.hidden,start:root.classList.contains('bp-start-open'),scroll:launcher.scrollTop};}
      hasSelectedPlatform=true;
      active = id; root.dataset.platform = id; root.dataset.appOpen = "false"; root.classList.remove("bp-start-open"); selectedApp = null; filters = ""; fitDisplay();
      tabButtons.forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.platform === id)); b.tabIndex = b.dataset.platform === id ? 0 : -1; });
      root.querySelector(".bp-start").textContent = platform().mark;
      root.querySelector(".bp-desktop-brand").textContent = active === "linux" ? "Activities" : active === "macos" ? "Finder    File    Edit    View    Go    Window    Help" : platform().device;
      root.querySelector(".bp-launcher-title").textContent = platform().mobile ? "" : "Applications";
      if (!compact) root.querySelector(".bp-search").value = "";
      Object.keys(sessions).forEach(function (p) { Object.values(sessions[p]).forEach(function (w) { w.el.hidden = true; }); });
      var view=platformViews[id];
      if(view){selectedApp=view.selected;root.classList.toggle('bp-start-open',view.start);view.visible.forEach(function(key){if(running()[key])running()[key].el.hidden=false;});root.dataset.appOpen=selectedApp?'true':'false';}
      launcher.hidden = view ? !view.launcher : false; renderApps(); launcher.scrollTop=view?view.scroll:0; renderDock(); setInfo(selectedApp&&running()[selectedApp]?running()[selectedApp].app:null); applyAppearance(); showStandby(); feedback(profile().verified ? profile().source + " ? " + apps().length + " available, " + profile().pending.length + " awaiting implementation." : "This platform needs its own image inventory.");
      root.dispatchEvent(new CustomEvent('osomni:platformchange',{detail:{platform:active}}));
    }
    function home() {
      if(active==='android'){filters='';var search=root.querySelector('.bp-phone-search input');if(search)search.value='';}
      Object.values(running()).forEach(function (w) { w.el.hidden = true; }); selectedApp = null; launcher.hidden = false; renderDock();setInfo(null);
      root.dataset.appOpen = "false"; root.classList.remove("bp-start-open");
      renderApps();
    }
    function show(id) {
      var w = running()[id]; if (!w) return;
      if (platform().mobile) Object.values(running()).forEach(function (other) { other.el.hidden = true; });
      var wasStartOpen=root.classList.contains('bp-start-open');
      w.el.hidden = false; w.el.style.zIndex = ++z; selectedApp = id; root.dataset.appOpen = "true"; root.classList.remove("bp-start-open");if(wasStartOpen)renderApps();
      launcher.hidden = platform().mobile; setInfo(w.app); renderDock(); feedback(w.app.name + " · browser workspace");
    }
    function open(app) {
      if(!apps().some(function(a){return a.id===app.id;}))return;
      if (running()[app.id]) { show(app.id); return; }
      var el = document.createElement("section"); el.className = "bp-window" + (app.window && app.window.maximized ? " maximized" : ""); el.dataset.app = app.id; el.setAttribute("aria-label", app.name + " window");
      el.innerHTML = '<div class="bp-window-bar"><div class="bp-window-title">' + icon(app) + '<span>' + esc(app.name) + '</span></div><div class="bp-window-buttons"><button data-window-action="minimize" aria-label="Minimize ' + esc(app.name) + '">−</button><button data-window-action="maximize" aria-label="Maximize ' + esc(app.name) + '">□</button><button data-window-action="close" aria-label="Close ' + esc(app.name) + '">×</button></div></div><div class="bp-window-loading">Opening ' + esc(app.name) + '…</div>';
      var frame = document.createElement("iframe"); frame.title = app.name; frame.dataset.app = app.id; frame.dataset.label=app.name;frame.dataset.icon=app.icon||""; frame.dataset.platform = active; frame.dataset.timezone = profile().display && profile().display.timezone || "";
      // Downloads and clipboard are browser-local, just like the reference simulator.
      frame.setAttribute("allow", "clipboard-read; clipboard-write"); frame.src = app.url;
      el.appendChild(frame); windows.appendChild(el); running()[app.id] = { el: el, frame: frame, app: app };
      if (active === "macos") { var buttons = el.querySelector(".bp-window-buttons"); buttons.appendChild(buttons.querySelector('[data-window-action="close"]')); buttons.appendChild(buttons.querySelector('[data-window-action="minimize"]')); buttons.appendChild(buttons.querySelector('[data-window-action="maximize"]')); }
      var count = Object.keys(running()).length - 1;
      if (!platform().mobile) { el.style.left = 3 + count % 4 * 2 + "%"; el.style.top = 4 + count % 4 * 3 + "%"; }
      el.addEventListener("pointerdown", function () { if (!el.hidden) { el.style.zIndex = ++z; selectedApp = app.id; renderDock();setInfo(app); } });
      el.querySelector(".bp-window-buttons").addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.windowAction === "close") { frame.src = "about:blank"; el.remove(); delete running()[app.id]; selectedApp = null;setInfo(null); if (!Object.keys(running()).length || platform().mobile) home(); renderDock(); }
        if (b.dataset.windowAction === "minimize") { el.hidden = true; selectedApp = null;setInfo(null); if (platform().mobile) home(); renderDock(); }
        if (b.dataset.windowAction === "maximize") el.classList.toggle("maximized");
      });
      var bar = el.querySelector(".bp-window-bar");
      bar.addEventListener("dblclick", function (e) { if (!e.target.closest("button")) el.classList.toggle("maximized"); });
      bar.addEventListener("pointerdown", function (e) {
        if (platform().mobile || el.classList.contains("maximized") || e.target.closest("button")) return;
        var rect = el.getBoundingClientRect(), parent = surface.getBoundingClientRect();
        drag = { el: el, x: e.clientX, y: e.clientY, left: (rect.left - parent.left) / scale, top: (rect.top - parent.top) / scale }; bar.setPointerCapture(e.pointerId); root.classList.add("bp-dragging");
      });
      bar.addEventListener("pointermove", function (e) { if (!drag || drag.el !== el) return; el.style.left = Math.max(0, Math.min(surface.clientWidth - 120, drag.left + (e.clientX - drag.x) / scale)) + "px"; el.style.top = Math.max(0, Math.min(surface.clientHeight - 40, drag.top + (e.clientY - drag.y) / scale)) + "px"; });
      function endDrag() { drag = null; root.classList.remove("bp-dragging"); } bar.addEventListener("pointerup", endDrag); bar.addEventListener("pointercancel", endDrag);
      frame.addEventListener("load", function () { el.querySelector(".bp-window-loading").hidden = true; });
      show(app.id);
    }
    root.querySelector(".bp-start").addEventListener("click", function () { if (platform().mobile) home(); else { root.classList.toggle("bp-start-open");launcher.hidden = false; renderApps(); } });
    var homeBar=root.querySelector('.bp-home-bar'),homeGesture=null,suppressHomeClick=false;
    var phoneSearch=document.createElement('form');phoneSearch.className='bp-phone-search';phoneSearch.setAttribute('role','search');phoneSearch.innerHTML='<span aria-hidden="true">⌕</span><input type="search" aria-label="Search installed apps" placeholder="Search apps" autocomplete="off"><button type="submit" aria-label="Search apps">→</button>';homeBar.before(phoneSearch);
    phoneSearch.querySelector('input').addEventListener('input',function(){filters=this.value.trim().toLowerCase();androidHomePage=0;renderApps();});
    phoneSearch.addEventListener('submit',function(event){event.preventDefault();var matches=apps().filter(function(app){return app.name.toLowerCase().includes(filters);});if(filters&&matches.length===1)open(matches[0]);});
    homeBar.addEventListener('click',function(){if(suppressHomeClick){suppressHomeClick=false;return;}home();});
    homeBar.addEventListener('pointerdown',function(event){
      if(!platform().mobile||event.isPrimary===false||event.button!==0)return;
      var window=selectedApp&&running()[selectedApp];
      homeGesture={pointer:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),window:window,app:selectedApp,launcherHidden:launcher.hidden,platform:active,dx:0,dy:0};
      homeBar.setPointerCapture(event.pointerId);event.preventDefault();
    });
    homeBar.addEventListener('pointermove',function(event){
      var gesture=homeGesture;if(!gesture||gesture.pointer!==event.pointerId)return;
      gesture.dx=(event.clientX-gesture.x)/scale;gesture.dy=(gesture.y-event.clientY)/scale;
      if(gesture.window&&gesture.dy>8&&Math.abs(gesture.dx)<gesture.dy){
        launcher.hidden=false;var progress=Math.min(1,gesture.dy/200);
        gesture.window.el.style.transition='none';gesture.window.el.style.transform='translateY('+(-gesture.dy*.25)+'px) scale('+(1-progress*.12)+')';
        gesture.window.el.style.borderRadius='22px';
      }
    });
    function finishHomeGesture(event,cancelled){
      var gesture=homeGesture;if(!gesture||gesture.pointer!==event.pointerId)return;homeGesture=null;
      var distance=Math.hypot(gesture.dx,gesture.dy),elapsed=Math.max(1,performance.now()-gesture.time);
      var returnHome=!cancelled&&active===gesture.platform&&Math.abs(gesture.dx)<Math.max(1,gesture.dy)*.85&&(gesture.dy>=52||(gesture.dy>=26&&gesture.dy/elapsed>=.45));
      suppressHomeClick=distance>8||cancelled||event.pointerType==='touch';
      if(suppressHomeClick)setTimeout(function(){suppressHomeClick=false;},400);
      var startTransform=gesture.window&&gesture.window.el.style.transform;
      if(gesture.window){gesture.window.el.style.transition='transform 160ms ease-out';gesture.window.el.style.transform='';gesture.window.el.style.borderRadius='';setTimeout(function(){gesture.window.el.style.transition='';},180);}
      if(returnHome&&gesture.window&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
        launcher.hidden=false;
        var animation=gesture.window.el.animate([{transform:startTransform||'none',opacity:1,borderRadius:'22px'},{transform:'translateY(-90px) scale(.25)',opacity:0,borderRadius:'30px'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
        animation.finished.then(function(){if(active===gesture.platform&&selectedApp===gesture.app&&running()[gesture.app]===gesture.window)home();}).catch(function(){});
      }else if(returnHome)home();else launcher.hidden=gesture.launcherHidden;
      if(homeBar.hasPointerCapture(event.pointerId))homeBar.releasePointerCapture(event.pointerId);
    }
    homeBar.addEventListener('pointerup',function(event){finishHomeGesture(event,false);});
    homeBar.addEventListener('pointercancel',function(event){finishHomeGesture(event,true);});
    homeBar.addEventListener('lostpointercapture',function(event){if(homeGesture)finishHomeGesture(event,true);});
    root.querySelector(".bp-show-desktop").addEventListener("click", home);
    root.querySelector(".bp-expand").addEventListener("click", function () { root.classList.toggle("bp-expanded"); this.textContent = root.classList.contains("bp-expanded") ? "⤡ Exit expanded view" : "⤢ Expand"; });
    function discardDevice(id) {
      Object.values(sessions[id] || {}).forEach(function (w) {
        try { if (w.frame.contentWindow.OSOmniDevice) w.frame.contentWindow.OSOmniDevice.suspendPersistence = true; } catch (_) {}
        w.frame.src = "about:blank"; w.el.remove();
      }); sessions[id] = {};
    }
    window.addEventListener("osomni:reset-device", function (event) { discardDevice(event.detail); if (active === event.detail) home(); });
    root.querySelector(".bp-reset").addEventListener("click", async function () {
      window.dispatchEvent(new CustomEvent("osomni:reset-device", { detail: active }));
      var prefix = "osomni.browser.v2." + active + ".";
      try { [localStorage, sessionStorage].forEach(function (store) { Object.keys(store).filter(function (key) { return key.startsWith(prefix); }).forEach(function (key) { store.removeItem(key); }); }); await resetFiles(active); await resetApplicationDBs(active); }
      catch (_) { feedback("Some browser storage could not be reset."); return; }
      applyAppearance(); home(); feedback("This device has been reset. Your other devices are unchanged.");
    });
    if (!compact) root.querySelector(".bp-search").addEventListener("input", function () { filters = this.value.toLowerCase(); renderApps(); });
    function findFrame(event) { for (var p of Object.keys(sessions)) for (var w of Object.values(sessions[p])) if (w.frame.contentWindow === event.source) return { platform: p, window: w }; return null; }
    window.addEventListener("message", function (event) {
      if (event.origin !== location.origin || !event.data) return;
      var source = findFrame(event); if (!source) return;
      if (event.data.type === "osomni:browser-ready") source.window.el.querySelector(".bp-window-loading").hidden = true;
      if (event.data.type === "osomni:browser-error") feedback(source.window.app.name + ": " + event.data.message);
      if (event.data.type === "osomni:device-settings") { root.style.setProperty("--bp-accent", event.data.settings.accent); root.dataset.wallpaper = event.data.settings.wallpaper; root.dataset.appearance = event.data.settings.theme; }
      if (event.data.type === "osomni:file-export" && event.data.blob instanceof Blob) saveFile(source.platform, event.data.name, event.data.blob).then(function () { feedback("Export saved to Files and downloaded to your computer."); });
    });
    function applyAppearance() {
      try { var setting = JSON.parse(localStorage.getItem("osomni.browser.v2." + active + ".settings.system.settings")); root.style.setProperty("--bp-accent", setting && setting.accent || "#367ee8"); root.dataset.wallpaper = setting && setting.wallpaper || "default"; root.dataset.appearance = setting && setting.theme || "light"; } catch (_) {}
    }
    function clock() { var zone=profile().display && profile().display.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;var now=new Date();root.querySelectorAll(".bp-clock").forEach(function(element){element.textContent=now.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:zone});});var date=root.querySelector('.bp-taskbar-date');if(date)date.textContent=now.toLocaleDateString('en-US',{timeZone:zone});if(standby){standby.querySelector('.bp-standby-time').textContent=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone});standby.querySelector('.bp-standby-date').textContent=now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:zone});} }
    clock(); setInterval(clock, 30000); selectPlatform(active);
    if(window.OSOmniAndroidControls)window.OSOmniAndroidControls(root);
    if(window.OSOmniDesktopControls)window.OSOmniDesktopControls(root);
    if(window.OSOmniIOSControls)window.OSOmniIOSControls(root);
    root.osomniDevice={
      selectPlatform:function(id){if(!platforms.some(function(p){return p.id===id;}))return false;selectPlatform(id);return true;},
      apps:function(){return apps().map(function(app){return {id:app.id,name:app.name,icon:app.icon};});},
      openApp:function(id){var app=apps().find(function(item){return item.id===id;});if(!app)return false;unlockDevice();open(app);return true;},
      home:function(){unlockDevice();home();},
      state:function(){var prefix='osomni.browser.v2.'+active+'.',stores=[];try{Object.keys(localStorage).filter(function(key){return key.startsWith(prefix);}).sort().forEach(function(key){var value=localStorage.getItem(key)||'';stores.push({key:key.slice(prefix.length),characters:value.length});});}catch(_){}return {platform:active,locked:root.dataset.locked==='true',activeApp:selectedApp,openApps:Object.keys(running()),availableApps:apps().length,storageEntries:stores.length,storedCharacters:stores.reduce(function(sum,row){return sum+row.characters;},0),stores:stores};}
    };
    return { open: open, selectPlatform: selectPlatform };
  }
  function filesDB(operation) {
    return new Promise(function (resolve, reject) { var request = indexedDB.open("osomni.browser.files.v2", 1); request.onupgradeneeded = function () { request.result.createObjectStore("files", { keyPath: "id" }); }; request.onerror = function () { reject(request.error); }; request.onsuccess = function () { var db = request.result; operation(db, resolve, reject); }; });
  }
  function saveFile(platform, name, blob) {
    return filesDB(function(db,resolve,reject){var tx=db.transaction("files","readwrite"),store=tx.objectStore("files"),request=store.getAll();request.onsuccess=function(){var old=request.result.find(function(f){return f.platform===platform&&f.name===name&&!f.parent&&f.type!=='folder';});store.put({id:old?old.id:crypto.randomUUID(),platform:platform,name:name,blob:blob,parent:null,modified:Date.now()});};tx.oncomplete=function(){db.close();resolve();};tx.onerror=function(){reject(tx.error);};});
  }
  function resetFiles(platform) {
    return filesDB(function (db, resolve, reject) { var tx = db.transaction("files", "readwrite"), store = tx.objectStore("files"), cursor = store.openCursor(); cursor.onsuccess = function () { var c = cursor.result; if (!c) return; if (c.value.platform === platform) c.delete(); c.continue(); }; tx.oncomplete = function () { db.close(); resolve(); }; tx.onerror = function () { reject(tx.error); }; });
  }
  async function resetApplicationDBs(platform) {
    if(!indexedDB.databases)return;
    var databases=await indexedDB.databases(),prefix="osomni.browser.v2."+platform+".";
    for(var db of databases){if(!db.name||!db.name.startsWith(prefix))continue;await new Promise(function(resolve,reject){var request=indexedDB.deleteDatabase(db.name);request.onsuccess=resolve;request.onerror=function(){reject(request.error);};request.onblocked=function(){reject(new Error("An application database is still open."));};});}
  }
  window.OSOmniPlayground = mount;
  mount(document.getElementById("playground"), false);
  window.OSOmniBoot?.ready('playground');
})();
