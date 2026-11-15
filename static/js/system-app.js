(function () {
  "use strict";
  var id = new URLSearchParams(location.search).get("app") || "notes";
  if (["habits", "drawing", "gallery", "chat", "media", "browser", "pdf", "diagram", "terminal", "imageviewer"].includes(id)) return;
  var device = window.OSOmniDevice || { platform: "windows" };
  document.body.dataset.platform = device.platform; document.body.dataset.app = id;
  if (id === "notes" && ((device.platform === "linux" && device.app === "notes") || (device.platform === "windows" && device.app === "notepad"))) {window.OSOmniTextEditor(document.getElementById("system-app"));return;}
  var names = { calendar: "Calendar", contacts: "Contacts", reminders: "Reminders", notes: "Notes", files: "Files", calculator: "Calculator", clock: "Clock", settings: "Settings" };
  if (new URLSearchParams(location.search).get("title")) names[id] = new URLSearchParams(location.search).get("title");
  var root = document.getElementById("system-app"), query = "", selected = null, clockTimer = null;
  function uid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function escape(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function date(offset) { var d = new Date(); d.setDate(d.getDate() + (offset || 0)); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function oneHourLater() { var d = new Date(Date.now() + 3600000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  var noteFolders = JSON.parse(localStorage.getItem("system.notes.folders") || "[]"), folderFilter = "*";
  var calendarDefaults = null;
  var defaults = {
    calendar: [],
    contacts: [{ id: "contact-maya", name: "Maya Chen", phone: "+1 555 0101", email: "maya@example.test", notes: "Research team" }, { id: "contact-alex", name: "Alex Rivera", phone: "+1 555 0102", email: "alex@example.test", notes: "Project coordination" }],
    reminders: [{ id: "task-welcome", title: "Try a workflow in the playground", due: date(1).slice(0, 10), notes: "Create an event and write a follow-up note.", done: false }],
    notes: [{ id: "note-welcome", title: "Welcome to your device", body: "This is your own browser workspace.\n\nWrite a note, create a calendar event, or explore the applications. Your changes stay in this browser.", modified: Date.now() }],
    calculator: [], clock: { elapsed: 0 }, settings: { theme: "light", accent: "#367ee8", wallpaper: "default" }
  };
  var data;
  try { data = JSON.parse(localStorage.getItem("system." + id)) || structuredClone(defaults[id] || []); }
  catch (_) { data = structuredClone(defaults[id] || []); }
  if (id === "calendar") data = data.filter(function(e){return !(e.id === "welcome-event" && e.title === "Research planning" && e.location === "Meeting room" && e.notes === "Review the next OS-Omni workflow.");});
  function save() { localStorage.setItem("system." + id, JSON.stringify(data)); }
  function status(message) { var target = document.getElementById("status"); if (target) target.textContent = message; }
  function header(extra) { return '<header><div><h1>' + escape(names[id]) + '</h1><p>Your personal browser workspace</p></div>' + (extra || "") + '</header><main id="content"></main><dialog id="edit-dialog"></dialog>'; }
  function button(action, item, label) { return '<button type="button" data-action="' + action + '" data-id="' + escape(item) + '">' + label + '</button>'; }
  function searchToolbar(label) { return '<div class="toolbar"><input id="search" placeholder="Search ' + label.toLowerCase() + '" value="' + escape(query) + '"><button class="primary" type="button" data-action="new">+ ' + label + '</button></div>'; }
  function matching(record) { return JSON.stringify(record).toLowerCase().includes(query.toLowerCase()); }
  function render() {
    clearInterval(clockTimer); root.innerHTML = id === "calendar" && device.platform === "linux" ? '<main id="content"></main><dialog id="edit-dialog"></dialog>' : header(); document.title = names[id];
    var content = document.getElementById("content");
    if (id === "calendar") {
      window.OSOmniCalendar.render(content, data, {render:render,edit:edit,escape:escape,matching:matching,query:function(){return query;},setQuery:function(value){query=value;},newAt:function(start,end){calendarDefaults={start:start,end:end};edit();}});
    } else if (["contacts", "reminders"].includes(id)) {
      var rows = data.filter(matching);
      if (id === "calendar") rows.sort(function (a, b) { return a.start.localeCompare(b.start); });
      content.innerHTML = searchToolbar(id === "calendar" ? "Event" : id === "contacts" ? "Contact" : "Reminder") + '<div class="' + (id === "reminders" ? "" : "cards") + '">' + rows.map(function (item) {
        if (id === "reminders") return '<div class="task ' + (item.done ? "done" : "") + '"><input type="checkbox" data-action="toggle" data-id="' + item.id + '" ' + (item.done ? "checked" : "") + '><div class="text"><div class="title">' + escape(item.title) + '</div><p>' + escape(item.due || "No due date") + '</p></div>' + button("edit", item.id, "Edit") + button("delete", item.id, "Delete") + '</div>';
        var title = item.title || item.name;
        return '<article class="card">' + (id === "calendar" ? '<div class="day">' + escape(new Date(item.start).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })) + '</div>' : '<div class="avatar">' + escape(title[0]) + '</div>') + '<h3>' + escape(title) + '</h3><p>' + escape(id === "calendar" ? new Date(item.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " – " + new Date(item.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : item.phone) + '</p><p>' + escape(item.location || item.email || "") + '</p><p>' + escape(item.notes) + '</p><div class="actions">' + button("edit", item.id, "Edit") + button("delete", item.id, "Delete") + '</div></article>';
      }).join("") + (rows.length ? "" : '<div class="empty">No items here yet.</div>') + '</div><div id="status"></div>';
    } else if (id === "notes") {
      var visibleNotes = data.filter(function(n) { return (folderFilter === "*" || (n.folder || "") === folderFilter) && matching(n); });
      selected = selected && visibleNotes.some(function (n) { return n.id === selected; }) ? selected : visibleNotes[0] && visibleNotes[0].id;
      var note = data.find(function (n) { return n.id === selected; });
      content.innerHTML = '<div class="toolbar"><input id="search" aria-label="Search notes" placeholder="Search notes" value="' + escape(query) + '"><button class="primary" data-action="new">+ New note</button><button data-action="new-folder">New folder</button><select id="folder-filter" aria-label="Folder filter"><option value="*">All notes</option><option value="">Root</option>' + noteFolders.map(function(f){return '<option value="' + escape(f) + '">' + escape(f) + '</option>';}).join("") + '</select>' + (device.app==='fsnotes'?'<button data-action="import-note">Import Markdown</button>'+(folderFilter!=='*'&&folderFilter?'<button data-action="rename-note-folder">Rename folder</button>':''):'') + (note ? (device.app==='fsnotes'?button('archive-note',note.id,'Archive note'):'')+button("delete", note.id, "Delete note") + button("export", note.id, device.app==='fsnotes'?'Export Markdown':'Export text') : "") + '</div><div class="layout"><div class="list">' + visibleNotes.map(function (n) { return '<button data-action="select" data-id="' + n.id + '" class="' + (n.id === selected ? "active" : "") + '">' + escape(n.title || "Untitled") + '</button>'; }).join("") + '</div>' + (note ? '<div class="editor"><input id="note-title" aria-label="Note title" value="' + escape(note.title) + '"><label class="muted" for="note-folder">Folder</label><input id="note-folder" list="note-folders" value="' + escape(note.folder || "") + '"><datalist id="note-folders">' + noteFolders.map(function(f){return '<option value="' + escape(f) + '">';}).join("") + '</datalist><textarea id="note-body" aria-label="Note body">' + escape(note.body) + '</textarea><div class="muted" id="note-saved">Saved automatically</div></div>' : '<div class="empty">'+(query?'No matching notes.':folderFilter!=='*'?'This folder is empty.':'Create your first note.')+'</div>') + '</div>';
    } else if (id === "calculator") {
      content.innerHTML = '<div class="calc"><form id="calculator-form"><input id="expression" aria-label="Expression" placeholder="0" autocomplete="off"><div class="result" id="result">0</div><div class="keypad">' + ["C", "(", ")", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "%", "="].map(function (key) { return '<button type="button" data-key="' + key + '">' + key + '</button>'; }).join("") + '</div></form><div class="history">' + data.slice(-8).reverse().map(function (row) { return '<p>' + escape(row.expression) + ' = ' + escape(row.result) + '</p>'; }).join("") + '</div><div id="status"></div></div>';
    } else if (id === "clock") {
      content.innerHTML = '<div class="card"><div class="clock" id="local-time"></div><div class="muted" style="text-align:center" id="local-date"></div></div><div class="world">' + [["New York", "America/New_York"], ["London", "Europe/London"], ["Tokyo", "Asia/Tokyo"]].map(function (city) { return '<div>' + city[0] + '<span data-zone="' + city[1] + '"></span></div>'; }).join("") + '</div><h3>Stopwatch</h3><div class="clock" id="stopwatch">00:00.0</div><div class="toolbar"><button data-action="stopwatch">Start / pause</button><button data-action="reset-watch">Reset</button></div>';
      clockTimer = setInterval(updateClock, 100); updateClock();
    } else if (id === "settings") {
      content.innerHTML = '<div class="card"><div class="setting-row"><span>Appearance</span><select id="appearance"><option value="light">Light</option><option value="dark">Dark</option></select></div><div class="setting-row"><span>Accent color</span><div class="swatches">' + ["#367ee8", "#5e9b73", "#ac6e9f", "#c47a47"].map(function (color) { return '<button aria-label="Accent ' + color + '" data-color="' + color + '" style="background:' + color + '"></button>'; }).join("") + '</div><div class="setting-row"><span>Wallpaper</span><select id="wallpaper"><option value="default">Platform default</option><option value="aurora">Aurora</option><option value="sunset">Sunset</option></select></div></div><div id="status"></div>';
      document.getElementById("appearance").value = data.theme; document.getElementById("wallpaper").value = data.wallpaper;
    } else if (id === "files") {
      content.innerHTML = '<div class="toolbar"><label><input id="file-import" type="file" multiple hidden><button data-action="import">Import files</button><button data-action="new-file-folder">New folder</button><button data-action="file-up">Up</button></label><input id="file-search" placeholder="Search files"></div><div class="cards" id="file-list"><div class="empty">Loading your files…</div></div><div id="status"></div>';
      renderFiles();
    }
    var search = document.getElementById("search");
    if (search) search.addEventListener("input", function () { var pos = this.selectionStart; query = this.value; render(); var next = document.getElementById("search"); next.focus(); next.setSelectionRange(pos, pos); });
    if (id === "notes" && note) ["note-title", "note-body"].forEach(function (field) { document.getElementById(field).addEventListener("input", function () { note[field === "note-title" ? "title" : "body"] = this.value; note.modified = Date.now(); save();if(field==="note-title"){var listTitle=content.querySelector('[data-action="select"][data-id="'+note.id+'"]');if(listTitle)listTitle.textContent=note.title||"Untitled";} document.getElementById("note-saved").textContent = "Saved just now"; }); });
    if (id === "notes") {
      document.getElementById("folder-filter").value = folderFilter;
      document.getElementById("folder-filter").onchange = function(){folderFilter=this.value;render();};
      if(note) document.getElementById("note-folder").onchange = function(){note.folder=this.value.trim();if(note.folder&&!noteFolders.includes(note.folder)){noteFolders.push(note.folder);localStorage.setItem("system.notes.folders",JSON.stringify(noteFolders));}save();render();};
    }
    if (id === "files") {
      document.getElementById("file-import").addEventListener("change", async function () { for (var f of this.files) await fileDB("put", { id: uid(), platform: device.platform, name: f.name, parent: currentFolder, blob: f, modified: Date.now() }); renderFiles(); });
      document.getElementById("file-search").addEventListener("input", renderFiles);
    }
  }
  function edit(record) {
    var dialog = document.getElementById("edit-dialog"), original = record || (id === "calendar" ? Object.assign({}, window.OSOmniCalendar.defaults(), calendarDefaults || {}) : {}); calendarDefaults = null;
    var fields = id === "calendar" ? [["title", "Title", "text"], ["start", "Start", "datetime-local"], ["end", "End", "datetime-local"], ["location", "Location", "text"], ["notes", "Notes", "textarea"]] : id === "contacts" ? [["name", "Name", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["notes", "Notes", "textarea"]] : [["title", "Title", "text"], ["due", "Due date", "date"], ["notes", "Notes", "textarea"]];
    dialog.innerHTML = '<form id="record-form"><h2>' + (record ? "Edit" : "New") + ' ' + (id === "calendar" ? "event" : id === "contacts" ? "contact" : "reminder") + '</h2>' + fields.map(function (field, index) { var value = original[field[0]] || (field[0] === "start" ? date() : field[0] === "end" ? oneHourLater() : ""); return '<label for="field-' + field[0] + '">' + field[1] + '</label>' + (field[2] === "textarea" ? '<textarea id="field-' + field[0] + '" name="' + field[0] + '">' + escape(value) + '</textarea>' : '<input id="field-' + field[0] + '" name="' + field[0] + '" type="' + field[2] + '" value="' + escape(value) + '" ' + (index === 0 || field[2] === "datetime-local" ? "required" : "") + '>'); }).join("") + (id === "calendar" ? '<label for="event-calendar">Calendar</label><select id="event-calendar" name="calendar">' + window.OSOmniCalendar.options().map(function(c){return '<option value="' + escape(c.name) + '">' + escape(c.name) + '</option>';}).join("") + '</select><label><input id="event-all-day" type="checkbox" ' + (original.allDay ? 'checked' : '') + '> All day</label>' : '') + '<div id="form-error"></div><div class="buttons"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save</button></div></form>';
    if (id === "calendar") document.getElementById("event-calendar").value = original.calendar || "Personal";
    dialog.showModal();
    dialog.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault(); var values = Object.fromEntries(new FormData(this));
      if (id === "calendar") { values.allDay = document.getElementById("event-all-day").checked; if(values.allDay) {values.start=values.start.slice(0,10)+"T00:00"; var dayEnd=new Date(values.start);dayEnd.setDate(dayEnd.getDate()+1);values.end=new Date(dayEnd.getTime()-dayEnd.getTimezoneOffset()*60000).toISOString().slice(0,16);} }
      if (id === "calendar" && values.end <= values.start) { document.getElementById("form-error").textContent = "End must be after start."; return; }
      var next = Object.assign({}, original, values, { id: original.id || uid() });
      if (record) data = data.map(function (item) { return item.id === next.id ? next : item; }); else data.push(next);
      save(); dialog.close(); render();
    });
  }
  function download(blob, name) { var a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 10000); }
  function evaluate(text) {
    var tokens = text.match(/\d*\.?\d+(?:e[+-]?\d+)?|[()+\-*/%]/gi) || [], pos = 0;
    if (tokens.join("") !== text.replace(/\s/g, "")) throw new Error("Use numbers and arithmetic operators.");
    function factor() { var token = tokens[pos++]; if (token === "+") return factor(); if (token === "-") return -factor(); if (token === "(") { var value = expression(); if (tokens[pos++] !== ")") throw new Error("Close the parentheses."); return value; } if (token === undefined || !/^\d*\.?\d/.test(token)) throw new Error("Invalid expression."); return Number(token); }
    function term() { var value = factor(); while (["*", "/", "%"].includes(tokens[pos])) { var op = tokens[pos++], rhs = factor(); value = op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs; } return value; }
    function expression() { var value = term(); while (["+", "-"].includes(tokens[pos])) { var op = tokens[pos++], rhs = term(); value = op === "+" ? value + rhs : value - rhs; } return value; }
    var result = expression(); if (pos !== tokens.length || !Number.isFinite(result)) throw new Error("This calculation has no finite result."); return Number(result.toPrecision(12));
  }
  function calculate() { try { var input = document.getElementById("expression"), value = evaluate(input.value); data.push({ expression: input.value, result: value }); save(); document.getElementById("result").textContent = value; status("Saved to history"); } catch (error) { status(error.message); } }
  var watchStart = null;
  function updateClock() {
    document.getElementById("local-time").textContent = new Date().toLocaleTimeString([], { hour12: false });
    document.getElementById("local-date").textContent = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    document.querySelectorAll("[data-zone]").forEach(function (e) { e.textContent = new Date().toLocaleTimeString([], { timeZone: e.dataset.zone, hour: "2-digit", minute: "2-digit", hour12: false }); });
    var elapsed = data.elapsed + (watchStart ? Date.now() - watchStart : 0); document.getElementById("stopwatch").textContent = String(Math.floor(elapsed / 60000)).padStart(2, "0") + ":" + String(Math.floor(elapsed / 1000) % 60).padStart(2, "0") + "." + Math.floor(elapsed % 1000 / 100);
  }
  async function fileDB(action, record) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open("osomni.browser.files.v2", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("files", { keyPath: "id" }); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () { var db = req.result, tx = db.transaction("files", action === "getAll" ? "readonly" : "readwrite"), store = tx.objectStore("files"), request = store[action](record); request.onsuccess = function () { var result = request.result; tx.oncomplete = function () { db.close(); resolve(result); }; }; request.onerror = function () { reject(request.error); }; };
    });
  }
  var fileRows = [], currentFolder = null;
  async function renderFiles() {
    try {
      fileRows = (await fileDB("getAll")).filter(function (f) { return f.platform === device.platform; });
      var search = document.getElementById("file-search").value.toLowerCase(), folder = fileRows.find(function(f){return f.id===currentFolder;});
      document.getElementById("status").textContent = folder ? "Folder: " + folder.name : "Home ? browser workspace files";
      document.getElementById("file-list").innerHTML = fileRows.filter(function(f){return (f.parent || null) === currentFolder && f.name.toLowerCase().includes(search);}).map(function(f){return '<article class="card"><h3>'+escape(f.name)+'</h3><p>'+(f.type==='folder'?'Folder':(f.blob.size/1024).toFixed(1)+' KB ? '+escape(f.blob.type || 'File'))+'</p><div class="actions">'+(f.type==='folder'?button('open-file-folder',f.id,'Open'):button('download-file',f.id,'Download'))+button('rename-file',f.id,'Rename')+button('move-file',f.id,'Move')+button('delete-file',f.id,'Delete')+'</div></article>';}).join('') || '<div class="empty">No files here. Import a file or create a folder.</div>';
    } catch(e){status("File storage is unavailable in this browser.");}
  }
  function descendants(id){var out=[id];fileRows.forEach(function(f){if(f.parent===id)out=out.concat(descendants(f.id));});return out;}

  root.addEventListener("click", async function (event) {
    var b = event.target.closest("button"); if (!b) return;
    var action = b.dataset.action, record = Array.isArray(data) && data.find(function (item) { return item.id === b.dataset.id; });
    if (action === "new") { if (id === "notes") { var n = { id: uid(), title: "Untitled note", body: "", folder: folderFilter === "*" ? "" : folderFilter, modified: Date.now() }; data.unshift(n); selected = n.id; save(); render(); } else edit(); }
    if (action === "new-folder") { var folder = prompt("Folder name"); if(folder && folder.trim() && !noteFolders.includes(folder.trim())) {noteFolders.push(folder.trim());localStorage.setItem("system.notes.folders",JSON.stringify(noteFolders));render();} }
    if(action==='rename-note-folder') {var nextFolder=prompt('New folder name',folderFilter);if(nextFolder&&nextFolder.trim()&&nextFolder.trim()!==folderFilter&&!noteFolders.includes(nextFolder.trim())){var oldFolder=folderFilter;folderFilter=nextFolder.trim();noteFolders=noteFolders.map(function(f){return f===oldFolder?folderFilter:f;});data.forEach(function(n){if(n.folder===oldFolder)n.folder=folderFilter;});localStorage.setItem('system.notes.folders',JSON.stringify(noteFolders));save();render();}}
    if(action==='archive-note'&&record){record.folder='Archive';record.modified=Date.now();if(!noteFolders.includes('Archive')){noteFolders.push('Archive');localStorage.setItem('system.notes.folders',JSON.stringify(noteFolders));}save();render();}
    if(action==='import-note'){var importNote=document.createElement('input');importNote.type='file';importNote.accept='.md,.markdown,.txt,text/plain,text/markdown';importNote.multiple=true;importNote.onchange=async function(){for(var file of importNote.files){data.unshift({id:uid(),title:file.name.replace(/\.(md|markdown|txt)$/i,''),body:await file.text(),folder:folderFilter==='*'?'':folderFilter,modified:Date.now()});}save();selected=data[0]&&data[0].id;render();};importNote.click();}
    if (action === "edit") edit(record);
    if (action === "delete") { data = data.filter(function (item) { return item.id !== b.dataset.id; }); save(); render(); }
    if (action === "cancel") document.getElementById("edit-dialog").close();
    if (action === "select") { selected = b.dataset.id; render(); }
    if (action === "export" && record) download(new Blob([record.body], { type: "text/plain" }), record.title + (device.app==='fsnotes'?'.md':'.txt'));
    if (action === "stopwatch") { if (watchStart) { data.elapsed += Date.now() - watchStart; watchStart = null; save(); } else watchStart = Date.now(); }
    if (action === "reset-watch") { watchStart = null; data.elapsed = 0; save(); }
    if (action === "import") document.getElementById("file-import").click();
    if (action === "download-file") { var file = fileRows.find(function (f) { return f.id === b.dataset.id; }); if (file) download(file.blob, file.name); }
    if (action === "new-file-folder") { var name=prompt("Folder name"); if(name&&name.trim()) {await fileDB("put",{id:uid(),platform:device.platform,name:name.trim(),type:"folder",parent:currentFolder,modified:Date.now()});renderFiles();} }
    if (action === "file-up") { var folder=fileRows.find(function(f){return f.id===currentFolder;});currentFolder=folder&&folder.parent||null;renderFiles(); }
    if (action === "open-file-folder") {currentFolder=b.dataset.id;renderFiles();}
    if (action === "rename-file") {var f=fileRows.find(function(f){return f.id===b.dataset.id;}),name=prompt("New name",f.name);if(name&&name.trim()){f.name=name.trim();f.modified=Date.now();await fileDB("put",f);renderFiles();}}
    if (action === "move-file") {var f=fileRows.find(function(f){return f.id===b.dataset.id;}),name=prompt("Destination folder name (leave empty for Home)");if(name!==null){var dest=name.trim()?fileRows.find(function(d){return d.type==='folder'&&d.name===name.trim();}):null;if(name.trim()&&!dest){status("Folder not found.");return;}if(dest&&descendants(f.id).includes(dest.id)){status("A folder cannot be moved into itself.");return;}f.parent=dest&&dest.id||null;await fileDB("put",f);renderFiles();}}
    if (action === "delete-file") {var ids=descendants(b.dataset.id);if(ids.length>1&&!confirm("Delete this folder and its contents?"))return;for(var idToDelete of ids)await fileDB("delete",idToDelete);renderFiles();}
    if (b.dataset.key) { var input = document.getElementById("expression"), key = b.dataset.key; if (key === "=") calculate(); else if (key === "C") { input.value = ""; document.getElementById("result").textContent = "0"; } else input.value += key; }
    if (b.dataset.color) { data.accent = b.dataset.color; save(); applySettings(); }
  });
  root.addEventListener("change", function (event) {
    if (event.target.dataset.action === "toggle") { var record = data.find(function (r) { return r.id === event.target.dataset.id; }); record.done = event.target.checked; save(); render(); }
    if (id === "settings") { if (event.target.id === "appearance") data.theme = event.target.value; if (event.target.id === "wallpaper") data.wallpaper = event.target.value; save(); applySettings(); }
  });
  root.addEventListener("submit", function (event) { if (event.target.id === "calculator-form") { event.preventDefault(); calculate(); } });
  function applySettings() { parent.postMessage({ type: "osomni:device-settings", settings: data }, location.origin); status("Device appearance updated."); }
  render();
})();
