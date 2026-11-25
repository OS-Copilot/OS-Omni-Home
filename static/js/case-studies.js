/* Recorded screenshots and explicit actions only. This player executes no actions. */
(function(global){
  'use strict';
  function esc(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function init(){
    var host=document.getElementById('recorded-cases');if(!host)return;
    fetch('static/data/case-studies.json?v=6-web-library').then(function(response){if(!response.ok)throw Error('Recorded cases could not be loaded.');return response.json();}).then(function(data){
      var cases=data.cases,selected=0,index=0,after=false,playing=false,timer=null,imageVersion=0;
      var names={linux:'Linux',windows:'Windows',macos:'macOS',android:'Android',ios:'iOS',web:'Web'};
      var librarySummary=document.getElementById('case-library-summary');if(librarySummary)librarySummary.textContent='Explore '+cases.length+' recorded attempts, with 12 tasks per platform. Choose a platform and application, then follow its original observations, recorded actions and final-state verdict.';
      host.innerHTML='<div class="cs-tabs" role="group" aria-label="Choose a recorded case">'+cases.map(function(item,i){return '<button type="button" data-case="'+i+'" aria-pressed="false"><span class="cs-case-icon">'+(global.OSOmniTaskIcons?global.OSOmniTaskIcons.app(item.app,item.platform):'')+'</span><span><strong>'+names[item.platform]+'</strong><small>'+esc(item.app)+' · '+item.stepCount+' recorded steps</small></span><span aria-hidden="true">↗</span></button>';}).join('')+'</div><div class="cs-player"><div class="cs-main"><div class="cs-screen-head"><span class="cs-frame-label" role="status" aria-live="polite"></span><div class="cs-screen-modes" role="group" aria-label="Observation timing"><button type="button" data-screen="before" aria-pressed="true">Before action</button><button type="button" data-screen="after" aria-pressed="false">Next observation</button></div></div><div class="cs-screen" aria-busy="false"><img alt="" decoding="async"><span class="cs-loading" role="status" hidden>Loading recorded screen…</span></div><div class="cs-transport"><div><button type="button" data-prev aria-label="Previous recorded step">←</button><button type="button" data-play>▶ Play replay</button><button type="button" data-next aria-label="Next recorded step">→</button></div><span class="cs-step-count"></span><a class="cs-original" target="_blank" rel="noopener">Open screenshot ↗</a></div><input class="cs-seek" type="range" min="0" step="1" value="0" aria-label="Select a recorded step"><div class="cs-milestones" role="group" aria-label="Recorded checkpoints"></div><p class="cs-timing-note">Replay timing is compressed. “Next observation” is the next recorded screenshot, not a live application.</p></div><aside class="cs-details"><span class="eyebrow">Recorded case study</span><h3></h3><p class="cs-summary"></p><div class="cs-verdict"><span>Final-state evaluator</span><strong></strong><p></p></div><p class="cs-focus"></p><div class="cs-action-heading"><span>RECORDED ACTION</span><span class="cs-action-status"></span></div><pre class="cs-action"><code></code></pre><details class="cs-instruction"><summary>Read the archived task instruction</summary><p></p><code></code></details><a class="cs-source" target="_blank" rel="noopener">Source result archive ↗</a></aside></div>';
      var tabs=host.querySelector('.cs-tabs'),groups=document.createElement('div');
      groups.className='cs-case-groups';
      groups.innerHTML='<section class="cs-case-group"><h3>Desktop</h3><div class="cs-tabs" role="group" aria-label="Desktop recorded cases"></div></section><section class="cs-case-group"><h3>Mobile</h3><div class="cs-tabs" role="group" aria-label="Mobile recorded cases"></div></section><section class="cs-case-group"><h3>Browser</h3><div class="cs-tabs" role="group" aria-label="Web recorded cases"></div></section>';
      host.insertBefore(groups,tabs);
      var groupedTabs=groups.querySelectorAll('.cs-tabs');
      var platformsSeen={};
      tabs.querySelectorAll('[data-case]').forEach(function(button){
        var item=cases[Number(button.dataset.case)];if(platformsSeen[item.platform])return;platformsSeen[item.platform]=true;
        var platformCases=cases.filter(function(c){return c.platform===item.platform;}),counts=platformCases.map(function(c){return c.stepCount;});
        var count=platformCases.length,stepRange=Math.min.apply(null,counts)+'–'+Math.max.apply(null,counts);
        button.innerHTML='<span class="cs-platform-icon" aria-hidden="true">'+(global.OSOmniTaskIcons?global.OSOmniTaskIcons.platform(item.platform):'')+'</span><span><strong>'+names[item.platform]+'</strong><small>'+count+' tasks · '+stepRange+' steps</small></span><span aria-hidden="true">↗</span>';
        groupedTabs[item.platform==='web'?2:(item.platform==='ios'||item.platform==='android')?1:0].appendChild(button);
      });
      var groupColumns=[];
      groups.querySelectorAll('.cs-case-group').forEach(function(group){var size=group.querySelectorAll('[data-case]').length;group.hidden=!size;group.style.setProperty('--cs-group-size',String(size||1));if(size)groupColumns.push('minmax(0,'+size+'fr)');});
      groups.style.setProperty('--cs-group-columns',groupColumns.join(' '));
      tabs.remove();
      var chooser=document.createElement('div');chooser.className='cs-task-chooser';
      chooser.innerHTML='<div class="cs-choice-toolbar"><div><h3>Choose a recorded task</h3><p class="cs-choice-count" role="status" aria-live="polite"></p></div><label>Application<select class="cs-app-filter" aria-label="Filter recorded tasks by application"></select></label><label>Search tasks<input class="cs-task-search" type="search" placeholder="App, task or keyword" aria-label="Search recorded tasks"></label></div><div class="cs-task-list" role="group" aria-label="Available recorded tasks"></div>';
      host.insertBefore(chooser,host.querySelector('.cs-player'));
      var taskSearch=chooser.querySelector('.cs-task-search'),appFilter=chooser.querySelector('.cs-app-filter');
      function taskApps(item){return item.apps||[item.app];}
      function resetChoices(platform){
        taskSearch.value='';var apps=[];
        cases.filter(function(item){return item.platform===platform;}).forEach(function(item){taskApps(item).forEach(function(app){if(apps.indexOf(app)<0)apps.push(app);});});
        apps.sort();appFilter.innerHTML='<option value="">All applications</option>'+apps.map(function(app){return '<option value="'+esc(app)+'">'+esc(app)+'</option>';}).join('');appFilter.value='';
      }
      function renderChoices(){
        var platform=cases[selected].platform,query=taskSearch.value.trim().toLowerCase(),app=appFilter.value;
        var available=cases.map(function(item,i){return {item:item,index:i};}).filter(function(entry){var item=entry.item;return item.platform===platform&&(!app||taskApps(item).indexOf(app)>=0)&&(!query||(item.title+' '+taskApps(item).join(' ')+' '+item.taskId).toLowerCase().indexOf(query)>=0);});
        var all=cases.filter(function(item){return item.platform===platform;});
        chooser.querySelector('.cs-choice-count').textContent=names[platform]+' · '+available.length+' of '+all.length+' tasks · archived PASS and FAIL verdicts';
        chooser.querySelector('.cs-task-list').innerHTML=available.length?available.map(function(entry){var item=entry.item;return '<button type="button" class="cs-task-option" data-task="'+entry.index+'" aria-pressed="'+String(entry.index===selected)+'"><span class="cs-case-icon">'+(global.OSOmniTaskIcons?global.OSOmniTaskIcons.app(item.app,item.platform):'')+'</span><span class="cs-task-text"><strong>'+esc(item.title)+'</strong><small>'+esc(taskApps(item).join(' + '))+' · '+item.stepCount+' steps</small></span><span class="cs-task-verdict" data-status="'+esc(item.evaluationStatus)+'">'+esc(item.evaluationStatus)+'</span></button>';}).join(''):'<p class="cs-no-tasks">No recorded tasks match these filters.</p>';
        chooser.querySelectorAll('[data-task]').forEach(function(button){button.onclick=function(){choose(Number(button.dataset.task));};});
      }
      taskSearch.addEventListener('input',renderChoices);appFilter.addEventListener('change',renderChoices);
      var screen=host.querySelector('.cs-screen'),image=screen.querySelector('img'),loading=host.querySelector('.cs-loading'),range=host.querySelector('.cs-seek'),play=host.querySelector('[data-play]');
      function controlIcon(name){
        var shapes={play:'<path d="M9 5.5a1 1 0 0 0-1.5.87v11.26A1 1 0 0 0 9 18.5l9-5.63a1 1 0 0 0 0-1.74Z" fill="currentColor"/>',pause:'<rect x="7" y="5" width="3.5" height="14" rx="1.5" fill="currentColor"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.5" fill="currentColor"/>',previous:'<path d="M6 6v12m11-11-6 5 6 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',next:'<path d="M18 6v12M7 7l6 5-6 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'};
        return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">'+shapes[name]+'</svg>';
      }
      host.querySelector('[data-prev]').innerHTML=controlIcon('previous');host.querySelector('[data-next]').innerHTML=controlIcon('next');
      var decodedScreens=new Map(),loadingTimer=null,screenAnimation=null;
      var reducedMotion=global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      image.className='cs-screen-layer';
      function stop(){playing=false;clearTimeout(timer);timer=null;play.innerHTML=controlIcon('play');play.setAttribute('aria-label','Play replay');play.title='Play replay';play.setAttribute('aria-pressed','false');}
      function decodedScreen(shot,priority){
        var source=shot.preview||shot,key=source.src,entry=decodedScreens.get(key);
        if(entry){decodedScreens.delete(key);decodedScreens.set(key,entry);if(priority==='high')entry.image.fetchPriority='high';return entry.promise;}
        var next=new global.Image();next.decoding='async';next.fetchPriority=priority||'low';next.width=source.width;next.height=source.height;next.className='cs-screen-layer';
        entry={image:next,promise:null};
        entry.promise=new Promise(function(resolve,reject){
          var settled=false;
          function ready(){if(settled)return;settled=true;var decoded=next.decode?next.decode():Promise.resolve();decoded.then(function(){resolve(next);},reject);}
          next.onload=ready;next.onerror=function(){if(settled)return;settled=true;reject(Error('Recorded screenshot unavailable.'));};
          next.src=key;if(next.complete&&next.naturalWidth)ready();
        });
        decodedScreens.set(key,entry);
        entry.promise.catch(function(){if(decodedScreens.get(key)===entry)decodedScreens.delete(key);});
        // Bound decoded memory to a short rolling window, never the complete archive.
        while(decodedScreens.size>12)decodedScreens.delete(decodedScreens.keys().next().value);
        return entry.promise;
      }
      function warmScreens(){
        var item=cases[selected],count=playing?5:2;
        for(var offset=1;offset<=count;offset++){
          var at=index+offset;if(at>item.steps.length)break;
          decodedScreen(at===item.steps.length?item.finalScreenshot:item.steps[at].before,'low').catch(function(){});
        }
      }
      function loadScreen(shot,label,present){
        screen.style.setProperty('--cs-screen-ratio',shot.width+' / '+shot.height);
        var version=++imageVersion;clearTimeout(loadingTimer);screen.setAttribute('aria-busy','true');loading.hidden=true;
        loadingTimer=setTimeout(function(){if(version!==imageVersion)return;loading.textContent='Buffering recorded screen…';loading.hidden=false;},220);
        decodedScreen(shot,'high').then(function(next){
          if(version!==imageVersion)return;
          clearTimeout(loadingTimer);loading.hidden=true;screen.setAttribute('aria-busy','false');
          next.alt=label;
          if(next!==image){
            if(screenAnimation)screenAnimation.cancel();
            var previous=image,hadImage=!!previous.src;
            screen.querySelectorAll('img').forEach(function(old){if(old!==previous&&old!==next)old.remove();});
            previous.style.zIndex='1';next.style.zIndex='2';screen.appendChild(next);image=next;
            if(hadImage&&!reducedMotion&&next.animate){
              screenAnimation=next.animate([{opacity:0},{opacity:1}],{duration:180,easing:'linear'});
              screenAnimation.finished.then(function(){if(previous!==image)previous.remove();}).catch(function(){});
            }else previous.remove();
          }
          host.querySelector('.cs-original').href=shot.src;
          present();warmScreens();schedule();global.OSOmniBoot?.ready('replays');
        }).catch(function(){
          if(version!==imageVersion)return;clearTimeout(loadingTimer);stop();screen.setAttribute('aria-busy','false');loading.hidden=false;loading.textContent='This recorded screenshot could not be loaded.';global.OSOmniBoot?.fail('replays','The initial recorded screen could not be loaded.');
        });
      }
      function schedule(){
        clearTimeout(timer);timer=null;if(!playing)return;
        if(index>=cases[selected].steps.length){stop();return;}
        timer=setTimeout(function(){if(!playing)return;index++;after=false;render();},1100);
      }
      function render(){
        clearTimeout(timer);timer=null;var item=cases[selected],final=index===item.steps.length,step=final?null:item.steps[index];
        host.dataset.platform=item.platform;host.dataset.formFactor=(item.platform==='ios'||item.platform==='android')?'mobile':'desktop';
        loadScreen(final?item.finalScreenshot:(after?step.after:step.before),names[item.platform]+' · '+item.app+' · '+(final?'final recorded screenshot':'recorded step '+step.number+(after?', next observation':', before action')),function(){
        range.max=String(item.steps.length);range.value=String(index);
        range.setAttribute('aria-valuetext',final?'Final recorded state':'Recorded step '+step.number+' of '+item.stepCount);
        host.querySelector('.cs-step-count').textContent=final?'Final state':'Step '+String(step.number).padStart(2,'0')+' / '+item.stepCount;
        host.querySelector('.cs-frame-label').textContent=final?'FINAL RECORDED STATE':(after?'NEXT RECORDED OBSERVATION':'OBSERVATION BEFORE STEP '+step.number);
        host.querySelectorAll('[data-screen]').forEach(function(button){button.disabled=final;button.setAttribute('aria-pressed',String(!final&&(button.dataset.screen==='after')===after));});
        host.querySelector('[data-prev]').disabled=index===0;host.querySelector('[data-next]').disabled=final;
        host.querySelectorAll('[data-checkpoint]').forEach(function(button){button.setAttribute('aria-pressed',String(Number(button.dataset.checkpoint)===index));});
        var status=final?'Evaluator: '+item.evaluationStatus:step.parseStatus==='ERROR'?'Parse: ERROR':step.executionStatus==='ERROR'?'Execution: ERROR':step.actionType==='success'?'Completion signal':step.executionStatus;
        host.querySelector('.cs-action-status').textContent=status;
        host.querySelector('.cs-action-status').dataset.error=String(final?item.evaluationStatus!=='PASS':step.parseStatus==='ERROR'||step.executionStatus==='ERROR');
        host.querySelector('.cs-action code').textContent=final?item.evaluationMessage:step.code||(step.actionType==='success'?'Agent completion signal (DONE).':step.parseError?'No executable action parsed: '+step.parseError:'No executable action recorded.');
        });
      }
      function choose(n){
        stop();var previousPlatform=host.dataset.platform;selected=n;index=0;after=false;var item=cases[selected];
        if(previousPlatform!==item.platform){resetChoices(item.platform);renderChoices();}
        else chooser.querySelectorAll('[data-task]').forEach(function(button){button.setAttribute('aria-pressed',String(Number(button.dataset.task)===selected));});
        host.querySelectorAll('[data-case]').forEach(function(button){button.setAttribute('aria-pressed',String(cases[Number(button.dataset.case)].platform===item.platform));});
        host.querySelector('.cs-details h3').textContent=item.title;host.querySelector('.cs-summary').textContent=item.summary;
        host.querySelector('.cs-verdict').dataset.status=item.evaluationStatus;
        host.querySelector('.cs-verdict strong').textContent=item.evaluationStatus;host.querySelector('.cs-verdict p').textContent=item.evidence;
        host.querySelector('.cs-focus').textContent=item.focus;
        host.querySelector('.cs-instruction p').textContent=item.instruction;host.querySelector('.cs-instruction code').textContent=item.taskId;host.querySelector('.cs-instruction').open=false;
        host.querySelector('.cs-source').href='https://huggingface.co/datasets/'+item.source.repo+'/tree/'+item.source.revision+'/'+item.source.directory;
        host.querySelector('.cs-milestones').innerHTML=item.milestones.map(function(mark){return '<button type="button" data-checkpoint="'+mark.index+'" aria-pressed="false">'+esc(mark.label)+'</button>';}).join('');
        host.querySelectorAll('[data-checkpoint]').forEach(function(button){button.onclick=function(){stop();index=Number(button.dataset.checkpoint);after=false;render();};});render();
      }
      host.querySelectorAll('[data-case]').forEach(function(button){button.onclick=function(){if(cases[Number(button.dataset.case)].platform!==cases[selected].platform)choose(Number(button.dataset.case));};});
      host.querySelectorAll('[data-screen]').forEach(function(button){button.onclick=function(){stop();after=button.dataset.screen==='after';render();};});
      function move(delta){stop();index=Math.max(0,Math.min(cases[selected].steps.length,index+delta));after=false;render();}
      host.querySelector('[data-prev]').onclick=function(){move(-1);};host.querySelector('[data-next]').onclick=function(){move(1);};
      range.addEventListener('input',function(){stop();index=Number(range.value);after=false;render();});
      play.onclick=function(){if(playing){stop();return;}if(index===cases[selected].steps.length){index=0;after=false;}playing=true;play.innerHTML=controlIcon('pause');play.setAttribute('aria-label','Pause replay');play.title='Pause replay';play.setAttribute('aria-pressed','true');render();};
      document.addEventListener('visibilitychange',function(){if(document.hidden)stop();});
      if('IntersectionObserver'in global)new global.IntersectionObserver(function(entries){if(!entries[0].isIntersecting)stop();}).observe(host);
      host.osomniCaseStudy={state:function(){return {caseId:cases[selected].id,index:index,after:after,playing:playing};}};
      choose(0);
    }).catch(function(error){host.textContent=error.message;global.OSOmniBoot?.fail('replays','The trajectory library could not be loaded.');});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
