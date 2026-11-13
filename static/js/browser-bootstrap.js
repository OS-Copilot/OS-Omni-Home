window.OSOmniBrowserBoot = function () {
  "use strict";
  function update(key, user) {
    var state = JSON.parse(localStorage.getItem(key));
    if (state && !state.session.loggedIn) {
      state.session = { loggedIn: true, user: user };
      localStorage.setItem(key, JSON.stringify(state));
    }
  }
  try {
    if (window.opentwitterLocalApi && window.opentwitterSeed) {
      Promise.resolve(window.opentwitterLocalApi.request("/api/bootstrap")).catch(function () {});
      update("opentwitter.localState.v7", { handle: window.opentwitterSeed.account.username });
    }
    if (window.openbankLocalApi && window.openbankSeed) {
      Promise.resolve(window.openbankLocalApi.request("/api/bootstrap")).catch(function () {});
      update("openbank.localState.v7", window.openbankSeed.customer);
    }
    if (window.OpenNoteLocalApi && window.OPENNOTE_SEED) {
      Promise.resolve(window.OpenNoteLocalApi.request("/api/bootstrap")).catch(function () {});
      update("opennote.localState.v2", { handle: window.OPENNOTE_SEED.account.username });
    }
    if (typeof readLocalState === "function" && (window.openshopSeed || window.opentripSeed || window.OPENSHOP_SEED || window.OPENTRIP_SEED)) {
      var state = readLocalState();
      var seed = window.openshopSeed || window.opentripSeed || window.OPENSHOP_SEED || window.OPENTRIP_SEED;
      var account = seed.benchmarkAccount;
      if (!state.session.loggedIn) {
        state.session = { loggedIn: true, user: { phone: account.phone, name: account.name, id: account.id || "demo" } };
        writeLocalState(state);
      }
    }
  } catch (e) { console.warn("Demo initialization:", e.message); }
};
window.OSOmniBrowserBoot();
// Original OpenNote requires a cover. Make its existing text-cover mode the
// fallback for a text post, and expose validation errors inside a small device.
document.addEventListener('submit',function(event){
  if(event.target.id!=='composer-form')return;
  var toggle=document.getElementById('text-cover-enabled'),file=document.getElementById('note-cover-file'),preview=document.getElementById('cover-preview');
  if(toggle&&!toggle.checked&&(!file||!file.files.length)&&(!preview||!preview.getAttribute('src'))){toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));}
},true);
document.addEventListener('DOMContentLoaded',function(){
  var error=document.getElementById('compose-error');if(!error)return;
  error.setAttribute('role','alert');error.setAttribute('aria-live','polite');
  new MutationObserver(function(){if(error.textContent.trim())error.scrollIntoView({block:'nearest'});}).observe(error,{childList:true,subtree:true,characterData:true});
});
