(function () {
  "use strict";
  var frame = window.frameElement;
  var platform = frame && frame.dataset.platform || "windows";
  var app = frame && frame.dataset.app || new URLSearchParams(location.search).get("app") || "app";
  document.documentElement.dataset.osomniPlatform = platform;
  // The device shell owns Linux window controls. Hide decorative traffic lights
  // from reused web clients, while preserving their application menus.
  if (["linux","windows"].includes(platform)) {
    var chromeStyle = document.createElement('style');
    chromeStyle.textContent = 'html:is([data-osomni-platform="linux"],[data-osomni-platform="windows"]) .window-actions[aria-hidden="true"]{display:none!important}html:is([data-osomni-platform="linux"],[data-osomni-platform="windows"]) .titlebar:has(>.window-actions[aria-hidden="true"]){grid-template-columns:max-content max-content minmax(180px,1fr)!important}html:is([data-osomni-platform="linux"],[data-osomni-platform="windows"]) header.menubar:has(>.window-actions[aria-hidden="true"]){grid-template-columns:max-content minmax(0,1fr)!important}';
    document.head.appendChild(chromeStyle);
  }
  if(platform==='ios'){
    var adapter=document.createElement('script');adapter.src=new URL('ios-app-adapter.js',document.currentScript.src).href;document.head.appendChild(adapter);
  }
  var prefix = "osomni.browser.v2." + platform + "." + app + ".";
  var get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
  var packed = "~osomni.lzw1~";
  function compress(text) {
    if (!text) return text;
    var dict = new Map(), code = 65536, word = "", out = [];
    function emit(w) { var n = w.length === 1 ? w.charCodeAt(0) : dict.get(w); out.push(String.fromCharCode(n & 65535, n >>> 16)); }
    for (var i = 0; i < text.length; i++) { var c = text[i], next = word + c; if (next.length === 1 || dict.has(next)) word = next; else { emit(word); dict.set(next, code++); word = c; } }
    if (word) emit(word);
    var result = packed + out.join(""); return result.length < text.length ? result : text;
  }
  function expand(text) {
    if (!text || !text.startsWith(packed)) return text;
    var dict = new Map(), code = 65536, previous = "", out = [];
    for (var i = packed.length; i < text.length; i += 2) { var n = text.charCodeAt(i) + text.charCodeAt(i + 1) * 65536; var word = n < 65536 ? String.fromCharCode(n) : dict.get(n) || previous + previous[0]; out.push(word); if (previous) dict.set(code++, previous + word[0]); previous = word; }
    return out.join("");
  }
  Storage.prototype.getItem = function (key) { return expand(get.call(this, prefix + key)); };
  Storage.prototype.setItem = function (key, value) {
    if (window.OSOmniDevice && window.OSOmniDevice.suspendPersistence) return;
    value = String(value);
    try { return set.call(this, prefix + key, value); }
    catch (error) {
      if (error.name !== "QuotaExceededError") throw error;
      // Compress our own large JSON records, preserving independent app state.
      for (var i = 0; i < this.length; i++) { var storedKey = this.key(i); if (!storedKey.startsWith("osomni.browser.v2.")) continue; var text = get.call(this, storedKey); if (text && text.length > 50000 && !text.startsWith(packed)) set.call(this, storedKey, compress(text)); }
      return set.call(this, prefix + key, compress(value));
    }
  };
  Storage.prototype.removeItem = function (key) { return remove.call(this, prefix + key); };
  window.OSOmniDevice = { platform: platform, app: app, timezone:frame && frame.dataset.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone };
  if(['android','windows','linux','macos','ios'].includes(platform)){
    var connectedFetch=window.fetch.bind(window);
    window.fetch=function(input,options){var settings=OSOmniDevice.settings;if(['android','ios'].includes(platform)&&settings&&!settings.wifi&&!settings.mobile){var url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(/^https?:$/.test(url.protocol)&&url.origin!==location.origin&&!['localhost','127.0.0.1'].includes(url.hostname))return Promise.reject(new TypeError('Virtual phone is offline'));}return connectedFetch(input,options);};
    function applyDeviceSettings(settings){OSOmniDevice.settings=settings;document.querySelectorAll('audio,video').forEach(function(media){media.volume=settings.volume/100;});}
    window.addEventListener('message',function(event){if(event.source===parent&&event.origin===location.origin&&event.data?.type==='osomni:device-settings')applyDeviceSettings(event.data.settings);});
    new MutationObserver(function(){if(OSOmniDevice.settings)applyDeviceSettings(OSOmniDevice.settings);}).observe(document.documentElement,{childList:true,subtree:true});
    try{if(frame.dataset.deviceSettings)applyDeviceSettings(JSON.parse(frame.dataset.deviceSettings));}catch(_){}
  }
  window.openshopUseLocalApi = window.opentwitterUseLocalApi = window.openbankUseLocalApi = window.opentripUseLocalApi = window.OPENNOTE_USE_LOCAL_API = true;
  var originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (options) { return originalFocus.call(this, Object.assign({}, options, { preventScroll: true })); };
  function notify(type, extra) { parent.postMessage(Object.assign({ type: type, app: app }, extra), location.origin); }
  window.addEventListener("error", function (e) { notify("osomni:browser-error", { message: e.message }); });
  window.addEventListener("unhandledrejection", function (e) { notify("osomni:browser-error", { message: String(e.reason && e.reason.message || e.reason) }); });
  document.addEventListener("DOMContentLoaded", function () { notify("osomni:browser-ready"); });
  document.addEventListener("click", function (event) {
    var a = event.target.closest && event.target.closest("a[download]");
    if (!a || ! /^(blob:|data:)/.test(a.href)) return;
    fetch(a.href).then(function (r) { return r.blob(); }).then(function (blob) { notify("osomni:file-export", { name: a.download || "Export", blob: blob }); }).catch(function () {});
  }, true);
})();
