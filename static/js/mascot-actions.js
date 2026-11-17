/* Additive joint choreography; the approved character geometry stays intact. */
export const ACTIONS=['curious','celebrate','stretch','twirl','bow','wave'];
export const DURATIONS={wave:2.6,curious:3.1,celebrate:2.4,stretch:3.5,twirl:3.6,bow:2.5};
export const ACTION_LABELS={wave:'Hello!',curious:'Curious',celebrate:'Happy hop',stretch:'Stretch',twirl:'Space spin',bow:'Little bow'};
export function createActionSequence(){
  const order=['celebrate','curious','stretch','twirl','bow','wave'];let index=0,last='wave';
  return{next(){let name=order[index++%order.length];if(name===last)name=order[index++%order.length];last=name;return name;},note(name){last=name;}};
}
const smooth=t=>t*t*(3-2*t);
function envelope(t){return smooth(Math.min(1,t/.22))*smooth(Math.min(1,(1-t)/.25));}

export function applyRobotAction(robot,name,age){
  const duration=DURATIONS[name];
  if(!duration||age<0||age>=duration)return false;
  const t=age/duration,p=envelope(t),{root,torso,head,arms,legs,antenna}=robot;
  if(name==='wave'){
    head.rotation.z+=p*.09;
    const right=arms.find(a=>a.sign===1);
    right.shoulder.rotation.z+=p*1.65;
    right.elbow.rotation.z+=p*(.25+Math.sin(age*11)*.27);
    right.hand.rotation.z+=p*Math.sin(age*11)*.18;
  }else if(name==='curious'){
    head.rotation.z+=p*(.18+Math.sin(t*Math.PI*2)*.08);
    head.rotation.y+=p*Math.sin(t*Math.PI*2)*.30;
    head.rotation.x+=p*.045;
    torso.rotation.z-=p*.045;
    const right=arms.find(a=>a.sign===1);
    right.shoulder.rotation.z+=p*.60;right.elbow.rotation.x-=p*.35;
    antenna.rotation.z+=p*.12;
  }else if(name==='celebrate'){
    const jump=Math.max(0,Math.sin(t*Math.PI*4));
    root.position.y+=jump*(t<.5?.16:.10);
    torso.rotation.z+=p*Math.sin(t*Math.PI*4)*.07;
    for(const {shoulder,elbow,sign}of arms){shoulder.rotation.z+=sign*p*.85;elbow.rotation.x-=p*.25;}
    for(const leg of legs)leg.rotation.x-=jump*.13;
    head.rotation.z+=p*Math.sin(t*Math.PI*4)*.08;
  }else if(name==='stretch'){
    for(const {shoulder,elbow,hand,sign}of arms){shoulder.rotation.z+=sign*p*.88;elbow.rotation.z-=sign*p*.09;hand.rotation.z+=sign*p*.12;}
    torso.rotation.x-=p*.07;root.position.y+=p*.035;head.rotation.x-=p*.12;
    antenna.rotation.z+=p*Math.sin(age*4)*.06;
  }else if(name==='twirl'){
    root.rotation.y+=smooth(t)*Math.PI*2;
    for(const {shoulder,sign}of arms)shoulder.rotation.z+=sign*p*.28;
    root.rotation.z+=p*Math.sin(t*Math.PI*2)*.035;
    head.rotation.z+=p*.06;
  }else if(name==='bow'){
    torso.rotation.x+=p*.23;head.rotation.x+=p*.13;
    for(const {shoulder,elbow}of arms){shoulder.rotation.x-=p*.36;elbow.rotation.x-=p*.22;}
    antenna.rotation.z+=p*Math.sin(age*5)*.08;
  }
  return true;
}
