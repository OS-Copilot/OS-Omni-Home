import * as T from './vendor/three.module.min.js';
import {createRobot,poseRobot} from './mascot-model.js?v=orbit-proportions-7';
import {createPlatforms} from './mascot-platforms.js?v=orbit-proportions-7';
import {createExplorationOrbit} from './mascot-orbit.js?v=orbit-proportions-7';
import {createCompanion} from './mascot-companion.js?v=companion-8';

const host=document.querySelector('.charcoal-brand-visual');
if(host)try{start(host);}catch(error){console.warn('3D mascot unavailable; original project logo retained.',error.message);}

function start(host){
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.NeutralToneMapping;
  renderer.toneMappingExposure=1;
  const canvas=renderer.domElement;
  canvas.className='om3d-canvas';canvas.tabIndex=0;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Interactive 3D OS-Omni robot. Drag or use arrow keys to turn; press Enter to wave.');
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(36,1,.1,50);
  camera.position.set(0,2.35,8.9);camera.lookAt(0,1.57,0);
  scene.add(new T.HemisphereLight(0xffffff,0x7c8895,1.0));
  const key=new T.DirectionalLight(0xffffff,1.6);key.position.set(-3,5,6);scene.add(key);
  const rim=new T.DirectionalLight(0xffffff,1.5);rim.position.set(4,3,-3);scene.add(rim);
  const fill=new T.PointLight(0xffffff,8,15);fill.position.set(-3,1,-2);scene.add(fill);
  // An inexpensive studio environment provides broad reflections on the shell.
  const studio=new T.Scene();studio.background=new T.Color(0x6b727c);
  for(const [color,x,y,z,sx,sy] of [[0xffffff,-3,4,2,4,5],[0xffffff,4,2,0,2,5],[0x465064,0,-2,0,10,10]]){
    const p=new T.Mesh(new T.PlaneGeometry(sx,sy),new T.MeshBasicMaterial({color,side:T.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,1,0);studio.add(p);
  }
  const pmrem=new T.PMREMGenerator(renderer);const environment=pmrem.fromScene(studio,.08);scene.environment=environment.texture;pmrem.dispose();
  studio.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  const robot=createRobot();scene.add(robot.root);
  const floor=new T.Group();floor.position.y=-.1;scene.add(floor);
  const base=new T.Mesh(new T.CylinderGeometry(.85,.88,.075,80),new T.MeshStandardMaterial({color:0x17669e,metalness:.25,roughness:.3}));floor.add(base);
  const inset=new T.Mesh(new T.CylinderGeometry(.83,.83,.018,80),new T.MeshStandardMaterial({color:0x64cdbd,metalness:.18,roughness:.3}));inset.position.y=.075;floor.add(inset);
  const halo=new T.Mesh(new T.TorusGeometry(.84,.010,12,100),new T.MeshBasicMaterial({color:0xa5f4c9}));halo.rotation.x=Math.PI/2;halo.position.y=.08;floor.add(halo);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
  const gc=glowCanvas.getContext('2d');const gradient=gc.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(45,166,228,.24)');gradient.addColorStop(1,'rgba(45,166,228,0)');gc.fillStyle=gradient;gc.fillRect(0,0,128,128);
  const glow=new T.Mesh(new T.PlaneGeometry(5,5),new T.MeshBasicMaterial({map:new T.CanvasTexture(glowCanvas),transparent:true,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.y=-.18;scene.add(glow);
  const {devices,pickable}=createPlatforms(scene);
  const orbit=createExplorationOrbit(scene,devices);
  const sparkles=[];
  for(let i=0;i<6;i++){
    const star=new T.Mesh(new T.OctahedronGeometry(.025+i%3*.012),new T.MeshBasicMaterial({color:0xffd337,transparent:true,opacity:.7}));
    const angle=i*2.399;star.position.set(Math.cos(angle)*2.3,.3+(i%5)*.59,Math.sin(angle)*.8-.5);scene.add(star);sparkles.push(star);
  }
  host.appendChild(canvas);
  const controls=document.createElement('div');controls.className='om3d-controls';
  controls.innerHTML='<button type="button" class="om3d-hello" aria-label="Make the 3D robot wave"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13 5 8a1.5 1.5 0 0 1 2.6-1.5L10 10l-2-6a1.5 1.5 0 0 1 2.8-1L13 9l-.5-5a1.5 1.5 0 0 1 3-.2L16 11l1-3a1.5 1.5 0 0 1 2.8 1L18 17c-1 5-8 5-11 1l-3-4a1.5 1.5 0 0 1 2.3-2L9 15"/></svg>Say hello</button><span class="om3d-hint">Drag to turn · Tap to play</span>';
  const message=document.createElement('div');message.className='om3d-message';message.setAttribute('role','status');host.append(controls,message);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let look={x:0,y:0},target={x:0,y:0},yaw=-.15,yawTarget=-.15,waveStart=-100,last=performance.now(),elapsed=0,visible=true,paused=false,frame=0,down=null,dragged=false,messageTimer,orbitTime=0,orbitRate=1,orbitHover=false,companion=null,miniMode=false;
  const raycaster=new T.Raycaster();
  function wave(){waveStart=elapsed;message.textContent=['Hello, human. Let’s explore.','Six platforms. One curious little robot.','Ready when you are.'][Math.floor(Math.random()*3)];message.classList.add('is-visible');clearTimeout(messageTimer);messageTimer=setTimeout(()=>message.classList.remove('is-visible'),2600);if(reduced.matches)renderOnce();}
  controls.querySelector('button').addEventListener('click',wave);
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,yaw:yawTarget};dragged=false;});
  canvas.addEventListener('pointermove',e=>{
    const r=canvas.getBoundingClientRect();target={x:T.MathUtils.clamp((e.clientX-r.left)/r.width*2-1,-1,1),y:T.MathUtils.clamp(1-(e.clientY-r.top)/r.height*2,-1,1)};
    if(down&&Math.abs(e.clientX-down.x)>5){dragged=true;yawTarget=down.yaw+(e.clientX-down.x)*.008;}
    raycaster.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
    orbitHover=!miniMode&&Boolean(raycaster.intersectObjects(pickable)[0]);
    canvas.style.cursor=orbitHover?'pointer':down?'grabbing':'grab';
    if(reduced.matches)renderOnce();
  });
  window.addEventListener('pointerup',()=>{down=null;});
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('pointerleave',()=>{orbitHover=false;if(!down)target={x:0,y:0};});
  canvas.addEventListener('pointerenter',()=>{if(elapsed-waveStart>5)waveStart=elapsed;});
  canvas.addEventListener('click',e=>{
    if(dragged)return;
    if(miniMode){wave();return;}
    const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
    const hit=raycaster.intersectObjects(pickable)[0];
    const blocking=hit&&raycaster.intersectObject(robot.root,true)[0];
    if(hit&&(!blocking||blocking.distance>hit.distance)){const id=hit.object.userData.platform;const tab=document.querySelector('#playground .bp-tabs [data-platform="'+id+'"]');if(tab){tab.click();document.getElementById('playground-section').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});return;}}
    wave();
  });
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Enter',' '].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')yawTarget-=.3;else if(e.key==='ArrowRight')yawTarget+=.3;else wave();if(reduced.matches)renderOnce();}});
  function resize(){const w=canvas.parentElement.clientWidth;if(!w)return;renderer.setSize(w,w,false);camera.aspect=1;camera.updateProjectionMatrix();renderOnce();}
  const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(host);
  function draw(dt){
    look.x=T.MathUtils.damp(look.x,target.x,5,dt);look.y=T.MathUtils.damp(look.y,target.y,5,dt);yaw=T.MathUtils.damp(yaw,yawTarget,6,dt);robot.root.rotation.y=yaw;
    const age=elapsed-waveStart;
    const waveAmount=reduced.matches?0:age>=0&&age<2.5?Math.sin(Math.min(1,age/.35)*Math.PI/2)*Math.min(1,(2.5-age)/.5):elapsed<2?Math.sin(elapsed*Math.PI/2)*.8:0;
    poseRobot(robot,elapsed,look,waveAmount,age>=0&&age<1&&!reduced.matches?Math.sin(age*Math.PI):0,reduced.matches);
    if(!miniMode){
      orbitRate=T.MathUtils.damp(orbitRate,orbitHover?.18:1,4,dt);
      if(!reduced.matches)orbitTime+=dt*orbitRate;
      orbit.update(orbitTime,camera,reduced.matches);
      sparkles.forEach((star,i)=>{star.rotation.y=elapsed*.4;star.material.opacity=.25+(Math.sin(elapsed*1.4+i)+1)*.25;});
    }
    renderer.render(scene,camera);
  }
  function renderOnce(){draw(1/60);}
  function animate(now){frame=0;if(!visible||paused||reduced.matches)return;const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;draw(dt);frame=requestAnimationFrame(animate);}
  function resume(){last=performance.now();if(!frame&&visible&&!paused&&!reduced.matches)frame=requestAnimationFrame(animate);else if(reduced.matches)renderOnce();}
  document.addEventListener('visibilitychange',()=>{paused=document.hidden;resume();});
  companion=createCompanion({host,canvas,message,onChange:state=>{
    const entering=state.docked&&!miniMode;
    miniMode=state.docked;visible=state.visible;orbitHover=false;
    devices.forEach(({device})=>{device.visible=!miniMode;});
    orbit.setVisible(!miniMode);sparkles.forEach(star=>{star.visible=!miniMode;});
    if(miniMode){camera.position.set(0,1.85,5.3);camera.lookAt(0,1.40,0);}
    else{camera.position.set(0,2.35,8.9);camera.lookAt(0,1.57,0);}
    if(entering&&!state.minimized){yawTarget=-.15;waveStart=elapsed;}
    resize();resume();
  }});
  sizeObserver.observe(companion.stage);
  document.addEventListener('pointermove',event=>{
    if(!miniMode||!visible||paused||event.pointerType==='touch'||event.target===canvas||reduced.matches)return;
    const rect=canvas.getBoundingClientRect();
    target={x:T.MathUtils.clamp((event.clientX-rect.left-rect.width/2)/innerWidth*2,-.85,.85),y:T.MathUtils.clamp((rect.top+rect.height/2-event.clientY)/innerHeight*2,-.65,.65)};
  },{passive:true});
  reduced.addEventListener('change',resume);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;companion?.disable();host.classList.remove('om3d-ready');canvas.hidden=true;controls.hidden=true;});
  resize();host.classList.add('om3d-ready');resume();
}
