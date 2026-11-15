(function () {
  "use strict";
  var root = document.getElementById("playground");
  if (!root) return;
  var platforms = [
    ["windows", "Windows", "Windows PC", "⊞"], ["linux", "Linux", "Ubuntu workstation", "◉"],
    ["macos", "macOS", "Mac desktop", "⌘"], ["ios", "iOS", "iPhone", "◌"],
    ["android", "Android", "Android phone", "◇"], ["web", "Web", "Browser", "◎"]
  ];
  var apps = [
    { id: "openshop", name: "OpenShop", mark: "S", color: "#ff8051", note: "Browse products, edit your cart, and place a demo order.", task: "Find a product, choose its options, and add it to your cart." },
    { id: "opentwitter", name: "OpenTwitter", mark: "T", color: "#61afff", note: "Write posts, follow people, and send direct messages.", task: "Open Messages, select a conversation, and send a message." }
  ];
  var active = "windows", current = null, available = false, frame = null;
  root.dataset.platform = active;
  root.innerHTML = '<div class="pg-tabs" role="tablist" aria-label="Choose a platform"></div>' +
    '<div class="pg-layout"><div class="pg-stage"><div class="pg-device"><div class="pg-camera" aria-hidden="true"></div>' +
    '<div class="pg-screen"><div class="pg-status"><span id="pg-clock">9:41</span><span>● ▰</span></div>' +
    '<div class="pg-appbar" hidden><button type="button" class="pg-back">← Desktop</button><span class="pg-app-title"></span></div>' +
    '<div class="pg-desktop"><div class="pg-wallpaper"><span class="pg-os-mark">⊞</span><h3 class="pg-device-name">Windows PC</h3><p>Your next workflow starts here.</p></div>' +
    '<div class="pg-app-grid"></div><div class="pg-desktop-note">Interactive application preview</div></div>' +
    '<div class="pg-app-host" hidden></div><div class="pg-dock"><button type="button" class="pg-home" aria-label="Go to home screen">⊞</button><span>OS-Omni</span><span class="pg-dock-apps"></span></div></div></div><div class="pg-stand" aria-hidden="true"></div></div>' +
    '<aside class="pg-details"><span class="eyebrow">YOUR PLAYGROUND</span><h3 class="pg-side-title">One workflow.<br>Every platform.</h3>' +
    '<p>Choose a device, open an app, and try a workflow yourself.</p><div class="pg-feature"><span>01</span><div><b>Shop with OpenShop</b><p>Search, select options, and build a cart.</p></div></div>' +
    '<div class="pg-feature"><span>02</span><div><b>Connect with OpenTwitter</b><p>Publish a post or send a direct message.</p></div></div>' +
    '<div class="pg-task"><span>TRY THIS</span><p class="pg-task-text">Open an application to start exploring.</p></div>' +
    '<button type="button" class="pg-reset">↻ Reset this device</button><p class="pg-feedback" role="status" aria-live="polite">Connecting to the application preview…</p>' +
    '<small>Platform-styled preview using OS-Omni applications. Native operating systems are not connected in this preview. Each platform keeps its own demo data.</small></aside></div>';
  var desktop = root.querySelector(".pg-desktop"), host = root.querySelector(".pg-app-host"), bar = root.querySelector(".pg-appbar");
  var feedback = root.querySelector(".pg-feedback");
  platforms.forEach(function (p) {
    var b = document.createElement("button"); b.type = "button"; b.role = "tab";
    b.dataset.platform = p[0]; b.textContent = p[1]; b.setAttribute("aria-selected", String(p[0] === active));
    b.tabIndex = p[0] === active ? 0 : -1;
    b.addEventListener("click", function () { select(p[0]); });
    root.querySelector(".pg-tabs").appendChild(b);
  });
  root.querySelector(".pg-tabs").addEventListener("keydown", function (e) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault(); var i = platforms.findIndex(function (p) { return p[0] === active; });
    i = e.key === "Home" ? 0 : e.key === "End" ? platforms.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + platforms.length) % platforms.length;
    select(platforms[i][0]); root.querySelector('.pg-tabs [data-platform="' + active + '"]').focus();
  });
  apps.forEach(function (a) {
    var b = document.createElement("button"); b.type = "button"; b.className = "pg-app-icon";
    b.innerHTML = '<span style="--app-color:' + a.color + '">' + a.mark + '</span><b>' + a.name + '</b>';
    b.title = a.note; b.addEventListener("click", function () { open(a); });
    root.querySelector(".pg-app-grid").appendChild(b);
    var d = document.createElement("button"); d.type = "button"; d.textContent = a.mark; d.title = a.name;
    d.style.background = a.color; d.addEventListener("click", function () { open(a); });
    root.querySelector(".pg-dock-apps").appendChild(d);
  });
  function home() {
    if (frame) frame.remove(); frame = null; current = null;
    desktop.hidden = false; host.hidden = true; bar.hidden = true;
    var task = root.querySelector(".pg-task-text");
    if (task) task.textContent = "Open an application to start exploring.";
  }
  function select(id) {
    home(); active = id; root.dataset.platform = id;
    var p = platforms.find(function (p) { return p[0] === id; });
    root.querySelector(".pg-device-name").textContent = p[2]; root.querySelector(".pg-os-mark").textContent = p[3];
    root.querySelector(".pg-home").textContent = p[3];
    root.querySelectorAll(".pg-tabs button").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.platform === id)); b.tabIndex = b.dataset.platform === id ? 0 : -1;
    });
    feedback.textContent = available ? "Ready. Choose an app to explore." : "Applications are unavailable. Start the local playground server.";
    root.dispatchEvent(new CustomEvent("osomni:platform", { detail: id }));
  }
  function open(a) {
    if (!available) { feedback.textContent = "Start the local playground server to use these applications."; return; }
    home(); current = a; desktop.hidden = true; host.hidden = false; bar.hidden = false;
    root.querySelector(".pg-app-title").textContent = a.name;
    root.querySelector(".pg-task-text").textContent = a.task;
    frame = document.createElement("iframe"); frame.title = a.name + " on " + active;
    frame.src = "demo-apps/" + a.id + "/index.html";
    host.appendChild(frame); feedback.textContent = "Opening " + a.name + "…";
  }
  root.querySelector(".pg-home").addEventListener("click", home);
  root.querySelector(".pg-back").addEventListener("click", home);
  root.querySelector(".pg-reset").addEventListener("click", function () {
    home(); var prefix = "osomni.demo." + active + ".";
    try { Object.keys(localStorage).filter(function (k) { return k.startsWith(prefix); }).forEach(function (k) { localStorage.removeItem(k); });
      feedback.textContent = "This device has been reset. Open an app to start again.";
    } catch (_) { feedback.textContent = "Browser storage is unavailable."; }
  });
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
    if (e.data && e.data.type === "osomni:app-ready") feedback.textContent = current.name + " is ready. Changes are saved on this device.";
    if (e.data && e.data.type === "osomni:app-error") feedback.textContent = "The app encountered an error. Try resetting this device.";
  });
  function clock() { root.querySelector("#pg-clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  clock(); setInterval(clock, 60000);
  fetch("demo-apps/openshop/index.html").then(function (r) { if (!r.ok) throw new Error(); return r.text(); }).then(function (html) {
    available = html.includes("playground-bridge.js"); if (!root.dataset.native) select(active);
  }).catch(function () { if (!root.dataset.native) select(active); });
})();
