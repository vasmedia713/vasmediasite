import {createHash, randomUUID} from 'node:crypto';
const copy = value => structuredClone(value);
export class ContractError extends Error { constructor(code) { super(code); this.code=code; } }
const fail = code => { throw new ContractError(code); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Synthetic shared-store adapter. Not durable, not a production database. */
export function memoryStore() { return {drafts:new Map(),versions:new Map(),photos:new Map(),submissions:new Map(),audit:[],catalog:new Map(),contracts:new Map(),invoices:new Map()}; }
export class CustomerService {
  constructor({store,assignments,templates,clock=()=>Date.now(),destination=null}) { Object.assign(this,{store,assignments,templates,clock,destination}); }
  authorize(principal,customer) {
    const a=this.assignments.find(a=>a.subject===principal?.id && a.customer===customer);
    if (!a || a.revoked || a.expiresAt<=this.clock()) fail('ACCESS_DENIED');
    if (!this.templates[a.template] || this.templates[a.template].customer!==customer) fail('TEMPLATE_MISMATCH');
    return a;
  }
  key(a) { return `${a.customer}/${a.subject}/${a.template}`; }
  load(principal,customer) {
    const a=this.authorize(principal,customer), key=this.key(a);
    return copy({template:this.templates[a.template],draft:this.store.drafts.get(key)||{schemaVersion:1,template:a.template,revision:0,answers:{inventory:[],packages:[],closing:[],language:'unknown'},photos:[]}});
  }
  validate(answers) {
    if (!answers || !Array.isArray(answers.inventory) || !Array.isArray(answers.packages) || !Array.isArray(answers.closing) || !['unknown','English','Spanish','Both'].includes(answers.language)) fail('INVALID_ANSWERS');
    if (answers.inventory.length>100 || answers.packages.length>100 || answers.closing.length>30) fail('TOO_MANY_ENTRIES');
    const ids=new Set();
    for (const item of [...answers.inventory,...answers.packages]) {
      if (!item || typeof item.id!=='string' || !/^[\w-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.name!=='string' || !item.name.trim() || item.name.length>160 || !['confirm','correct','unknown','add'].includes(item.decision)) fail('INVALID_ITEM');
      ids.add(item.id);
      if (item.quantity!==null && (!Number.isSafeInteger(item.quantity) || item.quantity<0)) fail('INVALID_QUANTITY');
      if (item.priceCents!==null && (!Number.isSafeInteger(item.priceCents) || item.priceCents<0)) fail('INVALID_PRICE');
      if (!Number.isSafeInteger(item.baseVersion) || item.baseVersion<0) fail('INVALID_BASE_VERSION');
      if (item.details!==undefined && (typeof item.details!=='string' || item.details.length>2000)) fail('INVALID_DETAILS');
      if (Object.keys(item).some(k=>!['id','name','decision','quantity','priceCents','baseVersion','details','includes'].includes(k))) fail('UNKNOWN_ITEM_FIELD');
    }
    for (const p of answers.packages) {
      if (!Array.isArray(p.includes) || p.includes.length>100 || p.includes.some(i=>!answers.inventory.some(x=>x.id===i.itemId) || !Number.isSafeInteger(i.quantity) || i.quantity<1)) fail('INVALID_COMPOSITION');
    }
    if (answers.closing.some(x=>typeof x!=='string' || x.length>4000)) fail('INVALID_CLOSING');
    if (JSON.stringify(answers).length>100000) fail('ANSWERS_TOO_LARGE');
  }
  save(principal,customer,{expectedRevision,answers,photos=[]}) {
    const a=this.authorize(principal,customer),key=this.key(a),old=this.load(principal,customer).draft;
    if (old.revision!==expectedRevision) fail('DRAFT_CONFLICT');
    this.validate(answers);
    if (!Array.isArray(photos) || photos.length>30 || photos.some(id=>{const p=this.store.photos.get(id);return !p || p.key!==key || p.status!=='complete';})) fail('PHOTO_NOT_READY');
    const draft={schemaVersion:1,template:a.template,revision:old.revision+1,answers:copy(answers),photos:copy(photos),savedAt:new Date(this.clock()).toISOString()};
    this.store.drafts.set(key,draft);this.store.versions.set(`${key}/${draft.revision}`,copy(draft)); return copy(draft);
  }
  beginPhoto(principal,customer,{itemId,mime,size,sha256}) {
    const a=this.authorize(principal,customer),key=this.key(a),draft=this.load(principal,customer).draft;
    if (!draft.answers.inventory.concat(draft.answers.packages).some(i=>i.id===itemId)) fail('UNKNOWN_ITEM');
    if (!['image/jpeg','image/png','image/webp'].includes(mime) || !Number.isSafeInteger(size) || size<1 || size>10000000 || !/^[a-f0-9]{64}$/.test(sha256)) fail('INVALID_PHOTO');
    const id=randomUUID();this.store.photos.set(id,{id,key,itemId,mime,size,sha256,status:'pending',expiresAt:this.clock()+900000});return {id,status:'pending'};
  }
  completePhoto(principal,customer,id,verifiedObject) {
    const a=this.authorize(principal,customer),p=this.store.photos.get(id);
    if (!p || p.key!==this.key(a)) fail('ACCESS_DENIED');
    if (p.expiresAt<=this.clock()) fail('UPLOAD_EXPIRED');
    // Trusted adapter must inspect actual bytes, decode image, scan and verify private object ownership.
    if (!verifiedObject || verifiedObject.sha256!==p.sha256 || verifiedObject.size!==p.size || verifiedObject.mime!==p.mime || verifiedObject.safe!==true) fail('UPLOAD_UNVERIFIED');
    p.status='complete'; return copy(p);
  }
  photo(principal,customer,id) {
    const a=this.authorize(principal,customer),p=this.store.photos.get(id);
    if (!p || p.key!==this.key(a) || p.status!=='complete') fail('ACCESS_DENIED');
    return copy(p);
  }
  receipt(principal,customer,revision) {
    const a=this.authorize(principal,customer),r=this.store.submissions.get(`${this.key(a)}/${revision}`);
    return r ? copy(r) : null;
  }
  async submit(principal,customer,revision) {
    const a=this.authorize(principal,customer),key=this.key(a),id=`${key}/${revision}`;
    let record=this.store.submissions.get(id);
    if (record?.status==='verified' || record?.status==='pending') return copy(record);
    const draft=this.store.drafts.get(key);
    if (!record && (!draft || revision!==draft.revision)) fail('STALE_SUBMISSION');
    if (!record) { this.validate(draft.answers); record={id,customer,subject:a.subject,template:a.template,revision,payload:copy(draft),digest:hash(draft),status:'pending',updateStatus:'disabled',notionUrl:null};this.store.submissions.set(id,record); }
    record.status='pending';
    if (!this.destination) { record.status='disabled';return copy(record); }
    try {
      // Adapter upserts/reconciles by id and digest, including unknown timeout outcomes.
      const result=await this.destination.deliver(copy(record));
      const url=new URL(result?.notionUrl);
      if (result?.verified!==true || url.protocol!=='https:' || !['notion.so','www.notion.so','app.notion.com'].includes(url.hostname)) fail('UNVERIFIED_RECEIPT');
      record.status='verified';record.notionUrl=url.href;
      record.updateStatus='pending';
    } catch { record.status='retryable';record.error='Destination outcome unverified. Reconcile and retry this version.'; }
    return copy(record);
  }
  applySynthetic(principal,customer,revision) {
    const a=this.authorize(principal,customer),r=this.store.submissions.get(`${this.key(a)}/${revision}`);
    if (!r || r.status!=='verified') fail('SUBMISSION_UNVERIFIED');
    if (r.updateStatus==='applied') return copy(r);
    if (r.updateStatus==='rolled-back') fail('VERSION_ROLLED_BACK');
    const items=[...r.payload.answers.inventory,...r.payload.answers.packages].filter(i=>i.decision!=='unknown');
    for(const i of items) { const old=this.store.catalog.get(`${customer}/${i.id}`);if ((old?.version||0)!==i.baseVersion || i.priceCents===null || i.quantity===null) fail('CATALOG_CONFLICT'); }
    for(const i of items) { const k=`${customer}/${i.id}`,before=this.store.catalog.get(k)||null,after={...copy(i),version:i.baseVersion+1};this.store.catalog.set(k,after);this.store.audit.push({submission:r.id,before:copy(before),after:copy(after)}); }
    r.updateStatus='applied';return copy(r);
  }
  rollbackSynthetic(principal,customer,revision) {
    const a=this.authorize(principal,customer),r=this.store.submissions.get(`${this.key(a)}/${revision}`);
    if (!r || r.updateStatus!=='applied') fail('ROLLBACK_UNAVAILABLE');
    const events=this.store.audit.filter(x=>x.submission===r.id && !x.rollback);
    for(const event of events) { const current=this.store.catalog.get(`${customer}/${event.after.id}`);if(hash(current)!==hash(event.after)) fail('ROLLBACK_CONFLICT'); }
    for(const event of events) { const key=`${customer}/${event.after.id}`;if(event.before===null)this.store.catalog.delete(key);else this.store.catalog.set(key,copy(event.before));this.store.audit.push({submission:r.id,rollback:true,before:copy(event.after),after:copy(event.before)}); }
    r.updateStatus='rolled-back';return copy(r);
  }
}
