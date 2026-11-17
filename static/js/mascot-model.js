import * as T from './vendor/three.module.min.js';

export function roundedSolid(width,height,depth,radius,bevel=.025) {
  const x=-width/2+bevel,y=-height/2+bevel,w=width-2*bevel,h=height-2*bevel;
  const r=Math.min(radius,w/2,h/2),s=new T.Shape();
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  const geometry=new T.ExtrudeGeometry(s,{depth:Math.max(.001,depth-2*bevel),bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:16});
  geometry.translate(0,0,-depth/2+bevel);geometry.computeVertexNormals();return geometry;
}

// A visor painted onto the helmet's compound curve, rather than a TV-like box.
function visorSurface(rx,ry,cy,offset) {
  const positions=[],indices=[],segments=80,rings=22;
  for(let ring=0;ring<=rings;ring++)for(let j=0;j<=segments;j++){
    const radius=ring/rings,angle=j/segments*Math.PI*2;
    const x=Math.cos(angle)*rx*radius,y=cy+Math.sin(angle)*ry*radius;
    positions.push(x,y,helmetFront(x,y)+offset);
  }
  for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
    const a=i*(segments+1)+j,b=a+segments+1;
    indices.push(a,b,b+1,a,b+1,a+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function helmetFront(x,y){return .61*Math.sqrt(Math.max(.025,1-(x/.84)**2-((y-.20)/.73)**2));}

// Art-directed geometry and independent joints; no raster logo in this model.
export function createRobot() {
  const root = new T.Group();
  const pearl = new T.MeshToonMaterial({color:0xeaf6ff});
  const trim = new T.MeshToonMaterial({color:0x195a99});
  const dark = new T.MeshToonMaterial({color:0x0c4585,emissive:0x0c4585,emissiveIntensity:.16});
  const pupilInk = new T.MeshBasicMaterial({color:0x072747});
  const cyan = new T.MeshToonMaterial({color:0x8deef7,emissive:0x63dcea,emissiveIntensity:.12});
  const white = new T.MeshBasicMaterial({color:0xf3fdff});
  const joint = new T.MeshToonMaterial({color:0x17477a});
  const ink = new T.MeshBasicMaterial({color:0x112c48,side:T.BackSide});
  function outline(object,amount=.023){
    const edge=new T.Mesh(object.geometry,ink);edge.position.copy(object.position);edge.rotation.copy(object.rotation);
    edge.scale.copy(object.scale).multiplyScalar(1+amount);object.parent.add(edge);return edge;
  }
  function mesh(parent, geo, mat, xyz=[0,0,0], scale=[1,1,1]) {
    const m = new T.Mesh(geo, mat);m.position.set(...xyz);m.scale.set(...scale);parent.add(m);return m;
  }
  const sphere = (p,m,pos,s) => mesh(p,new T.SphereGeometry(1,40,28),m,pos,s);
  const torso = new T.Group();root.add(torso);
  // One continuous, slightly tapered shell instead of stacked spherical parts.
  const bodyProfile=[new T.Vector2(0,.50),new T.Vector2(.25,.50),new T.Vector2(.37,.54),new T.Vector2(.39,.61),new T.Vector2(.36,.76),new T.Vector2(.335,.97),new T.Vector2(.30,1.14),new T.Vector2(.20,1.24),new T.Vector2(0,1.27)];
  const bodySamples=new T.SplineCurve(bodyProfile).getPoints(80);
  const shell=mesh(torso,new T.LatheGeometry(bodySamples,56),pearl);shell.name='torso-shell';shell.scale.z=.82;outline(shell,.035);
  // Trace the original suit's curved front panel and hem on the actual shell.
  function suitFront(x,y){
    const sample=bodySamples.reduce((a,b)=>Math.abs(a.y-y)<Math.abs(b.y-y)?a:b);
    return Math.sqrt(Math.max(.002,sample.x*sample.x-x*x))*.82+.013;
  }
  const panelPoints=[[-.245,1.16],[-.245,1.04],[-.26,.84],[-.285,.66],[-.20,.60],[0,.585],[.20,.60],[.285,.66],[.26,.84],[.245,1.04],[.245,1.16]];
  const suitSeam=new T.CatmullRomCurve3(panelPoints.map(([x,y])=>new T.Vector3(x,y,suitFront(x,y))));
  mesh(torso,new T.TubeGeometry(suitSeam,72,.009,8,false),trim);
  const hem=mesh(torso,new T.TorusGeometry(.375,.012,10,64),trim,[0,.565,0]);hem.rotation.x=Math.PI/2;hem.scale.y=.82;
  mesh(torso,roundedSolid(.28,.19,.035,.07,.012),trim,[0,1.01,.31]);
  const chest=mesh(torso,roundedSolid(.20,.11,.025,.04,.008),cyan,[0,1.01,.334]);
  for(const x of [-.035,.035])sphere(torso,white,[x,1.01,.35],[.015,.015,.005]);
  mesh(torso,new T.CylinderGeometry(.13,.16,.14,32),joint,[0,1.30,0]);
  // Rear equipment stays within the suit silhouette when seen from the front.
  const backpack=new T.Group();backpack.name='explorer-backpack';backpack.position.set(0,.91,-.275);backpack.rotation.y=Math.PI;torso.add(backpack);
  const packShell=mesh(backpack,roundedSolid(.46,.52,.18,.12,.035),pearl);outline(packShell,.035);
  mesh(backpack,roundedSolid(.38,.43,.016,.085,.006),trim,[0,0,.101]);
  mesh(backpack,roundedSolid(.31,.34,.013,.07,.005),pearl,[0,0,.116]);
  mesh(backpack,roundedSolid(.225,.205,.012,.055,.004),dark,[0,.035,.129]);
  const reactor=mesh(backpack,new T.TorusGeometry(.063,.012,10,40),cyan,[0,.035,.143]);reactor.name='backpack-energy';
  mesh(backpack,new T.CapsuleGeometry(.009,.055,4,12),white,[0,.04,.145]);
  for(const x of [-.265,.265]){
    const tank=mesh(backpack,new T.CapsuleGeometry(.065,.21,8,20),pearl,[x,-.015,0]);outline(tank,.045);
    mesh(backpack,new T.CylinderGeometry(.067,.067,.035,24),trim,[x,.10,0]);
    mesh(backpack,new T.CylinderGeometry(.043,.043,.018,24),cyan,[x,-.196,0]);
  }
  for(let i=0;i<3;i++)mesh(backpack,roundedSolid(.105,.012,.008,.005,.002),trim,[0,-.118-i*.035,.132]);
  for(const x of [-.15,.15])for(const y of [-.17,.17])sphere(backpack,trim,[x,y,.131],[.012,.012,.006]);
  const head = new T.Group();head.position.set(0,1.64,0);torso.add(head);
  const helmet=sphere(head,pearl,[0,.20,0],[.84,.73,.61]);helmet.name='helmet-shell';outline(helmet,.020);
  const rearHatch=new T.Group();rearHatch.name='helmet-rear-hatch';rearHatch.position.set(0,.20,-.606);rearHatch.rotation.y=Math.PI;head.add(rearHatch);
  const hatch=mesh(rearHatch,roundedSolid(.47,.27,.035,.10,.012),pearl);outline(hatch,.04);
  mesh(rearHatch,roundedSolid(.39,.195,.012,.065,.004),trim,[0,0,.025]);
  mesh(rearHatch,roundedSolid(.355,.163,.009,.052,.003),pearl,[0,0,.036]);
  for(let i=0;i<3;i++)mesh(rearHatch,roundedSolid(.15,.013,.006,.005,.002),trim,[-.035,.04-i*.04,.043]);
  sphere(rearHatch,cyan,[.115,0,.044],[.022,.022,.007]);
  const navigationNodes=[[-.45,.46],[-.27,.58],[.02,.48],[.26,.62],[.43,.51]];
  const navigationCurve=new T.CatmullRomCurve3(navigationNodes.map(([x,y])=>new T.Vector3(x,y,-helmetFront(x,y)-.012)));
  mesh(head,new T.TubeGeometry(navigationCurve,48,.006,6,false),trim);
  for(const [x,y] of navigationNodes)sphere(head,cyan,[x,y,-helmetFront(x,y)-.016],[.018,.018,.010]);
  mesh(head,visorSurface(.752,.553,.125,.008),pupilInk);
  mesh(head,visorSurface(.716,.516,.125,.014),trim);
  mesh(head,visorSurface(.686,.486,.125,.020),dark);
  // A small reflective highlight gives the visor a glass-like surface.
  const highlight = new T.MeshBasicMaterial({color:0x74b9f7, transparent:true, opacity:.14, depthWrite:false});
  const glint=sphere(head,highlight,[-.35,.48,helmetFront(-.35,.48)+.026],[.15,.038,.006]);glint.rotation.z=.45;
  sphere(head,white,[-.48,.62,helmetFront(-.48,.62)+.01],[.050,.027,.008]).rotation.z=.6;
  sphere(head,white,[-.36,.68,helmetFront(-.36,.68)+.01],[.025,.015,.007]).rotation.z=.6;
  const eyes=[];
  for(const x of [-.27,.27]) {
    const eye = new T.Group();eye.position.set(x,.22,helmetFront(x,.22)+.035);eye.rotation.y=x*.48;head.add(eye);
    sphere(eye,pupilInk,[0,0,-.003],[.204,.222,.018]);
    sphere(eye,cyan,[0,0,.006],[.184,.201,.018]);
    const pupil=new T.Group();eye.add(pupil);
    sphere(pupil,pupilInk,[.014,.012,.021],[.124,.143,.012]);
    sphere(pupil,white,[-.028,.075,.033],[.043,.046,.006]);
    sphere(pupil,white,[.060,-.052,.034],[.015,.017,.004]);
    eyes.push({eye,pupil});
  }
  // Reference logo: a tiny white open mouth, not a smile or a V-shaped curve.
  const mouthPosition=[0,-.045,helmetFront(0,-.045)+.032];
  const mouth=sphere(head,pupilInk,mouthPosition,[.046,.053,.010]);mouth.name='mouth-outline';
  const mouthWhite=sphere(head,white,[mouthPosition[0],mouthPosition[1],mouthPosition[2]+.010],[.029,.035,.006]);mouthWhite.name='mouth-white';
  for(const x of [-.46,.46])sphere(head,new T.MeshBasicMaterial({color:0x4093d9,transparent:true,opacity:.30}),[x,-.015,helmetFront(x,-.015)+.025],[.038,.013,.004]);
  for(const sign of [-1,1]) {
    const ear=sphere(head,trim,[sign*.81,.16,-.01],[.12,.23,.22]);outline(ear,.045);
    const cap=sphere(head,pearl,[sign*.855,.16,0],[.11,.205,.20]);outline(cap,.025);
    const light=sphere(head,cyan,[sign*.927,.16,.015],[.025,.137,.125]);outline(light,.03);
  }
  const antenna = new T.Group();antenna.position.set(.29,.86,-.04);antenna.rotation.z=-.12;head.add(antenna);
  mesh(antenna,new T.CylinderGeometry(.018,.025,.19,16),trim,[0,.085,0]);
  const antennaTip=sphere(antenna,cyan,[0,.21,0],[.083,.083,.083]);outline(antennaTip,.05);
  sphere(antenna,white,[-.02,.23,.05],[.017,.017,.007]);
  const arms=[];
  for(const sign of [-1,1]) {
    const shoulder=new T.Group();shoulder.position.set(sign*.36,1.15,0);torso.add(shoulder);
    sphere(shoulder,joint,[0,0,0],[.085,.085,.085]);
    const upperArm=mesh(shoulder,new T.CapsuleGeometry(.108,.17,8,24),pearl,[0,-.13,0]);outline(upperArm,.045);
    const elbow=new T.Group();elbow.position.y=-.27;shoulder.add(elbow);
    sphere(elbow,pearl,[0,0,0],[.099,.099,.099]);
    const forearm=mesh(elbow,new T.CapsuleGeometry(.095,.13,8,24),pearl,[0,-.12,0]);outline(forearm,.045);
    const hand=new T.Group();hand.position.set(0,-.26,.02);elbow.add(hand);
    const mitten=sphere(hand,pearl,[0,0,0],[.13,.14,.10]);outline(mitten,.035);
    sphere(hand,cyan,[0,0,.08],[.04,.05,.012]);
    sphere(hand,pearl,[-sign*.092,.035,.025],[.043,.064,.05]);
    arms.push({shoulder,elbow,hand,sign});
  }
  const legs=[];
  for(const sign of [-1,1]) {
    const leg=new T.Group();leg.position.set(sign*.22,.47,0);leg.scale.set(1.10,1.10,1.06);leg.rotation.y=sign*.09;root.add(leg);
    mesh(leg,new T.CapsuleGeometry(.13,.11,8,24),pearl,[0,-.14,0]);
    const sole=sphere(leg,trim,[0,-.355,.09],[.19,.065,.255]);outline(sole,.035);
    const boot=sphere(leg,pearl,[0,-.29,.075],[.19,.12,.25]);outline(boot,.035);
    legs.push(leg);
  }
  // Give the original big-eyed explorer a fuller suit and a less top-heavy
  // silhouette. Compensate the head inside its torso parent so its final
  // dimensions are intentional, rather than growing with the body.
  torso.scale.set(1.10,1.09,1.04);
  head.scale.set(.88/1.10,.90/1.09,.90/1.04);
  head.position.y=1.61;
  root.rotation.y=-.15;
  return {root,torso,head,eyes,arms,legs,antenna,chest,reactor};
}

export function poseRobot(robot, time, look, wave=0, delight=0, reduced=false) {
  const {root,torso,head,eyes,arms,legs,antenna}=robot;
  const idle=reduced?0:1;
  torso.rotation.x=0;root.rotation.z=0;
  robot.reactor.scale.setScalar(reduced?1:1+Math.sin(time*1.8)*.035);
  root.position.y=idle*(Math.sin(time*1.7)*.045+delight*.18);
  torso.rotation.z=idle*(Math.sin(time*.85)*.035-look.x*.035);
  head.rotation.y=look.x*.34+idle*Math.sin(time*.66)*.055;
  head.rotation.x=-look.y*.19+idle*Math.sin(time*1.3)*.025;
  head.rotation.z=idle*(Math.sin(time*.73)*.035+wave*.10);
  antenna.rotation.z=idle*(Math.sin(time*3.4)*.09+wave*Math.sin(time*10)*.12);
  const phase=time%6.3;
  const blink=reduced?1:phase<.16?Math.max(.08,Math.abs(phase-.08)/.08):1;
  eyes.forEach(({eye,pupil})=>{eye.scale.y=blink;pupil.position.x=look.x*.036;pupil.position.y=look.y*.026;});
  for(const {shoulder,elbow,hand,sign} of arms) {
    shoulder.rotation.z=sign*(.64+idle*Math.sin(time*1.4+sign)*.045);
    shoulder.rotation.x=idle*Math.sin(time*1.1+sign)*.055;
    elbow.rotation.x=-.13;
    elbow.rotation.z=sign*.09;
    hand.rotation.z=0;
    if(sign===1){shoulder.rotation.z+=wave*1.65;elbow.rotation.z+=wave*(.25+Math.sin(time*12)*.30);hand.rotation.z=wave*Math.sin(time*12)*.2;}
    else{shoulder.rotation.z-=delight*.5;}
  }
  legs.forEach((leg,i)=>{leg.rotation.x=idle*Math.sin(time*1.7+i)*.025;leg.rotation.z=0;});
}
