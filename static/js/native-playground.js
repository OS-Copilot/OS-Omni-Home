(function () {
  "use strict";
  var root = document.getElementById("playground");
  if (!root) return;
  root.dataset.native = "true";
  var inventory = {
    windows: ["LibreOffice Calc / Writer / Impress", "Thunderbird / Calendar", "Delta Chat", "Actual Budget", "QuickShop / OpenShop", "Blender", "GIMP", "draw.io", "Wireshark", "Zotero", "VS Code / Notepad", "Spotube"],
    linux: ["LibreOffice Calc / Writer / Impress", "Thunderbird", "Delta Chat", "Actual Budget", "QuickShop / OpenShop", "Blender", "GIMP", "draw.io", "Marble", "Wireshark", "Zotero", "Notepadqq / VS Code", "Spotube"],
    macos: ["LibreOffice Calc / Writer / Impress", "Thunderbird / Calendar", "Delta Chat", "Actual Budget", "QuickShop / OpenShop", "Spotube", "Blender", "GIMP", "draw.io", "Wireshark", "Zotero", "VSCodium / TextEdit", "Maps / Photos"],
    android: ["K-9 Mail", "Delta Chat", "Fossify Calendar / Contacts", "Tasks.org", "Markor", "LibreOffice", "Material Files", "Fossify Gallery", "Oinkoin", "QuickShop / OpenShop", "Organic Maps", "Spotube", "Calculator / Clock / Settings"],
    ios: ["Calendar", "Reminders", "Contacts", "Delta Chat", "Maily", "FSNotes", "Flow", "Habit", "QuickShop / OpenShop", "Safari"]
  };
  var platform = root.dataset.platform, status = {}, generation = 0, connected = false, serviceMissing = false;
  var image = null, imageUrl = null, timer = null, point = null, pointerStart = null, queue = Promise.resolve(), tapTimer = null, hoverTime = 0, pending = 0;
  var details = root.querySelector(".pg-details");
  function stop() {
    generation++; connected = false; clearTimeout(timer); clearTimeout(tapTimer); timer = null;
    if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = null;
  }
  function render() {
    stop(); platform = root.dataset.platform;
    root.querySelector(".pg-desktop").hidden = true;
    root.querySelector(".pg-appbar").hidden = true;
    root.querySelector(".pg-dock").hidden = true;
    var host = root.querySelector(".pg-app-host"); host.hidden = false;
    host.innerHTML = '<div class="native-display"><div class="native-offline"><span class="native-symbol">' + (platform === "ios" || platform === "android" ? "▯" : "▣") + '</span><h3>Connect a real environment</h3><p>The original desktop, applications, and saved state will appear here.</p><button type="button" class="native-connect">Connect ' + platform + '</button><p class="native-status" role="status" aria-live="polite"></p></div><img class="native-screen" hidden alt="Live device screen" tabindex="0"></div>';
    image = host.querySelector(".native-screen");
    details.innerHTML = '<span class="eyebrow">NATIVE ENVIRONMENT</span><h3>The actual apps.<br>The actual system.</h3><p>Operate the same installed applications used by OS-Omni. This view connects to a running VM or simulator.</p><p class="native-inventory-label">Application families referenced by the paper and tasks</p><ul class="native-app-list"></ul><div class="native-input"><label for="native-text">Type into the focused field</label><textarea id="native-text" rows="2" placeholder="Click a field on the device first"></textarea><button type="button" class="native-send">Send text</button></div><button type="button" class="native-reconnect">Reconnect environment</button><p class="native-feedback" role="status" aria-live="polite"></p><small>Installed apps are supplied by the connected baseline. Screenshot preview; one local device per platform. Environment provisioning and baseline reset are not connected yet.</small>';
    (inventory[platform] || ["Chrome / Edge / Firefox / Safari", "Benchmark-controlled web applications"]).forEach(function (name) {
      var li = document.createElement("li"); li.textContent = name; details.querySelector("ul").appendChild(li);
    });
    var connect = host.querySelector(".native-connect");
    connect.disabled = !status[platform] || !status[platform].configured;
    host.querySelector(".native-status").textContent = connect.disabled ? "No environment configured for this platform." : "Environment configured. Connect to check availability.";
    if (serviceMissing) {
      host.querySelector(".native-status").textContent = "This address does not provide the live environment connection.";
      var link = document.createElement("a"); link.href = "http://127.0.0.1:8900/#playground-section";
      link.textContent = "Open the connected local preview"; link.className = "native-preview-link";
      host.querySelector(".native-offline").appendChild(link);
    }
    connect.addEventListener("click", start);
    details.querySelector(".native-reconnect").disabled = connect.disabled;
    details.querySelector("small").textContent = platform === "linux" && status.linux && status.linux.configured
      ? "This device runs an independent copy of the Linux image. Application changes are saved in that copy."
      : "Connect an environment to use its installed applications.";
    details.querySelector(".native-reconnect").addEventListener("click", start);
    var expand = document.createElement("button"); expand.type = "button"; expand.className = "native-expand"; expand.textContent = "Expand screen";
    details.querySelector(".native-reconnect").after(expand);
    expand.addEventListener("click", function () {
      root.classList.toggle("pg-expanded"); this.textContent = root.classList.contains("pg-expanded") ? "Exit expanded view" : "Expand screen";
    });
    var shortcuts = document.createElement("div"); shortcuts.className = "native-shortcuts";
    [["Save", ["ctrl", "s"]], ["Copy", ["ctrl", "c"]], ["Paste", ["ctrl", "v"]], ["Undo", ["ctrl", "z"]], ["Close window", ["alt", "f4"]]].forEach(function (shortcut) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = shortcut[0];
      b.addEventListener("click", function () { send({ type: "hotkey", keys: shortcut[1] }); }); shortcuts.appendChild(b);
    });
    details.querySelector(".native-input").after(shortcuts);
    details.querySelector(".native-send").disabled = true;
    details.querySelector(".native-send").addEventListener("click", function () {
      var text = details.querySelector("textarea").value;
      if (text) send({ type: "type_text", text: text });
    });
    bindInput();
  }
  function message(text) { var e = details.querySelector(".native-feedback"); if (e) e.textContent = text; }
  async function capture(serial) {
    var response = await fetch("api/native/" + platform + "/screen", { cache: "no-store" });
    if (!response.ok) throw new Error("The environment is unavailable. Check its runtime and host configuration.");
    var blob = await response.blob();
    if (serial !== generation) return;
    var next = URL.createObjectURL(blob), previous = imageUrl;
    image.onload = function () { if (previous) URL.revokeObjectURL(previous); };
    imageUrl = next; image.src = next; image.hidden = false;
    root.querySelector(".native-offline").hidden = true;
  }
  async function tick(serial) {
    if (serial !== generation || !connected) return;
    try { if (!document.hidden) await capture(serial); }
    catch (error) { if (serial === generation) { stop(); message(error.message); } return; }
    if (serial === generation && connected) timer = setTimeout(function () { tick(serial); }, 180);
  }
  async function start() {
    stop(); var serial = generation; message("Connecting…");
    try {
      await capture(serial); if (serial !== generation) return;
      connected = true; details.querySelector(".native-send").disabled = false;
      message("Connected. Click or drag on the screen; focus it to use the keyboard."); tick(serial);
      fetch("api/native/" + platform + "/apps").then(function (r) { return r.json(); }).then(function (data) {
        if (serial !== generation || !data.apps || !data.apps.length) return;
        details.querySelector(".native-inventory-label").textContent = data.apps.length + " installed application launchers";
        var list = details.querySelector(".native-app-list"); list.innerHTML = "";
        data.apps.forEach(function (a) {
          var li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.textContent = a.name;
          b.addEventListener("click", function () { send({ type: "launch_app", app_id: a.id }); }); li.appendChild(b); list.appendChild(li);
        });
      }).catch(function () { message("Connected. Application inventory is unavailable; use the desktop icons."); });
    } catch (error) { if (serial === generation) message(error.message); }
  }
  function coordinates(event) {
    var rect = image.getBoundingClientRect();
    var scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    var x = (event.clientX - rect.left - (rect.width - image.naturalWidth * scale) / 2) / scale;
    var y = (event.clientY - rect.top - (rect.height - image.naturalHeight * scale) / 2) / scale;
    if (x < 0 || y < 0 || x >= image.naturalWidth || y >= image.naturalHeight) return null;
    return [Math.round(x), Math.round(y)];
  }
  function send(action) {
    if (!connected) return;
    if (action.type === "move" && pending) return;
    pending++;
    var selected = platform, serial = generation;
    queue = queue.then(async function () {
      if (serial !== generation) return;
      var response = await fetch("api/native/" + selected + "/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      var result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.error || result.message || "Input was rejected by the environment.");
      if (serial === generation && action.type !== "move") message("Input sent.");
    }).catch(function (error) { if (serial === generation) message(error.message); }).finally(function () { pending--; });
  }
  function bindInput() {
    image.draggable = false;
    image.addEventListener("pointerdown", function (e) { if (e.button !== 0) return; pointerStart = coordinates(e); image.focus(); image.setPointerCapture(e.pointerId); });
    image.addEventListener("pointerup", function (e) {
      point = coordinates(e);
      if (point && pointerStart) {
        var distance = Math.hypot(point[0] - pointerStart[0], point[1] - pointerStart[1]);
        if (distance > 6) send({ type: "drag", from_target: pointerStart, to_target: point });
        else { var target = point; clearTimeout(tapTimer); tapTimer = setTimeout(function () { send({ type: "tap", target: target }); }, 240); }
      }
      pointerStart = null;
    });
    image.addEventListener("pointercancel", function () { pointerStart = null; });
    image.addEventListener("dblclick", function (e) { clearTimeout(tapTimer); var p = coordinates(e); if (p) send({ type: "double_tap", target: p }); });
    image.addEventListener("pointermove", function (e) {
      if (pointerStart || !connected || Date.now() - hoverTime < 180) return;
      var p = coordinates(e); if (p) { hoverTime = Date.now(); send({ type: "move", target: p }); }
    });
    image.addEventListener("contextmenu", function (e) { e.preventDefault(); var p = coordinates(e); if (p) send({ type: "right_click", target: p }); });
    image.addEventListener("wheel", function (e) { e.preventDefault(); var p = coordinates(e); if (p) send({ type: "scroll", target: p, direction: e.deltaY > 0 ? "down" : "up" }); }, { passive: false });
    image.addEventListener("keydown", function (e) {
      if (!connected) return;
      var keys = { Enter: "enter", Escape: "escape", Backspace: "backspace", Delete: "delete", Tab: "tab", " ": "space", ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown", Insert: "insert" };
      if (/^F([1-9]|1[0-2])$/.test(e.key)) keys[e.key] = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if (e.key.length !== 1 && !keys[e.key]) return; e.preventDefault();
        var combo = []; if (e.ctrlKey) combo.push("ctrl"); if (e.metaKey) combo.push("command"); if (e.altKey) combo.push("alt"); if (e.shiftKey) combo.push("shift"); combo.push(keys[e.key] || e.key.toLowerCase()); send({ type: "hotkey", keys: combo });
      } else if (keys[e.key]) { e.preventDefault(); send({ type: "keyboard", action: keys[e.key] }); }
      else if (e.key.length === 1 && !e.isComposing) { e.preventDefault(); send({ type: "type_text", text: e.key }); }
    });
  }
  root.addEventListener("osomni:platform", render);
  render();
  fetch("api/native/status").then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (data) {
    status = data;
    var first = Object.keys(data).find(function (p) { return data[p].configured; });
    if (first) { root.querySelector('.pg-tabs [data-platform="' + first + '"]').click(); start(); }
    else render();
  }).catch(function () { serviceMissing = true; render(); message("Open the connected local preview to operate Linux."); });
})();
