import * as T from './vendor/three.module.min.js';

function randomSource(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function gaussian(random){return Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(2*Math.PI*random());}

export function galaxyStars(count=1800){
  const random=randomSource(63842),position=[],color=[],size=[],phase=[];
  const palette=[0xaed9ff,0xd5ecff,0x8edbdc,0xffdfa0];
  for(let i=0;i<count;i++){
    const along=(random()-.5)*10;
    const across=i<count*.70?gaussian(random)*.42:(random()-.5)*6;
    const angle=.46,x=along*Math.cos(angle)-across*Math.sin(angle),y=along*Math.sin(angle)+across*Math.cos(angle);
    position.push(x,1.65+y,-3.0-random()*4.5);
    const c=new T.Color(palette[Math.floor(random()*palette.length)]);color.push(c.r,c.g,c.b);
    size.push(.65+random()**3*2.6);phase.push(random()*Math.PI*2);
  }
  return{position,color,size,phase};
}

function nebulaTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
  const c=canvas.getContext('2d'),random=randomSource(24177);
  function cloud(x,y,rx,ry,color,opacity){
    c.save();c.translate(x,y);c.scale(rx,ry);
    const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba('+color+','+opacity+')');g.addColorStop(.35,'rgba('+color+','+(opacity*.48)+')');g.addColorStop(1,'rgba('+color+',0)');
    c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  c.globalCompositeOperation='lighter';
  // Diffuse dust, then finer knots: an irregular band instead of a flat halo.
  for(let i=0;i<100;i++){
    const x=65+random()*638,y=384+gaussian(random)*64;
    cloud(x,y,45+random()*110,30+random()*72,i%3?'80,145,221':'89,184,191',.018+random()*.035);
  }
  for(let i=0;i<220;i++){
    const x=95+random()*580,y=384+Math.sin(x*.018)*19+gaussian(random)*27;
    cloud(x,y,10+random()*40,8+random()*24,i%7?'159,202,241':'242,218,168',.025+random()*.065);
  }
  cloud(440,386,105,55,'182,215,247',.16);
  // Break up the bright band with a winding dark dust lane.
  c.globalCompositeOperation='destination-out';
  for(let i=0;i<80;i++){
    const x=90+i*7.4,y=383+Math.sin(x*.023)*13;
    cloud(x,y,14+random()*9,4+random()*10,'0,0,0',.17+random()*.22);
  }
  // Fade all four edges so the cloud never appears as a rectangular image.
  c.globalCompositeOperation='destination-in';
  const fade=c.createRadialGradient(384,384,80,384,384,365);fade.addColorStop(0,'rgba(255,255,255,1)');fade.addColorStop(.62,'rgba(255,255,255,.9)');fade.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=fade;c.fillRect(0,0,768,768);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}

export function createGalaxy(scene,pixelRatio=1){
  const root=new T.Group();root.name='galactic-depth';scene.add(root);
  const texture=nebulaTexture();
  const nebula=new T.Mesh(new T.PlaneGeometry(10.5,8),new T.MeshBasicMaterial({map:texture,transparent:true,opacity:.82,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
  nebula.position.set(.15,1.75,-4);nebula.rotation.z=.46;root.add(nebula);
  const mist=new T.Mesh(new T.PlaneGeometry(11.5,8.7),new T.MeshBasicMaterial({map:texture,transparent:true,opacity:.20,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
  mist.position.set(-.2,1.45,-5.5);mist.rotation.z=.43;root.add(mist);
  const data=galaxyStars(),geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(data.position,3));geometry.setAttribute('aColor',new T.Float32BufferAttribute(data.color,3));geometry.setAttribute('aSize',new T.Float32BufferAttribute(data.size,1));geometry.setAttribute('aPhase',new T.Float32BufferAttribute(data.phase,1));
  const uniforms={uTime:{value:0},uPixelRatio:{value:Math.min(pixelRatio,1.7)},uOpacity:{value:.8}};
  const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
    vertexShader:`attribute vec3 aColor;attribute float aSize;attribute float aPhase;
      uniform float uTime;uniform float uPixelRatio;varying vec3 vColor;varying float vGlow;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(aSize*uPixelRatio*12.0/max(1.0,-p.z),1.0,7.0);
        vColor=aColor;vGlow=.65+.23*sin(uTime*.75+aPhase);}`,
    fragmentShader:`uniform float uOpacity;varying vec3 vColor;varying float vGlow;
      void main(){vec2 p=gl_PointCoord-.5;float d=length(p)*2.0;
        float alpha=exp(-d*d*6.0)*(1.0-smoothstep(.12,1.0,d))*vGlow*uOpacity;
        if(alpha<.012)discard;gl_FragColor=vec4(vColor,alpha);
        #include <colorspace_fragment>
      }`
  });
  const stars=new T.Points(geometry,material);stars.frustumCulled=false;root.add(stars);
  let compact=false;
  return{
    root,
    setUnified(value){root.visible=!value;},
    setCompact(value){compact=value;nebula.material.opacity=value?.24:.82;mist.visible=!value;geometry.setDrawRange(0,value?440:data.size.length);uniforms.uOpacity.value=value?.40:.8;},
    update(time,look,reduced=false){
      if(!root.visible)return;
      const t=reduced?0:time;
      uniforms.uTime.value=t;
      root.rotation.y=reduced?0:Math.sin(t*.035)*.018;
      stars.rotation.z=Math.sin(t*.018)*.008;
      nebula.position.x=.15+(reduced?0:look.x*.065+Math.sin(t*.03)*.06);
      nebula.position.y=1.75+(reduced?0:look.y*.04);
      nebula.rotation.z=.46+Math.sin(t*.025)*.008;
      mist.rotation.z=.43-Math.sin(t*.021)*.010;
      if(compact)stars.rotation.z*=.5;
    }
  };
}
