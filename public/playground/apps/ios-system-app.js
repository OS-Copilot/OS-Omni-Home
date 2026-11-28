(function(){
 'use strict';
 const key=new URLSearchParams(location.search).get('app'),root=document.querySelector('main');
 const definitions={
 news:['News','Saved stories',[['Title','text'],['Source','text'],['Article','textarea']]],
 health:['Health','Health records',[['Metric','select','Steps,Weight,Heart rate,Sleep'],['Value','number'],['Unit','text'],['Date','date']]],
 wallet:['Wallet','Passes',[['Pass name','text'],['Issuer','text'],['Reference','text'],['Valid until','date']]],
 fitness:['Fitness','Workouts',[['Activity','select','Walking,Running,Cycling,Swimming,Strength'],['Minutes','number'],['Calories','number'],['Date','date']]],
 watch:['Watch','Watch preferences',[['Watch name','text'],['Face','select','Modular,Activity,Photos'],['Notifications','select','On,Off']]],
 shortcuts:['Shortcuts','My shortcuts',[['Name','text'],['Action','select','Show message,Start timer'],['Message or seconds','text']]],
 passwords:['Passwords','Demo credentials',[['Website','text'],['Username','text'],['Password','password']]],
 preview:['Preview','Documents',[]]
 };
 const config=definitions[key];if(!config)return;
 document.title=config[0];let records=JSON.parse(localStorage.getItem('records')||'[]'),query='',selected=null,objectURL=null;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const header=el('header');header.append(el('small',config[1]),el('h1',config[0]));root.append(header);
 const search=el('input');search.type='search';search.placeholder='Search '+config[0];search.setAttribute('aria-label',search.placeholder);root.append(search);
 const list=el('section',undefined,'cards');root.append(list);const status=el('p',undefined,'status');status.setAttribute('role','status');root.append(status);
 function save(){localStorage.setItem('records',JSON.stringify(records));render();}
 function render(){list.replaceChildren();const matches=records.filter(r=>r.values.some(v=>String(v).toLowerCase().includes(query)));if(!matches.length)list.append(el('p',query?'No matches':'No '+config[1].toLowerCase()+' yet. Add your first one below.','empty'));
 matches.forEach(r=>{const card=el('article');card.append(el('h2',r.values[0]));r.values.slice(1).forEach((v,i)=>{if(key!=='passwords')card.append(el('p',config[2][i+1][0]+': '+v));else if(i===0)card.append(el('p','Username: '+v));});
 if(key==='shortcuts'){const run=el('button','Run');run.onclick=()=>{if(r.values[1]==='Start timer'){const seconds=Number(r.values[2]);if(!(seconds>0&&seconds<=86400)){status.textContent='Enter a timer between 1 and 86400 seconds.';return;}status.textContent='Timer running';setTimeout(()=>status.textContent=r.values[0]+': timer finished',seconds*1000);}else status.textContent=r.values[2];};card.append(run);}
 const edit=el('button','Edit');edit.onclick=()=>{selected=r.id;config[2].forEach((f,i)=>form.elements['f'+i].value=key==='passwords'&&i===2?'':r.values[i]);form.scrollIntoView({block:'nearest'});};const del=el('button','Delete','secondary');del.onclick=()=>{records=records.filter(x=>x.id!==r.id);save();};card.append(edit,del);list.append(card);});}
 search.oninput=()=>{query=search.value.toLowerCase();render();};
 if(key==='preview'){
  const input=el('input');input.type='file';input.accept='application/pdf,image/*,text/plain,.md';input.setAttribute('aria-label','Open document');const viewer=el('section',undefined,'viewer');root.append(input,viewer);list.remove();search.remove();
  if(window.OSOmniDemo){const sample=el('iframe');sample.src=window.OSOmniDemo.asset('public/demo/project-brief.pdf');sample.title='Demo project brief';viewer.append(sample);status.textContent='Demo project brief - fictional example document';}
  input.onchange=async()=>{const file=input.files[0];if(!file)return;if(objectURL)URL.revokeObjectURL(objectURL);viewer.replaceChildren();status.textContent=file.name+' · '+Math.ceil(file.size/1024)+' KB';if(file.type.startsWith('image/')){objectURL=URL.createObjectURL(file);const image=el('img');image.src=objectURL;image.alt=file.name;viewer.append(image);}else if(file.type==='application/pdf'){objectURL=URL.createObjectURL(file);const frame=el('iframe');frame.src=objectURL;frame.title=file.name;viewer.append(frame);}else if(file.type.startsWith('text/')||/\.(txt|md)$/i.test(file.name)){viewer.append(el('pre',await file.text()));}else status.textContent='Supported files: PDF, images and text.';};return;
 }
 const form=el('form');form.append(el('h2','Add '+(key==='shortcuts'?'shortcut':'record')));
 config[2].forEach((f,i)=>{const label=el('label',f[0]);let input=el(f[1]==='textarea'?'textarea':f[1]==='select'?'select':'input');input.name='f'+i;input.required=true;if(input.tagName==='INPUT')input.type=f[1];if(f[1]==='number'){input.min='0';input.step='any';}if(f[1]==='date')input.value=new Date().toLocaleDateString('en-CA');if(f[1]==='select')f[2].split(',').forEach(v=>{const option=el('option',v);input.append(option);});label.append(input);form.append(label);});
 if(key==='passwords'){const label=el('label','Encryption passphrase');const pass=el('input');pass.type='password';pass.name='passphrase';pass.required=true;pass.minLength=8;label.append(pass);form.append(label);form.append(el('small','Demo credentials are encrypted locally. Use the same passphrase when revealing a saved password.'));const reveal=el('button','Reveal selected password');reveal.type='button';reveal.onclick=async()=>{try{const record=records.find(r=>r.id===selected);if(!record)throw Error('Select Edit on a credential first.');const secret=record.values[2];const aes=await derive(form.elements.passphrase.value,Uint8Array.from(secret.salt));const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(secret.iv)},aes,Uint8Array.from(secret.data));form.elements.f2.value=new TextDecoder().decode(plain);status.textContent='Password revealed in the password field.';}catch(e){status.textContent='Unable to reveal: select a credential and enter its passphrase.';}};form.append(reveal);}
 const submit=el('button','Save');submit.type='submit';form.append(submit);const cancel=el('button','Cancel edit','secondary');cancel.type='button';cancel.onclick=()=>{selected=null;form.reset();};form.append(cancel);root.append(form);
 async function derive(pass,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
 form.onsubmit=async event=>{event.preventDefault();const values=config[2].map((f,i)=>form.elements['f'+i].value.trim());if(key==='passwords'){try{const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),aes=await derive(form.elements.passphrase.value,salt);const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(values[2]));values[2]={salt:Array.from(salt),iv:Array.from(iv),data:Array.from(new Uint8Array(data))};}catch(e){status.textContent='Encryption requires a secure browser context.';return;}}const record={id:selected||crypto.randomUUID(),values};records=records.filter(r=>r.id!==record.id);records.unshift(record);selected=null;save();form.reset();status.textContent='Saved';};render();
})();
