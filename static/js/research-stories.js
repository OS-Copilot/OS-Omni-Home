/* Illustrative process animations. These never execute or score a benchmark. */
(function(global){
  'use strict';
  function esc(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function player(root,labels,draw){
    var index=0,playing=false,elapsed=0,lastTime=null,animationFrame=null,drawnIndex=-1,focusedNode=-1,accessibleSecond=-1;
    var visible=!('IntersectionObserver'in global),scrubbing=false;
    var stageDuration=3000,total=stageDuration*labels.length;
    root.innerHTML='<div class="st-player-head"><span class="st-kind">Illustrative process · not an experiment replay</span></div><div class="st-timeline"><div class="st-steps" role="group" aria-label="Walkthrough stages and playback progress">'+labels.map(function(label,i){return '<button type="button" data-stage="'+i+'"><span>0'+(i+1)+'</span>'+esc(label)+'</button>';}).join('')+'</div><input id="annotation-playback" class="st-scrubber" type="range" min="0" max="'+total+'" step="any" value="0" aria-label="Seek across the five annotation stages"></div><div class="st-scene"></div><p class="st-caption" role="status" aria-live="polite"></p>';
    var scene=root.querySelector('.st-scene'),caption=root.querySelector('.st-caption'),scrubber=root.querySelector('.st-scrubber');
    var buttons=Array.from(root.querySelectorAll('[data-stage]')),frames=labels.map(function(_,i){return draw(i);});
    // Keep all five scenes mounted. Stage changes only update visibility and state.
    scene.innerHTML=frames.map(function(frame,i){return '<div class="ap-stage-frame" data-ap-frame="'+i+'" aria-hidden="true" inert>'+frame.html+'</div>';}).join('');
    var panels=Array.from(scene.querySelectorAll('[data-ap-frame]'));
    var panelNodes=panels.map(function(panel){return Array.from(panel.querySelectorAll('[data-ap-node]'));});
    function clock(ms){var seconds=Math.floor(ms/1000);return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
    function stop(){playing=false;lastTime=null;if(animationFrame!==null)global.cancelAnimationFrame(animationFrame);animationFrame=null;root.dataset.playing='false';}
    function render(force){
      index=Math.min(labels.length-1,Math.floor(elapsed/stageDuration));
      var changed=drawnIndex!==index,phase=Math.min(1,(elapsed-index*stageDuration)/stageDuration),node=Math.min(2,Math.floor(phase*3));
      if(force||changed){
        drawnIndex=index;focusedNode=-1;root.dataset.stage=index;
        if(root.parentElement)root.parentElement.dataset.annotationStage=index;
        panels.forEach(function(panel,i){var active=i===index;panel.classList.toggle('ap-frame-active',active);panel.setAttribute('aria-hidden',String(!active));panel.inert=!active;});
        buttons.forEach(function(button,n){button.setAttribute('aria-pressed',String(n===index));button.classList.toggle('st-stage-complete',n<index);button.style.setProperty('--st-stage-progress',n<index?'1':'0');});
        caption.textContent=frames[index].caption;
      }
      if(focusedNode!==node){
        focusedNode=node;root.dataset.focusNode=node;
        panelNodes[index].forEach(function(item,n){item.classList.toggle('ap-node-active',n===node);item.classList.toggle('ap-node-complete',n<node);});
      }
      buttons[index].style.setProperty('--st-stage-progress',phase.toFixed(5));
      // Fractional input values avoid the old 100-ms (10-fps) thumb quantization.
      scrubber.value=elapsed.toFixed(2);scrubber.style.setProperty('--st-progress',(elapsed/total*100).toFixed(5)+'%');
      var second=Math.floor(elapsed/1000);
      if(changed||second!==accessibleSecond){accessibleSecond=second;scrubber.setAttribute('aria-valuetext',clock(elapsed)+' of '+clock(total)+', '+labels[index]);}
    }
    function tick(now){
      if(!playing)return;
      if(lastTime!==null)elapsed=(elapsed+Math.max(0,now-lastTime))%total;
      lastTime=now;render(false);animationFrame=global.requestAnimationFrame(tick);
    }
    function start(){if(playing||!visible||document.hidden||scrubbing)return;playing=true;lastTime=null;root.dataset.playing='true';render(false);animationFrame=global.requestAnimationFrame(tick);}
    function seek(ms){stop();elapsed=Math.max(0,Math.min(total-1,Number(ms)||0));render(false);start();}
    buttons.forEach(function(button){button.onclick=function(){seek(Number(button.dataset.stage)*stageDuration);};});
    scrubber.addEventListener('input',function(){seek(this.value);});
    scrubber.addEventListener('pointerdown',function(event){scrubbing=true;stop();if(this.setPointerCapture)this.setPointerCapture(event.pointerId);});
    function releaseScrubber(){scrubbing=false;start();}
    scrubber.addEventListener('pointerup',releaseScrubber);
    scrubber.addEventListener('pointercancel',releaseScrubber);
    scrubber.addEventListener('change',releaseScrubber);
    scrubber.addEventListener('blur',releaseScrubber);
    document.addEventListener('visibilitychange',function(){if(document.hidden)stop();else start();});
    if('IntersectionObserver'in global)new global.IntersectionObserver(function(entries){visible=entries[0].isIntersecting;if(visible)start();else stop();}).observe(root);
    render(true);start();return {refresh:function(){render(true);},reset:function(){seek(0);},getState:function(){return {index:index,playing:playing,elapsed:elapsed,total:total,stageDuration:stageDuration};}};
  }
  var stages=[
    {title:'Experience-based task design',text:'An annotator with hands-on software experience writes the instruction, initialization procedure, and evaluator.',cards:[['Instruction','A clear user goal'],['Initialization','A reproducible starting state'],['Evaluator','An executable final-state check']]},
    {title:'Independent task review',text:'A second annotator checks instruction clarity, feasibility in the initialized environment, and a well-defined expected outcome.',cards:[['Clarity','Is the instruction understandable?'],['Feasibility','Can it be completed from this state?'],['Outcome','Is success precisely defined?']]},
    {title:'Cross-platform difficulty calibration',text:'Annotators compare expected human operation steps across platforms and revise tasks with large discrepancies.',cards:[['Compare','Human interaction steps'],['Calibrate','Across platform conventions'],['Revise','Reduce large discrepancies']]},
    {title:'Oracle-based execution validation',text:'An oracle runs from the initialized environment. The evaluator checks its final state to confirm that a correct completion is recognized.',cards:[['Initialized environment','Load the prepared task state'],['Oracle execution','Execute and record the workflow'],['Final-state check','Recognize correct completion']]},
    {title:'Failure-state testing and final revision',text:'Representative incorrect outcomes must be rejected. Tasks with unclear instructions, broken setup, or unreliable evaluation are revised or removed.',cards:[['Incorrect state','Reject → revise or remove'],['Correct state','Accept the validated result'],['Final revision','Release only after the checks']]}
  ];
  function pipeline(){
    var host=document.getElementById('annotation-pipeline');if(!host)return;
    host.classList.add('annotation-story');
    var symbols=[
      '<path d="M8 3h10l6 6v21H8zM18 3v7h6M12 15h8M12 20h8M12 25h5"/>',
      '<rect x="6" y="4" width="21" height="25" rx="4"/><path d="m11 12 2 2 4-5m-6 12 2 2 4-5M21 13h2M21 22h2"/>',
      '<path d="M4 7h24M7 3v8M4 25h24M25 21v8M5 16h22M13 12v8"/>',
      '<path d="m12 7 13 9-13 9z"/><circle cx="16" cy="16" r="14"/>',
      '<path d="m6 16 7 7 14-15M4 8V3h5M28 24v5h-5"/>'
    ];
    function symbol(i){return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+symbols[i]+'</svg>';}
    var nodeSymbols={
      document:'<path d="M8 3h10l6 6v21H8zM18 3v7h6M12 15h8M12 20h8M12 25h5"/>',
      reset:'<path d="M6 12a11 11 0 1 1 0 9M6 4v8h8"/>',
      shield:'<path d="m16 3 11 4v9c0 7-11 13-11 13S5 23 5 16V7zM11 15l4 4 7-8"/>',
      eye:'<path d="M2 16s5-9 14-9 14 9 14 9-5 9-14 9S2 16 2 16Z"/><circle cx="16" cy="16" r="4"/>',
      check:'<circle cx="16" cy="16" r="12"/><path d="m10 16 4 4 9-9"/>',
      target:'<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="7"/><circle cx="16" cy="16" r="2"/>',
      compare:'<rect x="2" y="5" width="17" height="13" rx="2"/><path d="M6 23h9m-5-5v5"/><rect x="22" y="10" width="8" height="17" rx="2"/>',
      sliders:'<path d="M4 8h24M4 16h24M4 24h24M10 4v8M22 12v8M14 20v8"/>',
      edit:'<path d="m22 3 7 7-16 16-9 2 2-9zM18 7l7 7"/>',
      play:'<circle cx="16" cy="16" r="13"/><path d="m13 9 10 7-10 7z"/>',
      cross:'<circle cx="16" cy="16" r="12"/><path d="m11 11 10 10m0-10L11 21"/>'
    };
    var nodeKeys=[['document','reset','shield'],['eye','check','target'],['compare','sliders','edit'],['reset','play','shield'],['cross','check','edit']];
    var focusLabels=['The task specification','Independent review criteria','Cross-platform calibration','Oracle validation','Evaluator reliability'];
    function nodeIcon(key){return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+nodeSymbols[key]+'</svg>';}
    function diagram(index){
      return '<div class="ap-flow"><div class="ap-flow-core"><span class="ap-core-symbol">'+symbol(index)+'</span><span>'+esc(focusLabels[index])+'</span></div><svg class="ap-flow-branches" viewBox="0 0 600 70" preserveAspectRatio="none" aria-hidden="true"><path d="M300 0v24M100 70V38q0-14 14-14h372q14 0 14 14v32M300 24v46"/></svg><div class="ap-flow-nodes">'+stages[index].cards.map(function(card,n){return '<div class="ap-flow-node" data-ap-node="'+n+'"><span class="ap-node-icon">'+nodeIcon(nodeKeys[index][n])+'</span><strong>'+esc(card[0])+'</strong><small>'+esc(card[1])+'</small></div>';}).join('')+'</div></div>';
    }
    host.innerHTML='<div class="ap-header"><div><span class="eyebrow">Behind every task</span><h3>One pipeline.<br><span class="gilt">Every platform.</span></h3><p>Five stages turn a realistic user goal into a reviewed, executable benchmark task.</p></div><div class="ap-platforms"><span>Shared across</span><div>'+['linux','windows','macos','android','ios','web'].map(function(id){return '<span title="'+esc(id)+'">'+(global.OSOmniTaskIcons?global.OSOmniTaskIcons.platform(id):esc(id))+'</span>';}).join('')+'</div><small>Desktop · mobile · web</small></div></div><div class="st-player"></div><p class="cr-source">Camera Ready Figure 4 and Section 3.5. One shared annotation and validation process across platforms. This is an explanatory animation, not a measured task execution.</p>';
    var root=host.querySelector('.st-player');
    var api=player(root,['Design','Review','Calibrate','Validate','Revise'],function(index){var stage=stages[index];return {html:'<div class="ap-stage-art"><div class="ap-orbit-glow" aria-hidden="true"></div>'+diagram(index)+'</div><div class="ap-stage-copy"><span class="ap-stage-index">STAGE 0'+(index+1)+' / 05</span><h4>'+esc(stage.title)+'</h4><p>'+esc(stage.text)+'</p></div>',caption:''};});
    root.querySelectorAll('[data-stage]').forEach(function(button,i){button.innerHTML='<span class="ap-step-symbol">'+symbol(i)+'</span><span class="ap-step-label"><small>0'+(i+1)+'</small>'+['Design','Review','Calibrate','Validate','Revise'][i]+'</span>';});
    host.osomniStory=api;
  }
  function init(){pipeline();}
  global.OSOmniResearchStories={player:player,stages:stages};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
