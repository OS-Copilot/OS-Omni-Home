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
  root.name='os-omni-explorer';
  // Satin ceramic and coated glass keep the approved palette, while continuous
  // light response replaces the broad, flat bands of the old toon materials.
  const pearl = new T.MeshPhysicalMaterial({color:0xeaf6ff,metalness:.025,roughness:.32,clearcoat:.55,clearcoatRoughness:.26,envMapIntensity:.8});
  const trim = new T.MeshStandardMaterial({color:0x195a99,metalness:.34,roughness:.30,envMapIntensity:.75});
  const dark = new T.MeshPhysicalMaterial({color:0x0c4585,metalness:.12,roughness:.24,clearcoat:1,clearcoatRoughness:.14,envMapIntensity:.95,emissive:0x0c4585,emissiveIntensity:.025});
  const pupilInk = new T.MeshBasicMaterial({color:0x072747});
  const cyan = new T.MeshPhysicalMaterial({color:0x8deef7,metalness:.08,roughness:.28,clearcoat:.6,clearcoatRoughness:.2,emissive:0x63dcea,emissiveIntensity:.08});
  const white = new T.MeshBasicMaterial({color:0xf3fdff});
  const joint = new T.MeshStandardMaterial({color:0x17477a,metalness:.18,roughness:.48});
  const alloy = new T.MeshStandardMaterial({color:0xa7c9dd,metalness:.60,roughness:.28});
  const insetMaterial=new T.MeshPhysicalMaterial({color:0xd0e4ef,metalness:.07,roughness:.40,clearcoat:.25});
  const gasketMaterial=new T.MeshStandardMaterial({color:0x53758e,metalness:.05,roughness:.72});
  const energyMaterial=new T.MeshStandardMaterial({color:0x8deef7,emissive:0x63dcea,emissiveIntensity:.38,roughness:.24,metalness:.12});
  const ink = new T.MeshBasicMaterial({color:0x112c48,side:T.BackSide});
  function outline(object,amount=.023){
    const edge=new T.Mesh(object.geometry,ink);edge.position.copy(object.position);edge.rotation.copy(object.rotation);
    // Fine silhouette edge instead of the inflated, marker-like contour.
    edge.scale.copy(object.scale).multiplyScalar(1+amount*.24);object.parent.add(edge);return edge;
  }
  function mesh(parent, geo, mat, xyz=[0,0,0], scale=[1,1,1]) {
    const m = new T.Mesh(geo, mat);m.position.set(...xyz);m.scale.set(...scale);parent.add(m);return m;
  }
  const smoothSphere=new T.SphereGeometry(1,56,36),detailSphere=new T.SphereGeometry(1,16,12);
  const sphere = (p,m,pos,s) => mesh(p,Math.max(...s)<=.05?detailSphere:smoothSphere,m,pos,s);
  function seam(parent,points,radius,material=alloy){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    return mesh(parent,new T.TubeGeometry(curve,Math.max(16,points.length*8),radius,6,false),material);
  }
  // A subdivided plate conforms to its parent shell, including continuous
  // analytic normals. This avoids floating flat badges and faceted shading.
  function curvedPlate(parent,w,h,r,cy,front,offset,material){
    const s=new T.Shape(),x=-w/2,y=cy-h/2;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    const base=new T.ShapeGeometry(s,12).toNonIndexed(),p=base.attributes.position;
    const positions=[],normals=[],eps=.0005;
    function emit(v){
      const [xx,yy]=v;positions.push(xx,yy,front(xx,yy)+offset);
      const n=new T.Vector3(-(front(xx+eps,yy)-front(xx-eps,yy))/(2*eps),-(front(xx,yy+eps)-front(xx,yy-eps))/(2*eps),1).normalize();
      normals.push(...n);
    }
    function split(a,b,c,depth){
      if(!depth){emit(a);emit(b);emit(c);return;}
      const ab=a.map((v,i)=>(v+b[i])/2),bc=b.map((v,i)=>(v+c[i])/2),ca=c.map((v,i)=>(v+a[i])/2);
      split(a,ab,ca,depth-1);split(ab,b,bc,depth-1);split(ca,bc,c,depth-1);split(ab,bc,ca,depth-1);
    }
    for(let i=0;i<p.count;i+=3)split([p.getX(i),p.getY(i)],[p.getX(i+1),p.getY(i+1)],[p.getX(i+2),p.getY(i+2)],2);
    base.dispose();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    return mesh(parent,g,material);
  }
  // Compact vector engraving: one mesh for all glyphs, no remote font/texture.
  function engraving(parent,word,x,y,front,size,material=trim){
    const glyphs={O:['111','101','101','101','111'],S:['111','100','111','001','111'],M:['101','111','111','101','101'],N:['101','111','111','111','101'],I:['111','010','010','010','111'],'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'-':['000','000','111','000','000'],' ':['000','000','000','000','000']};
    const vertices=[];
    [...word].forEach((letter,j)=>(glyphs[letter]||glyphs[' ']).forEach((row,iy)=>[...row].forEach((on,ix)=>{
      if(on!=='1')return;const xx=x+(j*4+ix)*size,yy=y-iy*size,d=size*.75;
      for(const [dx,dy]of [[0,0],[0,-d],[d,0],[d,0],[0,-d],[d,-d]])vertices.push(xx+dx,yy+dy,front(xx+dx,yy+dy)+.006);
    })));
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return mesh(parent,g,material);
  }
  const torso = new T.Group();root.add(torso);
  // One continuous, slightly tapered shell instead of stacked spherical parts.
  const bodyProfile=[new T.Vector2(0,.50),new T.Vector2(.25,.50),new T.Vector2(.37,.54),new T.Vector2(.39,.61),new T.Vector2(.36,.76),new T.Vector2(.335,.97),new T.Vector2(.30,1.14),new T.Vector2(.20,1.24),new T.Vector2(0,1.27)];
  const bodySamples=new T.SplineCurve(bodyProfile).getPoints(80);
  const shell=mesh(torso,new T.LatheGeometry(bodySamples,56),pearl);shell.name='torso-shell';shell.scale.z=.82;outline(shell,.035);
  // Trace the original suit's curved front panel and hem on the actual shell.
  const bodySide=bodySamples.filter(p=>p.y>=.55&&p.y<=1.18&&p.x>.2).sort((a,b)=>a.y-b.y);
  function suitFront(x,y){
    // Interpolate the monotonic side profile rather than jumping between
    // nearest samples; fine surface plates need a continuous height field.
    const side=bodySide;
    let radius=side[0].x;
    for(let i=1;i<side.length;i++){
      if(y<=side[i].y){const a=side[i-1],b=side[i],t=T.MathUtils.clamp((y-a.y)/(b.y-a.y),0,1);radius=T.MathUtils.lerp(a.x,b.x,t);break;}
      radius=side[i].x;
    }
    return Math.sqrt(Math.max(.002,radius*radius-x*x))*.82+.013;
  }
  const panelPoints=[[-.245,1.16],[-.245,1.04],[-.26,.84],[-.285,.66],[-.20,.60],[0,.585],[.20,.60],[.285,.66],[.26,.84],[.245,1.04],[.245,1.16]];
  const suitSeam=new T.CatmullRomCurve3(panelPoints.map(([x,y])=>new T.Vector3(x,y,suitFront(x,y))));
  mesh(torso,new T.TubeGeometry(suitSeam,96,.0045,8,false),trim);
  const hem=mesh(torso,new T.TorusGeometry(.375,.006,10,80),trim,[0,.565,0]);hem.rotation.x=Math.PI/2;hem.scale.y=.82;
  const breastplate=curvedPlate(torso,.43,.25,.065,1.015,suitFront,.005,insetMaterial);breastplate.name='conformal-breastplate';
  const belly=curvedPlate(torso,.39,.17,.045,.785,suitFront,.004,insetMaterial);belly.name='abdominal-service-panel';
  engraving(torso,'OS OMNI',-.115,.859,suitFront,.0075);
  seam(torso,[[-.16,.67,suitFront(-.16,.67)],[0,.65,suitFront(0,.65)],[.16,.67,suitFront(.16,.67)]],.003,gasketMaterial);
  for(const sign of [-1,1])for(let i=0;i<3;i++){
    const xx=sign*(.105+i*.018),yy=.755;
    seam(torso,[[xx,yy-.014,suitFront(xx,yy-.014)+.006],[xx,yy+.014,suitFront(xx,yy+.014)+.006]],.0025,gasketMaterial);
  }
  mesh(torso,roundedSolid(.28,.19,.035,.07,.012),trim,[0,1.01,.31]);
  const chest=mesh(torso,roundedSolid(.20,.11,.025,.04,.008),cyan,[0,1.01,.334]);
  const coreFrame=new T.Group();coreFrame.position.set(0,1.01,.322);torso.add(coreFrame);
  // A chamfered instrument bezel, kept low-profile around the original badge.
  seam(coreFrame,[[-.115,.065,.015],[0,.080,.015],[.115,.065,.015],[.132,0,.015],[.115,-.065,.015],[0,-.080,.015],[-.115,-.065,.015],[-.132,0,.015],[-.115,.065,.015]],.004,alloy);
  for(const sign of [-1,1]){
    const channel=[[sign*.17,.925],[sign*.205,.88],[sign*.215,.79],[sign*.185,.69]];
    seam(torso,channel.map(([x,y])=>[x,y,suitFront(x,y)+.007]),.008,trim);
    seam(torso,channel.map(([x,y])=>[x,y,suitFront(x,y)+.014]),.0028,energyMaterial);
  }
  for(const x of [-.035,.035])sphere(torso,white,[x,1.01,.35],[.015,.015,.005]);
  // Small engineered details follow the existing shell and joint surfaces.
  // Keep the main silhouette readable; concentrate detail at actual seams.
  for(const x of [-.115,.115])for(const y of [.948,1.072])
    sphere(torso,alloy,[x,y,.332],[.008,.008,.003]);
  for(let i=0;i<3;i++)mesh(torso,roundedSolid(.035,.009,.006,.003,.001),i===2?cyan:alloy,[-.046+i*.046,.72,suitFront(0,.72)+.003]);
  for(const sign of [-1,1]){
    const port=new T.Group();port.position.set(sign*.23,.84,suitFront(sign*.23,.84));port.rotation.y=sign*.32;torso.add(port);
    mesh(port,new T.TorusGeometry(.025,.0035,6,24),alloy);
    sphere(port,joint,[0,0,-.001],[.020,.020,.003]);
    mesh(port,roundedSolid(.018,.003,.004,.001,.0007),cyan,[0,0,.004]);
  }
  mesh(torso,new T.CylinderGeometry(.13,.16,.14,32),joint,[0,1.30,0]);
  for(const y of [1.25,1.32])mesh(torso,new T.CylinderGeometry(.155,.155,.018,40),alloy,[0,y,0]);
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
    const exhaust=mesh(backpack,new T.TorusGeometry(.043,.007,8,32),alloy,[x,-.21,0]);exhaust.rotation.x=Math.PI/2;
  }
  for(let i=0;i<3;i++)mesh(backpack,roundedSolid(.105,.012,.008,.005,.002),trim,[0,-.118-i*.035,.132]);
  for(const x of [-.15,.15])for(const y of [-.17,.17])sphere(backpack,trim,[x,y,.131],[.012,.012,.006]);
  // The rear energy unit has an instrument-like concentric assembly.
  mesh(backpack,new T.TorusGeometry(.086,.004,8,48),alloy,[0,.035,.144]);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,x=Math.cos(a)*.080,y=.035+Math.sin(a)*.080;
    sphere(backpack,alloy,[x,y,.145],[.004,.004,.002]);
  }
  const head = new T.Group();head.position.set(0,1.64,0);torso.add(head);
  const helmet=sphere(head,pearl,[0,.20,0],[.84,.73,.61]);helmet.name='helmet-shell';outline(helmet,.020);
  // Larger readable assembly details, with a controlled edge hierarchy.
  // The face itself and approved eyes/mouth remain unchanged.
  const helmetBand=[];
  for(let j=0;j<=64;j++){const a=j/64*Math.PI*2;helmetBand.push([.84*.919*Math.cos(a),.20+.73*.919*Math.sin(a),-.24]);}
  seam(head,helmetBand,.0035,gasketMaterial);
  curvedPlate(head,.24,.065,.018,.715,helmetFront,.009,insetMaterial).name='helmet-id-plate';
  engraving(head,'OS-01',-.085,.735,helmetFront,.0085);
  for(const sign of [-1,1]){
    const linePoints=[.18,.28,.39,.50].map(yy=>[sign*.71,yy,helmetFront(sign*.71,yy)+.010]);
    seam(head,linePoints,.004,alloy);
    for(let i=0;i<3;i++){
      const xx=sign*(.57+i*.025),yy=.62;
      seam(head,[[xx,yy-.024,helmetFront(xx,yy-.024)+.012],[xx,yy+.012,helmetFront(xx,yy+.012)+.012]],.003,gasketMaterial);
    }
  }
  const crownPoints=[[-.49,.68],[-.28,.77],[0,.80],[.28,.77],[.49,.68]];
  const crownCurve=new T.CatmullRomCurve3(crownPoints.map(([x,y])=>new T.Vector3(x,y,helmetFront(x,y)+.005)));
  mesh(head,new T.TubeGeometry(crownCurve,64,.003,6,false),alloy);
  for(const sign of [-1,1])sphere(head,alloy,[sign*.49,-.27,helmetFront(sign*.49,-.27)+.012],[.010,.010,.004]);
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
  mesh(head,visorSurface(.738,.535,.125,.008),pupilInk);
  mesh(head,visorSurface(.720,.517,.125,.014),trim);
  mesh(head,visorSurface(.686,.486,.125,.020),dark);
  // Two short light guides follow the visor's actual compound curve; a broken
  // arc is clearer and more precise than a continuous neon outline.
  for(const [start,end] of [[.30,1.04],[Math.PI-1.04,Math.PI-.30]]){
    const points=[];
    for(let i=0;i<=20;i++){
      const a=start+(end-start)*i/20,x=.707*Math.cos(a),y=.125+.505*Math.sin(a);
      points.push([x,y,helmetFront(x,y)+.027]);
    }
    seam(head,points,.0035,energyMaterial);
  }
  for(const sign of [-1,1]){
    const xx=sign*.57;
    seam(head,[[xx,.30,helmetFront(xx,.30)+.024],[xx+sign*.025,.28,helmetFront(xx+sign*.025,.28)+.024],[xx+sign*.025,.20,helmetFront(xx+sign*.025,.20)+.024]],.002,cyan);
  }
  // A small reflective highlight gives the visor a glass-like surface.
  const highlight = new T.MeshBasicMaterial({color:0x74b9f7, transparent:true, opacity:.055, depthWrite:false});
  const glint=sphere(head,highlight,[-.35,.48,helmetFront(-.35,.48)+.026],[.13,.024,.004]);glint.rotation.z=.45;
  sphere(head,white,[-.48,.62,helmetFront(-.48,.62)+.01],[.050,.027,.008]).rotation.z=.6;
  sphere(head,white,[-.36,.68,helmetFront(-.36,.68)+.01],[.025,.015,.007]).rotation.z=.6;
  const eyes=[];
  for(const x of [-.27,.27]) {
    const eye = new T.Group();eye.position.set(x,.22,helmetFront(x,.22)+.035);eye.rotation.y=x*.48;head.add(eye);
    sphere(eye,pupilInk,[0,0,-.003],[.196,.214,.018]);
    sphere(eye,cyan,[0,0,.006],[.184,.201,.018]);
    const irisRim=mesh(eye,new T.TorusGeometry(.175,.0025,6,48),alloy,[0,0,.019]);irisRim.scale.y=1.09;
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
    const earRing=mesh(head,new T.TorusGeometry(.141,.005,8,48),alloy,[sign*.944,.16,.015]);earRing.rotation.y=Math.PI/2;
    const earRecess=mesh(head,new T.TorusGeometry(.112,.0035,8,48),trim,[sign*.952,.16,.015]);earRecess.rotation.y=Math.PI/2;
    for(let j=0;j<4;j++){
      const a=j*Math.PI/2+.5,yy=.16+Math.sin(a)*.12,zz=.015+Math.cos(a)*.12;
      sphere(head,energyMaterial,[sign*.955,yy,zz],[.003,.008,.008]);
    }
    for(let i=0;i<3;i++){
      const a=-.7+i*.7;
      sphere(head,alloy,[sign*.94,.16+Math.sin(a)*.17,.015+Math.cos(a)*.15],[.004,.009,.009]);
    }
  }
  const antenna = new T.Group();antenna.position.set(.29,.86,-.04);antenna.rotation.z=-.12;head.add(antenna);
  mesh(antenna,new T.CylinderGeometry(.018,.025,.19,16),trim,[0,.085,0]);
  mesh(antenna,new T.CylinderGeometry(.033,.04,.045,24),alloy,[0,.005,0]);
  const antennaTip=sphere(antenna,cyan,[0,.21,0],[.083,.083,.083]);outline(antennaTip,.05);
  sphere(antenna,white,[-.02,.23,.05],[.017,.017,.007]);
  const arms=[];
  for(const sign of [-1,1]) {
    const shoulder=new T.Group();shoulder.position.set(sign*.36,1.15,0);torso.add(shoulder);
    sphere(shoulder,joint,[0,0,0],[.085,.085,.085]);
    const shoulderCap=sphere(shoulder,insetMaterial,[sign*.018,-.038,.018],[.126,.115,.115]);shoulderCap.name='articulated-shoulder-cap';
    seam(shoulder,[[sign*.09,.012,.075],[sign*.12,-.045,.075],[sign*.09,-.095,.075]],.004,alloy);
    const upperArm=mesh(shoulder,new T.CapsuleGeometry(.108,.17,8,24),pearl,[0,-.13,0]);outline(upperArm,.045);
    mesh(shoulder,new T.CylinderGeometry(.107,.107,.015,28),alloy,[0,-.19,0]);
    const elbow=new T.Group();elbow.position.y=-.27;shoulder.add(elbow);
    sphere(elbow,pearl,[0,0,0],[.099,.099,.099]);
    for(let i=0;i<4;i++){
      const bellow=mesh(elbow,new T.TorusGeometry(.096,.0045,6,28),gasketMaterial,[0,-.034+i*.022,0]);bellow.rotation.x=Math.PI/2;
    }
    mesh(shoulder,roundedSolid(.10,.08,.012,.025,.003),insetMaterial,[0,-.09,.104]);
    mesh(shoulder,roundedSolid(.045,.009,.004,.003,.001),cyan,[0,-.09,.113]);
    const forearm=mesh(elbow,new T.CapsuleGeometry(.095,.13,8,24),pearl,[0,-.12,0]);outline(forearm,.045);
    mesh(elbow,roundedSolid(.095,.115,.014,.024,.003),insetMaterial,[0,-.12,.093]);
    for(let i=0;i<3;i++)mesh(elbow,roundedSolid(.045,.005,.004,.002,.001),i===0?energyMaterial:alloy,[0,-.087-i*.023,.103]);
    const hand=new T.Group();hand.position.set(0,-.26,.02);elbow.add(hand);
    // Small cuff layers articulate the hand/forearm transition without
    // changing the mitten silhouette or any of the animation pivots.
    mesh(elbow,new T.CylinderGeometry(.097,.102,.025,32),trim,[0,-.229,0]);
    mesh(elbow,new T.CylinderGeometry(.099,.099,.009,32),pearl,[0,-.213,0]);
    const mitten=sphere(hand,pearl,[0,0,0],[.13,.14,.10]);outline(mitten,.035);
    sphere(hand,cyan,[0,0,.08],[.04,.05,.012]);
    sphere(hand,pearl,[-sign*.092,.035,.025],[.043,.064,.05]);
    for(const x of [-.032,.032])seam(hand,[[x,-.042,.096],[x,-.073,.082],[x,-.092,.065]],.0025,alloy);
    arms.push({shoulder,elbow,hand,sign});
  }
  const legs=[];
  for(const sign of [-1,1]) {
    const leg=new T.Group();leg.position.set(sign*.22,.47,0);leg.scale.set(1.10,1.10,1.06);leg.rotation.y=sign*.09;root.add(leg);
    mesh(leg,new T.CapsuleGeometry(.13,.11,8,24),pearl,[0,-.14,0]);
    mesh(leg,new T.CylinderGeometry(.133,.135,.024,32),trim,[0,-.22,0]);
    const sole=sphere(leg,trim,[0,-.355,.09],[.19,.065,.255]);outline(sole,.035);
    const boot=sphere(leg,pearl,[0,-.29,.075],[.19,.12,.25]);outline(boot,.035);
    seam(leg,[[-.13,-.32,.22],[-.08,-.335,.284],[0,-.339,.310],[.08,-.335,.284],[.13,-.32,.22]],.004,alloy);
    // Fine toe accents are embedded into the boot instead of drawn as thick lines.
    for(const x of [-.055,0,.055])mesh(leg,roundedSolid(.025,.004,.005,.001,.001),alloy,[x,-.245,.27]);
    legs.push(leg);
  }
  // Give the original big-eyed explorer a fuller suit and a less top-heavy
  // silhouette. Compensate the head inside its torso parent so its final
  // dimensions are intentional, rather than growing with the body.
  torso.scale.set(1.10,1.09,1.04);
  head.scale.set(.88/1.10,.90/1.09,.90/1.04);
  head.position.y=1.61;
  root.rotation.y=-.15;
  // Only solid exterior surfaces enter the shadow pass; inverted outline
  // meshes and transparent highlights otherwise cause false dark halos.
  root.traverse(o=>{if(o.isMesh&&o.material.side!==T.BackSide&&!o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});
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
