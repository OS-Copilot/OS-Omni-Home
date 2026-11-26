(function(){
  'use strict';
  function platformIcon(key) {
    var shapes = {
      windows:'<path d="m3 5 8-1v7H3zm10-1 8-1v8h-8zM3 13h8v7l-8-1zm10 0h8v8l-8-1z"/>',
      linux:'<path d="M8 9C7 3 10 1 13 2c4 1 3 5 3 7 4 5 5 10 1 11H7c-4-1-3-6 1-11Z"/><ellipse cx="12" cy="14" rx="4" ry="5" fill="var(--te-icon-cutout,#fff)"/><ellipse cx="10.5" cy="6.5" rx="1" ry="1.5" fill="var(--te-icon-cutout,#fff)"/><ellipse cx="13.5" cy="6.5" rx="1" ry="1.5" fill="var(--te-icon-cutout,#fff)"/><path d="m9 9 3-2 3 2-3 2zM3 19l5-2 2 5H2zm13-2 5 2 1 3h-8z"/>',
      macos:'<rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 2 10 14h5l-1 8M7 7v3m10-3v3M6 15q6 5 12 0" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      android:'<path d="M5 11h14v8H5zm0-2a7 7 0 0 1 14 0Z"/><path d="m8 4-2-3m10 3 2-3M2 11v7m20-7v7M8 19v3m8-3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="6.5" r="1" fill="var(--te-icon-cutout,#fff)"/><circle cx="15" cy="6.5" r="1" fill="var(--te-icon-cutout,#fff)"/>',
      ios:'<path d="M15 5c1-1 2-3 2-4-2 0-4 1-5 4h3Zm5 12c-1 3-3 6-5 6-1 0-2-1-3-1s-2 1-3 1c-3 0-7-7-7-11 0-5 4-7 7-6l3 1 3-1c2-1 5 0 6 2-5 3-4 7-1 9Z" transform="translate(1 0) scale(.92)"/>',
      web:'<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m12 8 8-1M8.5 14l-4-7M14 15l-4 7" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      cross_device:'<rect x="1" y="3" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 19h8m-4-4v4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="16" y="8" width="7" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      all:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>'
    };
    return '<svg class="te-platform-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+(shapes[key]||shapes.all)+'</svg>';
  }
  function appIcon(name, track) {
    var normalized=function(value){return value.toLowerCase().replace(/[^a-z0-9]/g,'');};
    var aliases={opennote:'openrednote',visualstudiocode:'vscode',thunderbirdcalendar:'thunderbird',tasks:'tasks-org'};
    var key=normalized(name), id=aliases[key]||null, catalog=window.OSOmniBrowserApps||[];
    var app=catalog.find(function(item){return id?item.id===id:normalized(item.id)===key||normalized(item.name)===key;});
    var profile=(window.OSOmniDeviceProfiles||{})[track];
    var nativeEntries=profile&&profile.applications||[];
    var nativeEntry=nativeEntries.find(function(item){return normalized(item.name)===key;})||nativeEntries.find(function(item){return item.id===(id||key)||app&&item.id===app.id;});
    var controlled=/^open/.test(key)&&app&&app.icon&&app.icon.indexOf("/controlled/")!==-1;
    var path=controlled?app.icon:nativeEntry&&nativeEntry.icon||app&&app.icon;
    return path?'<img class="te-app-icon" src="'+esc(path)+'" alt="" loading="lazy" width="20" height="20">':'<span class="te-app-initial" aria-hidden="true">'+esc(name.slice(0,1).toUpperCase())+'</span>';
  }
  var esc = function (value) { return String(value).replace(/[&<>"']/g, function (c) {return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  window.OSOmniTaskIcons={app:appIcon,platform:platformIcon};
})();
