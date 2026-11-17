// Reuse the existing canvas: a companion does not create a second WebGL scene.
export function createCompanion({host,canvas,message,onChange,onPlay}){
  const dock=document.createElement('aside');dock.className='om3d-companion';dock.hidden=true;
  dock.setAttribute('aria-label','OS-Omni companion');
  const toolbar=document.createElement('div');toolbar.className='om3d-companion-tools';
  const home=document.createElement('button');home.type='button';home.title='Back to overview';home.setAttribute('aria-label','Back to overview');
  home.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 11 5-5 5 5M10 6v10"/></svg>';
  const minimize=document.createElement('button');minimize.type='button';minimize.title='Minimize companion';minimize.setAttribute('aria-label','Minimize companion');
  minimize.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10"/></svg>';
  const play=document.createElement('button');play.type='button';play.title='Next robot action';play.setAttribute('aria-label','Play a different robot action');
  play.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h3l8 10h3M13 12l4 3-4 2M3 15h3l3-4M11 7l3-2h3M14 3l3 2-3 2"/></svg>';
  play.addEventListener('click',()=>onPlay?.());
  toolbar.append(home,play,minimize);
  const stage=document.createElement('div');stage.className='om3d-companion-stage';stage.id='om3d-companion-stage';
  const caption=document.createElement('div');caption.className='om3d-companion-caption';caption.innerHTML='<i aria-hidden="true"></i>';
  const context=document.createElement('span');context.textContent='OS-Omni';caption.appendChild(context);let sectionLabel='OS-Omni',actionLabel='';
  const refreshCaption=()=>{context.textContent=actionLabel||sectionLabel;};
  const onExplore=event=>{sectionLabel=event.detail.label;refreshCaption();caption.title='Exploring '+event.detail.label;};
  const onAction=event=>{actionLabel=event.detail.label||'';refreshCaption();};
  document.addEventListener('osomni:explore',onExplore);
  document.addEventListener('osomni:robot-action',onAction);
  dock.append(toolbar,stage,caption);
  const launcher=document.createElement('button');launcher.type='button';launcher.className='om3d-companion-launcher';launcher.hidden=true;
  launcher.setAttribute('aria-label','Show OS-Omni companion');launcher.setAttribute('aria-controls',stage.id);launcher.setAttribute('aria-expanded','false');
  launcher.innerHTML='<img src="public/favicon-512.png" alt="" width="34" height="34"><span>OS-Omni</span>';
  document.body.append(dock,launcher);
  let away=false,minimized=false,heroVisible=true,disabled=false;
  try{minimized=sessionStorage.getItem('osomni-companion-minimized')==='1';}catch(_){/* Storage is optional. */}
  function update(){
    if(disabled)return;
    dock.hidden=!away||minimized;launcher.hidden=!away||!minimized;
    launcher.setAttribute('aria-expanded',String(away&&!minimized));
    host.classList.toggle('om3d-away',away);
    if(away){stage.append(canvas,message);}
    else{host.append(canvas,message);}
    onChange({docked:away,minimized,visible:away?!minimized:heroVisible});
  }
  function setMinimized(value){
    minimized=value;
    try{sessionStorage.setItem('osomni-companion-minimized',value?'1':'0');}catch(_){}
    update();
  }
  minimize.addEventListener('click',()=>{setMinimized(true);launcher.focus();});
  launcher.addEventListener('click',()=>{setMinimized(false);canvas.focus({preventScroll:true});});
  dock.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setMinimized(true);launcher.focus();}});
  home.addEventListener('click',()=>{
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('top')?.scrollIntoView({behavior:reduced?'instant':'smooth'});
  });
  const observer=new IntersectionObserver(entries=>{
    const entry=entries[0];heroVisible=entry.isIntersecting;
    const nextAway=entry.boundingClientRect.bottom<=72;
    if(nextAway!==away||!away){away=nextAway;update();}
  },{rootMargin:'-72px 0px 0px 0px',threshold:[0,.02]});
  observer.observe(host);
  return {
    stage,
    get docked(){return away;},
    get minimized(){return minimized;},
    disable(){disabled=true;observer.disconnect();document.removeEventListener('osomni:explore',onExplore);document.removeEventListener('osomni:robot-action',onAction);host.classList.remove('om3d-away');host.append(canvas,message);dock.remove();launcher.remove();}
  };
}
