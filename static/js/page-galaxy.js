/* One interactive galaxy for the entire page, including the robot scene. */
function randomSource(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function gaussian(random){return Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(2*Math.PI*random());}
export function pageStarField(width,height){
  const random=randomSource(74291),count=Math.max(300,Math.min(1200,Math.round(width*height/2400))),stars=[];
  for(let i=0;i<count;i++){
    const x=random()*width;
    const y=i<count*.65?height*.53-(x-width*.5)*.34+gaussian(random)*height*.105:random()*height;
    stars.push({x,y,radius:.35+random()**5*1.6,opacity:.23+random()*.53,color:random()<.08?'247,218,166':random()<.25?'135,210,220':'184,214,250',depth:.25+random()*.75,phase:random()*Math.PI*2});
  }
  return stars;
}

export function starPose(star,time,travel,pointer,width,height){
  const wrap=(n,size)=>(n%size+size)%size;
  let x=wrap(star.x+time*star.depth*2.8,width),y=wrap(star.y-time*star.depth*.65-travel*star.depth*.11,height);
  let proximity=0;
  if(pointer.active){const dx=(pointer.x+.5)*width-x,dy=(pointer.y+.5)*height-y,d=Math.hypot(dx,dy);proximity=Math.max(0,1-d/175);x+=dx*proximity*.10*star.depth;y+=dy*proximity*.10*star.depth;}
  return{x,y,opacity:Math.min(1,star.opacity*(.77+.23*Math.sin(time*.8+star.phase))+proximity*.24)};
}

export function createPageGalaxy(){
  if(document.querySelector('.site-galaxy'))return null;
  const nebula=document.createElement('canvas'),stars=document.createElement('canvas');
  const nc=nebula.getContext('2d'),sc=stars.getContext('2d');if(!nc||!sc)return null;
  const root=document.createElement('div');root.className='site-galaxy';root.setAttribute('aria-hidden','true');
  nebula.className='site-galaxy-nebula';stars.className='site-galaxy-stars';root.append(nebula,stars);
  const glints=[];
  for(let i=0;i<7;i++){
    const glint=document.createElement('i');glint.className='site-galaxy-glint';glint.style.left=(9+i*13.1)+'%';glint.style.top=(20+(i*23)%66)+'%';
    glint.style.setProperty('--glint-delay',(-i*1.7)+'s');glint.style.setProperty('--glint-period',(6+i*.7)+'s');root.appendChild(glint);glints.push(glint);
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let timer,frame=0,pointer={x:0,y:0,active:false},destroyed=false;
  let width=1,height=1,field=[],clock=0,lastTime=0,lastDraw=0,scrollOffset=scrollY,velocity=0,ripples=[];
  function cloud(x,y,rx,ry,color,alpha){
    nc.save();nc.translate(x,y);nc.scale(rx,ry);
    const g=nc.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba('+color+','+alpha+')');g.addColorStop(.4,'rgba('+color+','+alpha*.42+')');g.addColorStop(1,'rgba('+color+',0)');nc.fillStyle=g;nc.fillRect(-1,-1,2,2);nc.restore();
  }
  function paint(){
    if(destroyed)return;
    width=Math.ceil(innerWidth*1.08);height=Math.ceil(innerHeight*1.08);const scale=Math.min(1,1536/width);
    nebula.width=Math.ceil(width*scale);nebula.height=Math.ceil(height*scale);
    nc.clearRect(0,0,nebula.width,nebula.height);nc.save();nc.scale(scale,scale);nc.translate(width*.50,height*.53);nc.rotate(-.33);
    const random=randomSource(58217),span=Math.max(width,height)*1.4;
    nc.globalCompositeOperation='lighter';
    for(let i=0;i<150;i++){
      const x=(random()-.5)*span,y=gaussian(random)*height*.055;
      cloud(x,y,width*(.025+random()*.065),height*(.025+random()*.065),i%4?'70,130,207':'83,168,185',.024+random()*.052);
    }
    for(let i=0;i<260;i++){
      const x=(random()-.5)*span,y=Math.sin(x*.009)*height*.020+gaussian(random)*height*.023;
      cloud(x,y,width*(.009+random()*.023),height*(.009+random()*.025),i%9?'160,199,237':'220,208,174',.028+random()*.072);
    }
    nc.globalCompositeOperation='destination-out';
    for(let i=0;i<125;i++){
      const x=(i/124-.5)*span,y=Math.sin(x*.009)*height*.020;
      cloud(x,y,span*.012,height*(.003+random()*.009),'0,0,0',.20+random()*.22);
    }
    nc.restore();
    const ratio=Math.min(devicePixelRatio||1,1.1);stars.width=Math.ceil(width*ratio);stars.height=Math.ceil(height*ratio);sc.setTransform(ratio,0,0,ratio,0,0);
    field=pageStarField(width,height);root.dataset.starCount=String(field.length);
    drawStars();composite();
  }
  function drawStars(){
    sc.clearRect(0,0,width,height);
    const t=reduced.matches?0:clock,travel=reduced.matches?0:scrollOffset;
    for(const star of field){
      const p=starPose(star,t,travel,reduced.matches?{active:false}:pointer,width,height);
      sc.fillStyle='rgba('+star.color+','+p.opacity+')';sc.beginPath();sc.arc(p.x,p.y,star.radius,0,Math.PI*2);sc.fill();
      if(!reduced.matches&&Math.abs(velocity)>200){
        const tail=Math.min(12,Math.abs(velocity)*.0025)*star.depth;
        sc.strokeStyle='rgba('+star.color+','+(p.opacity*.21)+')';sc.lineWidth=.6;sc.beginPath();sc.moveTo(p.x,p.y);sc.lineTo(p.x,p.y+Math.sign(velocity)*tail);sc.stroke();
      }
    }
    ripples=ripples.filter(r=>clock-r.time<1.8);
    for(const ripple of ripples){
      const age=clock-ripple.time,radius=12+age*105,alpha=(1-age/1.8)**2;
      sc.strokeStyle='rgba(151,216,247,'+alpha*.36+')';sc.lineWidth=.8;sc.beginPath();sc.arc(ripple.x,ripple.y,radius,0,Math.PI*2);sc.stroke();
      for(let i=0;i<22;i++){
        const a=i/22*Math.PI*2+age*.12,r=radius*(.65+(i%5)*.07),x=ripple.x+Math.cos(a)*r,y=ripple.y+Math.sin(a)*r;
        sc.fillStyle='rgba('+(i%6?'178,224,250':'247,218,166')+','+alpha*.7+')';sc.beginPath();sc.arc(x,y,i%5?.9:1.5,0,Math.PI*2);sc.fill();
      }
    }
  }
  function composite(){
    if(destroyed)return;
    const x=reduced.matches?0:pointer.x*9,y=reduced.matches?0:pointer.y*6;
    const travel=reduced.matches?0:Math.sin(scrollOffset*.00042)*35;
    const drift=reduced.matches?0:Math.sin(clock*.035)*17;
    root.style.setProperty('--galaxy-x',(x+drift).toFixed(2)+'px');root.style.setProperty('--galaxy-y',(y+travel).toFixed(2)+'px');
    root.style.setProperty('--stars-x',(-x*.4).toFixed(2)+'px');root.style.setProperty('--stars-y',(-y*.4+travel*.25).toFixed(2)+'px');
  }
  function tick(now){
    frame=0;if(destroyed||document.hidden||reduced.matches||(window.OSOmniBoot&&!window.OSOmniBoot.released))return;
    frame=requestAnimationFrame(tick);
    if(now-lastDraw<1000/30)return;
    const dt=Math.min(.06,Math.max(.001,(now-lastTime)/1000));lastTime=now;lastDraw=now;clock+=dt;
    const before=scrollOffset;scrollOffset+=(scrollY-scrollOffset)*(1-Math.exp(-dt*6));velocity=(scrollOffset-before)/dt;
    drawStars();composite();
  }
  function schedule(){
    if(destroyed||document.hidden||(window.OSOmniBoot&&!window.OSOmniBoot.released))return;
    if(reduced.matches){drawStars();composite();return;}
    if(!frame){lastTime=performance.now();lastDraw=lastTime;frame=requestAnimationFrame(tick);}
  }
  function onPointer(event){if(reduced.matches||event.pointerType==='touch')return;pointer={x:event.clientX/innerWidth-.5,y:event.clientY/innerHeight-.5,active:true};schedule();}
  function onLeave(){pointer.active=false;}
  function onClick(event){
    if(reduced.matches||document.hidden||event.button!==0||event.target.closest?.('a,button,input,select,textarea,label,summary,details,iframe,canvas,table,[role="button"],[contenteditable]')||window.getSelection?.()?.toString())return;
    const rect=stars.getBoundingClientRect();
    ripples.push({x:(event.clientX-rect.left)*width/rect.width,y:(event.clientY-rect.top)*height/rect.height,time:clock});if(ripples.length>4)ripples.shift();schedule();
  }
  function onPreference(){cancelAnimationFrame(frame);frame=0;ripples=[];schedule();}
  function onResize(){clearTimeout(timer);timer=setTimeout(paint,160);}
  function onVisibility(){root.dataset.paused=String(document.hidden);if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();}
  document.body.prepend(root);
  paint();document.body.classList.add('has-page-galaxy');document.dispatchEvent(new CustomEvent('osomni:galaxy',{detail:{active:true}}));schedule();
  document.addEventListener('osomni:app-enter',schedule);
  window.OSOmniBoot?.ready('galaxy');
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',onResize,{passive:true});document.addEventListener('pointermove',onPointer,{passive:true});document.addEventListener('pointerleave',onLeave);document.addEventListener('click',onClick);document.addEventListener('visibilitychange',onVisibility);reduced.addEventListener('change',onPreference);
  return{root,paint,destroy(){destroyed=true;clearTimeout(timer);cancelAnimationFrame(frame);removeEventListener('scroll',schedule);removeEventListener('resize',onResize);document.removeEventListener('osomni:app-enter',schedule);document.removeEventListener('pointermove',onPointer);document.removeEventListener('pointerleave',onLeave);document.removeEventListener('click',onClick);document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',onPreference);document.body.classList.remove('has-page-galaxy');document.dispatchEvent(new CustomEvent('osomni:galaxy',{detail:{active:false}}));root.remove();}};
}
if(typeof document!=='undefined'){const scene=createPageGalaxy();if(!scene)window.OSOmniBoot?.fail('galaxy','The galaxy canvas could not start.');}
