(function () {
  'use strict';
  var root = document.getElementById('task-explorer');
  if (!root) return;
  var labels = {linux:'Linux', windows:'Windows', macos:'macOS', android:'Android', ios:'iOS', web:'Web', cross_device:'Cross-device'};
  function platformIcon(key) {
    var shapes = {
      windows:'<path d="m3 5 8-1v7H3zm10-1 8-1v8h-8zM3 13h8v7l-8-1zm10 0h8v8l-8-1z"/>',
      linux:'<path d="M8 9C7 3 10 1 13 2c4 1 3 5 3 7 4 5 5 10 1 11H7c-4-1-3-6 1-11Z"/><ellipse cx="12" cy="14" rx="4" ry="5" fill="var(--te-icon-cutout,#fff)"/><ellipse cx="10.5" cy="6.5" rx="1" ry="1.5" fill="var(--te-icon-cutout,#fff)"/><ellipse cx="13.5" cy="6.5" rx="1" ry="1.5" fill="var(--te-icon-cutout,#fff)"/><path d="m9 9 3-2 3 2-3 2zM3 19l5-2 2 5H2zm13-2 5 2 1 3h-8z"/>',
      macos:'<rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 2 10 14h5l-1 8M7 7v3m10-3v3M6 15q6 5 12 0" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      android:'<path d="M5 11h14v8H5zm0-2a7 7 0 0 1 14 0Z"/><path d="m8 4-2-3m10 3 2-3M2 11v7m20-7v7M8 19v3m8-3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="6.5" r="1" fill="var(--te-icon-cutout,#fff)"/><circle cx="15" cy="6.5" r="1" fill="var(--te-icon-cutout,#fff)"/>',
      ios:'<path d="M15 5c1-1 2-3 2-4-2 0-4 1-5 4h3Zm5 12c-1 3-3 6-5 6-1 0-2-1-3-1s-2 1-3 1c-3 0-7-7-7-11 0-5 4-7 7-6l3 1 3-1c2-1 5 0 6 2-5 3-4 7-1 9Z" transform="translate(1 0) scale(.92)"/>',
      web:'<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m12 8 8-1M8.5 14l-4-7M14 15l-4 7" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      cross_device:'<rect x="1" y="3" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 19h8m-4-4v4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="16" y="8" width="7" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      all:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>'
    };
    return '<svg class="te-platform-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+(shapes[key]||shapes.all)+'</svg>';
  }
  function appIcon(name, track) {
    var normalized=function(value){return value.toLowerCase().replace(/[^a-z0-9]/g,'');};
    var aliases={opennote:'openrednote',visualstudiocode:'vscode',thunderbirdcalendar:'thunderbird',tasks:'tasks-org'};
    var key=normalized(name), id=aliases[key]||null, catalog=window.OSOmniBrowserApps||[];
    var app=catalog.find(function(item){return id?item.id===id:normalized(item.id)===key||normalized(item.name)===key;});
    var profile=(window.OSOmniDeviceProfiles||{})[track];
    var nativeEntries=profile&&profile.applications||[];
    var nativeEntry=nativeEntries.find(function(item){return normalized(item.name)===key;})||nativeEntries.find(function(item){return item.id===(id||key)||app&&item.id===app.id;});
    var path=nativeEntry&&nativeEntry.icon||app&&app.icon;
    return path?'<img class="te-app-icon" src="'+esc(path)+'" alt="" loading="lazy" width="20" height="20">':'<span class="te-app-initial" aria-hidden="true">'+esc(name.slice(0,1).toUpperCase())+'</span>';
  }
  var esc = function (value) { return String(value).replace(/[&<>"']/g, function (c) {return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  window.OSOmniTaskIcons={app:appIcon,platform:platformIcon};
  fetch('static/data/task-catalog.json?v=composition-2').then(function (response) {
    if (!response.ok) throw new Error('Task catalog could not be loaded.');
    return response.json();
  }).then(function (data) {
    var rows=data.tasks, page=0, size=12, spotlight=null;
    root.innerHTML='<div class="te-controls"><label>Platform<select data-filter="track"><option value="">All platforms</option></select></label><label>Application<select data-filter="app"><option value="">All applications</option></select></label><label class="te-search">Search tasks<input type="search" placeholder="Task name, instruction or ID" aria-label="Search tasks"></label><button class="te-clear" type="button">Clear filters</button></div><p class="te-count" role="status" aria-live="polite"></p><div class="te-results"></div><div class="te-pagination"><button type="button" data-page="previous">← Previous</button><span></span><button type="button" data-page="next">Next →</button></div>';
    var track=root.querySelector('[data-filter=track]'),app=root.querySelector('[data-filter=app]'),search=root.querySelector('input');
    track.parentElement.classList.add('te-track-select');
    var intro=document.createElement('div');intro.className='te-intro';intro.innerHTML='<span><strong>'+rows.length+'</strong> tasks / 7 tracks / one collection</span><button class="te-surprise" type="button">Find a task <span aria-hidden="true">↗</span></button>';root.prepend(intro);
    var platformNav=document.createElement('div');platformNav.className='te-platforms';platformNav.setAttribute('role','group');platformNav.setAttribute('aria-label','Filter by platform');intro.after(platformNav);
    [''].concat(Object.keys(labels)).forEach(function(key){var button=document.createElement('button');button.type='button';button.className='te-platform';button.dataset.track=key;button.innerHTML='<span class="te-platform-top">'+platformIcon(key)+'<b>'+String(key?data.counts[key]:rows.length).padStart(3,'0')+'</b></span><span>'+esc(labels[key]||'All Tasks')+'</span>';button.onclick=function(){track.value=key;page=0;spotlight=null;updateApps();render();};platformNav.appendChild(button);});
    Object.keys(labels).forEach(function (key) {if(data.counts[key])track.add(new Option(labels[key]+' ('+data.counts[key]+')',key));});
    function updateApps(){var selected=app.value;app.replaceChildren(new Option('All applications',''));var counts={};rows.filter(function(row){return !track.value||row.track===track.value;}).forEach(function(row){row.apps.forEach(function(name){counts[name]=(counts[name]||0)+1;});});Object.keys(counts).sort().forEach(function(name){app.add(new Option(name+' ('+counts[name]+')',name));});if(counts[selected])app.value=selected;}
    function render(){
      platformNav.querySelectorAll('button').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.track===track.value));});
      var query=search.value.trim().toLowerCase();
      var matches=rows.filter(function(row){return (!track.value||row.track===track.value)&&(!app.value||row.apps.includes(app.value))&&(!query||[row.id,row.description,row.instruction,row.apps.join(' ')].join(' ').toLowerCase().includes(query));});
      if(spotlight){var chosen=matches.findIndex(function(row){return row.id===spotlight;});if(chosen>=0)page=Math.floor(chosen/size);else spotlight=null;}
      var pages=Math.max(1,Math.ceil(matches.length/size));page=Math.min(page,pages-1);
      root.querySelector('.te-count').textContent=matches.length+' of '+rows.length+' tasks · '+data.release+' · '+(app.value||'All applications');
      root.querySelector('.te-results').innerHTML=matches.slice(page*size,(page+1)*size).map(function(row,index){
        var title=(row.id.split('.').slice(2).join(' · ')||row.id).replace(/_\d{6,}/g,'').replace(/_/g,' ');
        var art='<span class="te-card-platform" title="'+esc(labels[row.track]||row.track)+'">'+platformIcon(row.track)+'</span>';
        return '<details class="te-task" data-track="'+esc(row.track)+'" style="--te-order:'+index+'"'+(row.id===spotlight?' open':'')+'><summary><span class="te-card-top"><span>'+String(page*size+index+1).padStart(3,'0')+' / '+esc(labels[row.track]||row.track)+'</span>'+art+'</span><span class="te-task-title">'+esc(title)+'</span><span class="te-excerpt">'+esc(row.description||row.instruction)+'</span><span class="te-badges">'+row.apps.map(function(name){return '<span class="te-app-badge">'+appIcon(name,row.track)+'<span>'+esc(name)+'</span></span>';}).join('')+(row.maxSteps?'<span>'+esc(row.maxSteps)+' steps</span>':'')+'</span><span class="te-expand" aria-hidden="true">+</span></summary><div class="te-task-body"><code>'+esc(row.id)+'</code><h4>The instruction</h4><div class="te-instruction">'+esc(row.instruction)+'</div><p class="te-source">'+esc(row.path)+(row.maxSteps?' · Step limit: '+esc(row.maxSteps):'')+'</p></div></details>';
      }).join('')||'<p class="te-empty">No tasks match these filters. Try another application or clear the search.</p>';
      root.querySelector('.te-pagination span').textContent='Page '+(page+1)+' of '+pages;
      root.querySelector('[data-page=previous]').disabled=page===0;root.querySelector('[data-page=next]').disabled=page>=pages-1;
    }
    track.addEventListener('change',function(){page=0;spotlight=null;updateApps();render();});[app].forEach(function(element){element.addEventListener('change',function(){page=0;spotlight=null;render();});});search.addEventListener('input',function(){page=0;spotlight=null;render();});
    root.querySelector('.te-clear').onclick=function(){track.value='';search.value='';app.value='';page=0;spotlight=null;updateApps();render();};
    intro.querySelector('.te-surprise').onclick=function(){var query=search.value.trim().toLowerCase();var pool=rows.filter(function(row){return (!track.value||row.track===track.value)&&(!app.value||row.apps.includes(app.value))&&(!query||[row.id,row.description,row.instruction,row.apps.join(' ')].join(' ').toLowerCase().includes(query));});if(!pool.length)return;spotlight=pool[Math.floor(Math.random()*pool.length)].id;render();var selected=root.querySelector('.te-task[open]');if(selected)selected.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
    root.querySelectorAll('[data-page]').forEach(function(button){button.onclick=function(){spotlight=null;page+=button.dataset.page==='next'?1:-1;render();root.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};});
    window.OSOmniTaskExplorer={filter:function(selection){track.value=selection.track||'';page=0;spotlight=selection.taskId||null;search.value='';updateApps();app.value=selection.app||'';render();}};
    updateApps();render();window.OSOmniBoot?.ready('tasks');
  }).catch(function(error){root.textContent=error.message+' Please reload the page.';window.OSOmniBoot?.fail('tasks','The task catalog could not be loaded.');});
})();
