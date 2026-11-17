/* Progressive motion: content and published values remain readable without it. */
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const stops=[['top','Overview'],['playground-section','Applications'],['abstract','Research'],['benchmark','Benchmark'],['leaderboard','Results'],['method','Protocol'],['tasks','Tasks'],['case-studies','Trajectories'],['resources','Resources']]
  .map(([id,label])=>({id,label,el:document.getElementById(id)})).filter(stop=>stop.el);

if(stops.length){
  const progress=document.createElement('div');progress.className='exp-reading-progress';progress.setAttribute('aria-hidden','true');
  const fill=document.createElement('i');progress.appendChild(fill);document.body.appendChild(progress);
  const rail=document.createElement('nav');rail.className='exp-journey';rail.setAttribute('aria-label','Explore this page');
  const links=stops.map((stop,index)=>{
    const a=document.createElement('a');a.href='#'+stop.id;a.setAttribute('aria-label',stop.label);
    const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=String(index+1).padStart(2,'0')+' / '+stop.label;
    a.append(dot,label);rail.appendChild(a);return a;
  });
  document.body.appendChild(rail);
  let pending=false,active=-1;
  function track(){
    pending=false;
    const range=document.documentElement.scrollHeight-innerHeight;
    fill.style.transform='scaleX('+Math.max(0,Math.min(1,range>0?scrollY/range:0))+')';
    const marker=Math.min(innerHeight*.32,240);
    let next=0;
    stops.forEach((stop,index)=>{if(stop.el.getBoundingClientRect().top<=marker)next=index;});
    if(next===active)return;
    active=next;
    links.forEach((a,index)=>{
      a.classList.toggle('is-current',index===active);a.classList.toggle('is-past',index<active);
      if(index===active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');
    });
    document.body.dataset.explorationSection=stops[active].id;
    document.dispatchEvent(new CustomEvent('osomni:explore',{detail:{id:stops[active].id,label:stops[active].label}}));
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(track);}}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
  new ResizeObserver(schedule).observe(document.body);
  track();

  const observed=new WeakSet(),played=new WeakSet(),running=new Set();
  function animate(el,frames,options){
    if(reduced.matches||!el.animate)return;
    const animation=el.animate(frames,{fill:'backwards',...options});running.add(animation);
    animation.finished.then(()=>running.delete(animation),()=>running.delete(animation));
  }
  const observer=new IntersectionObserver(entries=>{
    let stagger=0;
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const el=entry.target;observer.unobserve(el);
      if(played.has(el))continue;played.add(el);
      const delay=Math.min(stagger++*45,150);
      if(el.matches('.cr-bar-track>i')){
        animate(el,[{transform:'scaleX(.03)'},{transform:'scaleX(1)'}],{duration:740,delay,easing:'cubic-bezier(.22,1,.36,1)'});
      }else if(el.matches('.dc-ring')){
        animate(el,[{opacity:.35,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:700,delay,easing:'cubic-bezier(.22,1,.36,1)'});
      }else{
        animate(el,[{opacity:.10,translate:'0 18px'},{opacity:1,translate:'0 0'}],{duration:620,delay,easing:'cubic-bezier(.22,1,.36,1)'});
      }
    }
  },{threshold:.10,rootMargin:'0px 0px -24px 0px'});
  const revealSelector='.hero-content>*,.section-head,.charcoal-facts>div,.cr-stats>div,.te-task,.lex-scroll tbody tr,.cr-bar-track>i,.dc-ring,main .chart-card:not(.rise)';
  const surfaceSelector='main .card:not(.annotation-story):not(.story-widget),.te-task,.orbit-explore-guide>a';
  function collect(root){
    root.querySelectorAll(revealSelector).forEach(el=>{
      if(observed.has(el))return;observed.add(el);
      // A separate translate property never overwrites a widget's own transform.
      observer.observe(el);
    });
    root.querySelectorAll(surfaceSelector).forEach(el=>el.classList.add('exp-surface'));
  }
  collect(document);
  // Watch only data-driven content, not the device iframe or 3D renderer.
  for(const id of ['tasks','findings','benchmark','leaderboard']){
    const root=document.getElementById(id);if(!root)continue;
    new MutationObserver(records=>{
      for(const record of records)for(const node of record.removedNodes){
        if(node.nodeType!==1)continue;
        observer.unobserve(node);node.querySelectorAll(revealSelector).forEach(el=>observer.unobserve(el));
      }
      if(records.some(record=>record.addedNodes.length))collect(root);
    }).observe(root,{childList:true,subtree:true});
  }
  let pointerFrame=0,pointer=null;
  document.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||reduced.matches)return;
    const card=event.target.closest?.('.exp-surface');
    if(!card)return;
    pointer={card,x:event.clientX,y:event.clientY};
    if(pointerFrame)return;
    pointerFrame=requestAnimationFrame(()=>{
      pointerFrame=0;const {card,x,y}=pointer;if(!card.isConnected)return;
      const bounds=card.getBoundingClientRect();card.style.setProperty('--exp-x',(x-bounds.left)+'px');card.style.setProperty('--exp-y',(y-bounds.top)+'px');
    });
  },{passive:true});
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.te-platform,.lex-metrics button,.cr-platform-tabs button');
    if(button)animate(button,[{scale:'.97'},{scale:'1'}],{duration:230,easing:'ease-out'});
  });
  for(const [from,to,label]of [['benchmark','leaderboard','Explore the results'],['method','tasks','Find a task to explore'],['tasks','case-studies','See the steps in action']]){
    const section=document.getElementById(from);if(!section)continue;
    const next=document.createElement('a');next.className='exp-next';next.href='#'+to;
    next.innerHTML='<span>'+label+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
    (section.querySelector('.wrap')||section).appendChild(next);
  }
  reduced.addEventListener('change',()=>{if(reduced.matches){for(const a of running)a.cancel();running.clear();}});
}
