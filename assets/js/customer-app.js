import {customerApi,validateWorkspace,accessMessage} from './customer-api.js';
const api=customerApi(new URLSearchParams(location.search).get('customer'));
let template, answers, photos=[],busy=false;
const $=id=>document.getElementById(id), section=$('step');
let step=0, revision=0, dirty=false, fieldId=0;

const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function field(parent,label,value,change,{options,type='text',min}={}){
  const id=`field-${fieldId++}`;
  const l=el('label',label);l.htmlFor=id;parent.append(l);
  const input=el(options?'select':type==='textarea'?'textarea':'input');input.id=id;
  if(options)for(const v of options){const o=el('option',v);o.value=v;input.append(o);}else if(type!=='textarea')input.type=type;
  if(min!==undefined)input.min=min;if(type==='number')input.step='1';input.value=value??'';
  input.maxLength=type==='textarea'?2000:160;
  input.addEventListener('input',()=>{change(input.value);dirty=true;$('status').textContent='Unsaved changes in memory. Save a version to keep these changes.';});parent.append(input);return input;
}
function itemCard(item,isPackage=false){
  const card=el('article');card.append(el('h3',item.name));
  card.append(el('p','Review the assigned source values. Leave uncertain quantities and prices unknown.'));
  field(card,'Name',item.name,v=>item.name=v);
  field(card,'Review decision',item.decision,v=>item.decision=v,{options:['confirm','correct','unknown','add']});
  const row=el('div');row.className='row';card.append(row);
  field(row,'Available quantity (blank = unknown)',item.quantity,v=>item.quantity=v===''?null:Number(v),{type:'number',min:0});
  field(row,'Price in cents (blank = unknown)',item.priceCents,v=>item.priceCents=v===''?null:Number(v),{type:'number',min:0});
  field(card,'Details and restrictions',item.details,v=>item.details=v,{type:'textarea'});
  if(isPackage){for(const inventory of answers.inventory){field(card,`Included ${inventory.name}: quantity (0 = excluded)`,item.includes.find(i=>i.itemId===inventory.id)?.quantity||0,v=>{item.includes=item.includes.filter(i=>i.itemId!==inventory.id);if(Number(v)>0)item.includes.push({itemId:inventory.id,quantity:Number(v)});},{type:'number',min:0});}}

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
  if(step===5){section.append(el('p',`Unresolved: ${unresolved().join(', ')||'None in inventory and packages'}. Responsibility: ${answers.responsibility}; language: ${answers.language}.`));const summary=el('pre',JSON.stringify({schemaVersion:1,template:template.id,revision,answers},null,2));section.append(summary);for(let i=0;i<5;i++)addButton(`Edit ${template.steps[i].title}`,()=>{step=i;render();});addButton('Submit saved version',submit);}
  h.focus();
}
$('wizard').addEventListener('submit',e=>{e.preventDefault();if(!$('wizard').reportValidity())return;step=Math.min(5,step+1);render();});
$('back').onclick=()=>{step=Math.max(0,step-1);render();};
function controls(disabled){busy=disabled;document.querySelectorAll('#wizard button,#wizard input,#wizard select,#wizard textarea').forEach(n=>n.disabled=disabled);if(!disabled)$('back').disabled=step===0;}
function lock(message){dirty=false;answers=null;template=null;photos=[];section.replaceChildren();for(const id of ['source','progress','status'])$(id).textContent='';$('workspace').hidden=true;$('gate').textContent=message;$('retry').hidden=false;}
async function save(){
  if(busy||!answers)return;
  if(!$('wizard').reportValidity())return;
  controls(true);
  try{
    const d=await api.save({expectedRevision:revision,answers:structuredClone(answers),photos});
    if(d?.schemaVersion!==1||d.template!==template.id||d.revision!==revision+1||JSON.stringify(d.answers)!==JSON.stringify(answers)||JSON.stringify(d.photos)!==JSON.stringify(photos))throw Error('Unverified save receipt');
    revision=d.revision;dirty=false;$('status').textContent=`Saved version ${revision}.`;
  }catch(e){if(e.status===401||e.status===403)lock(accessMessage(e.status));else $('status').textContent=e.status===409?'Another device has saved a newer version. Your changes remain in memory. Do not overwrite; contact VDS to reconcile.':'Save could not be verified. Your changes remain in memory. Keep this page open and retry.';}
  finally{controls(false);}
}
async function submit(){
  if(busy||!answers)return;
  if(dirty||revision<1){$('status').textContent='Save your changes before submitting a version.';return;}
  controls(true);
  try{
    // Retry uses the same saved version; server owns stable identity and deduplication.
    const r=await api.submit(revision);
    if(r?.revision!==revision||typeof r.id!=='string')throw Error('Unverified receipt');
    $('status').textContent=r.status==='delivered'&&typeof r.notionUrl==='string'&&/^https:\/\/(www\.)?notion\.so\//.test(r.notionUrl)?`Delivery verified for version ${revision}. Reference: ${r.id}. Catalog update status: ${r.updateStatus||'unverified'}.`:`Version ${revision} receipt: ${r.id}. Delivery is ${r.status||'unverified'}; no completed delivery is claimed. Retry this saved version to recover.`;
  }catch(e){if(e.status===401||e.status===403)lock(accessMessage(e.status));else $('status').textContent='Delivery could not be verified. Retry the same saved version; no completed submission is claimed.';}
  finally{controls(false);}
}
$('save').onclick=save;
$('retry').onclick=load;
async function load(){
  if(busy)return;
  busy=true;$('retry').disabled=true;
  try{
    const data=validateWorkspace(await api.load());
    template=data.template;answers=data.draft.answers;photos=data.draft.photos;revision=data.draft.revision;step=0;dirty=false;
    $('gate').textContent='Assigned customer workspace verified by the server.';$('retry').hidden=true;$('workspace').hidden=false;
    $('source').textContent=template.source?`${template.source.label||'Assigned source'} · ${template.source.checkedAt||'Date unverified'}`:'Source date is unverified. Leave uncertain values unknown.';
    $('status').textContent=revision?`Loaded saved version ${revision}.`:'No saved answers yet.';render();
  }catch(e){lock(accessMessage(e.status));}
  finally{busy=false;$('retry').disabled=false;}
}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
// A restored browser-history page must reverify access before showing private data.
window.addEventListener('pagehide',()=>{section.replaceChildren();$('workspace').hidden=true;});
window.addEventListener('pageshow',e=>{if(e.persisted)void load();});
void load();
