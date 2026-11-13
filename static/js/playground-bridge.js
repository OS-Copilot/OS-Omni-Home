/* Applied only to the locally mounted demo apps; upstream sources stay intact. */
(function () {
  "use strict";
  var platform = "windows";
  try { platform = parent.document.getElementById("playground").dataset.platform; } catch (_) {}
  if (!/^(windows|linux|macos|ios|android|web)$/.test(platform)) platform = "windows";
  var prefix = "osomni.demo." + platform + ".";
  var get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
  function scoped(key) { return /^(openshop|opentwitter)\./.test(String(key)) ? prefix + key : key; }
  Storage.prototype.getItem = function (key) { return get.call(this, scoped(key)); };
  Storage.prototype.setItem = function (key, value) { return set.call(this, scoped(key), value); };
  Storage.prototype.removeItem = function (key) { return remove.call(this, scoped(key)); };
  window.openshopUseLocalApi = true;
  window.opentwitterUseLocalApi = true;
  window.addEventListener("error", function () {
    parent.postMessage({ type: "osomni:app-error" }, location.origin);
  });
})();
