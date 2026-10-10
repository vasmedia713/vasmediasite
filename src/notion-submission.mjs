// Inject an approved server-only request transport. No credentials or live client here.
export class NotionSubmissionAdapter {
 constructor({request,parent}){if(!/^[a-f0-9]{32}$/.test(parent))throw Error('Invalid approved parent');Object.assign(this,{request,parent});}
 async children(id){let cursor=null,all=[];for(let page=0;page<100;page++){const query=new URLSearchParams({page_size:'100'});if(cursor)query.set('start_cursor',cursor);const data=await this.request('GET',`/v1/blocks/${id}/children?${query}`);all.push(...data.results);if(!data.has_more)return all;cursor=data.next_cursor;if(!cursor)throw Error('Incomplete listing');}throw Error('Listing too large');}
 async reconcile(record){
  const title=`VDS submission ${record.id}`,pages=(await this.children(this.parent)).filter(b=>b.type==='child_page'&&b.child_page.title===title);
  if(pages.length!==1)return {verified:false,reason:pages.length?'duplicate_destination':'not_observed'};
  const page=await this.request('GET',`/v1/pages/${pages[0].id}`);
  const clean=id=>id?.replaceAll('-','');
  if(page.archived||page.in_trash||clean(page.parent?.page_id)!==this.parent)return {verified:false,reason:'wrong_parent'};
  const text=(await this.children(page.id)).filter(b=>b.type==='paragraph').map(b=>(b.paragraph.rich_text||[]).map(t=>t.plain_text??t.text?.content??'').join('')).join('');
  let observed;try{observed=JSON.parse(text);}catch{return {verified:false,reason:'incomplete_payload'};}
  if(observed.id!==record.id||observed.digest!==record.digest||JSON.stringify(observed.payload)!==JSON.stringify(record.payload))return {verified:false,reason:'payload_mismatch'};
  return {verified:true,id:record.id,digest:record.digest,notionUrl:`https://app.notion.com/p/${clean(page.id)}`};
 }
 async deliver(record,{markCreateAttempt}){
  const prior=await this.reconcile(record);if(prior.verified)return prior;
  // Any previously attempted create is reconciled only; absence is not proof it failed.
  if(record.lease.create_attempted||prior.reason!=='not_observed')return prior;
  const body=JSON.stringify({schemaVersion:1,id:record.id,digest:record.digest,payload:record.payload});
  if(body.length>150000)throw Error('Payload too large');
  const chunks=[];let chunk='';for(const character of body){if(chunk.length+character.length>1800){chunks.push(chunk);chunk='';}chunk+=character;}if(chunk)chunks.push(chunk);
  // Durable mark BEFORE external call. A crash between mark and send remains
  // explicitly ambiguous rather than risking a duplicate Notion page.
  await markCreateAttempt(record.lease);
  try{
   await this.request('POST','/v1/pages',{parent:{page_id:this.parent},properties:{title:{type:'title',title:[{type:'text',text:{content:`VDS submission ${record.id}`}}]}},children:chunks.map(content=>({object:'block',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content}}]}}))});
   return await this.reconcile(record);
  }catch{return {verified:false,reason:'unknown_create_outcome'};}
 }
}
export async function deliverNext(outbox,adapter,worker){const record=await outbox.claim(worker);if(!record)return null;let result;try{result=await adapter.deliver(record,{markCreateAttempt:lease=>outbox.markCreateAttempt(lease)});}catch{result={verified:false,reason:'unverified_destination'};}await outbox.finish(record.lease,result);return result;}
