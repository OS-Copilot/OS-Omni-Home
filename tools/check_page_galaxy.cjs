/* Canvas event/lifecycle fixture; does not substitute for visual browser QA. */
const assert=require('node:assert/strict');
(async()=>{
  const T=await import('../static/js/vendor/three.module.min.js');
  const {pageStarField,starPose,createPageGalaxy}=await import('../static/js/page-galaxy.js');
  const {createGalaxy}=await import('../static/js/mascot-galaxy.js');
  const field=pageStarField(1440,900),star=field[50],pointer={x:0,y:0,active:false};
  assert.notDeepEqual(starPose(star,10,0,pointer,1440,900),starPose(star,0,0,pointer,1440,900));
  assert.notDeepEqual(starPose(star,0,1000,pointer,1440,900),starPose(star,0,0,pointer,1440,900));
  let circles=0;
  const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),arc(){circles++;}},{get:(o,k)=>k in o?o[k]:(()=>{})});
  class El{
    constructor(){this.children=[];this.style={setProperty(){}};this.dataset={};this.classList={add(){},remove(){}};}
    getContext(){return ctx;}append(...x){this.children.push(...x);}appendChild(x){this.append(x);}
    setAttribute(){}remove(){}getBoundingClientRect(){return{left:-57.6,top:-36,width:1556,height:972};}
  }
  const callbacks={},queue=[],events=[];let id=0;
  Object.assign(globalThis,{innerWidth:1440,innerHeight:900,devicePixelRatio:1,scrollY:0});
  const reduced={matches:false,addEventListener:(k,f)=>callbacks.preference=f,removeEventListener(){}};
  globalThis.matchMedia=()=>reduced;
  globalThis.requestAnimationFrame=f=>{queue.push({f,id:++id});return id;};
  globalThis.cancelAnimationFrame=k=>{const i=queue.findIndex(x=>x.id===k);if(i>=0)queue.splice(i,1);};
  globalThis.addEventListener=(k,f)=>callbacks[k]=f;globalThis.removeEventListener=()=>{};
  globalThis.CustomEvent=class{constructor(type,o){this.type=type;this.detail=o.detail;}};
  const body=new El();body.prepend=x=>body.children.unshift(x);
  globalThis.window={getSelection:()=>null};
  globalThis.document={body,hidden:false,querySelector:()=>null,createElement:()=>new El(),addEventListener:(k,f)=>callbacks[k]=f,removeEventListener(){},dispatchEvent:e=>events.push(e)};
  const g=createPageGalaxy();assert.equal(events.at(-1).detail.active,true);assert.equal(queue.length,1);
  let now=performance.now();const step=()=>{const job=queue.shift();if(job)job.f(now+=40);};
  step();const baseline=circles;step();const perFrame=circles-baseline;assert(perFrame>=field.length);
  callbacks.click({button:0,clientX:700,clientY:450,target:{closest:()=>null}});
  const before=circles;step();const burstFrame=circles-before;
  assert(burstFrame>perFrame,'Blank click must draw a wave and stars');
  const beforeInteractive=circles;
  callbacks.click({button:0,clientX:700,clientY:450,target:{closest:()=>({})}});step();
  assert.equal(circles-beforeInteractive,burstFrame,'Controls must not add a second burst');
  reduced.matches=true;callbacks.preference();assert.equal(queue.length,0);
  document.hidden=true;callbacks.visibilitychange();assert.equal(queue.length,0);
  const scene=new T.Scene(),local=createGalaxy(scene,1);
  local.setUnified(true);assert.equal(local.root.visible,false);local.setUnified(false);assert.equal(local.root.visible,true);
  g.destroy();assert.equal(events.at(-1).detail.active,false);
  console.log('PASS: autonomous drift, scroll depth, click burst, control exclusion, one animation loop, reduced-motion stop, hidden-tab pause and shared-scene fallback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
