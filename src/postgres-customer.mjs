import {createHash,randomUUID} from 'node:crypto';
import {CustomerService,ContractError} from './customer-service.mjs';
const fail=code=>{throw new ContractError(code);};
const validator=new CustomerService({});
const digest=payload=>createHash('sha256').update(JSON.stringify(payload)).digest('hex');
/** Adapts an approved pg-compatible pool; no credentials are read here. */
export function postgresTransactions(pool){return {transaction:async work=>{const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}};}
export class PostgresCustomerRepository {
 constructor(db,{verifyPhoto=null}={}){this.db=db;this.verifyPhoto=verifyPhoto;}
 async scoped(principal,customer,work){
  if(!['netlify','supabase'].includes(principal?.provider)||typeof principal?.id!=='string'||!principal.id||typeof customer!=='string')fail('ACCESS_DENIED');
  return this.db.transaction(async tx=>{
   await tx.query("SELECT set_config('vds.provider',$1,true),set_config('vds.subject',$2,true),set_config('vds.customer',$3,true)",[principal.provider,principal.id,customer]);
   const {rows}=await tx.query('SELECT * FROM vds_intake.assignments WHERE provider=$1 AND subject=$2 AND customer=$3 AND expires_at>now() AND NOT revoked FOR SHARE',[principal.provider,principal.id,customer]);
   if(rows.length!==1)fail('ACCESS_DENIED');return work(tx,rows[0]);
  });
 }
 load(principal,customer){return this.scoped(principal,customer,async(tx,a)=>{const {rows}=await tx.query('SELECT * FROM vds_intake.drafts WHERE workspace=$1',[a.workspace]);return rows[0]||{workspace:a.workspace,revision:0,payload:{schemaVersion:1,template:a.template,answers:{inventory:[],packages:[],closing:[],language:'unknown'},photos:[]}};});}
 save(principal,customer,{expectedRevision,answers,photos=[]}){
  validator.validate(answers);if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)fail('DRAFT_CONFLICT');
  if(!Array.isArray(photos)||photos.length>30||new Set(photos).size!==photos.length)fail('PHOTO_NOT_READY');
  return this.scoped(principal,customer,async(tx,a)=>{
   // Serialize first creation as well as updates across independent connections.
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.workspace]);
   const old=(await tx.query('SELECT revision FROM vds_intake.drafts WHERE workspace=$1 FOR UPDATE',[a.workspace])).rows[0];
   if((old?.revision||0)!==expectedRevision)fail('DRAFT_CONFLICT');
   for(const id of photos){const p=(await tx.query("SELECT * FROM vds_intake.uploads WHERE id=$1 AND workspace=$2 AND status='complete'",[id,a.workspace])).rows[0];if(!p||!answers.inventory.concat(answers.packages).some(i=>i.id===p.item_id))fail('PHOTO_NOT_READY');}
   const revision=expectedRevision+1,payload={schemaVersion:1,template:a.template,revision,answers,photos};
   await tx.query('INSERT INTO vds_intake.versions(workspace,revision,payload) VALUES($1,$2,$3)',[a.workspace,revision,JSON.stringify(payload)]);
   await tx.query('INSERT INTO vds_intake.drafts(workspace,revision,payload) VALUES($1,$2,$3) ON CONFLICT(workspace) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,saved_at=now()',[a.workspace,revision,JSON.stringify(payload)]);
   return payload;
  });
 }
 submit(principal,customer,revision){return this.scoped(principal,customer,async(tx,a)=>{
  if(!Number.isSafeInteger(revision)||revision<1)fail('STALE_SUBMISSION');
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.workspace]);
  const previous=(await tx.query('SELECT * FROM vds_intake.submissions WHERE workspace=$1 AND revision=$2',[a.workspace,revision])).rows[0];if(previous)return previous;
  const draft=(await tx.query('SELECT * FROM vds_intake.drafts WHERE workspace=$1 FOR UPDATE',[a.workspace])).rows[0];
  if(!draft||draft.revision!==revision)fail('STALE_SUBMISSION');
  const result=(await tx.query('INSERT INTO vds_intake.submissions(id,workspace,revision,digest) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),a.workspace,revision,digest(draft.payload)])).rows[0];
  await tx.query('INSERT INTO vds_intake.outbox(submission) VALUES($1)',[result.id]);return result;
 });}
 receipt(principal,customer,revision){return this.scoped(principal,customer,async(tx,a)=>(await tx.query('SELECT * FROM vds_intake.submissions WHERE workspace=$1 AND revision=$2',[a.workspace,revision])).rows[0]||null);}
 beginPhoto(principal,customer,{itemId,mime,size,sha256}){return this.scoped(principal,customer,async(tx,a)=>{
  if(!['image/jpeg','image/png','image/webp'].includes(mime)||!Number.isSafeInteger(size)||size<1||size>10000000||!/^[a-f0-9]{64}$/.test(sha256))fail('INVALID_PHOTO');
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.workspace]);
  const draft=(await tx.query('SELECT payload FROM vds_intake.drafts WHERE workspace=$1',[a.workspace])).rows[0];
  if(!draft?.payload.answers.inventory.concat(draft.payload.answers.packages).some(i=>i.id===itemId))fail('UNKNOWN_ITEM');
  const count=(await tx.query("SELECT count(*)::int AS n FROM vds_intake.uploads WHERE workspace=$1 AND (status='complete' OR expires_at>now())",[a.workspace])).rows[0].n;if(count>=30)fail('PHOTO_LIMIT');
  const id=randomUUID(),prefix=createHash('sha256').update(a.workspace).digest('hex');
  return (await tx.query("INSERT INTO vds_intake.uploads(id,workspace,item_id,object_key,mime,size,sha256,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '15 minutes') RETURNING *",[id,a.workspace,itemId,`${prefix}/${id}`,mime,size,sha256])).rows[0];
 });}
 async completePhoto(principal,customer,id){
  const manifest=await this.scoped(principal,customer,async(tx,a)=>(await tx.query('SELECT * FROM vds_intake.uploads WHERE id=$1 AND workspace=$2 AND expires_at>now()',[id,a.workspace])).rows[0]);
  if(!manifest||!this.verifyPhoto)fail('UPLOAD_UNVERIFIED');
  const result=await this.verifyPhoto(manifest);
  if(result?.safe!==true||['id','workspace','object_key','mime','size','sha256'].some(k=>result[k]!==manifest[k]))fail('UPLOAD_UNVERIFIED');
  return this.scoped(principal,customer,async(tx,a)=>{const row=(await tx.query("UPDATE vds_intake.uploads SET status='complete' WHERE id=$1 AND workspace=$2 AND expires_at>now() RETURNING *",[id,a.workspace])).rows[0];if(!row)fail('UPLOAD_EXPIRED');return row;});
 }
}
/** Trusted worker only. The pool needs a distinct role; never expose these APIs to customers. */
export class PostgresOutbox {
 constructor(db){this.db=db;}
 claim(worker){return this.db.transaction(async tx=>{
  const row=(await tx.query('SELECT submission FROM vds_intake.outbox WHERE NOT done AND next_attempt<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY next_attempt FOR UPDATE SKIP LOCKED LIMIT 1')).rows[0];if(!row)return null;
  const lease=(await tx.query("UPDATE vds_intake.outbox SET fence=fence+1,worker=$2,lease_until=now()+interval '30 seconds' WHERE submission=$1 RETURNING *",[row.submission,worker])).rows[0];
  const record=(await tx.query('SELECT s.*,v.payload FROM vds_intake.submissions s JOIN vds_intake.versions v ON v.workspace=s.workspace AND v.revision=s.revision WHERE s.id=$1',[row.submission])).rows[0];return {...record,lease};
 });}
 markCreateAttempt(lease){return this.db.transaction(async tx=>{const row=(await tx.query('UPDATE vds_intake.outbox SET create_attempted=true WHERE submission=$1 AND fence=$2 AND worker=$3 AND NOT done AND lease_until>now() RETURNING *',[lease.submission,lease.fence,lease.worker])).rows[0];if(!row)fail('LEASE_LOST');return row;});}
 finish(lease,result){return this.db.transaction(async tx=>{
  const row=(await tx.query('SELECT * FROM vds_intake.outbox WHERE submission=$1 AND fence=$2 AND worker=$3 AND NOT done AND lease_until>now() FOR UPDATE',[lease.submission,lease.fence,lease.worker])).rows[0];if(!row)fail('LEASE_LOST');
  const submission=(await tx.query('SELECT * FROM vds_intake.submissions WHERE id=$1',[lease.submission])).rows[0];
  if(result?.verified===true){
   let url;try{url=new URL(result.notionUrl);}catch{fail('UNVERIFIED_RECEIPT');}
   if(result.id!==submission.id||result.digest!==submission.digest||url.protocol!=='https:'||url.hostname!=='app.notion.com'||url.username||url.password||!/^\/p\/[a-zA-Z0-9-]+$/.test(url.pathname))fail('UNVERIFIED_RECEIPT');
   await tx.query("UPDATE vds_intake.submissions SET status='verified',notion_url=$2,update_status='disabled' WHERE id=$1",[lease.submission,url.href]);
   await tx.query('UPDATE vds_intake.outbox SET done=true,lease_until=NULL WHERE submission=$1',[lease.submission]);
  }else{
   await tx.query("UPDATE vds_intake.submissions SET status='ambiguous' WHERE id=$1",[lease.submission]);
   await tx.query("UPDATE vds_intake.outbox SET lease_until=NULL,next_attempt=now()+interval '60 seconds' WHERE submission=$1",[lease.submission]);
  }
 });}
}
