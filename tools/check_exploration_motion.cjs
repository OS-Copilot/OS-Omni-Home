/* DOM-level regression checks, not browser rendering or visual acceptance. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const elements=[],events={},raf=[],intersections=[],mutations=[],animations=[],dispatched=[];
const reduced={matches:false,addEventListener(_,fn){this.change=fn;}};
let scroll=0;
class Element{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={setProperty(k,v){this[k]=v;}};this.attributes={};this.isConnected=true;this.nodeType=1;this.classes=new Set();elements.push(this);this.classList={add:k=>this.classes.add(k),toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k)};}
  append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parentElement=this;}
  appendChild(node){this.append(node);}
  setAttribute(k,v){this.attributes[k]=v;}
  removeAttribute(k){delete this.attributes[k];}
  querySelector(){return this.wrap||null;}
  querySelectorAll(selector){return selector.startsWith('main .card')?[card]:reveals;}
  getBoundingClientRect(){return {top:(this.top||0)-scroll,left:0,width:500,height:400};}
  matches(selector){return selector.split(',').some(s=>s.trim()===this.kind);}
  animate(frames,options){const animation={frames,options,canceled:false,finished:new Promise(()=>{}),cancel(){this.canceled=true;}};animations.push(animation);return animation;}
}
const ids=['top','playground-section','abstract','benchmark','leaderboard','method','tasks','case-studies','resources'];
const sections=Object.fromEntries(ids.map((id,i)=>{const section=new Element('section');section.top=i*900;section.wrap=new Element('div');return[id,section];}));
const heading=new Element('h2'),bar=new Element('i'),ring=new Element('svg'),card=new Element('details');
bar.kind='.cr-bar-track>i';bar.style.width='64%';ring.kind='.dc-ring';
const reveals=[heading,bar,ring];
const body=new Element('body');const document={body,documentElement:{scrollHeight:9000},getElementById:id=>sections[id],createElement:tag=>new Element(tag),querySelectorAll:s=>body.querySelectorAll(s),addEventListener:(name,fn)=>{events[name]=fn;},dispatchEvent:event=>dispatched.push(event)};
const context={document,matchMedia:()=>reduced,innerHeight:900,innerWidth:1600,scrollY:0,
  requestAnimationFrame:fn=>{raf.push(fn);return raf.length;},addEventListener:(name,fn)=>{events[name]=fn;},
  IntersectionObserver:class{constructor(fn){this.fn=fn;this.unobserved=[];intersections.push(this);}observe(){}unobserve(el){this.unobserved.push(el);}},
  ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){}},
  MutationObserver:class{constructor(fn){this.fn=fn;mutations.push(this);}observe(){}},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}
};
vm.runInNewContext(fs.readFileSync('static/js/exploration-motion.js','utf8'),context);
const flush=()=>{while(raf.length)raf.shift()();};
assert.equal(dispatched.at(-1).detail.id,'top');
scroll=4700;context.scrollY=scroll;events.scroll();flush();
assert.equal(dispatched.at(-1).detail.id,'method');
const progress=body.children.find(el=>el.className==='exp-reading-progress');
assert.match(progress.children[0].style.transform,/scaleX\(0\.58/);
const rail=body.children.find(el=>el.className==='exp-journey');
assert.equal(rail.children.filter(a=>a.attributes['aria-current']==='location').length,1);
assert.equal(rail.children[5].attributes['aria-current'],'location');
intersections[0].fn([{isIntersecting:true,target:bar},{isIntersecting:true,target:ring}]);
assert.equal(bar.style.width,'64%','Animation must never rewrite chart measurements');
assert.equal(animations.length,2);assert.equal(animations[0].frames[1].transform,'scaleX(1)');
assert.equal(animations[0].options.fill,'backwards');
reduced.matches=true;reduced.change();assert(animations.every(a=>a.canceled));
intersections[0].fn([{isIntersecting:true,target:heading}]);assert.equal(animations.length,2,'Reduced motion must skip entrance animations');
const removed=new Element('div');mutations[0].fn([{removedNodes:[removed],addedNodes:[]}]);assert(intersections[0].unobserved.includes(removed));
assert.equal(sections.benchmark.wrap.children.at(-1).href,'#leaderboard');
assert.equal(sections.method.wrap.children.at(-1).href,'#tasks');
assert.equal(sections.tasks.wrap.children.at(-1).href,'#case-studies');
console.log('PASS: section tracking, reading progress, one active waypoint, companion context event, unchanged chart values, reduced motion, removed-node cleanup and exploration links.');
