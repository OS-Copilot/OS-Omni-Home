(function () {
  'use strict';
  var root = document.getElementById('task-explorer');
  if (!root) return;
  var labels = {linux:'Linux', windows:'Windows', macos:'macOS', android:'Android', ios:'iOS', web:'Web', cross_device:'Cross-device'};
  var appIcon=window.OSOmniTaskIcons.app,platformIcon=window.OSOmniTaskIcons.platform;
  var esc = function (value) { return String(value).replace(/[&<>"']/g, function (c) {return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
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
