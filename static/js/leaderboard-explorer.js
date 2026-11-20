/* OS-Omni results explorer. Published scores only; no inferred task outcomes. */
(function(global){
  'use strict';
  var families={openai:'OpenAI',anthropic:'Anthropic',google:'Google',deepseek:'DeepSeek',qwen:'Qwen',human:'Human reference'};
  var esc=function(x){return String(x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  function value(row,key){return key==='average'?row.average:row.scores[Number(key)];}
  function ranked(data,state){
    var models=data.results.filter(function(r){return !r.human;});
    return models.filter(function(r){return (state.family==='all'||r.family===state.family)&&(!state.query||[r.name,families[r.family]].join(' ').toLowerCase().indexOf(state.query.toLowerCase().trim())!==-1);})
      .sort(function(a,b){return (state.direction==='desc'?-1:1)*(value(a,state.metric)-value(b,state.metric))||a.name.localeCompare(b.name);})
      .map(function(r){return {row:r,rank:1+models.filter(function(other){return value(other,state.metric)>value(r,state.metric);}).length};});
  }
  function csv(data,state){
    var columns=['Rank','Model','Provider','Average'].concat(data.tracks.map(function(t){return t.label;}));
    var rows=ranked(data,state).map(function(item){return [item.rank,item.row.name,families[item.row.family],item.row.average].concat(item.row.scores);});
    if(state.human){var h=data.results.find(function(r){return r.human;});if(h)rows.push(['Reference',h.name,'Human',h.average].concat(h.scores));}
    return [columns].concat(rows).map(function(row){return row.map(function(x){return '"'+String(x).replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');
  }
  global.OSOmniLeaderboardExplorer={ranked:ranked,csv:csv,value:value};

  function init(){
    var section=document.getElementById('leaderboard'),data=global.OSOmniData;
    if(!section||!data||!data.results||!document.body.classList.contains('orbit'))return;
    var models=data.results.filter(function(r){return !r.human;}),human=data.results.find(function(r){return r.human;});
    var metricColumns=[{key:'average',label:'Average',count:null}].concat(data.tracks.map(function(t,i){return {key:String(i),label:t.label,count:t.count};}));
    var state={metric:'average',direction:'desc',query:'',family:'all',human:true,view:'table'};
    var selected=new Set(models.slice().sort(function(a,b){return b.average-a.average;}).slice(0,2).map(function(r){return r.name;}));
    var isDark=document.documentElement.getAttribute('data-theme')==='dark';
    var seriesPalette=isDark?['#73c8ee','#f0ac7e','#8eb9fa','#c6a9ef','#f0a1c3','#bdd27d','#d5b395']:['#257b81','#bd7450','#5279ae','#8069a9','#aa607d','#708b44','#8e7753'];
    function plotColor(row){return row.human?(isDark?'#dbc57e':'#9b7b32'):seriesPalette[models.findIndex(function(r){return r.name===row.name;})%seriesPalette.length];}
    var root=section.querySelector('.wrap');root.classList.add('lex-root');
    root.innerHTML='<div class="section-head"><span class="eyebrow">OS-Omni / Results</span><h2 class="section-title">The leaderboard.</h2><p class="section-sub">Compare seven evaluated models across six platforms and cross-device workflows. Select an evaluation group to rank the results.</p></div>'+
      '<div id="leaderboard-explorer"><div class="lex-scope"><span class="lex-release">v1 / 300 tasks</span><span>Success rate (%)</span><a href="#method">Evaluation protocol ↗</a></div>'+
      '<div class="lex-metrics" role="group" aria-label="Evaluation group">'+metricColumns.map(function(c){return '<button type="button" data-lex-metric="'+c.key+'" aria-pressed="'+(c.key==='average')+'">'+esc(c.label)+(c.count?'<small>'+c.count+'</small>':'')+'</button>';}).join('')+'</div>'+
      '<div class="lex-toolbar"><label class="lex-search"><span>Search models</span><input type="search" data-lex-search placeholder="Model or provider" autocomplete="off"></label><label><span>Provider</span><select data-lex-family><option value="all">All providers</option>'+Object.keys(families).filter(function(k){return k!=='human';}).map(function(k){return '<option value="'+k+'">'+families[k]+'</option>';}).join('')+'</select></label><label class="lex-human-toggle"><input type="checkbox" data-lex-human checked><span>Human reference</span></label><button class="lex-reset" type="button" data-lex-reset>Reset filters</button><button class="lex-download" type="button" data-lex-download>Download CSV ↓</button></div>'+
      '<div class="lex-viewbar"><div role="group" aria-label="Results view"><button type="button" data-lex-view="table" aria-pressed="true">Leaderboard</button><button type="button" data-lex-view="compare" aria-pressed="false">Compare <span data-lex-selection-count>2</span></button></div><p data-lex-status role="status" aria-live="polite"></p></div>'+
      '<div class="lex-table-host"></div><div class="lex-compare" hidden><div class="lex-compare-head"><h3>Across evaluation groups</h3><p>Select up to four models. Each point is a published platform score.</p></div><div class="lex-model-picks" role="group" aria-label="Models to compare"></div><div class="lex-plot-host"></div><div class="lex-plot-legend"></div></div>'+
      '<p class="lex-note"><b>Reading the results.</b> Average is the published equal-weight mean across all seven evaluation groups, including the 12-task cross-device group. Ranks are computed among all seven models; filtering does not change them. Human performance is a separate reference.</p><p class="lex-source">Source: Camera Ready Table 1, p. 9. Scores are success rates, not task counts. No confidence intervals or dated evaluation windows are reported.</p></div>';
    var host=root.querySelector('#leaderboard-explorer'),tableHost=host.querySelector('.lex-table-host'),compareHost=host.querySelector('.lex-compare');
    function metric(){return metricColumns.find(function(c){return c.key===state.metric;});}
    function status(message){host.querySelector('[data-lex-status]').textContent=message||ranked(data,state).length+' / '+models.length+' models · '+metric().label+' · '+(state.direction==='desc'?'highest first':'lowest first');}
    function selectionCount(){host.querySelector('[data-lex-selection-count]').textContent=selected.size;}
    function toggleModel(name,checked){
      if(checked&&selected.size>=4&&!selected.has(name)){status('Select up to four models for a readable comparison.');return false;}
      if(checked)selected.add(name);else selected.delete(name);
      selectionCount();renderPicks();renderPlot();status();return true;
    }
    function rowHTML(row,rank){
      var isHuman=Boolean(row.human),color=data.chartPalette.families[row.family];
      return '<tr class="'+(isHuman?'lex-human':'')+'"><td class="lex-choose">'+(isHuman?'<span title="Human reference">—</span>':'<input type="checkbox" data-lex-model="'+esc(row.name)+'" '+(selected.has(row.name)?'checked':'')+' aria-label="Compare '+esc(row.name)+'">')+'</td><td class="lex-rank">'+(isHuman?'Ref.':'<span class="lex-rank-badge '+(rank<=3?'lex-top-'+rank:'')+'">'+rank+'</span>')+'</td><th scope="row"><span class="lex-model-name"><i style="background:'+color+'"></i>'+esc(row.name)+'</span><small>'+esc(families[row.family])+'</small></th>'+metricColumns.map(function(c){var s=value(row,c.key),best=!isHuman&&s===Math.max.apply(null,models.map(function(r){return value(r,c.key);}));return '<td class="'+(c.key===state.metric?'lex-active-score ':'')+(best?'lex-best':'')+'">'+s.toFixed(1)+'</td>';}).join('')+'</tr>';
    }
    function renderTable(){
      var items=ranked(data,state),old=tableHost.querySelector('.lex-scroll'),scroll=old?old.scrollLeft:0;
      tableHost.innerHTML='<div class="lex-scroll" role="region" tabindex="0" aria-label="Model success rates; scroll horizontally on smaller screens"><table><caption class="lex-sr-only">OS-Omni v1 model success rates, Camera Ready Table 1</caption><thead><tr><th class="lex-choose" scope="col"><span class="lex-sr-only">Compare</span></th><th class="lex-rank" scope="col">Rank</th><th scope="col" class="lex-name-heading">Model</th>'+metricColumns.map(function(c){return '<th scope="col" class="'+(c.key===state.metric?'lex-active-score':'')+'" aria-sort="'+(c.key===state.metric?(state.direction==='desc'?'descending':'ascending'):'none')+'"><button type="button" data-lex-sort="'+c.key+'">'+esc(c.label)+' <span aria-hidden="true">'+(c.key===state.metric?(state.direction==='desc'?'↓':'↑'):'↕')+'</span></button></th>';}).join('')+'</tr></thead><tbody>'+items.map(function(item){return rowHTML(item.row,item.rank);}).join('')+(items.length?'':'<tr><td colspan="11" class="lex-empty">No models match these filters. Try another name or reset the filters.</td></tr>')+'</tbody>'+(state.human&&human?'<tbody class="lex-reference-body">'+rowHTML(human,null)+'</tbody>':'')+'</table></div>';
      tableHost.querySelector('.lex-scroll').scrollLeft=scroll;
      tableHost.querySelectorAll('[data-lex-sort]').forEach(function(b){b.onclick=function(){var key=b.dataset.lexSort;state.direction=state.metric===key&&state.direction==='desc'?'asc':'desc';state.metric=key;update();};});
      tableHost.querySelectorAll('[data-lex-model]').forEach(function(b){b.onchange=function(){if(!toggleModel(b.dataset.lexModel,b.checked))b.checked=!b.checked;};});
    }
    function renderPicks(){
      host.querySelector('.lex-model-picks').innerHTML=models.map(function(r){return '<button type="button" data-lex-pick="'+esc(r.name)+'" aria-pressed="'+selected.has(r.name)+'"><i style="background:'+plotColor(r)+'"></i>'+esc(r.name)+'</button>';}).join('');
      host.querySelectorAll('[data-lex-pick]').forEach(function(b){b.onclick=function(){toggleModel(b.dataset.lexPick,!selected.has(b.dataset.lexPick));renderTable();};});
    }
    function renderPlot(){
      var chosen=models.filter(function(r){return selected.has(r.name);}),rows=chosen.concat(state.human&&human?[human]:[]),plot=host.querySelector('.lex-plot-host');
      if(!chosen.length){plot.innerHTML='<p class="lex-empty">Select a model above or use the checkboxes in the leaderboard.</p>';host.querySelector('.lex-plot-legend').innerHTML='';return;}
      var w=940,h=310,left=45,right=30,top=22,bottom=55,dx=(w-left-right)/(data.tracks.length-1),height=h-top-bottom;
      var x=function(i){return left+i*dx;},y=function(n){return top+(100-n)/100*height;};
      var svg='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Published task success rates across seven evaluation groups. Exact values are available in the leaderboard.">';
      [0,25,50,75,100].forEach(function(n){svg+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y(n)+'" y2="'+y(n)+'" class="lex-grid-line"/><text x="'+(left-12)+'" y="'+(y(n)+4)+'" text-anchor="end" class="lex-axis">'+n+'</text>';});
      data.tracks.forEach(function(t,i){svg+='<text x="'+x(i)+'" y="'+(h-20)+'" text-anchor="middle" class="lex-axis">'+esc(t.label)+'</text>';});
      rows.forEach(function(r){var color=plotColor(r);svg+='<polyline fill="none" stroke="'+color+'" stroke-width="2.7" '+(r.human?'stroke-dasharray="6 5" ':'')+'points="'+r.scores.map(function(n,i){return x(i)+','+y(n);}).join(' ')+'"/>';r.scores.forEach(function(n,i){svg+='<circle cx="'+x(i)+'" cy="'+y(n)+'" r="4.5" fill="'+color+'" tabindex="0" aria-label="'+esc(r.name+', '+data.tracks[i].label+': '+n.toFixed(1)+'%')+'"><title>'+esc(r.name+' / '+data.tracks[i].label+' / '+n.toFixed(1)+'%')+'</title></circle>';});});
      plot.innerHTML=svg+'</svg>';
      host.querySelector('.lex-plot-legend').innerHTML=rows.map(function(r){return '<span><i style="background:'+plotColor(r)+'"></i>'+esc(r.name)+(r.human?' (reference)':'')+'</span>';}).join('');
    }
    function update(){
      host.querySelectorAll('[data-lex-metric]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.lexMetric===state.metric));});
      host.querySelectorAll('[data-lex-view]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.lexView===state.view));});
      tableHost.hidden=state.view!=='table';compareHost.hidden=state.view!=='compare';
      renderTable();renderPicks();renderPlot();selectionCount();status();
    }
    host.querySelectorAll('[data-lex-metric]').forEach(function(b){b.onclick=function(){state.metric=b.dataset.lexMetric;state.direction='desc';update();};});
    host.querySelectorAll('[data-lex-view]').forEach(function(b){b.onclick=function(){state.view=b.dataset.lexView;update();};});
    host.querySelector('[data-lex-search]').oninput=function(e){state.query=e.target.value;renderTable();status();};
    host.querySelector('[data-lex-family]').onchange=function(e){state.family=e.target.value;update();};
    host.querySelector('[data-lex-human]').onchange=function(e){state.human=e.target.checked;update();};
    host.querySelector('[data-lex-reset]').onclick=function(){state.metric='average';state.direction='desc';state.query='';state.family='all';state.human=true;host.querySelector('[data-lex-search]').value='';host.querySelector('[data-lex-family]').value='all';host.querySelector('[data-lex-human]').checked=true;update();};
    host.querySelector('[data-lex-download]').onclick=function(){var blob=new Blob(['\ufeff'+csv(data,state)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='os-omni-v1-'+metric().label.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv';document.body.appendChild(a);a.click();a.remove();global.setTimeout(function(){URL.revokeObjectURL(url);},1000);};
    update();global.OSOmniBoot?.ready('leaderboard');
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  }
})(typeof window!=='undefined'?window:globalThis);
