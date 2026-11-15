(function () {
  "use strict";
  var nativeLinux = window.OSOmniDevice.platform === "linux", weekStart = nativeLinux ? 0 : 1;
  function currentDate(){var parts=new Intl.DateTimeFormat("en",{timeZone:window.OSOmniDevice.timezone,year:"numeric",month:"numeric",day:"numeric"}).formatToParts(new Date()),values={};parts.forEach(function(p){values[p.type]=p.value;});return new Date(+values.year,+values.month-1,+values.day);}
  var calendars=JSON.parse(localStorage.getItem("system.calendar.sources")||"null") || [{name:"Personal",readOnly:false},{name:"Birthdays & Anniversaries",readOnly:true}];
  var cursor = currentDate(), selected = key(cursor), view = "month", enabled = new Set(calendars.map(function(c){return c.name;}));
  function key(d) { return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
  function day(s) { var a=s.split("-").map(Number);return new Date(a[0],a[1]-1,a[2]); }
  function shift(d,n) { var r=new Date(d);r.setDate(r.getDate()+n);return r; }
  function overlaps(e,date) { var start=day(date),end=shift(start,1);return e.start<key(end)+"T00:00" && e.end>date+"T00:00"; }
  function color(e) { return e.calendar==="Birthdays & Anniversaries"?"birthdays":e.calendar&&e.calendar!=="Personal"?"work":"personal"; }
  window.OSOmniCalendar = {
    options:function(){return calendars.filter(function(c){return !c.readOnly;});},
    defaults:function(){return {start:selected+"T09:00",end:selected+"T10:00",calendar:"Personal",allDay:false};},
    render:function(content,data,helpers) {
      var esc=helpers.escape;data.forEach(function(e){if(e.calendar&&!calendars.some(function(c){return c.name===e.calendar;})){calendars.push({name:e.calendar,readOnly:false});enabled.add(e.calendar);}});
      var today=key(currentDate()),rows=data.filter(function(e){return enabled.has(e.calendar||"Personal")&&helpers.matching(e);});
      var title=cursor.toLocaleDateString("en", {month:"long",year:"numeric"});
      if(view==="day")title=cursor.toLocaleDateString("en",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
      content.className = nativeLinux ? "calendar-linux-native" : "";
      var html='<div class="calendar-toolbar"><div class="calendar-navigation"><button data-cal-nav="previous" aria-label="Previous period">‹</button><button data-cal-nav="today">Today</button><button data-cal-nav="next" aria-label="Next period">›</button><h2 id="calendar-period">'+esc(title)+'</h2></div><div class="calendar-controls"><button type="button" id="calendar-options">Calendars / Search</button><select id="calendar-view" aria-label="Calendar view"><option value="month">Month</option><option value="year">Year</option>' + (nativeLinux ? '' : '<option value="week">Week</option><option value="day">Day</option><option value="agenda">Agenda</option>') + '</select><button class="primary" data-action="new">+ Event</button></div></div><div class="calendar-layout"><aside class="calendar-sidebar"><h3>Calendars</h3>' + calendars.map(function(c){return '<label><input type="checkbox" data-cal-filter="'+esc(c.name)+'" '+(enabled.has(c.name)?'checked':'')+'> <i class="calendar-dot '+color({calendar:c.name})+'"></i>'+esc(c.name)+'</label>';}).join('') + '<button id="new-calendar">Add calendar</button><label class="calendar-jump">Go to date<input type="date" id="calendar-jump" value="'+selected+'"></label><input id="calendar-search" placeholder="Search events" value="'+esc(helpers.query())+'"><p>'+esc(window.OSOmniDevice.timezone)+'</p></aside><section class="calendar-main">';
      function eventButton(e) {return '<button class="calendar-event '+color(e)+'" data-cal-event="'+esc(e.id)+'" title="'+esc(e.title)+'">'+(e.allDay?'All day ':esc(new Date(e.start).toLocaleTimeString("en",{hour:'2-digit',minute:'2-digit'}))+' ')+esc(e.title)+'</button>';}
      if(nativeLinux){html+='<div class="calendar-native-period"><strong>'+esc(cursor.toLocaleDateString('en',{month:'long'}))+'</strong><strong>'+cursor.getFullYear()+'</strong></div>';}
      if(view==="year"){
        html+='<div class="calendar-year">';
        for(var month=0;month<12;month++){var first=new Date(cursor.getFullYear(),month,1),length=new Date(cursor.getFullYear(),month+1,0).getDate();html+='<section><h3>'+esc(first.toLocaleDateString('en',{month:'long'}))+'</h3><div class="calendar-mini-month">';var offset=(first.getDay()-weekStart+7)%7;for(var j=0;j<offset;j++)html+='<span></span>';for(var j=1;j<=length;j++){var k=key(new Date(cursor.getFullYear(),month,j));html+='<button data-cal-date="'+k+'" class="'+(k===today?'today':'')+'">'+j+'</button>';}html+='</div></section>';}
        html+='</div>';
      }else if(view==="month"){
        var first=new Date(cursor.getFullYear(),cursor.getMonth(),1),start=shift(first,-((first.getDay()-weekStart+7)%7));
        html+='<div class="calendar-weekdays">'+(weekStart===0?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).map(function(s){return '<div>'+s+'</div>';}).join('')+'</div><div class="calendar-month" role="grid" aria-label="Month calendar">';
        var cellCount=Math.ceil(((first.getDay()-weekStart+7)%7+new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate())/7)*7;html=html.replace('class="calendar-month"','class="calendar-month" style="--weeks:'+cellCount/7+'"');
        for(var i=0;i<cellCount;i++){var date=shift(start,i),k=key(date);html+='<div role="gridcell" aria-selected="'+(selected===k)+'" class="calendar-cell '+(date.getMonth()!==cursor.getMonth()?'outside ':'')+(selected===k?'selected':'')+(k===today?' current-day':'')+'"><button class="calendar-date '+(k===today?'today':'')+'" data-cal-date="'+k+'" aria-label="'+esc(date.toLocaleDateString("en",{weekday:'long',year:'numeric',month:'long',day:'numeric'}))+'">'+date.getDate()+'</button>'+rows.filter(function(e){return overlaps(e,k);}).sort(function(a,b){return a.start.localeCompare(b.start);}).map(eventButton).join('')+'</div>';}
        html+='</div>';
      }else if(view==="week"||view==="day"){
        var count=view==="week"?7:1,first=view==="week"?shift(cursor,-((cursor.getDay()+6)%7)):cursor;
        html+='<div class="calendar-schedule-head" style="--days:'+count+'"><span></span>';
        for(var i=0;i<count;i++){var date=shift(first,i);html+='<button data-cal-date="'+key(date)+'">'+esc(date.toLocaleDateString("en",{weekday:'short',day:'numeric',month:'short'}))+'</button>';}
        html+='</div><div class="calendar-all-day-row" style="--days:'+count+'"><span>All day</span>';
        for(var i=0;i<count;i++){var allDayDate=key(shift(first,i));html+='<div>'+rows.filter(function(e){return e.allDay&&overlaps(e,allDayDate);}).map(eventButton).join('')+'</div>';}
        html+='</div><div class="calendar-schedule-scroll"><div class="calendar-schedule" style="--days:'+count+'"><div class="calendar-hours">';for(var h=0;h<24;h++)html+='<span>'+String(h).padStart(2,'0')+':00</span>';html+='</div>';
        for(var i=0;i<count;i++){var date=shift(first,i),k=key(date);html+='<div class="calendar-time-day" aria-label="'+k+'">';for(var h=0;h<24;h++)html+='<button class="calendar-slot" data-cal-slot="'+k+'T'+String(h).padStart(2,'0')+':00" aria-label="Create event '+k+' '+h+':00"></button>';
          rows.filter(function(e){return !e.allDay&&overlaps(e,k);}).forEach(function(e){var startDate=new Date(e.start),endDate=new Date(e.end),begin=startDate<day(k)?0:startDate.getHours()*60+startDate.getMinutes(),finish=endDate>=shift(day(k),1)?1440:endDate.getHours()*60+endDate.getMinutes();html+='<button class="calendar-time-event '+color(e)+'" data-cal-event="'+esc(e.id)+'" style="top:'+(begin*.8)+'px;height:'+Math.max(25,(finish-begin)*.8)+'px">'+esc(e.title)+'<small>'+esc(startDate.toLocaleTimeString("en",{hour:'2-digit',minute:'2-digit'}))+'</small></button>';});html+='</div>';}
        html+='</div></div>';
      }
      var dayRows=(view==="agenda"?rows:rows.filter(function(e){return overlaps(e,selected);})).sort(function(a,b){return a.start.localeCompare(b.start);});
      html+='<section class="calendar-agenda"><h3>'+(view==="agenda"?'All events':esc(day(selected).toLocaleDateString("en",{weekday:'long',month:'long',day:'numeric'})))+'</h3>'+dayRows.map(function(e){return '<article class="card"><h3>'+esc(e.title)+'</h3><p>'+esc(new Date(e.start).toLocaleString())+' – '+esc(new Date(e.end).toLocaleString())+'</p><p>'+esc(e.calendar||'Personal')+(e.allDay?' · All day':'')+'</p><p>'+esc(e.location)+'</p><p>'+esc(e.notes)+'</p><div class="actions"><button data-action="edit" data-id="'+esc(e.id)+'">Edit</button><button data-action="delete" data-id="'+esc(e.id)+'">Delete</button></div></article>';}).join('')+(dayRows.length?'':'<p class="muted">No events scheduled.</p>')+'</section></section></div><div id="status"></div>';
      content.innerHTML=html;document.getElementById('calendar-view').value=view;
      content.querySelectorAll('[data-cal-nav]').forEach(function(b){b.onclick=function(){if(b.dataset.calNav==='today')cursor=currentDate();else if(view==='year'){cursor=new Date(cursor.getFullYear()+(b.dataset.calNav==='next'?1:-1),0,1);}else if(view==='month'){cursor=new Date(cursor.getFullYear(),cursor.getMonth()+(b.dataset.calNav==='next'?1:-1),1);}else cursor=shift(cursor,(b.dataset.calNav==='next'?1:-1)*(view==='week'?7:1));selected=key(cursor);helpers.render();};});
      document.getElementById('calendar-options').onclick=function(){content.classList.toggle('calendar-show-options');};
      document.getElementById('new-calendar').onclick=function(){var name=prompt('Calendar name');if(name&&name.trim()&&!calendars.some(function(c){return c.name===name.trim();})){calendars.push({name:name.trim(),readOnly:false});enabled.add(name.trim());localStorage.setItem('system.calendar.sources',JSON.stringify(calendars));helpers.render();}};
      document.getElementById('calendar-view').onchange=function(){view=this.value;helpers.render();};
      content.querySelectorAll('[data-cal-date]').forEach(function(b){b.onclick=function(){selected=b.dataset.calDate;cursor=day(selected);if(view==='year')view='month';helpers.render();};});
      content.querySelectorAll('[data-cal-event]').forEach(function(b){b.onclick=function(){helpers.edit(data.find(function(e){return e.id===b.dataset.calEvent;}));};});
      content.querySelectorAll('[data-cal-slot]').forEach(function(b){b.onclick=function(){selected=b.dataset.calSlot.slice(0,10);var start=b.dataset.calSlot,end=new Date(new Date(start).getTime()+3600000);helpers.newAt(start,key(end)+'T'+String(end.getHours()).padStart(2,'0')+':'+String(end.getMinutes()).padStart(2,'0'));};});
      content.querySelectorAll('[data-cal-filter]').forEach(function(b){b.onchange=function(){if(this.checked)enabled.add(this.dataset.calFilter);else enabled.delete(this.dataset.calFilter);helpers.render();};});
      document.getElementById('calendar-jump').onchange=function(){if(!this.value)return;selected=this.value;cursor=day(selected);helpers.render();};
      document.getElementById('calendar-search').oninput=function(){var pos=this.selectionStart;helpers.setQuery(this.value);helpers.render();var next=document.getElementById('calendar-search');next.focus();next.setSelectionRange(pos,pos);};
      var scroll=content.querySelector('.calendar-schedule-scroll');if(scroll)scroll.scrollTop=8*48;
    }
  };
})();
