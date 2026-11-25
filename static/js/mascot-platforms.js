import * as T from './vendor/three.module.min.js';
import {roundedSolid} from './mascot-model.js?v=studio-22';

const SPECS=[
  ['windows','Windows','#419dec',false,[-1.55,2.22,-.15],-.11],
  ['linux','Linux','#eb6b28',false,[1.45,.58,.3],.10],
  ['macos','macOS','#74a9d7',false,[1.62,2.0,-.2],.10],
  ['android','Android','#8bd94b',true,[.91,3.02,-.6],-.12],
  ['ios','iOS','#a18ae4',true,[-.86,3.03,-.6],.14],
  ['web','Web','#7dbde9',false,[-1.43,.65,.15],-.10]
];
const IMAGE_CACHE=new Map();
function loadSurfaceImage(src){
  if(typeof Image==='undefined')return Promise.resolve(null);
  if(!IMAGE_CACHE.has(src))IMAGE_CACHE.set(src,new Promise(resolve=>{
    const image=new Image();let settled=false;
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>finish(null),4500);
    image.onload=()=>finish(image);image.onerror=()=>finish(null);image.src=src;
  }));
  return IMAGE_CACHE.get(src);
}
const SURFACE_ICONS=['chrome','files','vscode','libreoffice-calc','settings','calendar','photos','maps','contacts','notes','openshop','openbank'];
const WALLPAPERS={windows:'windows-wallpaper.jpg',linux:'linux-wallpaper.png',macos:'macos-wallpaper.jpg',ios:'ios-home-wallpaper.jpg',android:'android-wallpaper.png'};

function paintDesktop(c,w,h,id,wallpaper,images){
  function round(x,y,rw,rh,r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,rw,rh,r);c.fill();}
  function app(key,x,y,size){const im=images[SURFACE_ICONS.indexOf(key)];if(im)c.drawImage(im,x,y,size,size);}
  c.clearRect(0,0,w,h);
  if(wallpaper){const scale=Math.max(w/wallpaper.naturalWidth,h/wallpaper.naturalHeight),sw=w/scale,sh=h/scale;c.drawImage(wallpaper,(wallpaper.naturalWidth-sw)/2,(wallpaper.naturalHeight-sh)/2,sw,sh,0,0,w,h);}
  if(id==='ios'||id==='android'){
    const ios=id==='ios';
    c.fillStyle='#fff';c.textAlign='left';c.font='600 12px system-ui';c.fillText('9:41',18,23);
    for(let i=0;i<4;i++)round(w-57+i*4,22-i*2,2.5,3+i*2,1,'#fff');
    round(w-31,14,17,8,2,'#ffffffb0');
    round(16,61,w/2-23,99,16,'#e7f1ffb8');round(w/2+7,61,w/2-23,99,16,'#ffffffd9');
    c.fillStyle='#20354c';c.font='600 12px system-ui';c.fillText(ios?'Wednesday':'At a glance',28,83);
    c.font='300 39px system-ui';c.fillText('19',28,127);
    c.font='600 13px system-ui';c.fillText('OS-Omni',w/2+19,87);
    for(let j=0;j<3;j++)round(w/2+19,103+j*13,w/2-50-j*8,4,2,'#6d91b45a');
    const labels=['Photos','Maps','Calendar','Contacts','Notes','Settings','OpenShop','OpenBank','Chrome','Files','Code','Sheets'];
    const keys=['photos','maps','calendar','contacts','notes','settings','openshop','openbank','chrome','files','vscode','libreoffice-calc'];
    const size=34,step=(w-76)/3;
    for(let i=0;i<12;i++){
      const x=21+(i%4)*step,y=195+Math.floor(i/4)*75;
      if(ios)round(x-2,y-2,size+4,size+4,9,'#ffffff37');
      else round(x-3,y-3,size+6,size+6,20,'#eef5ffb0');
      app(keys[i],x,y,size);c.fillStyle='#fff';c.font='9px system-ui';c.textAlign='center';c.fillText(labels[i],x+17,y+50);
    }
    round(13,h-62,w-26,43,ios?16:23,'#ecf2ff62');
    ['chrome','contacts','notes','photos'].forEach((key,i)=>app(key,29+i*(w-84)/3,h-55,28));
    round(w*.35,h-9,w*.30,3,2,'#ffffffe6');
  }else{
    const mac=id==='macos',linux=id==='linux';
    round(0,0,w,15,0,mac?'#e8f1ff9a':linux?'#101725de':'#ffffff00');
    if(mac||linux){c.fillStyle=mac?'#21364b':'#fff';c.font='600 8px system-ui';c.textAlign='left';c.fillText(mac?'Finder   File   Edit   View':'Activities',10,11);c.textAlign='right';c.fillText('09:41',w-11,11);}
    if(linux){
      round(0,15,32,h-15,0,'#15202dc9');
      ['chrome','files','vscode','libreoffice-calc','settings'].forEach((key,i)=>app(key,6,27+i*35,21));
    }else{
      const bw=mac?258:220,y=h-34;
      round(mac?(w-bw)/2:0,y,mac?bw:w,34,mac?10:0,'#e6effac9');
      ['files','chrome','vscode','libreoffice-calc','calendar','settings'].forEach((key,i)=>app(key,(w-218)/2+i*36,y+6,23));
    }
    ['files','openshop','openbank','vscode','libreoffice-calc','chrome'].forEach((key,i)=>{
      const x=(linux?52:18)+(i%2)*48,y=34+Math.floor(i/2)*55;app(key,x,y,24);
      c.fillStyle='#fff';c.font='7px system-ui';c.textAlign='center';c.fillText(['Files','OpenShop','OpenBank','Code','Sheets','Chrome'][i],x+12,y+35);
    });
  }
}

function apple(c){
  c.beginPath();c.moveTo(0,-24);c.bezierCurveTo(-29,-43,-48,-10,-30,23);c.bezierCurveTo(-16,49,-8,36,0,36);c.bezierCurveTo(12,36,17,47,31,21);c.bezierCurveTo(7,10,13,-10,31,-17);c.bezierCurveTo(19,-35,7,-33,0,-24);c.fill();c.beginPath();c.ellipse(7,-43,6,14,.7,0,Math.PI*2);c.fill();
}
function icon(c,id,color){
  c.fillStyle='#fff';c.strokeStyle='#fff';c.lineWidth=4;
  if(id==='windows')for(const [x,y]of[[-33,-33],[3,-33],[-33,3],[3,3]])c.fillRect(x,y,30,30);
  else if(id==='ios'||id==='macos')apple(c);
  else if(id==='android'){
    c.beginPath();c.arc(0,-7,30,Math.PI,0);c.fill();c.fillRect(-30,-4,60,38);
    c.beginPath();c.moveTo(-20,-31);c.lineTo(-28,-45);c.moveTo(20,-31);c.lineTo(28,-45);c.stroke();
    for(const [x,y,h]of[[-40,-2,32],[33,-2,32],[-18,28,20],[10,28,20]]){c.beginPath();c.roundRect(x,y,8,h,4);c.fill();}
    c.fillStyle=color;for(const x of[-12,12]){c.beginPath();c.arc(x,-17,2.7,0,Math.PI*2);c.fill();}
  }else if(id==='linux'){
    c.lineWidth=7;c.beginPath();c.arc(0,0,29,0,Math.PI*2);c.stroke();
    for(let j=0;j<3;j++){const a=j*Math.PI*2/3,x=Math.cos(a)*38,y=Math.sin(a)*38;c.fillStyle=color;c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fill();}
  }else{
    c.lineWidth=3.5;c.beginPath();c.arc(0,0,35,0,Math.PI*2);c.moveTo(-35,0);c.lineTo(35,0);c.moveTo(-30,-17);c.lineTo(30,-17);c.moveTo(-30,17);c.lineTo(30,17);c.stroke();c.beginPath();c.ellipse(0,0,16,35,0,0,Math.PI*2);c.stroke();
  }
}
function screenTexture(id,label,color,mobile){
  const canvas=document.createElement('canvas');canvas.width=mobile?480:768;canvas.height=mobile?1040:480;
  const c=canvas.getContext('2d'),w=canvas.width/1.5,h=canvas.height/1.5;
  c.scale(1.5,1.5);
  const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,color);g.addColorStop(1,id==='linux'?'#ce4419':id==='ios'?'#7168cf':id==='android'?'#4d9635':'#2869ae');c.fillStyle=g;c.fillRect(0,0,w,h);
  const wash=c.createRadialGradient(w*.18,h*.12,0,w*.18,h*.12,w*.9);wash.addColorStop(0,'rgba(255,255,255,.24)');wash.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=wash;c.fillRect(0,0,w,h);
  // Small illustrated OS surfaces, not flat logo stickers. The same palette
  // and legible platform mark are retained in every miniature workspace.
  function pill(x,y,pw,ph,fill,r=8){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,pw,ph,r);c.fill();}
  c.save();c.globalAlpha=.18;c.strokeStyle='#fff';
  for(let j=0;j<6;j++){
    c.lineWidth=18-j*2;c.beginPath();c.moveTo(-w*.1,h*(.5+j*.04));
    c.bezierCurveTo(w*.2,-h*.2,w*.8,h*1.3,w*1.1,h*.28+j*10);c.stroke();
  }c.restore();
  if(mobile){
    c.fillStyle='#fff';c.textAlign='left';c.font='600 13px system-ui';c.fillText('9:41',20,27);
    for(let j=0;j<4;j++)pill(w-65+j*5,25-j*3,3,4+j*3,'#ffffffe0',1);
    c.strokeStyle='#fff';c.lineWidth=1.4;c.strokeRect(w-37,16,20,10);pill(w-35,18,15,6,'#ffffffd0',1);
    pill(18,h*.16,w-36,h*.38,'#ffffff12',22);
    c.strokeStyle='#ffffff40';c.lineWidth=1;c.beginPath();c.roundRect(18,h*.16,w-36,h*.38,22);c.stroke();
    for(let row=0;row<2;row++)for(let col=0;col<4;col++){
      const px=26+col*(w-52)/3,py=h*.72+row*48;
      pill(px-14,py-14,28,28,['#ffffffd9','#a5e8f5','#d8d6ff','#ffffff92'][(col+row)%4],id==='ios'?7:14);
      pill(px-5,py-4,10,8,color,3);
    }
    pill(19,h-56,w-38,40,'#ffffff24',19);
    for(let j=0;j<4;j++)pill(44+j*(w-88)/3,h-47,23,23,'#ffffffcc',id==='ios'?6:12);
    pill(w*.35,h-12,w*.3,3,'#ffffffdd',2);
  }else{
    pill(w*.16,h*.19,w*.68,h*.62,'#0c21433a',14);
    c.strokeStyle='#ffffff55';c.lineWidth=1.3;c.beginPath();c.roundRect(w*.16,h*.19,w*.68,h*.62,14);c.stroke();
    pill(w*.16,h*.19,w*.68,26,'#ffffff22',12);
    for(let j=0;j<3;j++)pill(w*.19+j*13,h*.19+10,5,5,['#ffb2ad','#ffe4a1','#bbf0d5'][j],3);
    pill(w*.30,h*.19+10,w*.29,4,'#ffffff55',2);
    if(id==='web'){
      pill(0,0,w,40,'#e4edf7',0);
      for(let j=0;j<3;j++)pill(15+j*12,15,6,6,['#ec968d','#e8c873','#8acbb1'][j],3);
      pill(66,9,w-89,23,'#ffffff',5);
      c.fillStyle='#58718d';c.font='12px system-ui';c.textAlign='left';c.fillText('os-omni / explore',83,25);
    }else{
      pill(0,0,w,20,id==='linux'?'#1722379a':'#ffffff25',0);
      pill(14,7,40,5,'#ffffffb0',2);pill(w-63,7,47,5,'#ffffff99',2);
      const bw=id==='windows'?138:190,by=h-34;
      pill((w-bw)/2,by,bw,27,'#e8f3ff54',8);
      for(let j=0;j<6;j++)pill((w-bw)/2+11+j*(bw-27)/6,by+7,13,13,['#ffffffd0','#89dce7','#bcd1ff'][j%3],4);
    }
  }
  c.save();c.translate(w/2,h*(mobile?.35:.46));c.scale(mobile?1.12:1.16,mobile?1.12:1.16);icon(c,id,color);c.restore();
  c.fillStyle='#fff';c.textAlign='center';c.font='600 '+(mobile?23:25)+'px system-ui';c.fillText(label,w/2,h*(mobile?.49:.70));
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const wallpaperPath=WALLPAPERS[id]&&'static/images/'+WALLPAPERS[id];
  texture.userData.surfaceReady=Promise.all([
    loadSurfaceImage(id==='web'?'public/favicon-512.png':wallpaperPath),
    ...SURFACE_ICONS.map(key=>loadSurfaceImage('static/images/app-icons/'+key+'.png'))
  ]).then(([wallpaper,...images])=>{
    if(!wallpaper)return;
    if(id==='web'){
      c.fillStyle='#0c1524';c.fillRect(0,0,w,h);
      c.fillStyle='#e6edf5';c.fillRect(0,0,w,32);
      for(let i=0;i<3;i++){c.fillStyle=['#e59f97','#e4c77d','#8cc9ab'][i];c.beginPath();c.arc(13+i*12,16,3,0,Math.PI*2);c.fill();}
      c.fillStyle='#fff';c.beginPath();c.roundRect(63,6,w-82,21,5);c.fill();
      c.fillStyle='#506781';c.textAlign='left';c.font='10px system-ui';c.fillText('os-copilot.github.io',76,20);
      c.fillStyle='#9badc6';c.font='8px system-ui';c.fillText('Overview   Playground   Benchmark   Results',21,55);
      c.fillStyle='#eaf0fb';c.font='600 35px system-ui';c.fillText('OS-Omni',24,122);
      c.font='13px system-ui';c.fillText('Computer-using agents.',25,153);c.fillText('Across platforms.',25,173);
      c.fillStyle='#7bdac5';c.beginPath();c.roundRect(25,198,112,25,5);c.fill();
      c.fillStyle='#0c1524';c.font='600 9px system-ui';c.fillText('Explore the benchmark',35,214);
      c.drawImage(wallpaper,w*.54,81,w*.39,w*.39);
      ['300 tasks','6 platforms','12 workflows'].forEach((label,i)=>{
        c.fillStyle='#19283e';c.beginPath();c.roundRect(22+i*(w-35)/3,h-63,(w-70)/3,40,5);c.fill();
        c.fillStyle='#c4d1e5';c.font='11px system-ui';c.fillText(label,34+i*(w-35)/3,h-38);
      });
    }else paintDesktop(c,w,h,id,wallpaper,images);
    texture.needsUpdate=true;
  });
  return texture;
}
function platformLabel(label,color){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const c=canvas.getContext('2d');c.fillStyle='#0c1524d9';c.beginPath();c.roundRect(2,3,508,90,40);c.fill();
  c.fillStyle=color;c.beginPath();c.arc(42,48,7,0,Math.PI*2);c.fill();
  c.fillStyle='#e6f0fc';c.font='500 39px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(label,274,50);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  return new T.Mesh(new T.PlaneGeometry(.39,.073),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));
}
function rearBrand(id,color){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d');c.translate(64,64);c.scale(.8,.8);icon(c,id,color);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const mark=new T.Mesh(new T.PlaneGeometry(.105,.105),new T.MeshBasicMaterial({map,transparent:true,opacity:.64,depthWrite:false,toneMapped:false}));
  mark.rotation.y=Math.PI;mark.name='rear-brand-mark';return mark;
}
function screenGeometry(w,h,r){
  const geometry=roundedSolid(w,h,.002,r,.0006);
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/w+.5,p.getY(i)/h+.5);
  uv.needsUpdate=true;return geometry;
}
export function createPlatforms(scene){
  const devices=[],pickable=[],surfacePromises=[];
  const shellMat=new T.MeshPhysicalMaterial({color:0xcbd7e2,metalness:.72,roughness:.24,clearcoat:.45,clearcoatRoughness:.20,anisotropy:.35});
  const bezelMat=new T.MeshStandardMaterial({color:0x183b63,roughness:.4,metalness:.2});
  const titanium=new T.MeshStandardMaterial({color:0x9bb3cc,metalness:.72,roughness:.26});
  const black=new T.MeshStandardMaterial({color:0x071526,metalness:.22,roughness:.28});
  const lensMat=new T.MeshPhysicalMaterial({color:0x174d76,roughness:.13,metalness:.35,clearcoat:1});
  const led=new T.MeshBasicMaterial({color:0x9ae7ee});
  const glassMat=new T.MeshPhysicalMaterial({color:0xf1f8ff,metalness:.08,roughness:.10,clearcoat:1,clearcoatRoughness:.09,transparent:true,opacity:.035,depthWrite:false});
  const edgeMat=new T.MeshPhysicalMaterial({color:0xe6f2fb,metalness:.8,roughness:.19,clearcoat:.5});
  const insetMat=new T.MeshStandardMaterial({color:0x52677e,metalness:.6,roughness:.42});
  // One shared, instanced vent/port geometry keeps perforated details cheap.
  const dotGeometry=new T.SphereGeometry(1,8,6);
  const detailGeometry=new T.SphereGeometry(1,12,8);
  function part(parent,g,m,x=0,y=0,z=0,name=''){
    const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.name=name;parent.add(mesh);return mesh;
  }
  function panel(parent,w,h,d,r,m,x,y,z,name){return part(parent,roundedSolid(w,h,d,r,Math.min(.003,d/3)),m,x,y,z,name);}
  function lens(parent,x,y,z,r){
    part(parent,new T.TorusGeometry(r,.0025,6,24),titanium,x,y,z,'camera-bezel');
    const m=part(parent,detailGeometry,lensMat,x,y,z);m.scale.set(r*.82,r*.82,.004);
    const glint=part(parent,detailGeometry,led,x-r*.2,y+r*.23,z+.004);glint.scale.set(r*.15,r*.15,.001);
  }
  function perforations(parent,count,position,step,scale){
    const dots=new T.InstancedMesh(dotGeometry,black,count),matrix=new T.Matrix4();
    const q=new T.Quaternion(),s=new T.Vector3(...scale);
    for(let i=0;i<count;i++)matrix.compose(new T.Vector3(...position).addScaledVector(new T.Vector3(...step),i),q,s),dots.setMatrixAt(i,matrix);
    dots.name='precision-perforations';parent.add(dots);return dots;
  }
  function edgeLine(parent,w,h,r,z){
    const points=[];
    for(let corner=0;corner<4;corner++){
      const cx=(corner===0||corner===3?1:-1)*(w/2-r),cy=(corner<2?1:-1)*(h/2-r);
      for(let j=0;j<=8;j++){
        const a=(corner*Math.PI/2)+(j/8)*Math.PI/2;
        points.push(new T.Vector3(cx+Math.cos(a)*r,cy+Math.sin(a)*r,z));
      }
    }
    const edge=new T.LineLoop(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xd7eaff,transparent:true,opacity:.48}));
    edge.name='polished-edge';parent.add(edge);
  }
  for(const [id,label,color,mobile,position,tilt] of SPECS){
    const device=new T.Group(),w=mobile?.44:.92,h=mobile?.92:.59;
    const depth=mobile?.042:id==='web'?.018:.036,front=depth/2;
    const anodized=new T.MeshPhysicalMaterial({color,metalness:.48,roughness:.30,clearcoat:.42,clearcoatRoughness:.21});
    device.name='platform-'+id;
    const body=new T.Mesh(roundedSolid(w,h,depth,mobile?.064:.030,.005),shellMat);device.add(body);
    edgeLine(device,w-.005,h-.005,mobile?.062:.028,front-.002);
    const bezel=new T.Mesh(roundedSolid(w-.012,h-.012,.004,mobile?.058:.025,.001),black);bezel.position.z=front+.001;device.add(bezel);
    const map=screenTexture(id,label,color,mobile);surfacePromises.push(map.userData.surfaceReady);
    const screen=new T.Mesh(screenGeometry(w-.028,h-.028,mobile?.052:.019),new T.MeshBasicMaterial({map,toneMapped:false}));screen.position.z=front+.004;screen.userData.platform=id;device.add(screen);pickable.push(screen);
    const glass=new T.Mesh(screen.geometry,glassMat);glass.position.z=front+.006;device.add(glass);
    // A separate metal band and rear panel give the edge a machined profile.
    panel(device,w+.001,h+.001,.008,mobile?.064:.030,titanium,0,0,-.004,'metal-frame');
    panel(device,w-.010,h-.010,.004,mobile?.059:.027,mobile?anodized:shellMat,0,0,-depth/2-.001,'rear-shell');
    if(id!=='web'){
      const mark=rearBrand(id,color);mark.position.set(0,mobile?-.04:0,-depth/2-.005);device.add(mark);
    }
    if(mobile){
      panel(device,id==='ios'?.102:.035,.016,.004,.007,black,0,h/2-.034,front+.008,'earpiece');
      lens(device,id==='ios'?.077:0,h/2-.034,front+.009,.005);
      for(const [side,y,kh] of [[1,.14,.10],[-1,.15,.065],[-1,.04,.065]])
        panel(device,.012,kh,.027,.005,titanium,side*(w/2+.003),y,0,'side-key');
      for(const side of [-1,1])for(const y of [-.28,.29])panel(device,.011,.013,.066,.003,bezelMat,side*w/2,y,-.004,'antenna-break');
      const rear=new T.Group();rear.rotation.y=Math.PI;rear.position.z=-depth/2-.007;device.add(rear);
      panel(rear,.145,.18,.018,.028,titanium,-w*.27,h*.31,0,'camera-island');
      lens(rear,-w*.30,h*.36,.013,.027);lens(rear,-w*.20,h*.26,.013,.027);
      const flash=part(rear,detailGeometry,edgeMat,-w*.15,h*.38,.014);flash.scale.set(.008,.008,.002);
      perforations(device,6,[-.092,-h/2+.003,.002],[.014,0,0],[.003,.002,.005]);
      perforations(device,4,[.050,-h/2+.003,.002],[.014,0,0],[.003,.002,.005]);
      panel(device,.043,.009,.013,.003,black,0,-h/2+.002,0,'charging-port');
      panel(device,.030,.003,.011,.001,titanium,0,-h/2+.003,.001,'charging-tongue');
    }else if(id==='windows'){
      // A monitor has a real stem and foot, rather than a laptop's thick bar.
      panel(device,.055,.14,.030,.012,titanium,0,-h/2-.060,-.008,'monitor-stem');
      panel(device,.34,.018,.22,.035,shellMat,0,-h/2-.127,.035,'monitor-foot');
      panel(device,.30,.005,.18,.028,insetMat,0,-h/2-.137,.035,'rubber-base');
      panel(device,.040,.073,.006,.012,black,0,-h/2-.060,-.026,'cable-management-slot');
      for(let i=0;i<5;i++)panel(device,.048,.003,.004,.001,insetMat,0,h*.20-i*.012,-depth/2-.004,'rear-vent');
      lens(device,0,h/2-.007,front+.004,.003);
      const power=part(device,detailGeometry,led,w*.40,-h/2+.007,front+.003);power.scale.set(.003,.003,.002);
    }else if(id!=='web'){
      const deck=new T.Group();deck.position.set(0,-h/2-.008,.105);deck.rotation.x=.40;device.add(deck);
      panel(deck,w+.025,.019,.38,.020,titanium,0,0,.03,'laptop-deck');
      panel(deck,w+.020,.006,.375,.018,shellMat,0,.012,.03,'palm-rest');
      panel(deck,.755,.003,.195,.014,black,0,.017,-.047,'keyboard-well');
      // Five keyboard rows share one draw call. The well and keycap surface
      // sit above the palm rest, so the keys do not disappear into its shell.
      const keys=new T.InstancedMesh(roundedSolid(.043,.004,.027,.004,.0008),insetMat,65);
      keys.name='keyboard-keycaps';
      const transform=new T.Matrix4();let k=0;
      for(let row=0;row<5;row++)for(let col=0;col<13;col++){
        transform.makeTranslation((col-6)*.053,.021,-.124+row*.034);keys.setMatrixAt(k++,transform);
      }deck.add(keys);
      panel(deck,.230,.004,.024,.004,insetMat,0,.021,.047,'spacebar');
      panel(deck,w*.94,.003,.022,.006,black,0,.015,-.151,'hinge-vent');
      perforations(deck,10,[-.409,.017,-.116],[0,0,.016],[.002,.001,.002]);
      perforations(deck,10,[.409,.017,-.116],[0,0,.016],[.002,.001,.002]);
      panel(deck,.18,.002,.072,.007,bezelMat,0,.017,.129,'trackpad-inset');
      panel(deck,.176,.002,.068,.006,shellMat,0,.019,.129,'trackpad');
      panel(deck,.09,.003,.006,.002,black,0,.002,.221,'opening-notch');
      panel(deck,.050,.008,.018,.003,black,-w/2-.008,-.002,.062,'side-usb-port');
      panel(deck,.030,.006,.018,.002,black,w/2+.008,-.002,.089,'side-usbc-port');
      const hinge=part(device,new T.CylinderGeometry(.014,.014,w*.78,24),titanium,0,-h/2,.012,'hinge');hinge.rotation.z=Math.PI/2;
      lens(device,0,h/2-.007,front+.005,.003);
    }else{
      // Browser is a thin glass panel, with a deliberately lighter rim.
      panel(device,w*.7,.003,.004,.001,titanium,0,-h/2+.005,front+.003,'browser-bottom-edge');
    }
    const tag=platformLabel(label,color);tag.position.set(0,-h/2-(mobile?.080:id==='windows'?.215:id==='web'?.08:.16),.07);device.add(tag);
    // Lids cast a genuine shadow onto their keyboards; glass and labels do not
    // take part in the shadow map and cannot create opaque rectangular halos.
    body.castShadow=true;
    device.traverse(o=>{if(o.isMesh&&!o.material.transparent)o.receiveShadow=true;});
    device.position.set(...position);scene.add(device);devices.push({device,position:new T.Vector3(...position),tilt,phase:devices.length*.9});
  }
  return{devices,pickable,ready:Promise.all(surfacePromises)};
}
