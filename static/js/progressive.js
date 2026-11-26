/* Load independent sections as they approach the viewport, after first paint. */
(function(global){
  'use strict';
  var scripts=new Map(),styles=new Map(),running=new Map(),pendingFilter=null;
  var definitions={
    data:{scripts:['osomni-data.js']},
    icons:{scripts:['browser-apps.js','device-profiles.js','app-icons.js']},
    overview:{target:'#problem, #benchmark, #findings',deps:['data','icons'],styles:['paper-results.css','dataset-composition.css'],scripts:['paper-results.js','dataset-composition.js'],after:function(){global.OSOmniPaperResults.render();}},
    devices:{target:'#playground-section',host:'#playground',deps:['icons'],styles:['browser-playground.css','device-hardware.css','device-startup.css','device-showcase.css'],scripts:['android-device-controls.js','desktop-device-controls.js','ios-device-controls.js','browser-playground.js','device-showcase.js']},
    tasks:{target:'#tasks',host:'#task-explorer',deps:['icons'],styles:['task-explorer.css'],scripts:['task-explorer.js']},
    replays:{target:'#case-studies',host:'#recorded-cases',deps:['icons'],styles:['case-studies.css'],scripts:['case-studies.js']},
    leaderboard:{target:'#leaderboard',deps:['overview'],styles:['leaderboard.css','leaderboard-explorer.css'],scripts:['leaderboard-explorer.js']},
    pipeline:{target:'#method',host:'#annotation-pipeline',deps:['icons'],styles:['research-stories.css','annotation-pipeline.css'],scripts:['research-stories.js']},
    atmosphere:{styles:['exploration-motion.css','galaxy.css','page-galaxy.css'],modules:['exploration-motion.js','page-galaxy.js']},
    robot:{target:'.charcoal-brand-visual',styles:['mascot-3d.css'],modules:['mascot-3d.js']}
  };
  function style(name){
    if(styles.has(name))return styles.get(name);
    var promise=new Promise(function(resolve,reject){var link=document.createElement('link');link.rel='stylesheet';link.href='static/css/'+name+'?v=progressive-1';link.onload=resolve;link.onerror=function(){styles.delete(name);link.remove();reject(Error('This section could not load.'));};document.head.appendChild(link);});styles.set(name,promise);return promise;
  }
  function script(name,module){
    if(scripts.has(name))return scripts.get(name);
    var promise=new Promise(function(resolve,reject){var el=document.createElement('script');el.src='static/js/'+name+'?v=progressive-1';if(module)el.type='module';el.onload=resolve;el.onerror=function(){scripts.delete(name);el.remove();reject(Error('This section could not load.'));};document.body.appendChild(el);});scripts.set(name,promise);return promise;
  }
  function load(id){
    if(running.has(id))return running.get(id);
    var d=definitions[id];if(!d)return Promise.resolve();
    var target=d.target&&document.querySelector(d.target);
    if(target)target.dataset.loadState='loading';
    var promise=(async function(){
      await Promise.all((d.deps||[]).map(load));
      await Promise.all((d.styles||[]).map(style));
      for(var name of d.scripts||[])await script(name,false);
      for(var name of d.modules||[])await script(name,true);
      if(d.after)d.after();
      if(target){target.dataset.loadState='ready';target.querySelector('.section-load-error')?.remove();}
    })().catch(function(error){
      running.delete(id);global.OSOmniBoot?.fail(id,error.message);
      if(target){target.dataset.loadState='failed';if(!target.querySelector('.section-load-error')){var note=document.createElement('p');note.className='section-load-error';note.setAttribute('role','status');note.append('This section could not load. ');var button=document.createElement('button');button.type='button';button.textContent='Try again';button.onclick=function(){note.remove();load(id).catch(function(){});};note.appendChild(button);(target.querySelector('.wrap')||target).appendChild(note);}}
      throw error;
    });running.set(id,promise);return promise;
  }
  global.OSOmniProgressive={load:load,state:function(){return Object.fromEntries(Object.keys(definitions).map(function(id){var t=definitions[id].target&&document.querySelector(definitions[id].target);return[id,t?.dataset.loadState||(running.has(id)?'requested':'idle')];}));}};
  // Preserve app-count links to a Task Explorer that has not loaded yet.
  var filterStub={filter:function(selection){pendingFilter=selection;load('tasks').catch(function(){});}};
  if(!global.OSOmniTaskExplorer)global.OSOmniTaskExplorer=filterStub;
  global.addEventListener('osomni:module-ready',function(event){if(event.detail.id==='tasks'&&pendingFilter&&global.OSOmniTaskExplorer!==filterStub){global.OSOmniTaskExplorer.filter(pendingFilter);pendingFilter=null;}});
  function onHash(){var target=document.getElementById(location.hash.slice(1));if(!target)return;Object.keys(definitions).forEach(function(id){var d=definitions[id],sections=d.target?Array.from(document.querySelectorAll(d.target)):[];if(sections.some(function(section){return section===target||section.contains(target);}))load(id).catch(function(){});});}
  function start(){
    var observer='IntersectionObserver' in global?new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){observer.unobserve(entry.target);load(entry.target.dataset.progressiveSection).catch(function(){});}});},{rootMargin:'250px 0px'}):null;
    Object.keys(definitions).forEach(function(id){var d=definitions[id];if(!d.target||id==='robot')return;document.querySelectorAll(d.target).forEach(function(target){target.dataset.progressiveSection=id;if(observer)observer.observe(target);else load(id).catch(function(){});});});
    global.addEventListener('hashchange',onHash);onHash();
    var decorate=function(){load('atmosphere').catch(function(){});if(!navigator.connection?.saveData)load('robot').catch(function(){});};
    if(global.requestIdleCallback)global.requestIdleCallback(decorate,{timeout:2500});else global.setTimeout(decorate,100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){requestAnimationFrame(function(){requestAnimationFrame(start);});},{once:true});else requestAnimationFrame(function(){requestAnimationFrame(start);});
})(window);
