// Set PLAYWRIGHT_CORE to an approved existing playwright-core installation.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true});
try {
  for(const width of [320,393,768,1280]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.route('http://127.0.0.1:8765/**',async route=>{
      let name=new URL(route.request().url()).pathname;
      if(name.startsWith('/.netlify/'))return route.fulfill({status:503,body:'Integration disabled'});
      if(name.endsWith('/'))name+='index.html';
      const file=path.resolve(__dirname,'..','.'+name);
      try{await route.fulfill({body:await fs.readFile(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:'Not found'});}
    });
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/customer-preview/');
    await page.getByLabel('I am responsible').selectOption('confirm');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    if(errors.length)throw Error(errors.join('; '));
    await page.getByLabel('Name',{exact:true}).fill('<img src=x onerror=alert(1)>');
    await page.getByLabel('Review decision').selectOption('correct');
    await page.getByLabel('Available quantity').fill('12');
    await page.getByLabel('Price in cents').fill('1250');
    await page.getByRole('button',{name:'Test save contract'}).click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Save unavailable'));
    for(let i=0;i<2;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByLabel('Preferred customer language').selectOption('Both');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('button',{name:'Add question or change'}).click();
    await page.getByLabel('Question or additional change 1').fill('Synthetic follow-up');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    assert.match(await page.locator('pre').innerText(),/Synthetic follow-up/);
    assert.equal(await page.locator('#step img').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.getByRole('button',{name:'Edit Inventory',exact:true}).click();
    assert.equal(await page.getByLabel('Available quantity').inputValue(),'12');
    await page.getByRole('button',{name:'Back',exact:true}).click();
    assert.equal(await page.getByLabel('I am responsible').inputValue(),'confirm');
    assert.deepEqual(errors,[]);
    if(width===393)await page.screenshot({path:'evidence/customer-393.png',fullPage:true});
    console.log(`PASS ${width}px: guided flow, edit/back, save failure, literal answers, closing review, no horizontal overflow`);
    await page.close();
  }
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
