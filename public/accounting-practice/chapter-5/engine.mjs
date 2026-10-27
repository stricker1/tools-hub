export { parseMoney } from '../chapter-4/engine.mjs';
export const groups = ['Heading','Exclude','Revenue','Cost of goods sold','Selling expense','Administrative expense','Other revenue / expense','Subtotal'];
export function generateCase(seed = 1, kind = 'income') {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  const rand = (a,b) => { n = (Math.imul(n,1664525)+1013904223)>>>0; return (a+n%(b-a+1))*100; };
  const rows=[];
  const add=(id,label,amount,group,column,why)=>rows.push({id,label,amount,group,column,why});
  if(kind==='income') {
    const sales=rand(900,1500), cogs=rand(350,950), selling=rand(80,200), admin=rand(60,170), interest=rand(5,30);
    const gross=sales-cogs, expenses=selling+admin, operating=gross-expenses;
    add('sales','Sales',sales,'Revenue','right','Revenue from merchandise starts the statement. Use the supplied adjusted Sales balance.');
    add('cogs','Cost of Goods Sold',cogs,'Cost of goods sold','right','Subtract the cost of merchandise sold from Sales. Enter a positive cost here.');
    add('gross','Gross profit',gross,'Subtotal','right','Sales − Cost of Goods Sold. Gross profit isolates the merchandise margin.');
    add('expenseHeading','Expenses',null,'Heading','none','This heading introduces selling and administrative expenses; it has no amount.');
    add('selling','Selling Expenses',selling,'Selling expense','left','Selling Expenses support selling merchandise. Enter the supplied combined expense balance in the left amount column.');
    add('admin','Administrative Expenses',admin,'Administrative expense','left','Administrative Expenses support the office and general management. Office Supplies itself is an asset, not this expense.');
    add('expenses','Total expenses',expenses,'Subtotal','right','Selling Expenses + Administrative Expenses. Interest Expense is excluded from this operating subtotal.');
    add('operating','Operating income',operating,'Subtotal','right','Gross profit − Total expenses. This isolates the result of the main merchandising operation. A loss is negative.');
    add('otherHeading','Other revenue and expense',null,'Heading','none','This heading separates nonoperating items from operating expenses; it has no amount.');
    add('interest','Interest Expense',-interest,'Other revenue / expense','right','Interest is nonoperating. Enter a negative amount in the signed other-items section to reduce operating income.');
    add('net',operating-interest<0?'Net loss':'Net income',operating-interest,'Subtotal','right','Operating income − Interest Expense. Use Net loss and a negative amount when expenses exceed revenue.');
  } else {
    const beginning=rand(80,180), purchases=rand(400,750), returns=rand(10,35), discounts=rand(5,20), freight=rand(10,35), ending=rand(100,250), estimated=rand(1,8), sales=rand(900,1300);
    const cost=purchases-returns-discounts+freight, available=beginning+cost, before=available-ending, cogs=before-estimated;
    add('beginning','Inventory, May 1, 2017',beginning,'Cost of goods sold','right','Beginning inventory is merchandise already on hand; start the COGS section here.');
    add('purchases','Purchases',purchases,'Cost of goods sold','left','Begin the cost-of-merchandise-purchased calculation with gross purchases.');
    add('returns','Purchases returns and allowances',-returns,'Cost of goods sold','left','Supplier returns and allowances reduce purchases. Use a negative amount in this signed worksheet.');
    add('discounts','Purchases discounts',-discounts,'Cost of goods sold','left','Discounts reduce acquisition cost. Subtract them, rather than treating them as revenue.');
    add('freight','Freight in',freight,'Cost of goods sold','left','Buyer inbound freight adds to acquisition cost. Seller Delivery Expense belongs to selling expenses instead.');
    add('costPurchased','Cost of merchandise purchased',cost,'Subtotal','right','Purchases − returns and allowances − discounts + freight in. The four left-column items combine into this right-column subtotal.');
    add('available','Cost of merchandise available for sale',available,'Subtotal','right','Beginning inventory + Cost of merchandise purchased.');
    add('ending','Inventory, April 30, 2018',-ending,'Cost of goods sold','right','Subtract ending inventory because merchandise still on hand was not sold.');
    add('beforeReturns','Cost of goods sold before estimated returns',before,'Subtotal','right','Cost available for sale − Ending inventory. There is still a returns adjustment to make.');
    add('estimated','Estimated returns of current year sales',-estimated,'Cost of goods sold','right','This worksheet supplies the COST of goods expected back from current-year sales. Subtract it from COGS; do not subtract it from Sales. Customer refunds at selling price are a separate adjustment.');
    add('cogs','Cost of goods sold',cogs,'Subtotal','right','COGS before estimated returns − Cost of estimated returns.');
    add('gross','Gross profit',sales-cogs,'Subtotal','right','Adjusted Sales − final Cost of goods sold.');
    rows.sales=sales;

  }
  const source=rows.filter(r=>r.group!=='Subtotal' && r.amount!==null).map(r=>({...r,amount:Math.abs(r.amount)}));
  if(kind==='income') {
    for(const [id,label,why] of [
      ['receivable','Accounts Receivable','Asset: amounts customers owe belong on the balance sheet, not as another Sales line.'],
      ['building','Building','Long-lived asset on the balance sheet, not an expense of this period.'],
      ['note','Notes Payable','Liability: principal owed is distinct from Interest Expense.'],
      ['retained','Retained Earnings','Equity from accumulated earnings, not revenue of this year.'],
      ['store','Store Supplies','Unused supplies are an asset; Store Supplies is not Selling Expenses.'],
      ['inventory','Inventory','Asset: unsold merchandise belongs on the balance sheet.'],
      ['supplies','Office Supplies','Asset until used; do not confuse supplies with Supplies Expense.'],
      ['dividends','Dividends','Distribution to stockholders, not an expense; excluded from net income.'],
      ['cash','Cash','Asset on the balance sheet, not revenue.'],
      ['stock','Common Stock','Equity from investment, not Sales.'],
      ['accumulated','Accumulated Depreciation—Building','Contra asset on the balance sheet, not current depreciation expense.'],
      ['payable','Salaries Payable','Liability, not a current expense balance.']
    ]) source.push({id,label,amount:rand(10,100),group:'Exclude',why});
  } else source.push({id:'sales',label:'Sales',amount:rows.sales,group:'Revenue',why:'Use adjusted Sales for gross profit, not as a line in the COGS calculation.'});
  // A deterministic shuffle prevents the source list from giving away worksheet order.
  for(let i=source.length-1;i>0;i--) { const j=rand(0,i)/100; [source[i],source[j]]=[source[j],source[i]]; }
  return {sales:rows.sales,seed:String(seed),kind,company:kind==='income'?'Royal-style Furnishings':'Harkins-style Merchandising',rows,source};
}
export const concepts = [
 ['What is a major advantage of a multiple-step income statement over a single-step statement?', ['It separates gross profit and operating income from the final net result','It records a different amount of net income for the same data','It includes assets and liabilities in total expenses'],0,'Gross profit shows the merchandise margin; operating income shows the result after selling and administrative expenses. Separating nonoperating items helps explain where income comes from.'],
 ['A seller makes a $900 credit sale; merchandise cost is $540. Which perpetual entries apply?', ['Dr Accounts Receivable 900; Cr Sales 900 AND Dr Cost of Goods Sold 540; Cr Inventory 540','Dr Inventory 900; Cr Accounts Payable 900','Dr Accounts Receivable 900; Cr Sales 900 only'],0,'The seller records revenue and the cost of inventory leaving. A periodic seller records only the sales entry on the sale date.'],
 ['A buyer purchases $600 of merchandise on account. Which periodic entry applies?', ['Dr Inventory 600; Cr Accounts Payable 600','Dr Purchases 600; Cr Accounts Payable 600','Dr Cost of Goods Sold 600; Cr Cash 600'],1,'Periodic uses Purchases. Perpetual uses Inventory. Neither recognizes COGS when acquiring merchandise.'],
 ['Which group has only normal credit balances?', ['Inventory, Delivery Expense, Sales','Sales Tax Payable, Customer Refunds Payable, Sales','Customer Refunds Payable, Estimated Returns Inventory, Sales'],1,'Liabilities and Sales normally carry credits. Estimated Returns Inventory is an asset with a normal debit balance.'],
 ['Which group has only normal debit balances?', ['Inventory, Delivery Expense, Cost of Goods Sold, Estimated Returns Inventory','Inventory, Customer Refunds Payable, Sales','Sales Tax Payable, Inventory, Delivery Expense'],0,'Assets and expenses normally carry debits. Customer Refunds Payable is a liability, not an expense.'],
 ['When does a periodic system determine inventory on hand and COGS?', ['Continuously with every sale','At period end using a physical count','Only when customers pay'],1,'Perpetual updates Inventory and COGS with each sale. Periodic calculates ending inventory and COGS at period end.'],
 ['A buyer pays $80 inbound freight under FOB shipping point. What changes?', ['Perpetual: debit Inventory; periodic: debit Freight-in; credit Cash in both','Debit Delivery Expense in both systems','Debit Sales in both systems'],0,'Buyer freight-in is acquisition cost. Seller outbound delivery is a selling expense. FOB terms determine who bears freight.']
];
