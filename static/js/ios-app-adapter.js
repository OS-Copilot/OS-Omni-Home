/* Phone-specific presentation for existing, platform-scoped iOS browser apps. */
(function(){
 if(window.OSOmniDevice?.platform!=='ios')return;
 const frame=window.frameElement,app=window.OSOmniDevice.app,label=frame?.dataset.label||app;
 const script=document.currentScript;const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('ios-app.css',script.src).href;document.head.appendChild(css);
 function start(){
  document.body.dataset.iosApp=app;document.title=label;
  const icon=frame?.dataset.icon?new URL(frame.dataset.icon,parent.location.href).href:null;
  if(['maily','flow'].includes(app)){
   const brand=document.querySelector(app==='maily'?'.brand strong':'.brand-row span');if(brand)brand.textContent=label;
   const brandImg=document.querySelector(app==='maily'?'.brand-logo':'.brand-row img');if(brandImg&&icon)brandImg.src=icon;
   const sidebar=document.querySelector('.sidebar');const bar=document.createElement('header');bar.className='ios-app-bar';bar.innerHTML='<button type="button" class="ios-section-button" aria-label="'+(app==='maily'?'Mailboxes':'Finance sections')+'" aria-expanded="false">☰</button><button type="button" class="ios-reader-back" hidden>‹ Inbox</button><strong></strong><button type="button" class="ios-create-button">'+(app==='maily'?'Compose':'+ Transaction')+'</button>';bar.querySelector('strong').textContent=label;document.body.prepend(bar);
   const menu=bar.querySelector('.ios-section-button');function close(){document.body.classList.remove('ios-sidebar-open');menu.setAttribute('aria-expanded','false');}
   menu.onclick=()=>{const open=document.body.classList.toggle('ios-sidebar-open');menu.setAttribute('aria-expanded',String(open));};bar.querySelector('.ios-create-button').onclick=()=>{close();document.querySelector(app==='maily'?'#compose-button':'#new-transaction-button')?.click();};
   sidebar?.addEventListener('click',event=>{if(event.target.closest('.folder-button,.folder-item,.nav-list button,[data-folder],[data-view],[data-label]'))close();});document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
   if(app==='flow'){
    // Input already refreshes search results. A second refresh on blur destroys the
    // clicked row between pointerdown and pointerup, swallowing its first click.
    document.querySelector('#search-input')?.addEventListener('change',event=>event.stopImmediatePropagation(),true);
    function labelTables(){document.body.dataset.iosFinanceView=document.querySelector('.nav-list button.active')?.dataset.view||'overview';document.querySelectorAll('.workspace table').forEach(table=>{const headers=Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());table.querySelectorAll('tbody tr').forEach(row=>Array.from(row.children).forEach((cell,index)=>{if(cell.colSpan===1)cell.dataset.mobileLabel=headers[index]||'';}));});}
    new MutationObserver(labelTables).observe(document.querySelector('.workspace'),{childList:true,subtree:true});labelTables();
   }
   if(app==='maily'){
    const back=bar.querySelector('.ios-reader-back');document.body.dataset.iosMailPane='list';
    const selection=document.createElement('button');selection.type='button';selection.className='ios-select-button';selection.textContent='Select';selection.setAttribute('aria-pressed','false');bar.querySelector('.ios-create-button').before(selection);selection.onclick=()=>{const editing=document.body.classList.toggle('ios-selecting');selection.textContent=editing?'Done':'Select';selection.setAttribute('aria-pressed',String(editing));};
    document.querySelector('#message-list')?.addEventListener('click',event=>{if(event.target.closest('[data-message-id]')){document.body.dataset.iosMailPane='reader';back.textContent='? '+(document.querySelector('#view-title')?.textContent||'Inbox');back.hidden=false;menu.hidden=true;document.querySelector('.mail-workspace').scrollTop=0;}});
    back.onclick=()=>{document.body.dataset.iosMailPane='list';back.hidden=true;menu.hidden=false;};
    sidebar?.addEventListener('click',event=>{if(event.target.closest('[data-folder]')){document.body.dataset.iosMailPane='list';back.hidden=true;menu.hidden=false;}});
   }
  }
  if(app==='maps'){
   const search=document.querySelector('input[placeholder*="OpenNavigation"]');if(search)search.placeholder='Search Maps';
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
