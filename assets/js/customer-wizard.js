import {template} from './customer-template.js';
const $=id=>document.getElementById(id), section=$('step');
let step=0, revision=0, dirty=true, fieldId=0;
const answers={responsibility:'unknown',inventory:structuredClone(template.inventory),packages:[],closing:[],language:'unknown'};
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function field(parent,label,value,change,{options,type='text',min}={}){
  const id=`field-${fieldId++}`;
  const l=el('label',label);l.htmlFor=id;parent.append(l);
  const input=el(options?'select':type==='textarea'?'textarea':'input');input.id=id;
  if(options)for(const v of options){const o=el('option',v);o.value=v;input.append(o);}else if(type!=='textarea')input.type=type;
  if(min!==undefined)input.min=min;if(type==='number')input.step='1';input.value=value??'';
  input.maxLength=type==='textarea'?4000:160;
  input.addEventListener('input',()=>{change(input.value);dirty=true;$('status').textContent='Unsaved changes in memory. No server save.';});parent.append(input);return input;
}
function itemCard(item,isPackage=false){
  const card=el('article');card.append(el('h3',item.name));
  card.append(el('p',`${template.source.label} · ${template.source.checkedAt}. Historical conflicts: none in synthetic fixture; real source comparison pending.`));
  field(card,'Name',item.name,v=>item.name=v);
  field(card,'Review decision',item.decision,v=>item.decision=v,{options:['confirm','correct','unknown','add']});
  const row=el('div');row.className='row';card.append(row);
  field(row,'Available quantity (blank = unknown)',item.quantity,v=>item.quantity=v===''?null:Number(v),{type:'number',min:0});
  field(row,'Price in cents (blank = unknown)',item.priceCents,v=>item.priceCents=v===''?null:Number(v),{type:'number',min:0});
  field(card,'Details and restrictions',item.details,v=>item.details=v,{type:'textarea'});
  if(isPackage){for(const inventory of answers.inventory){field(card,`Included ${inventory.name}: quantity (0 = excluded)`,item.includes.find(i=>i.itemId===inventory.id)?.quantity||0,v=>{item.includes=item.includes.filter(i=>i.itemId!==inventory.id);if(Number(v)>0)item.includes.push({itemId:inventory.id,quantity:Number(v)});},{type:'number',min:0});}}
  else{const photo=field(card,'Photo contract demonstration (file is not uploaded)','',()=>{},{type:'file'});photo.accept='image/jpeg,image/png,image/webp';photo.addEventListener('change',()=>{$('status').textContent='Upload disabled. No file has been stored; pending uploads cannot be submitted.';photo.value='';});}
  section.append(card);
}
function addButton(label,action){const b=el('button',label);b.type='button';b.onclick=action;section.append(b);}
function unresolved(){return [...answers.inventory,...answers.packages].filter(i=>i.decision==='unknown'||i.quantity===null||i.priceCents===null).map(i=>i.name);}
function render(){
  section.replaceChildren();fieldId=0;const definition=template.steps[step],h=el('h2',definition.title);h.tabIndex=-1;section.append(h,el('p',definition.why),el('p',definition.example));
  $('progress').textContent=`Step ${step+1} of ${template.steps.length} · ${template.name}`;$('bar').value=step+1;
  $('back').disabled=step===0;$('next').hidden=step===5;
  if(step===0)field(section,'I am responsible for reviewing these business answers',answers.responsibility,v=>answers.responsibility=v,{options:['unknown','confirm','correct']});
  if(step===1||step===2){const list=step===1?answers.inventory:answers.packages;list.forEach(i=>itemCard(i,step===2));addButton(step===1?'Add inventory item':'Add package',()=>{list.push({id:`entry-${crypto.randomUUID()}`,name:step===1?'New item':'New package',decision:'add',quantity:null,priceCents:null,baseVersion:0,details:'',...(step===2?{includes:[]}:{})});dirty=true;render();});}
  if(step===3)field(section,'Preferred customer language',answers.language,v=>answers.language=v,{options:['unknown','English','Spanish','Both']});
  if(step===4){answers.closing.forEach((x,i)=>field(section,`Question or additional change ${i+1}`,x,v=>answers.closing[i]=v,{type:'textarea'}));addButton('Add question or change',()=>{answers.closing.push('');dirty=true;render();});}
  if(step===5){section.append(el('p',`Unresolved: ${unresolved().join(', ')||'None in inventory and packages'}. Responsibility: ${answers.responsibility}; language: ${answers.language}.`));const summary=el('pre',JSON.stringify({schemaVersion:1,template:template.id,revision,answers},null,2));section.append(summary);for(let i=0;i<5;i++)addButton(`Edit ${template.steps[i].title}`,()=>{step=i;render();});addButton('Test submission receipt',async()=>{try{const r=await fetch('/.netlify/functions/customer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision})});if(!r.ok)throw Error();$('status').textContent='Destination response is not verified. Nothing can be claimed submitted.';}catch{$('status').textContent='Submission disabled or unavailable. Answers remain in memory; no Notion receipt exists.';}});}
  h.focus();
}
$('wizard').addEventListener('submit',e=>{e.preventDefault();if(!$('wizard').reportValidity())return;step=Math.min(5,step+1);render();});
$('back').onclick=()=>{step=Math.max(0,step-1);render();};
$('save').onclick=async()=>{try{const response=await fetch('/.netlify/functions/customer',{method:'PUT'});if(!response.ok)throw Error();$('status').textContent='No verified versioned save receipt. Changes remain unsaved.';}catch{$('status').textContent='Save unavailable. Keep this page open; changes remain in memory. Retry after a private storage adapter is connected.';}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
render();
