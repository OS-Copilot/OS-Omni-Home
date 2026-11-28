/* Fictional, browser-only example content. Existing records always win. */
(function(global){
 'use strict';
 var script=document.currentScript,base=new URL(script.src.includes('/public/playground/apps/')?'../../../':'../../',script.src),id=new URLSearchParams(location.search).get('app'),device=global.OSOmniDevice||{};
 function asset(path){return new URL(path,base).href;}
 function read(key,fallback){try{var value=JSON.parse(localStorage.getItem(key));return value===null?fallback:value;}catch(_){return fallback;}}
 function date(offset,hour){var d=new Date();d.setDate(d.getDate()+offset);d.setHours(hour===undefined?10:hour,0,0,0);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
 function array(key,examples){var marker='demo-content.v1.'+key;if(localStorage.getItem(marker))return;var rows=read(key,[]);if(!Array.isArray(rows))return;examples.forEach(function(record){if(!rows.some(function(r){return record.id&&r.id===record.id||record.email&&r.email===record.email;}))rows.push(record);});localStorage.setItem(key,JSON.stringify(rows));localStorage.setItem(marker,'1');}
 function object(key,defaults){if(localStorage.getItem('demo-content.v1.'+key))return;var old=read(key,null);if(old===null||key==='workflow.media'&&Array.isArray(old.tracks)&&old.tracks.length===0)localStorage.setItem(key,JSON.stringify(defaults));localStorage.setItem('demo-content.v1.'+key,'1');}
 var notes=[
  {id:'demo-note-brief',title:'Demo project brief',body:'# Demo project brief\n\nThis is a fictional example for the browser playground.\n\nGoal: prepare a small design review.\nOwner: Maya Chen\n\n1. Review the welcome screen.\n2. Collect feedback from Leo and Amelia.\n3. Write a short summary and share the next steps.',folder:'Demo Projects',modified:Date.now()},
  {id:'demo-note-meeting',title:'Design review notes',body:'Fictional meeting notes\n\nDecisions\n- Keep navigation clear.\n- Add a useful example to each empty workspace.\n\nFollow-up\n- Maya: update the mockup.\n- Leo: check the mobile layout.\n- Amelia: try the save and reopen flow.',folder:'Demo Projects',modified:Date.now()-3600000},
  {id:'demo-note-trip',title:'Weekend checklist',body:'Demo checklist\n\n[ ] Check the museum opening time\n[ ] Bring a notebook\n[ ] Pack a water bottle\n[ ] Meet the fictional group at 10:00',folder:'Personal',modified:Date.now()-7200000}
 ];
 if(id==='notes'){array('system.notes',notes);if(!localStorage.getItem('demo-content.v1.note-folders')){var folders=read('system.notes.folders',[]);['Demo Projects','Personal'].forEach(function(f){if(!folders.includes(f))folders.push(f);});localStorage.setItem('system.notes.folders',JSON.stringify(folders));localStorage.setItem('demo-content.v1.note-folders','1');}}
 if(id==='calendar')array('system.calendar',[
  {id:'demo-event-standup',title:'Demo team catch-up',start:date(0,10),end:date(0,11),location:'Demo meeting room',notes:'Fictional event. Review the project brief and agree on next steps.'},
  {id:'demo-event-review',title:'Design review with Maya',start:date(1,14),end:date(1,15),location:'Demo studio',notes:'Review the example welcome screen and mobile layout.'},
  {id:'demo-event-focus',title:'Focus time: draft the summary',start:date(2,9),end:date(2,10),location:'Desk',notes:'Turn the fictional review notes into a short summary.'},
  {id:'demo-event-weekend',title:'Demo museum visit',start:date(3,10),end:date(3,12),location:'Example Science Museum',notes:'Fictional weekend plan with the demo group.'}
 ]);
 if(id==='contacts')array('system.contacts',[
  {id:'contact-maya',name:'Maya Chen',email:'maya@example.test',phone:'+1 202-555-0101',notes:'Fictional design teammate'},
  {id:'contact-alex',name:'Alex Rivera',email:'alex@example.test',phone:'+1 202-555-0102',notes:'Fictional project coordinator'},
  {id:'demo-contact-leo',name:'Leo Rivera',email:'leo@example.test',phone:'+1 202-555-0103',notes:'Fictional engineering teammate'},
  {id:'demo-contact-amelia',name:'Amelia Brooks',email:'amelia@example.test',phone:'+1 202-555-0104',notes:'Fictional QA teammate'},
  {id:'demo-contact-noah',name:'Noah Patel',email:'noah@example.test',phone:'+1 202-555-0105',notes:'Fictional museum group contact'},
  {id:'demo-contact-sofia',name:'Sofia Martinez',email:'sofia@example.test',phone:'+1 202-555-0106',notes:'Fictional research teammate'}
 ]);
 if(id==='reminders')array('system.reminders',[
  {id:'demo-task-review',title:'Review the example project brief',due:date(0).slice(0,10),notes:'Read the fictional design notes before the demo meeting.',done:false},
  {id:'demo-task-contact',title:'Add a fictional teammate',due:date(1).slice(0,10),notes:'Try creating a contact and searching for their name.',done:false},
  {id:'demo-task-summary',title:'Write the review summary',due:date(2).slice(0,10),notes:'Keep the decisions and follow-up actions in one note.',done:false},
  {id:'demo-task-done',title:'Prepare the demo checklist',due:date(-1).slice(0,10),notes:'Example of a completed task.',done:true}
 ]);
 if(id==='habits')array('system.habits',[
  {id:'demo-habit-read',name:'Read for 15 minutes',days:[-6,-5,-3,-1].map(function(n){return date(n).slice(0,10);})},
  {id:'demo-habit-walk',name:'Take a short walk',days:[-5,-4,-2].map(function(n){return date(n).slice(0,10);})},
  {id:'demo-habit-note',name:'Write a daily note',days:[-3,-2,-1].map(function(n){return date(n).slice(0,10);})}
 ]);
 if(id==='gallery'){array('system.gallery',[
  {id:'demo-photo-landscape',name:'Sample desktop landscape',url:asset('static/images/windows-wallpaper.jpg'),album:'Demo Wallpapers'},
  {id:'demo-photo-mountain',name:'Sample mountain wallpaper',url:asset('static/images/macos-wallpaper.jpg'),album:'Demo Wallpapers'},
  {id:'demo-photo-aurora',name:'Sample phone wallpaper',url:asset('static/images/android-wallpaper.png'),album:'Demo Wallpapers'}
 ]);if(!localStorage.getItem('demo-content.v1.gallery-albums')){var albums=read('system.gallery.albums',[]);if(!albums.includes('Demo Wallpapers')){albums.push('Demo Wallpapers');localStorage.setItem('system.gallery.albums',JSON.stringify(albums));}localStorage.setItem('demo-content.v1.gallery-albums','1');}}
 if(id==='drawing')array('system.drawing',[
  {id:'demo-stroke-box',color:'#367ee8',width:5,points:[[250,180],[750,180],[750,450],[250,450],[250,180]]},
  {id:'demo-stroke-roof',color:'#44a28a',width:6,points:[[210,180],[500,70],[790,180]]},
  {id:'demo-stroke-door',color:'#c47a47',width:5,points:[[450,450],[450,320],[550,320],[550,450]]}
 ]);
 if(id==='diagram'){
  var diagram=read('workflow.diagram',null);if(!localStorage.getItem('demo-content.v1.workflow.diagram')){if(!diagram||diagram.nodes&&diagram.nodes.length===0)localStorage.setItem('workflow.diagram',JSON.stringify({nodes:[{id:'demo-plan',text:'Plan',x:70,y:130},{id:'demo-create',text:'Create',x:280,y:130},{id:'demo-review',text:'Review',x:490,y:130},{id:'demo-share',text:'Share',x:700,y:130}],edges:[['demo-plan','demo-create'],['demo-create','demo-review'],['demo-review','demo-share']]}));localStorage.setItem('demo-content.v1.workflow.diagram','1');}
 }
 if(id==='chat'&&!/delta\s*chat/i.test(new URLSearchParams(location.search).get('title')||'')&&device.app!=='deltachat')array('workflow.chat',[
  {id:'demo-message-maya',name:'Maya Chen',email:'maya@example.test',archived:false,messages:[{text:'Hi! Shall we review the demo project tomorrow?',time:Date.now()-7200000,incoming:true},{text:'Yes, 10:00 works for me.',time:Date.now()-7000000,incoming:false}]},
  {id:'demo-message-leo',name:'Leo Rivera',email:'leo@example.test',archived:false,messages:[{text:'The fictional project checklist is ready.',time:Date.now()-3600000,incoming:true}]},
  {id:'demo-message-team',name:'Demo Team',email:'team@example.test',archived:false,messages:[{text:'Welcome to the fictional demo group.',time:Date.now()-1800000,incoming:true}]}
 ]);
 if(id==='browser'){
  var browser=read('workflow.browser',{bookmarks:[]});if(!localStorage.getItem('demo-content.v1.workflow.browser')){[asset('public/demo/start.html'),asset('public/demo/design-notes.html')].forEach(function(u){if(!browser.bookmarks.includes(u))browser.bookmarks.push(u);});if(!browser.home)browser.home=asset('public/demo/start.html');localStorage.setItem('workflow.browser',JSON.stringify(browser));localStorage.setItem('demo-content.v1.workflow.browser','1');}
 }
 if(id==='media')object('workflow.media',{tracks:[{name:'Demo chime',url:asset('public/demo/chime.wav'),demo:true},{name:'Demo melody',url:asset('public/demo/melody.wav'),demo:true}],current:0});
 if(['news','health','wallet','fitness','watch','shortcuts'].includes(id)){
  var ios={news:[['Demo notebook: a small design review','Fictional demo newsroom','The demo team collected feedback on navigation and prepared a short project summary.'],['Weekend ideas from the demo group','Fictional community notes','A sample plan for a museum visit and a shared checklist.']],health:[['Steps','6400','steps',date(-1).slice(0,10)],['Sleep','7.5','hours',date(-1).slice(0,10)]],wallet:[['Demo museum pass','Fictional Science Museum','DEMO-NOT-VALID',date(7).slice(0,10)],['Demo workshop ticket','Example Studio','SAMPLE-ONLY',date(14).slice(0,10)]],fitness:[['Walking','25','95',date(-1).slice(0,10)],['Cycling','30','160',date(-2).slice(0,10)]],watch:[['Demo watch','Modular','On']],shortcuts:[['Welcome message','Show message','Hello from your fictional demo workspace.'],['Five-second timer','Start timer','5']]};array('records',ios[id].map(function(values,i){return{id:'demo-'+id+'-'+i,values:values};}));
 }
 var filesPromise;
 function seedFiles(){
  if(filesPromise)return filesPromise;
  filesPromise=new Promise(function(resolve,reject){var request=indexedDB.open('osomni.browser.files.v2',1);request.onupgradeneeded=function(){request.result.createObjectStore('files',{keyPath:'id'});};request.onerror=function(){reject(request.error);};request.onsuccess=function(){var db=request.result,tx=db.transaction('files','readwrite'),store=tx.objectStore('files'),prefix='demo-'+device.platform+'-',folder=prefix+'documents';var files=[{id:folder,name:'Demo Documents',type:'folder',parent:null},{id:prefix+'readme',name:'Demo Readme.txt',parent:null,blob:new Blob(['Fictional browser workspace. Open Demo Documents for an example brief and checklist.'],{type:'text/plain'})},{id:prefix+'brief',name:'Project brief.md',parent:folder,blob:new Blob([notes[0].body],{type:'text/markdown'})},{id:prefix+'checklist',name:'Review checklist.csv',parent:folder,blob:new Blob(['Task,Owner,Status\nDesign review,Maya,Planned\nMobile check,Leo,In progress\nSummary,Amelia,Done\n'],{type:'text/csv'})}];var marker=store.get(prefix+'seed-marker');marker.onsuccess=function(){if(marker.result)return;files.forEach(function(file){file.platform=device.platform;file.modified=Date.now();var req=store.get(file.id);req.onsuccess=function(){if(!req.result)store.add(file);};});store.add({id:prefix+'seed-marker',platform:device.platform,type:'demo-marker'});};tx.oncomplete=function(){db.close();resolve();};tx.onerror=function(){db.close();reject(tx.error);};};});return filesPromise;
 }
 global.OSOmniDemo={asset:asset,seedFiles:seedFiles};
})(window);
