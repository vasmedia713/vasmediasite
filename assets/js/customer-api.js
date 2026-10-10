// No browser identity, demo fallback, credential lookup or local answer storage.
export function customerApi(customer, transport=fetch) {
  const url='/.netlify/functions/customer'+(customer?'?customer='+encodeURIComponent(customer):'');
  async function request(body) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await transport(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
      if(!response.ok){const error=new Error('Customer service unavailable');error.status=response.status;throw error;}
      return await response.json();
    } finally {clearTimeout(timer);}
  }
  return {load:()=>request(),save:draft=>request({operation:'save',draft}),submit:revision=>request({operation:'submit',revision}),receipt:revision=>request({operation:'receipt',revision})};
}
export function validateWorkspace(value) {
  const t=value?.template,d=value?.draft;
  if(!t || t.kind!=='pesmera-inventory' || t.fixture!==false || typeof t.id!=='string' || !Number.isSafeInteger(t.version) || !Array.isArray(t.steps) || t.steps.length!==6 || t.steps.some(s=>typeof s.title!=='string'||typeof s.why!=='string'||typeof s.example!=='string') || !d || d.schemaVersion!==1 || d.template!==t.id || !Number.isSafeInteger(d.revision) || d.revision<0 || !Array.isArray(d.photos) || !Array.isArray(d.answers?.inventory) || !Array.isArray(d.answers?.packages) || !Array.isArray(d.answers?.closing))throw Error('Unverified workspace contract');
  return structuredClone(value);
}
export function accessMessage(status) {
  return status===401?'Customer sign-in is required. Use Customer access to continue.':status===403?'This customer assignment is unavailable, expired or revoked. Contact VDS for access.': 'Customer authentication, private drafts, photos and submissions are not connected. No answers can be entered or submitted yet.';
}
