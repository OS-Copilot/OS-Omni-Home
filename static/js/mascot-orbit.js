import * as T from './vendor/three.module.min.js';

// One shared 3D trajectory drives the rail, satellites and their fading wakes.
export const ORBIT_SPEED=.19;
export function orbitPoint(angle,target=new T.Vector3()){
  const c=Math.cos(angle),s=Math.sin(angle);
  // Tilt an orbit around the character's vertical axis: near side below the
  // face, far side rising behind the helmet. A vertical backdrop halo cannot
  // communicate satellites passing in front of and behind the explorer.
  return target.set(2.10*c,1.62-.40*s+.16*c,1.65*s);
}
class OrbitCurve extends T.Curve{
  getPoint(t,target=new T.Vector3()){return orbitPoint(t*Math.PI*2,target);}
}
export function createExplorationOrbit(scene,devices){
  const group=new T.Group();group.name='exploration-orbit';scene.add(group);
  const rail=new T.Mesh(new T.TubeGeometry(new OrbitCurve(),240,.008,8,true),new T.MeshBasicMaterial({color:0x63d9be,transparent:true,opacity:.52}));group.add(rail);
  const ghost=new T.Line(new T.BufferGeometry().setFromPoints(new OrbitCurve().getPoints(180)),new T.LineBasicMaterial({color:0x88d9e9,transparent:true,opacity:.13}));ghost.scale.set(1.08,.94,1.15);ghost.rotation.z=-.12;group.add(ghost);
  // A sparse precision scale shares one draw call, and remains fixed to the
  // actual orbit plane while the satellites travel through it.
  const ticks=new T.InstancedMesh(new T.BoxGeometry(.003,.004,.030),new T.MeshBasicMaterial({color:0x8ecbd4,transparent:true,opacity:.28}),48);
  ticks.name='orbit-calibration-marks';
  const matrix=new T.Matrix4(),rotation=new T.Quaternion(),scale=new T.Vector3(),axis=new T.Vector3(0,0,1);
  for(let i=0;i<48;i++){
    const a=i/48*Math.PI*2,p=orbitPoint(a);
    rotation.setFromUnitVectors(axis,new T.Vector3(Math.cos(a),0,Math.sin(a)));
    scale.set(1,1,i%4===0?1.8:1);matrix.compose(p,rotation,scale);ticks.setMatrixAt(i,matrix);
  }group.add(ticks);
  const trails=devices.map((_,i)=>{
    const positions=new Float32Array(22*3),colors=new Float32Array(22*3),color=new T.Color(i%3===0?0xf8d76d:0x84ecdc);
    for(let j=0;j<22;j++){const strength=(j/21)**1.8;colors[j*3]=color.r*strength;colors[j*3+1]=color.g*strength;colors[j*3+2]=color.b*strength;}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    const line=new T.Line(geometry,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.65,depthWrite:false,blending:T.AdditiveBlending}));line.frustumCulled=false;group.add(line);return line;
  });
  const beacons=[];
  for(let i=0;i<3;i++){
    const beacon=new T.Group();
    const coin=new T.Mesh(new T.SphereGeometry(.045,24,18),new T.MeshStandardMaterial({color:0xffc42b,metalness:.55,roughness:.23}));beacon.add(coin);
    const collar=new T.Mesh(new T.TorusGeometry(.047,.0025,6,32),new T.MeshStandardMaterial({color:0xf1d27b,metalness:.7,roughness:.25}));collar.rotation.x=.55;beacon.add(collar);
    const sparkle=new T.Mesh(new T.SphereGeometry(.019,12,8),new T.MeshBasicMaterial({color:0xfff1ac}));sparkle.position.set(-.022,.025,.048);beacon.add(sparkle);group.add(beacon);beacons.push(beacon);
  }
  const point=new T.Vector3();
  return {
    setVisible(value){group.visible=value;},
    update(time,camera,reduced=false){
      const clock=reduced?0:time;
      devices.forEach(({device,tilt},i)=>{
        const angle=i*Math.PI/3+.4+clock*ORBIT_SPEED;
        orbitPoint(angle,device.position);
        const depth=device.position.z;
        device.scale.setScalar(.87+depth*.055);
        device.lookAt(camera.position);
        device.rotation.y+=Math.cos(angle)*-.24;
        device.rotation.x+=Math.sin(angle)*.055;
        device.rotation.z=tilt+Math.sin(angle)*.065;
        const trail=trails[i],positions=trail.geometry.attributes.position;
        for(let j=0;j<22;j++){orbitPoint(angle-.40+(j/21)*.34,point);positions.setXYZ(j,point.x,point.y,point.z);}
        positions.needsUpdate=true;trail.visible=!reduced;
      });
      beacons.forEach((beacon,i)=>orbitPoint(i*Math.PI*2/3+1.1+clock*.11,beacon.position));
    }
  };
}
