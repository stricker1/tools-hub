import assert from 'node:assert/strict';
import {generateCase} from '../public/accounting-practice/chapter-5/engine.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1360,height:1000}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
const set=async(key,value)=>{const el=page.locator(`[data-key="${key}"]`);if(await el.evaluate(e=>e.tagName==='SELECT'))await el.selectOption(String(value));else await el.fill(String(value));};
try{
await page.goto(base+'/accounting-practice/chapter-5/');
await page.keyboard.press('Tab');assert.equal(await page.locator('.skip').evaluate(e=>e===document.activeElement),true);
assert.equal(await page.locator('.row').count(),11);
assert.equal(await page.locator('a[target="_blank"]').count(),0);
await page.locator('#check').click();
assert.ok(await page.locator('[aria-invalid="true"]').count()>0);
await set('amount0','1e3');assert.match(await page.locator('#msg-amount0').innerText(),/Try again/);
for(const mode of ['income','periodic']){
 await page.locator(`[data-mode="${mode}"]`).click();
 await page.locator('#level').selectOption('3');
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('little-tools:chapter-5:v1'))),c=generateCase(state.seed,mode);
 await set('date',mode==='income'?'For the Year Ended March 31, 2019':'For the Year Ended April 30, 2018');
 for(const r of c.source)await set('source-'+r.id,r.group);
 for(const [i,r] of c.rows.entries()){
 await set('label'+i,r.label);await set('group'+i,r.group);
 if(r.amount!==null){await set('amount'+i,r.amount);await set('column'+i,r.column);}
 }
 if(mode==='periodic')await set('system','No');
 await page.locator('#check').click();assert.equal(await page.locator('[aria-invalid="true"]').count(),0);
 assert.match(await page.locator('#progress').innerText(),/Worksheet complete/);
 await page.reload();assert.match(await page.locator('#progress').innerText(),/Worksheet complete/);
 await set('amount0','123');assert.match(await page.locator('#msg-amount0').innerText(),/Try again/);
 await page.locator('#reveal').click();assert.ok(await page.locator('#solution').innerText());
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 if(mode==='periodic')await page.screenshot({path:'/private/tmp/chapter-5-mobile.png',fullPage:true});
 await page.setViewportSize({width:1360,height:1000});
 await page.locator('#new').click();assert.equal(await page.locator('#f-amount0').inputValue(),'');
}
await page.locator('[data-mode="concepts"]').click();
await page.locator('[data-option="0"]').click();assert.match(await page.locator('#quiz-feedback').innerText(),/Correct/);
await page.locator('[data-option="1"]').click();assert.match(await page.locator('#quiz-feedback').innerText(),/Try again/);
await page.locator('#next-concept').click();assert.match(await page.locator('.quiz').innerText(),/seller/);
await page.goto(base+'/');await page.getByRole('link').filter({hasText:'Chapter 5'}).click();assert.match(page.url(),/chapter-5/);
await page.evaluate(()=>localStorage.setItem('little-tools:chapter-5:v1','{"mode":"bad"}'));await page.reload();assert.match(await page.locator('#notice').innerText(),/invalid/);
await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});
await page.reload();await page.locator('#new').click();assert.match(await page.locator('#notice').innerText(),/could not be saved/);
assert.deepEqual(errors,[]);
console.log('Chapter 5 browser checks passed: both completed worksheets, per-field feedback, malformed input, signs/columns, reload, resets, reveal, concepts, same-tab links, storage recovery, 390/320px overflow.');
}finally{await browser.close();}
