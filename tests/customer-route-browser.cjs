// All API responses in this test are synthetic interception fixtures, never live persistence.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const draft=()=>({schemaVersion:1,template:'test-assignment-v1',revision:0,answers:{responsibility:'unknown',inventory:[],packages:[],closing:[],language:'unknown'},photos:[]});
const workspace=()=>({template:{id:'test-assignment-v1',version:1,kind:'pesmera-inventory',fixture:false,name:'Synthetic assigned test',steps:['Responsibility','Inventory','Packages','Language','Questions','Review'].map(title=>({title,why:'Synthetic test question',example:'Synthetic test example'}))},draft:draft()});
(async()=>{const browser=await chromium.launch({headless:true});try{
for(const width of [320,393,768,1280]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],posts=[];let status=503,state=workspace(),saveError=0,submitError=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:8765/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.startsWith('/.netlify/')){
   if(status!==200)return route.fulfill({status,contentType:'application/json',body:'{}'});
   if(req.method()==='GET')return route.fulfill({json:state});
   const body=req.postDataJSON();posts.push(body);
   if(body.operation==='save'){if(saveError)return route.fulfill({status:saveError,body:'{}'});state.draft={...body.draft,schemaVersion:1,template:state.template.id,revision:body.draft.expectedRevision+1};delete state.draft.expectedRevision;return route.fulfill({json:state.draft});}
   if(submitError)return route.fulfill({status:submitError,body:'{}'});
   return route.fulfill({json:{id:'test-receipt',revision:body.revision,status:'pending',updateStatus:'disabled'}});
  }
  let name=url.pathname;if(name.endsWith('/'))name+='index.html';
  try{return route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});}catch{return route.fulfill({status:404,body:'Missing'});}
 });
 for(const [code,copy] of [[503,'No answers'],[401,'sign-in is required'],[403,'expired or revoked']]){
  status=code;await page.goto('http://127.0.0.1:8765/customer/?customer=test');await page.waitForFunction(text=>document.getElementById('gate').textContent.includes(text),copy);
  assert.equal(await page.locator('#workspace').isVisible(),false);assert.equal(await page.locator('input,select,textarea').count(),0);
 }
 // Server assignment is the only gate: an owner/session-shaped response is rejected.
 status=200;state={id:'owner',access:'owner'};await page.reload();await page.waitForFunction(()=>document.getElementById('gate').textContent.includes('No answers'));
 state=workspace();await page.reload();await page.getByLabel('I am responsible').selectOption('confirm');
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Add inventory item',exact:true}).click();
 await page.getByLabel('Name',{exact:true}).fill('<img src=x onerror=alert(1)>');await page.getByLabel('Available quantity').fill('8');await page.getByLabel('Price in cents').fill('2500');
 saveError=503;await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Keep this page open'));assert.equal(await page.getByLabel('Available quantity').inputValue(),'8');
 saveError=409;await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Another device'));
 saveError=0;await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Saved version 1.');
 for(let n=0;n<4;n++)await page.getByRole('button',{name:'Continue',exact:true}).click();
 assert.match(await page.locator('pre').textContent(),/<img src=x/);assert.equal(await page.locator('#step img').count(),0);
 await page.getByRole('button',{name:'Edit Inventory',exact:true}).click();assert.equal(await page.getByLabel('Available quantity').inputValue(),'8');
 for(let n=0;n<4;n++)await page.getByRole('button',{name:'Continue',exact:true}).click();
 submitError=503;await page.getByRole('button',{name:'Submit saved version'}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Delivery could not be verified'));
 submitError=0;await page.getByRole('button',{name:'Submit saved version'}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('no completed delivery'));
 assert.deepEqual(posts.filter(p=>p.operation==='submit').map(p=>p.revision),[1,1]);
 await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent==='Loaded saved version 1.');
 await page.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await page.getByLabel('Available quantity').inputValue(),'8');
 saveError=403;await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('gate').textContent.includes('expired or revoked'));assert.equal(await page.locator('#step input').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.length),0);
 await page.close();console.log(`PASS customer product route ${width}px (mocked API)`);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
