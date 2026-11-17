import * as T from './vendor/three.module.min.js';
import {roundedSolid} from './mascot-model.js?v=orbit-proportions-7';

const SPECS=[
  ['windows','Windows','#419dec',false,[-1.55,2.22,-.15],-.11],
  ['linux','Linux','#eb6b28',false,[1.45,.58,.3],.10],
  ['macos','macOS','#74a9d7',false,[1.62,2.0,-.2],.10],
  ['android','Android','#8bd94b',true,[.91,3.02,-.6],-.12],
  ['ios','iOS','#a18ae4',true,[-.86,3.03,-.6],.14],
  ['web','Web','#7dbde9',false,[-1.43,.65,.15],-.10]
];

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
  const canvas=document.createElement('canvas');canvas.width=mobile?320:512;canvas.height=mobile?560:344;
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,color);g.addColorStop(1,id==='linux'?'#ce4419':id==='ios'?'#7168cf':id==='android'?'#4d9635':'#2869ae');c.fillStyle=g;c.fillRect(0,0,w,h);
  const wash=c.createRadialGradient(w*.18,h*.12,0,w*.18,h*.12,w*.9);wash.addColorStop(0,'rgba(255,255,255,.24)');wash.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=wash;c.fillRect(0,0,w,h);
  // Deliberately quiet: one recognisable mark, one clear platform name.
  c.save();c.translate(w/2,h*(mobile?.46:.45));c.scale(mobile?1.65:1.65,mobile?1.65:1.65);icon(c,id,color);c.restore();
  c.fillStyle='#fff';c.textAlign='center';c.font='500 '+(mobile?24:27)+'px system-ui';c.fillText(label,w/2,h*.82);
  if(mobile){c.fillStyle='#10223d';c.beginPath();c.roundRect(w*.35,12,w*.30,13,7);c.fill();c.fillStyle='#ffffffb0';c.beginPath();c.roundRect(w*.35,h-16,w*.30,4,2);c.fill();}
  else{c.fillStyle='#ffffffa0';for(let i=0;i<3;i++){c.beginPath();c.arc(19+i*13,17,3,0,Math.PI*2);c.fill();}}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function screenGeometry(w,h,r){
  const geometry=roundedSolid(w,h,.008,r,.003);
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/w+.5,p.getY(i)/h+.5);
  uv.needsUpdate=true;return geometry;
}
export function createPlatforms(scene){
  const devices=[],pickable=[];
  const shellMat=new T.MeshToonMaterial({color:0xe6f1fa});
  const ink=new T.MeshBasicMaterial({color:0x112c48,side:T.BackSide});
  const bezelMat=new T.MeshStandardMaterial({color:0x183b63,roughness:.4,metalness:.2});
  for(const [id,label,color,mobile,position,tilt] of SPECS){
    const device=new T.Group(),w=mobile?.47:.84,h=mobile?.86:.57;
    const body=new T.Mesh(roundedSolid(w,h,.070,mobile?.085:.065,.018),shellMat);device.add(body);
    const contour=new T.Mesh(body.geometry,ink);contour.scale.set(1.035,1.035,1.08);device.add(contour);
    const bezel=new T.Mesh(roundedSolid(w-.035,h-.035,.013,mobile?.068:.050,.004),bezelMat);bezel.position.z=.038;device.add(bezel);
    const screen=new T.Mesh(screenGeometry(w-.059,h-.059,mobile?.059:.041),new T.MeshBasicMaterial({map:screenTexture(id,label,color,mobile),toneMapped:false}));screen.position.z=.048;screen.userData.platform=id;device.add(screen);pickable.push(screen);
    if(!mobile&&id!=='web'){
      const deck=new T.Mesh(roundedSolid(w+.06,.07,.29,.035,.014),shellMat);deck.position.set(0,-h/2-.01,.09);deck.rotation.x=-.04;device.add(deck);
    }
    // Side keys give the phones a silhouette without adding front-panel noise.
    if(mobile){const key=new T.Mesh(roundedSolid(.018,.10,.018,.007,.003),shellMat);key.position.set(w/2+.004,.12,0);device.add(key);}
    device.position.set(...position);scene.add(device);devices.push({device,position:new T.Vector3(...position),tilt,phase:devices.length*.9});
  }
  return{devices,pickable};
}
