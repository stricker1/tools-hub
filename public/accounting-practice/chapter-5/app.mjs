import {generateCase,groups,parseMoney,concepts} from './engine.mjs';
const $=s=>document.querySelector(s), KEY='little-tools:chapter-5:v1';
let state={mode:'income',level:'1',seed:1,answers:{},quiz:0}, storageIssue='';
try { const saved=JSON.parse(localStorage.getItem(KEY)); if(saved && ['income','periodic','concepts'].includes(saved.mode) && ['1','2','3'].includes(saved.level) && Number.isSafeInteger(saved.seed) && saved.seed>0 && saved.answers && typeof saved.answers==='object' && !Array.isArray(saved.answers) && Number.isSafeInteger(saved.quiz) && saved.quiz>=0) state=saved; else if(saved) storageIssue='Saved work was invalid. Started a fresh practice session.'; } catch {storageIssue='Saved work could not be read. Practice still works in this session.';}
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageIssue='Work could not be saved. You can continue practicing here.';}$('#notice').textContent=storageIssue;};
let problem;
function field(key,title,expected,options=null,prefill=false) {
 const value=state.answers[key]??(prefill?String(expected):'');
 if(prefill && state.answers[key]===undefined) state.answers[key]=value;
 const id='f-'+key;
 const control=options?`<select id="${id}" data-key="${key}"><option value="">Choose…</option>${options.map(o=>`<option value="${esc(o)}" ${value===String(o)?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input id="${id}" data-key="${key}" value="${esc(value)}" inputmode="decimal" autocomplete="off" placeholder="Amount">`;
 return `<label>${esc(title)}${control}<span class="field-feedback" id="msg-${key}"></span></label>`;
}
function expected() {
 const out={};
 if(state.mode==='concepts')return out;
 out.date=state.mode==='income'?'For the Year Ended March 31, 2019':'For the Year Ended April 30, 2018';
 for(const [i,r] of problem.rows.entries()) {
   out[`label${i}`]=r.label;out[`group${i}`]=r.group;
   if(r.amount!==null){out[`amount${i}`]=r.amount;out[`column${i}`]=r.column;}
 }
 for(const r of problem.source)out['source-'+r.id]=r.group;
 if(state.mode==='periodic')out.system='No';
 return out;
}
function validate(el,force=false) {
 const key=el.dataset.key, want=expected()[key], val=el.value;
 const msg=$('#msg-'+key);
 if(!val && !force){el.removeAttribute('aria-invalid');msg.textContent='';return false;}
 const correct=typeof want==='number'?parseMoney(val)===want:val===want;
 el.setAttribute('aria-invalid',String(!correct));el.setAttribute('aria-describedby','msg-'+key);
 msg.classList.toggle('good',correct);
 let why='';
 const match=key.match(/^(amount|label|column|group)(\d+)$/);
 if(match)why=problem.rows[Number(match[2])].why;
 else if(key.startsWith('source-'))why=problem.source.find(r=>'source-'+r.id===key)?.why||'';
 else if(key==='date')why='An income statement covers a period; use “For the Year Ended,” not just a date.';
 else why='The inventory system changes when costs are recorded, not gross profit when the same transactions, physical inventory and returns estimates are used.';
 msg.textContent=correct?'✓ Correct':!val?'Choose or enter an answer.':`Try again. ${key.startsWith('amount')&&parseMoney(val)===-want?'Check the sign. ':''}${why}`;
 return correct;
}
function progress(force=false) {
 const fields=[...document.querySelectorAll('[data-key]')], count=fields.filter(e=>validate(e,force)).length;
 $('#progress').textContent=`${count} of ${fields.length} fields correct${count===fields.length?' · Worksheet complete! Try the next support level or new numbers.':''}`;
}
function render() {
 $('#level').value=state.level;
 for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));
 if(state.mode==='concepts') { renderQuiz();save();return; }
 problem=generateCase(state.seed,state.mode);
 const guided=state.level==='1', coached=state.level!=='3', labels=[...new Set([...problem.rows.map(r=>r.label),...problem.source.map(r=>r.label),'Total assets','Net income','Net loss','Total liabilities'])].sort();
 const dates=['For the Year Ended March 31, 2019','March 31, 2019','For the Year Ended April 30, 2018','April 30, 2018'];
 $('#workspace').innerHTML=`<details class="guide" ${coached?'open':''}><summary><strong>The route through this worksheet</strong></summary><p>${state.mode==='income'?'Sales − COGS = Gross profit. Subtract selling and administrative expenses for Operating income. Then include nonoperating items for Net income or loss.':'Beginning inventory + (Purchases − returns − discounts + Freight in) = Cost available. Subtract ending inventory, then subtract estimated returns at cost to find COGS.'}</p><p>Left amount column = component amounts. Right amount column = main statement amounts and completed subtotals. This practice uses signed deductions for the Harkins worksheet and nonoperating expenses; ordinary Royal operating expense balances stay positive. Signs and columns are presentation conventions, not debit/credit sides.</p></details><div class="layout"><aside id="sources"><h2>Source balances</h2><a href="#statement">Jump to worksheet ↓</a><p>Problem ${state.seed}. Fresh practice numbers, based on your screenshots. Classify each source account before placing it.</p>${problem.source.map(r=>`<div class="source"><span>${esc(r.label)}</span><strong>${money(r.amount)}</strong></div>${field('source-'+r.id,'Classification',r.group,groups,false)}<details class="hint"><summary>Classification hint</summary><p>${esc(r.why)}</p></details>`).join('')}</aside><section class="worksheet" id="statement" tabindex="-1"><a href="#sources">↑ Source balances</a><h2>${problem.company}</h2><p>${state.mode==='income'?'Income Statement':'Income Statement · Cost of goods sold section'}</p><div class="fields">${field('date','Statement period',expected().date,dates,guided)}</div>${state.mode==='periodic'?'<p><strong>Cost of goods sold:</strong> Begin with inventory, then build the cost of merchandise purchased.</p>':''}${problem.rows.map((r,i)=>`${state.mode==='periodic'&&i===1?'<h3>Cost of merchandise purchased:</h3>':''}${state.mode==='periodic'&&i===11?'<h3>b. Determine gross profit</h3>':''}<section class="row ${r.group==='Subtotal'?'subtotal':''}" aria-label="Worksheet line ${i+1}"><div class="rowhead"><strong>${i+1}</strong>${guided?`<span>${esc(r.label)}</span>`:state.level==='2'?`<span>${r.group==='Heading'?'Section heading':r.group==='Subtotal'?'Calculate a subtotal':'Place a source balance'}</span>`:''}</div><div class="fields">${field('label'+i,'Line description',r.label,labels,guided)}${field('group'+i,'Line classification',r.group,groups,guided)}${r.amount!==null?field('column'+i,'Amount column',r.column,['left','right'],coached)+field('amount'+i,'Signed amount',r.amount):''}</div><details class="hint" ${guided?'open':''}><summary>Why this line?</summary><p>${esc(r.why)}</p></details></section>`).join('')}${state.mode==='periodic'?`<div class="guide">${field('system','Would gross profit differ under perpetual with the same transactions, ending count, and returns estimates?','No',['Yes','No'])}<p>Estimated returns here are merchandise cost; Sales is supplied after any selling-price refund adjustments.</p></div>`:''}<div class="status" id="progress" role="status" aria-live="polite"></div><button id="check">Check all fields</button> <button id="reveal">Show worked solution</button><div id="solution"></div></section></div>`;
 $('#workspace').oninput=e=>{if(!e.target.dataset.key)return;state.answers[e.target.dataset.key]=e.target.value;validate(e.target);progress();save();};
 $('#workspace').onchange=$('#workspace').oninput;
 $('#check').onclick=()=>progress(true);
 $('#reveal').onclick=()=>{ $('#solution').innerHTML=`<div class="guide"><h3>Worked solution · with support</h3><p>${esc(expected().date)}</p>${problem.rows.map(r=>`<p><strong>${esc(r.label)}${r.amount===null?'':`: ${money(r.amount)} (${r.column})`}</strong><br>${esc(r.why)}</p>`).join('')}<p>Return to the empty fields and reconstruct the logic. Revealing does not mark them correct.</p></div>`;};
 progress();save();
}
function renderQuiz() {
 const q=concepts[state.quiz%concepts.length];
 $('#workspace').innerHTML=`<section class="quiz"><p>Concept ${state.quiz%concepts.length+1} of ${concepts.length}</p><h2>${esc(q[0])}</h2>${q[1].map((o,i)=>`<button data-option="${i}">${esc(o)}</button>`).join('')}<p id="quiz-feedback" role="status" aria-live="polite"></p><button id="next-concept">Next concept →</button></section>`;
 for(const b of document.querySelectorAll('[data-option]'))b.onclick=()=>{$('#quiz-feedback').textContent=(Number(b.dataset.option)===q[2]?'✓ Correct. ':'Try again. ')+q[3];};
 $('#next-concept').onclick=()=>{state.quiz++;render();};
}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{if(state.mode===b.dataset.mode)return;state.mode=b.dataset.mode;state.answers={};render();};
$('#level').onchange=e=>{state.level=e.target.value;render();};
$('#new').onclick=()=>{state.seed++;state.answers={};if(state.mode==='concepts')state.quiz++;render();};
$('#reset').onclick=()=>{state.answers={};render();};
render();
