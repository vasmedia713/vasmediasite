const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const api=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(root,'assets/js/customer-api.js'))).toString('base64'));
test('public build includes product route and excludes fixture HTML and scripts',()=>{
  execFileSync('python',['build.py'],{cwd:root});
  for(const file of ['customer/index.html','assets/js/customer-app.js','assets/js/customer-api.js','assets/css/customer.css'])assert.ok(fs.existsSync(path.join(root,'dist',file)),file);
  for(const file of ['customer-preview/index.html','assets/js/customer-wizard.js','assets/js/customer-template.js'])assert.ok(!fs.existsSync(path.join(root,'dist',file)),file);
  assert.match(fs.readFileSync(path.join(root,'dist/access/index.html'),'utf8'),/href="\.\.\/customer\/"/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'dist/assets/js/customer-app.js'),'utf8'),/customer-template|sample-chair|pesmera-fixture|localStorage|sessionStorage/);
});
test('customer transport encodes selector, uses server credentials, no principal and versioned operations',async()=>{
  const {customerApi}=await api(),calls=[];
  const client=customerApi('a&customer=b',async(url,options)=>{calls.push({url,options});return Response.json({ok:true});});
  await client.load();await client.save({expectedRevision:7,answers:{}});await client.submit(8);await client.receipt(8);
  assert.equal(calls[0].url,'/.netlify/functions/customer?customer=a%26customer%3Db');
  for(const c of calls){assert.equal(c.options.credentials,'same-origin');assert.equal(c.options.cache,'no-store');assert.ok(c.options.signal);}
  assert.deepEqual(JSON.parse(calls[2].options.body),{operation:'submit',revision:8});
  assert.equal(calls[0].options.method,'GET');assert.equal(calls[1].options.method,'POST');
});
test('anonymous, revoked/owner denied, and unavailable responses never fall back to fixtures',async()=>{
  const {customerApi,accessMessage,validateWorkspace}=await api();
  for(const status of [401,403,503])await assert.rejects(customerApi('',async()=>new Response('{}',{status})).load(),e=>e.status===status);
  assert.match(accessMessage(401),/sign-in is required/);assert.match(accessMessage(403),/expired or revoked/);assert.match(accessMessage(503),/No answers/);
  assert.throws(()=>validateWorkspace({template:{fixture:true},draft:{}}));
  assert.throws(()=>validateWorkspace({access:'owner',id:'owner'}));
});
