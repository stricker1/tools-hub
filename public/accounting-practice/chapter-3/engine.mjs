// All ledger amounts are whole dollars; debit balances are positive.
export const TOPICS = {
  supplies: "Supplies used",
  insurance: "Prepaid insurance",
  unearned: "Unearned revenue",
  revenue: "Accrued revenue",
  wages: "Accrued wages",
  depreciation: "Depreciation",
};
export const ACCOUNTS = {
  cash: ["Cash", "asset"],
  receivable: ["Accounts Receivable", "asset"],
  supplies: ["Supplies", "asset"],
  insurance: ["Prepaid Insurance", "asset"],
  equipment: ["Equipment", "asset"],
  depreciation: ["Accumulated Depreciation—Equipment", "contra"],
  payable: ["Wages Payable", "liability"],
  unearned: ["Unearned Fees", "liability"],
  stock: ["Common Stock", "equity"],
  fees: ["Fees Earned", "revenue"],
  wagesExpense: ["Wages Expense", "expense"],
  rentExpense: ["Rent Expense", "expense"],
  suppliesExpense: ["Supplies Expense", "expense"],
  insuranceExpense: ["Insurance Expense", "expense"],
  depreciationExpense: ["Depreciation Expense", "expense"],
};
export const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, a) => a[Math.floor(r() * a.length)];
export function shuffle(a, r) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const number = (r, min, max, step = 50) =>
  (min + Math.floor(r() * (max - min + 1))) * step;
export const line = (account, amount) => ({ account, amount });
export const entry = (debit, credit, amount) => [
  line(debit, amount),
  line(credit, -amount),
];
export function ledger(entries) {
  const b = Object.fromEntries(Object.keys(ACCOUNTS).map((a) => [a, 0]));
  for (const e of entries) for (const l of e.lines) b[l.account] += l.amount;
  return b;
}
export function totals(b) {
  const debit = Object.values(b)
      .filter((x) => x > 0)
      .reduce((a, x) => a + x, 0),
    credit = -Object.values(b)
      .filter((x) => x < 0)
      .reduce((a, x) => a + x, 0);
  return { debit, credit };
}
export function statements(b) {
  let revenue = 0,
    expenses = 0,
    assets = 0,
    liabilities = 0;
  for (const [a, n] of Object.entries(b)) {
    const type = ACCOUNTS[a][1];
    if (type === "revenue") revenue -= n;
    if (type === "expense") expenses += n;
    if (type === "asset" || type === "contra") assets += n;
    if (type === "liability") liabilities -= n;
  }
  const net = revenue - expenses;
  return {
    revenue,
    expenses,
    net,
    retained: net,
    assets,
    liabilities,
    equity: -b.stock + net,
  };
}
export function generateMonth(seed) {
  const r = rng(seed),
    company = pick(r, [
      "Willow Creative",
      "Juniper Consulting",
      "Clover Studio",
      "Sage Design",
      "Fern Advisory",
    ]);
  const month = pick(r, ["April", "June", "September", "November"]),
    end = 30;
  const v = {
    stock: number(r, 18, 28, 1000),
    supplies: number(r, 12, 24),
    remaining: number(r, 2, 7),
    monthlyInsurance: number(r, 3, 7),
    months: pick(r, [6, 12]),
    earnedAdvance: number(r, 4, 10),
    accruedRevenue: number(r, 5, 16),
    accruedWages: number(r, 3, 9),
    dep: number(r, 2, 5),
    life: pick(r, [3, 4, 5]),
    wages: number(r, 12, 25),
    rent: number(r, 10, 18),
    cashRevenue: number(r, 40, 80),
  };
  v.insurance = v.monthlyInsurance * v.months;
  v.advance = v.earnedAdvance * 3;
  v.equipment = v.dep * 12 * v.life;
  v.salvage = number(r, 0, 4, 100);
  v.equipment += v.salvage;
  v.stock = Math.max(v.stock, v.equipment + v.insurance + v.supplies + 5000);
  const transactions = [
    {
      date: 1,
      text: `Owners invest ${money(v.stock)} cash in exchange for common stock.`,
      lines: entry("cash", "stock", v.stock),
      why: "Cash is an asset that increases with a debit. Issuing stock increases equity with a credit; it is not revenue.",
    },
    {
      date: 1,
      text: `Pay ${money(v.insurance)} for ${v.months} months of insurance, beginning on ${month} 1. Record the payment as an asset.`,
      lines: entry("insurance", "cash", v.insurance),
      why: "The payment buys future coverage. Debit Prepaid Insurance and credit Cash. Expense follows as coverage expires.",
    },
    {
      date: 2,
      text: `Buy ${money(v.supplies)} of supplies for cash. Record the purchase as an asset.`,
      lines: entry("supplies", "cash", v.supplies),
      why: "Unused supplies are an asset. The expense is recorded when supplies are used.",
    },
    {
      date: 3,
      text: `Buy equipment for ${money(v.equipment)} cash. It is available for use immediately.`,
      lines: entry("equipment", "cash", v.equipment),
      why: "Equipment benefits several periods, so record its cost as an asset. Allocate the depreciable cost over its useful life.",
    },
    {
      date: 7,
      text: `Receive ${money(v.advance)} in advance for future consulting services.`,
      lines: entry("cash", "unearned", v.advance),
      why: "We have cash, but still owe work. Unearned Fees is a liability, not earned revenue.",
    },
    {
      date: 18,
      text: `Earn and receive ${money(v.cashRevenue)} cash for completed services.`,
      lines: entry("cash", "fees", v.cashRevenue),
      why: "The service has been performed and cash received. Debit Cash and credit Fees Earned.",
    },
    {
      date: 24,
      text: `Pay ${money(v.wages)} for wages already earned this month.`,
      lines: entry("wagesExpense", "cash", v.wages),
      why: "The work is a current-period cost. Debit Wages Expense; credit Cash for the payment.",
    },
    {
      date: 28,
      text: `Pay ${money(v.rent)} for this month's office rent.`,
      lines: entry("rentExpense", "cash", v.rent),
      why: "This rent has been used this month. It is Rent Expense, not Prepaid Rent.",
    },
  ];
  const unadjusted = ledger(transactions);
  const definitions = [
    [
      "supplies",
      `A count on ${month} ${end} finds ${money(v.remaining)} of supplies still on hand. The Supplies account shows ${money(v.supplies)}.`,
      v.supplies - v.remaining,
      "suppliesExpense",
      "supplies",
      `${money(v.supplies)} available − ${money(v.remaining)} remaining = ${money(v.supplies - v.remaining)} used.`,
      `Supplies is the unused asset. Supplies Expense records what this month consumed. The original cash payment is already recorded.`,
      "Supplies or prepaid coverage was used.",
      "Assets (net) decrease; expenses increase; net income decreases.",
      "Cash was paid earlier. The adjustment records use, not another payment.",
    ],
    [
      "insurance",
      `The ${money(v.insurance)} policy began on ${month} 1 and covers ${v.months} months. One full month has expired; no insurance adjustment has been recorded.`,
      v.monthlyInsurance,
      "insuranceExpense",
      "insurance",
      `${money(v.insurance)} ÷ ${v.months} months = ${money(v.monthlyInsurance)} for one month.`,
      `Coverage used is an expense. The remaining coverage is still Prepaid Insurance, an asset.`,
      "Supplies or prepaid coverage was used.",
      "Assets (net) decrease; expenses increase; net income decreases.",
      "Cash was paid earlier. Time, not a new payment, uses the asset.",
    ],
    [
      "unearned",
      `Of the ${money(v.advance)} received in advance, ${money(v.earnedAdvance)} of services have now been provided. None has been transferred to revenue.`,
      v.earnedAdvance,
      "unearned",
      "fees",
      `${money(v.earnedAdvance)} has been earned; ${money(v.advance - v.earnedAdvance)} remains unearned.`,
      `Debit Unearned Fees to reduce the obligation. Credit Fees Earned because the work has now been performed.`,
      "An obligation was satisfied by earning revenue.",
      "Liabilities decrease; revenue increases; net income increases.",
      "Cash was received earlier. Doing the work now earns the revenue.",
    ],
    [
      "revenue",
      `Completed ${money(v.accruedRevenue)} of additional services by ${month} ${end}. The customer has not been billed, and nothing has been recorded.`,
      v.accruedRevenue,
      "receivable",
      "fees",
      `All ${money(v.accruedRevenue)} of completed work belongs to this month.`,
      `We earned revenue and have a right to collect. Debit Accounts Receivable; credit Fees Earned. Later collection replaces the receivable with cash, without earning revenue again.`,
      "Revenue was earned before cash was collected.",
      "Assets increase; revenue increases; net income increases.",
      "The work comes first. Cash will be collected later.",
    ],
    [
      "wages",
      `Employees earned ${money(v.accruedWages)} in the last days of ${month}. These wages have not been paid or recorded.`,
      v.accruedWages,
      "wagesExpense",
      "payable",
      `${money(v.accruedWages)} of work was received this month and is still owed.`,
      `Debit Wages Expense for work received. Credit Wages Payable for the obligation. Paying it next month settles this liability.`,
      "An expense was incurred before cash was paid.",
      "Liabilities increase; expenses increase; net income decreases.",
      "The work comes first. Cash will be paid later.",
    ],
    [
      "depreciation",
      `Equipment cost ${money(v.equipment)}, has an estimated residual value of ${money(v.salvage)}, and a ${v.life}-year useful life. Record one full month of straight-line depreciation.`,
      v.dep,
      "depreciationExpense",
      "depreciation",
      `(${money(v.equipment)} − ${money(v.salvage)}) ÷ ${v.life} years ÷ 12 = ${money(v.dep)} per month.`,
      `Debit Depreciation Expense; credit Accumulated Depreciation, a contra asset with a credit balance. Equipment stays at cost. Net book value falls; no cash moves.`,
      "Part of a long-lived asset’s cost belongs to this period.",
      "Assets (net) decrease; expenses increase; net income decreases.",
      "Cash was paid at purchase. Depreciation allocates cost; it does not set aside cash.",
    ],
  ];
  const adjustments = definitions.map(
    ([
      topic,
      text,
      amount,
      debit,
      credit,
      calculation,
      why,
      meaning,
      effect,
      timing,
    ]) => ({
      topic,
      text,
      amount,
      debit,
      credit,
      calculation,
      why,
      meaning,
      effect,
      timing,
      lines: entry(debit, credit, amount),
      date: end,
    }),
  );
  const adjusted = ledger([...transactions, ...adjustments]);
  return {
    seed,
    company,
    month,
    end,
    v,
    transactions,
    adjustments,
    unadjusted,
    adjusted,
    results: statements(adjusted),
  };
}
const MEANINGS = [
  "Supplies or prepaid coverage was used.",
  "An obligation was satisfied by earning revenue.",
  "Revenue was earned before cash was collected.",
  "An expense was incurred before cash was paid.",
  "Part of a long-lived asset’s cost belongs to this period.",
];
export function reasoningOptions(a, seed) {
  return shuffle(
    MEANINGS.map((text) => ({
      text,
      correct: text === a.meaning,
      why:
        text === a.meaning
          ? a.why
          : `That describes a different timing pattern. Here: ${a.timing} ${a.why}`,
    })),
    rng(seed),
  );
}
export function effectOptions(a, seed) {
  const texts = [
    ...new Set([
      a.effect,
      "Assets (net) decrease; expenses increase; net income decreases.",
      "Liabilities decrease; revenue increases; net income increases.",
      "Assets increase; revenue increases; net income increases.",
      "Liabilities increase; expenses increase; net income decreases.",
      "Assets (net) decrease; expenses increase; net income decreases.",
    ]),
  ];
  return shuffle(
    [
      a.effect,
      ...shuffle(
        texts.filter((t) => t !== a.effect),
        rng(seed + "other"),
      ).slice(0, 3),
    ].map((text) => ({
      text,
      correct: text === a.effect,
      why:
        text === a.effect
          ? a.why
          : `Follow the actual entry: debit ${ACCOUNTS[a.debit][0]}, credit ${ACCOUNTS[a.credit][0]}. ${a.effect}`,
    })),
    rng(seed),
  );
}
export function parseAmount(s) {
  const t = String(s).trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n * 100) ? n : null;
}
export function checkEntry(a, work) {
  if (!work.debit || !work.credit)
    return {
      ok: false,
      text: "Choose both accounts. Start with what increased or decreased.",
    };
  if (work.debit !== a.debit || work.credit !== a.credit) {
    if (work.debit === a.credit && work.credit === a.debit)
      return {
        ok: false,
        text: `The accounts are right, but the sides are reversed. ${a.why}`,
      };
    if (work.debit === "cash" || work.credit === "cash")
      return {
        ok: false,
        text: `Cash does not belong in this adjustment. ${a.timing}`,
      };
    return { ok: false, text: `Reconsider the accounts. ${a.why}` };
  }
  const d = parseAmount(work.debitAmount),
    c = parseAmount(work.creditAmount);
  if (d === null || c === null || d <= 0 || c <= 0)
    return {
      ok: false,
      text: "Enter a positive amount on each side. Blank fields are not zero.",
    };
  if (d !== c)
    return {
      ok: false,
      text: "This entry must have equal debits and credits. Both record the same adjustment amount.",
    };
  if (d !== a.amount)
    return {
      ok: false,
      text: `The accounts and sides are right. Recheck the amount: ${a.calculation}`,
    };
  return { ok: true, text: `Exactly. ${a.calculation} ${a.why}` };
}
function numericOptions(correct, wrong, why, r, unit = money) {
  return shuffle(
    [...new Set([correct, ...wrong])].slice(0, 4).map((n) => ({
      text: unit(n),
      correct: n === correct,
      why:
        n === correct
          ? why
          : `That amount uses the wrong balance or timing. ${why}`,
    })),
    r,
  );
}
export function detective(seed, filter = "mixed") {
  const m = generateMonth(seed),
    r = rng(seed + "detective"),
    keys = Object.keys(TOPICS),
    topic = filter === "mixed" ? pick(r, keys) : filter;
  const a = m.adjustments.find((x) => x.topic === topic),
    variant =
      filter === "mixed"
        ? pick(r, [
            "omission",
            "balance",
            "cash",
            "book",
            "settlement",
            "vertical",
            "omission",
          ])
        : "omission";
  let prompt, options, why, title;
  if (variant === "omission") {
    const incomeHigh = [
      "supplies",
      "insurance",
      "wages",
      "depreciation",
    ].includes(topic);
    const balanceMetric =
      topic === "wages" || topic === "unearned"
        ? "total liabilities"
        : "total assets (net)";
    const balanceHigh = !["wages", "revenue"].includes(topic);
    const [metric, up] = pick(r, [
      ["this month's net income", incomeHigh],
      ["ending stockholders’ equity", incomeHigh],
      [balanceMetric, balanceHigh],
      [incomeHigh ? "total expenses" : "total revenue", false],
    ]);
    title = "The missing adjustment";
    prompt = `${a.text} The entire adjusting entry is omitted. What happens to ${metric}?`;
    why = `${metric[0].toUpperCase() + metric.slice(1)} is ${up ? "too high" : "too low"} by ${money(a.amount)}. ${incomeHigh ? "The missing expense makes expenses too low and net income and ending equity too high." : "The missing revenue makes revenue, net income, and ending equity too low."} ${a.why}`;
    options = shuffle(
      [
        { text: `Overstated by ${money(a.amount)}`, correct: up, why },
        { text: `Understated by ${money(a.amount)}`, correct: !up, why },
        {
          text: "Unchanged because no cash moved",
          correct: false,
          why: `Accrual balances follow earning, use, and obligations, not just cash timing. ${why}`,
        },
        {
          text: "Impossible to tell because the trial balance will not balance",
          correct: false,
          why: `Omitting both sides leaves debits equal to credits. Balanced does not mean correct. ${why}`,
        },
      ],
      r,
    );
  } else if (variant === "balance") {
    title = "Balanced does not mean correct";
    prompt = `The bookkeeper omits both sides of the ${money(a.amount)} ${TOPICS[topic].toLowerCase()} adjustment. Will the trial balance still balance?`;
    why =
      "Yes. Omitting the entire entry omits an equal debit and credit. The accounts are wrong, but the columns remain equal.";
    options = shuffle(
      [
        {
          text: "Yes, but the financial statements contain errors.",
          correct: true,
          why,
        },
        { text: "No, debits will exceed credits.", correct: false, why },
        { text: "No, credits will exceed debits.", correct: false, why },
        {
          text: "Yes, so no adjustment is needed.",
          correct: false,
          why: "Equality checks arithmetic, not completeness. " + why,
        },
      ],
      r,
    );
  } else if (variant === "cash") {
    title = "Same work, different timing";
    prompt = `In ${m.month}, the company completes ${money(m.v.accruedRevenue)} of work. It collects the cash next month. How much revenue belongs to ${m.month} under accrual accounting?`;
    why = `All ${money(m.v.accruedRevenue)} belongs to ${m.month}, when it was earned. Record Accounts Receivable now; next month's collection is not new revenue.`;
    options = numericOptions(
      m.v.accruedRevenue,
      [0, m.v.accruedRevenue * 2, m.v.accruedRevenue / 2],
      why,
      r,
    );
  } else if (variant === "book") {
    title = "Cost versus book value";
    const months = pick(r, [2, 3, 6, 12]),
      acc = m.v.dep * months;
    prompt = `Equipment cost ${money(m.v.equipment)}. After ${months} months, accumulated depreciation is ${money(acc)}. What is the book value?`;
    why = `Cost − accumulated depreciation = ${money(m.v.equipment)} − ${money(acc)} = ${money(m.v.equipment - acc)}. Equipment stays at cost; accumulated depreciation is a contra asset, not a liability.`;
    options = numericOptions(
      m.v.equipment - acc,
      [m.v.equipment, acc, m.v.equipment + acc],
      why,
      r,
    );
  } else if (variant === "settlement") {
    title = "Do not expense it twice";
    const current = number(r, 12, 25);
    prompt = `Last month, ${money(m.v.accruedWages)} of wages was accrued correctly. This month, a ${money(current + m.v.accruedWages)} payment covers that liability plus this month's work. How much is this month's Wages Expense in the payment entry?`;
    why = `The prior ${money(m.v.accruedWages)} was already expensed. Debit Wages Payable ${money(m.v.accruedWages)}, debit Wages Expense ${money(current)}, and credit Cash ${money(current + m.v.accruedWages)}.`;
    options = numericOptions(
      current,
      [current + m.v.accruedWages, m.v.accruedWages, 0],
      why,
      r,
    );
  } else {
    title = "Read the income statement";
    const percent = pick(r, [10, 15, 20, 25, 30]),
      rev = number(r, 5, 12, 1000),
      exp = (rev * percent) / 100;
    prompt = `Revenue is ${money(rev)} and wages expense is ${money(exp)}. In vertical analysis of the income statement, what percentage is wages expense?`;
    why = `Expense ÷ revenue × 100 = ${money(exp)} ÷ ${money(rev)} × 100 = ${percent}%. Revenue is the income statement's base. Total assets is the usual balance sheet base.`;
    options = numericOptions(
      percent,
      [100 - percent, 100, percent * 2],
      why,
      r,
      (n) => `${n}%`,
    );
  }
  return {
    title,
    prompt,
    options,
    why,
    topic: variant === "omission" || variant === "balance" ? topic : variant,
  };
}
