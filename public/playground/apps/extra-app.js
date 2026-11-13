(function () {
  "use strict";
  var id = new URLSearchParams(location.search).get("app");
  if (!["habits", "drawing", "gallery", "imageviewer"].includes(id)) return;
  document.body.dataset.platform = window.OSOmniDevice.platform;
  var root = document.getElementById("system-app"), key = "system." + id;
  var data = JSON.parse(localStorage.getItem(key) || "[]");
  function save() { localStorage.setItem(key, JSON.stringify(data)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  root.innerHTML = '<header><h1>' + esc(new URLSearchParams(location.search).get("title") || {habits:"Habits",drawing:"Drawing",gallery:"Gallery",imageviewer:"Image Viewer"}[id]) + '</h1></header><main id="extra-content"></main>';
  var content = document.getElementById("extra-content");
  if (id === "habits") {
    var today = new Intl.DateTimeFormat("en-CA",{timeZone:window.OSOmniDevice.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    function render() {
      content.innerHTML = '<form><input name="habit" placeholder="New daily habit" required maxlength="100"><button>Add habit</button></form><p>Today: ' + today + '</p>' + data.map(function(h,i) {
        return '<div class="card" style="padding:16px;margin:10px 0"><label><input type="checkbox" data-check="' + i + '" ' + (h.days.includes(today)?'checked':'') + '> ' + esc(h.name) + '</label><p>' + h.days.length + ' days completed</p><button data-edit="' + i + '">Edit habit</button><button data-delete="' + i + '">Delete</button><div data-habit-history>' + Array.from({length:14},function(_,offset){var d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-13+offset);var day=d.toISOString().slice(0,10);return '<button type="button" data-history="'+i+'" data-day="'+day+'" aria-label="Toggle '+esc(h.name)+' on '+day+'" aria-pressed="'+h.days.includes(day)+'">'+day.slice(5)+'</button>';}).join('')+'</div></div>';
      }).join("");
      content.querySelector("form").onsubmit = function(e) { e.preventDefault(); data.push({name:this.habit.value,days:[]}); save(); render(); };
      content.querySelectorAll("[data-check]").forEach(function(b) { b.onchange=function(){ var h=data[+b.dataset.check]; h.days=h.days.filter(function(d){return d!==today;}); if(b.checked) h.days.push(today); save();render();}; });
      content.querySelectorAll('[data-edit]').forEach(function(b){b.onclick=function(){var h=data[+b.dataset.edit],name=prompt('Habit name',h.name);if(name&&name.trim()){h.name=name.trim();save();render();}};});
      content.querySelectorAll('[data-history]').forEach(function(b){b.onclick=function(){var h=data[+b.dataset.history],day=b.dataset.day;h.days=h.days.includes(day)?h.days.filter(function(d){return d!==day;}):h.days.concat(day);save();render();};});
      content.querySelectorAll("[data-delete]").forEach(function(b){b.onclick=function(){data.splice(+b.dataset.delete,1);save();render();};});
    } render();
  }
  if (id === "gallery") {
    var albums=JSON.parse(localStorage.getItem("system.gallery.albums")||"[]"),album="*";
    content.innerHTML='<div class="toolbar"><label>Import photos <input type="file" accept="image/*" multiple></label><button id="new-album">New album</button><select id="album-filter" aria-label="Album"></select></div><p id="gallery-status"></p><div id="photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px"></div><dialog id="photo-preview"><button id="close-preview">Close</button><img alt="Preview" style="max-width:100%;max-height:75vh;object-fit:contain"></dialog>';
    function render() {
      var area=document.getElementById("photos"),select=document.getElementById("album-filter");
      select.innerHTML='<option value="*">All photos</option><option value="">Unsorted</option>'+albums.map(function(a){return '<option value="'+esc(a)+'">'+esc(a)+'</option>';}).join('');select.value=album;
      area.innerHTML=data.map(function(p,i){return '<figure data-album="'+esc(p.album||'')+'" style="margin:0"><button data-preview="'+i+'" style="padding:0;width:100%"><img src="'+p.url+'" alt="'+esc(p.name)+'" style="width:100%;height:150px;object-fit:cover"></button><figcaption>'+esc(p.name)+'</figcaption><a href="'+p.url+'" download="'+esc(p.name)+'">Download</a><button data-rename="'+i+'">Rename</button><button data-album-move="'+i+'">Move</button><button data-delete="'+i+'">Delete</button></figure>';}).join('');
      area.querySelectorAll('figure').forEach(function(f){f.hidden=album!=="*"&&f.dataset.album!==album;});
      area.querySelectorAll('[data-delete]').forEach(function(b){b.onclick=function(){data.splice(+b.dataset.delete,1);save();render();};});
      area.querySelectorAll('[data-rename]').forEach(function(b){b.onclick=function(){var p=data[+b.dataset.rename],name=prompt('Photo name',p.name);if(name&&name.trim()){p.name=name.trim();save();render();}};});
      area.querySelectorAll('[data-album-move]').forEach(function(b){b.onclick=function(){var name=prompt('Album name (empty for Unsorted)');if(name===null)return;if(name.trim()&&!albums.includes(name.trim())){albums.push(name.trim());localStorage.setItem('system.gallery.albums',JSON.stringify(albums));}data[+b.dataset.albumMove].album=name.trim();save();render();};});
      area.querySelectorAll('[data-preview]').forEach(function(b){b.onclick=function(){var d=document.getElementById('photo-preview');d.querySelector('img').src=data[+b.dataset.preview].url;d.showModal();};});
    }
    document.getElementById('new-album').onclick=function(){var name=prompt('Album name');if(name&&name.trim()&&!albums.includes(name.trim())){albums.push(name.trim());localStorage.setItem('system.gallery.albums',JSON.stringify(albums));album=name.trim();render();}};
    document.getElementById('album-filter').onchange=function(){album=this.value;render();};document.getElementById('close-preview').onclick=function(){document.getElementById('photo-preview').close();};
    content.querySelector('input[type=file]').onchange=async function(){for(var file of this.files){if(!file.type.startsWith("image/"))continue;var url=await new Promise(function(resolve){var r=new FileReader();r.onload=function(){resolve(r.result);};r.readAsDataURL(file);});data.push({name:file.name,url:url,album:album==='*'?'':album});try{save();}catch(e){data.pop();document.getElementById("gallery-status").textContent="Browser storage is full. Delete photos to make room.";break;}}render();};render();
  }
  if(id === "imageviewer") {
    content.innerHTML='<div class="toolbar"><label>Open image <input type="file" accept="image/*"></label><button id="zoom-in">Zoom in</button><button id="zoom-out">Zoom out</button><button id="fit-image">Fit</button><button id="rotate-image">Rotate</button><button id="save-image">Save copy</button></div><p id="image-info">Open an image to view it.</p><div style="height:calc(100vh - 210px);overflow:auto;display:grid;place-items:center;background:#27292e"><img id="viewer-image" alt="" style="max-width:100%;max-height:100%;object-fit:contain"></div>';
    var img=document.getElementById('viewer-image'),scale=1,angle=0,objectURL=null;
    function display(){img.style.transform='scale('+scale+') rotate('+angle+'deg)';}
    content.querySelector('input').onchange=function(){if(!this.files[0])return;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(this.files[0]);img.src=objectURL;img.alt=this.files[0].name;scale=1;angle=0;display();};
    img.onload=function(){document.getElementById('image-info').textContent=img.alt+' ? '+img.naturalWidth+' ? '+img.naturalHeight;};
    document.getElementById('zoom-in').onclick=function(){scale=Math.min(8,scale*1.25);display();};document.getElementById('zoom-out').onclick=function(){scale=Math.max(.1,scale/1.25);display();};document.getElementById('fit-image').onclick=function(){scale=1;display();};document.getElementById('rotate-image').onclick=function(){angle=(angle+90)%360;display();};
    document.getElementById('save-image').onclick=function(){if(!img.naturalWidth)return;var c=document.createElement('canvas');c.width=angle%180?img.naturalHeight:img.naturalWidth;c.height=angle%180?img.naturalWidth:img.naturalHeight;var ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);c.toBlob(function(blob){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=img.alt.replace(/\.[^.]+$/,'')+'-edited.png';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},5000);});};
  }
  if (id === "drawing") {
    content.innerHTML='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:15px"><input type="color" value="#273c65" aria-label="Pen color"><input type="range" min="1" max="30" value="4" aria-label="Pen width"><button id="undo">Undo</button><button id="clear">Clear</button><button id="export">Export PNG</button></div><canvas width="1000" height="650" style="background:white;width:100%;border:1px solid #ccd5df;touch-action:none"></canvas>';
    var canvas=content.querySelector("canvas"),ctx=canvas.getContext("2d"),stroke=null;
    function render(){ctx.fillStyle="white";ctx.fillRect(0,0,1000,650);data.forEach(function(s){ctx.strokeStyle=s.color;ctx.lineWidth=s.width;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();s.points.forEach(function(p,i){if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.stroke();});}
    function point(e){var r=canvas.getBoundingClientRect();return[(e.clientX-r.left)*1000/r.width,(e.clientY-r.top)*650/r.height];}
    canvas.onpointerdown=function(e){stroke={color:content.querySelector('[type=color]').value,width:+content.querySelector('[type=range]').value,points:[point(e)]};data.push(stroke);canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=function(e){if(stroke){stroke.points.push(point(e));render();}};
    canvas.onpointerup=canvas.onpointercancel=function(){stroke=null;save();};
    document.getElementById("undo").onclick=function(){data.pop();save();render();};document.getElementById("clear").onclick=function(){data=[];save();render();};
    document.getElementById("export").onclick=function(){canvas.toBlob(function(blob){var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="drawing.png";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},5000);});};render();
  }
})();
