import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCase,parseMoney,concepts} from '../public/accounting-practice/chapter-5/engine.mjs';
test('2,000 seeds independently reconcile both screenshot worksheet structures',()=>{
 const outcomes=new Set();
 for(let seed=1;seed<=2000;seed++)for(const kind of ['income','periodic']){
 const c=generateCase(seed,kind), r=Object.fromEntries(c.rows.map(r=>[r.id,r.amount]));
 assert.deepEqual(c,generateCase(seed,kind));
 assert.equal(new Set(c.rows.map(r=>r.id)).size,c.rows.length);
 assert.ok(c.rows.every(r=>r.amount===null||Number.isInteger(r.amount)));
 if(kind==='income'){
 assert.equal(c.rows.length,11);
 assert.equal(r.gross,r.sales-r.cogs);
 assert.equal(r.expenses,r.selling+r.admin);
 assert.equal(r.operating,r.gross-r.expenses);
 assert.equal(r.net,r.operating+r.interest);
 assert.ok(r.interest<0);
 assert.equal(c.rows.at(-1).label,r.net<0?'Net loss':'Net income');
 outcomes.add(Math.sign(r.net));
 assert.ok(c.source.some(r=>r.label==='Office Supplies'&&r.group==='Exclude'));
 }else{
 assert.equal(r.costPurchased,r.purchases+r.returns+r.discounts+r.freight);
 assert.equal(r.available,r.beginning+r.costPurchased);
 assert.equal(r.beforeReturns,r.available+r.ending);
 assert.equal(r.cogs,r.beforeReturns+r.estimated);
 assert.equal(r.gross,c.sales-r.cogs);
 assert.ok(r.cogs>0&&r.estimated<0&&r.ending<0&&r.returns<0&&r.discounts<0);
 assert.deepEqual(c.rows.slice(1,5).map(r=>r.column),['left','left','left','left']);
 }
 }
 assert.ok(outcomes.has(1)&&outcomes.has(-1));
});
test('money parser rejects malformed or missing values and concepts have distinct explained answers',()=>{
 for(const v of ['', '1e3','12abc','1,2','Infinity'])assert.equal(parseMoney(v),null);
 assert.equal(parseMoney('-1,200'),-1200);
 for(const q of concepts){assert.ok(q[2]>=0&&q[2]<q[1].length);assert.equal(new Set(q[1]).size,q[1].length);assert.ok(q[3].length>50);}
});
