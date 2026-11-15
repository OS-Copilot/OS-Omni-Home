/* Camera Ready charts. Every displayed measurement comes from OSOmniData. */
(function(global){
  'use strict';
  function esc(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function mount(id,html){var host=document.getElementById(id);if(host)host.innerHTML=html;return host;}
  function bars(rows,max,unit){return '<div class="cr-bars">'+rows.map(function(row){var value=row.value.toFixed(row.digits===undefined?1:row.digits)+(unit||'');return '<div class="cr-bar-row'+(row.human?' cr-human':'')+'" tabindex="0" aria-label="'+esc(row.label+': '+value)+'" data-chart-tip="'+esc(row.label+' · '+value)+'"><span class="cr-bar-label">'+esc(row.label)+'</span><span class="cr-bar-track"><i style="width:'+Math.max(0,Math.min(100,row.value/max*100))+'%;'+(row.color?'background:'+row.color:'')+'"></i></span><strong>'+esc(value)+'</strong></div>';}).join('')+'</div>';}
  function render(){
    var data=global.OSOmniData;if(!data||!data.results)return;
    var human=data.results.find(function(row){return row.human;});
    var models=data.results.filter(function(row){return !row.human;});
    var ranked=models.slice().sort(function(a,b){return b.average-a.average;});
    var familyNames={openai:'OpenAI',anthropic:'Anthropic',google:'Google',deepseek:'DeepSeek',qwen:'Qwen'};
    mount('cr-summary',[
      [data.benchmark.tasks,'tasks in v1'],[data.benchmark.platforms,'platforms + cross-device'],[models.length,'evaluated models'],[data.benchmark.applications,'applications / websites · Fig. 3']
    ].map(function(item){return '<div class="cr-stat"><strong>'+item[0]+'</strong><span>'+item[1]+'</span></div>';}).join(''));
    mount('cr-platform-mix',bars(data.tracks.map(function(track){return {label:track.label,value:track.count,color:track.color,digits:0};}),48,' tasks'));
    mount('cr-taxonomy',bars(data.taxonomy.map(function(item,index){return {label:item.label,value:item.percent,color:data.chartPalette.categories[index]};}),100,'%'));
    mount('cr-workload-steps',bars([{label:'OS-Omni',value:data.humanWorkload.osomni.steps,digits:2},{label:'OSWorld reference',value:data.humanWorkload.osworld.steps,digits:1,color:'#7a91a7'}],80,' steps'));
    mount('cr-workload-time',bars([{label:'OS-Omni',value:data.humanWorkload.osomni.seconds,digits:2},{label:'OSWorld reference',value:data.humanWorkload.osworld.seconds,digits:2,color:'#7a91a7'}],240,' s'));
    var pick=document.getElementById('cr-track-select');
    var chartViews=[{key:'average',label:'Average',color:data.chartPalette.families.human}].concat(data.tracks.map(function(track,index){return {key:String(index),label:track.label,color:track.color};})),chartView='average';
    var tabs=mount('cr-platform-tabs',chartViews.map(function(view){return '<button type="button" data-cr-platform="'+view.key+'" aria-pressed="'+String(view.key===chartView)+'"><i style="background:'+view.color+'"></i>'+esc(view.label)+'</button>';}).join(''));
    function platformBars(){var view=chartViews.find(function(item){return item.key===chartView;});function value(row){return chartView==='average'?row.average:row.scores[Number(chartView)];}mount('cr-platform-results',bars([human].concat(models.slice().sort(function(a,b){return value(b)-value(a);})).map(function(row){return {label:row.name,value:value(row),human:row.human,color:data.chartPalette.families[row.family]};}),100,'%'));if(tabs)tabs.querySelectorAll('button').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.crPlatform===chartView));});var context=document.getElementById('cr-results-context');if(context)context.textContent=view.label+' · '+(chartView==='average'?'equal-weight mean across seven evaluation groups':'task success on this evaluation group');}
    if(pick){pick.innerHTML=chartViews.map(function(view){return '<option value="'+view.key+'">'+esc(view.label)+'</option>';}).join('');pick.value='average';pick.onchange=function(){chartView=pick.value;platformBars();};}if(tabs)tabs.querySelectorAll('button').forEach(function(button){button.onclick=function(){chartView=button.dataset.crPlatform;if(pick)pick.value=chartView;platformBars();};});platformBars();
    var sort='average',direction=-1,focusedModel=null;
    var columns=[{key:'average',label:'Average'}].concat(data.tracks.map(function(track,index){return {key:String(index),label:track.label};}));
    function score(row,key){return key==='average'?row.average:row.scores[Number(key)];}
    function reducedMotion(){return global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches;}
    function focusRows(name){
      var host=document.getElementById('table-leaderboard');if(!host)return;
      host.querySelectorAll('[data-lb-model]').forEach(function(row){row.classList.toggle('lb-row-focus',row.dataset.lbModel===name);});
    }
    function highlights(){
      var metric=columns.find(function(col){return col.key===sort;}).label;
      var leaders=models.slice().sort(function(a,b){return score(b,sort)-score(a,sort);}).slice(0,3);
      var host=mount('leaderboard-highlights',leaders.concat([human]).map(function(row,index){
        var value=score(row,sort),rank=row.human?'HUMAN REFERENCE':String(1+models.filter(function(other){return score(other,sort)>value;}).length).padStart(2,'0')+' / '+esc(metric.toUpperCase());
        return '<article class="lb-highlight'+(row.human?' lb-human-highlight':'')+'" style="--lb-family:'+data.chartPalette.families[row.family]+';--lb-order:'+index+'"><span class="lb-highlight-rank">'+rank+'</span><h3><button type="button" data-lb-focus="'+esc(row.name)+'" aria-pressed="'+String(focusedModel===row.name)+'" aria-label="Highlight '+esc(row.name)+' in the complete results">'+esc(row.name)+'<span aria-hidden="true">↗</span></button></h3><div><strong>'+value.toFixed(1)+'<small>%</small></strong><span>'+esc(metric)+' success</span></div><span class="lb-highlight-bar"><i style="width:'+value+'%"></i></span></article>';
      }).join(''));
      if(host)host.querySelectorAll('[data-lb-focus]').forEach(function(button){
        button.onclick=function(){focusedModel=focusedModel===button.dataset.lbFocus?null:button.dataset.lbFocus;host.querySelectorAll('[data-lb-focus]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.lbFocus===focusedModel));});focusRows(focusedModel);};
        var card=button.closest('.lb-highlight');
        if(card){card.onmouseenter=function(){focusRows(button.dataset.lbFocus);};card.onmouseleave=function(){focusRows(focusedModel);};}
        button.onfocus=function(){focusRows(button.dataset.lbFocus);};button.onblur=function(){focusRows(focusedModel);};
      });
    }
    var controls=mount('leaderboard-controls','<div class="lb-lenses" role="group" aria-label="Rank models by evaluation group">'+columns.map(function(col){var platform=col.key==='average'?'all':data.tracks[Number(col.key)].key;return '<button type="button" data-lb-metric="'+col.key+'" aria-pressed="'+String(col.key===sort)+'">'+(global.OSOmniTaskIcons?global.OSOmniTaskIcons.platform(platform):'')+'<span>'+esc(col.label)+'</span></button>';}).join('')+'</div><p class="lb-metric-note" role="status" aria-live="polite"></p>');
    if(controls)controls.querySelectorAll('[data-lb-metric]').forEach(function(button){button.onclick=function(){sort=button.dataset.lbMetric;direction=-1;focusedModel=null;table(true);};});
    function table(animate){
      var oldHost=document.getElementById('table-leaderboard'),positions={},scroll=0,focusKey=null;
      if(oldHost){
        var oldScroll=oldHost.querySelector('.table-scroll');scroll=oldScroll?oldScroll.scrollLeft:0;
        var active=document.activeElement;focusKey=active&&active.dataset?active.dataset.crSort:null;
        if(animate&&!reducedMotion())oldHost.querySelectorAll('[data-lb-model]').forEach(function(row){positions[row.dataset.lbModel]=row.getBoundingClientRect().top;});
      }
      var ordered=models.slice().sort(function(a,b){return direction*(score(a,sort)-score(b,sort));});
      var best=columns.map(function(col){return Math.max.apply(null,models.map(function(row){return score(row,col.key);}));});
      var seconds=columns.map(function(col){return Array.from(new Set(models.map(function(row){return score(row,col.key);}))).sort(function(a,b){return b-a;})[1];});
      var host=mount('table-leaderboard','<div class="table-scroll" tabindex="0" role="region" aria-label="Model results; scroll horizontally on small screens"><table class="data cr-table"><caption>OS-Omni v1 · task success rate (%) · Camera Ready Table 1</caption><thead><tr><th scope="col" class="lb-rank-heading">Rank</th><th scope="col">Model / agent</th>'+columns.map(function(col){return '<th scope="col" data-lb-column="'+col.key+'" class="'+(col.key==='average'?'cr-avg ':'')+(col.key===sort?'lb-active-column':'')+'" aria-sort="'+(sort===col.key?(direction===-1?'descending':'ascending'):'none')+'"><button type="button" data-cr-sort="'+col.key+'">'+esc(col.label)+'<span aria-hidden="true">'+(sort===col.key?(direction===-1?' ↓':' ↑'):' ↕')+'</span></button></th>';}).join('')+'</tr></thead><tbody>'+[human].concat(ordered).map(function(row){
        var rank=row.human?null:1+models.filter(function(other){return score(other,sort)>score(row,sort);}).length;
        return '<tr data-lb-model="'+esc(row.name)+'" class="'+(row.human?'cr-human':'lb-model')+'" style="--lb-family:'+data.chartPalette.families[row.family]+'"><td class="lb-rank">'+(row.human?'—':String(rank).padStart(2,'0'))+'</td><th scope="row"><span class="lb-model-name"><i aria-hidden="true"></i>'+esc(row.name)+'</span><small class="lb-model-family">'+(row.human?'Reference · excluded from model ranks':esc(familyNames[row.family]||row.family))+'</small></th>'+columns.map(function(col,index){var value=score(row,col.key);return '<td data-lb-column="'+col.key+'" style="--lb-score:'+value+'%" class="'+(!row.human&&value===best[index]?'cr-best':!row.human&&value===seconds[index]?'cr-second':'')+(col.key==='average'?' cr-avg':'')+(col.key===sort?' lb-active-column':'')+'"><span>'+value.toFixed(1)+'</span></td>';}).join('')+'</tr>';
      }).join('')+'</tbody></table></div>');
      if(host){
        host.querySelector('.table-scroll').scrollLeft=scroll;
        host.querySelectorAll('[data-cr-sort]').forEach(function(button){button.onclick=function(){var key=button.dataset.crSort;direction=sort===key?-direction:-1;sort=key;table(true);};if(focusKey===button.dataset.crSort)button.focus({preventScroll:true});});
        if(animate&&!reducedMotion())host.querySelectorAll('[data-lb-model]').forEach(function(row){var before=positions[row.dataset.lbModel];if(before===undefined||!row.animate)return;var delta=before-row.getBoundingClientRect().top;if(Math.abs(delta)>1)row.animate([{transform:'translateY('+delta+'px)'},{transform:'translateY(0)'}],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'});});
      }
      if(controls){controls.querySelectorAll('[data-lb-metric]').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.lbMetric===sort));});controls.querySelector('.lb-metric-note').textContent='Ranked by '+columns.find(function(col){return col.key===sort;}).label+' · '+(direction===-1?'highest first':'lowest first')+' · select a model card to highlight its row';}
      highlights();focusRows(focusedModel);
    }
    table(false);
  }
  global.OSOmniPaperResults={render:render};
})(window);
