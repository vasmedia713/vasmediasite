/** Unwired API adapter factory. The deployed customer function stays disabled.
 * resolveVerifiedUser must call the selected server auth SDK and return its fixed provider namespace;
 * never deserialize a browser principal. Owner Netlify and customer Supabase subjects are distinct.
 */
export function createCustomerHandler(resolveVerifiedUser,service) {
  return async request=>{
    const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
    const reply=(body,status=200)=>Response.json(body,{status,headers});
    if(!['GET','POST'].includes(request.method))return reply({error:'METHOD_NOT_ALLOWED'},405);
    const url=new URL(request.url);
    if(request.method==='POST' && request.headers.get('Origin')!==url.origin)return reply({error:'ORIGIN_DENIED'},403);
    try {
      const principal=await resolveVerifiedUser(request);
      if(!principal?.id)return reply({error:'SIGN_IN_REQUIRED'},401);
      const customer=url.searchParams.get('customer');
      if(request.method==='GET')return reply(await service.load(principal,customer));
      if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return reply({error:'JSON_REQUIRED'},415);
      const chunks=[],reader=request.body?.getReader();let size=0;
      if(reader){for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>120000){await reader.cancel();return reply({error:'REQUEST_TOO_LARGE'},413);}chunks.push(value);}}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      const body=JSON.parse(raw);
      // identity/customer/template fields in the body are rejected, not forwarded.
      if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!['operation','draft','revision','photo','photoId'].includes(k)))return reply({error:'UNKNOWN_FIELD'},400);
      if(body.operation==='save')return reply(await service.save(principal,customer,body.draft));
      if(body.operation==='beginPhoto')return reply(await service.beginPhoto(principal,customer,body.photo));
      if(body.operation==='completePhoto')return reply(await service.completePhoto(principal,customer,body.photoId));
      if(body.operation==='submit')return reply(await service.submit(principal,customer,body.revision));
      if(body.operation==='receipt')return reply(await service.receipt(principal,customer,body.revision));
      return reply({error:'UNKNOWN_OPERATION'},400);
    }catch(e){const denied=e?.code==='ACCESS_DENIED';return reply({error:denied?'ACCESS_DENIED':e?.code==='DRAFT_CONFLICT'?'DRAFT_CONFLICT':'REQUEST_UNVERIFIED'},denied?403:e?.code==='DRAFT_CONFLICT'?409:400);}
  };
}
