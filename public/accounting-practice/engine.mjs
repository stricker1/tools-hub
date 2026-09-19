// Amounts are integer dollars. Signed balances use debit-positive / credit-negative.
export const ACCOUNTS = [
  ["101", "Cash", "asset"],
  ["112", "Accounts Receivable", "asset"],
  ["115", "Supplies", "asset"],
  ["118", "Prepaid Insurance", "asset"],
  ["120", "Land", "asset"],
  ["125", "Equipment", "asset"],
  ["128", "Vehicles", "asset"],
  ["201", "Accounts Payable", "liability"],
  ["210", "Notes Payable", "liability"],
  ["215", "Unearned Rent", "liability"],
  ["301", "Common Stock", "equity"],
  ["310", "Retained Earnings", "equity"],
  ["320", "Dividends", "dividend"],
  ["401", "Fees Earned", "revenue"],
  ["410", "Rent Revenue", "revenue"],
  ["501", "Rent Expense", "expense"],
  ["510", "Wages Expense", "expense"],
  ["520", "Utilities Expense", "expense"],
  ["530", "Advertising Expense", "expense"],
  ["540", "Automobile Expense", "expense"],
  ["550", "Miscellaneous Expense", "expense"],
  ["560", "Supplies Expense", "expense"],
].map(([id, name, type]) => ({
  id,
  name,
  type,
  normal: ["asset", "expense", "dividend"].includes(type) ? "debit" : "credit",
}));
export const CONCEPTS = {
  opening: "Beginning balances",
  receivables: "Receivables & payables",
  prepaid: "Prepaid insurance",
  compound: "Compound entries & notes",
  unearned: "Unearned rent",
  returns: "Returns & refunds",
  supplies: "Supplies used",
  corrections: "Error correction",
  pages: "Multiple journal pages",
};
export const PRESETS = {
  beginner: [],
  intermediate: ["receivables", "prepaid", "compound"],
  advanced: Object.keys(CONCEPTS),
};
const byId = Object.fromEntries(ACCOUNTS.map((a) => [a.id, a]));
export const money = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
export const dollars = (n) => `$${money(n)}`;
export function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function encodeSeed(difficulty, concepts, token) {
  const mask = Object.keys(CONCEPTS).reduce(
    (m, k, i) => m + (concepts.includes(k) ? 2 ** i : 0),
    0,
  );
  return `AP1-${difficulty[0].toUpperCase()}-${mask.toString(36)}-${token}`;
}
export function parseSeed(id) {
  const m = /^AP1-([BIAC])-([0-9a-z]+)-([a-z0-9]{1,24})$/i.exec(id.trim());
  if (!m) throw Error("Use a full Problem ID, such as AP1-B-0-garden.");
  const mask = parseInt(m[2], 36);
  if (mask > 511) throw Error("This Problem ID has unknown concepts.");
  const difficulty = {
    B: "beginner",
    I: "intermediate",
    A: "advanced",
    C: "custom",
  }[m[1].toUpperCase()];
  const concepts = Object.keys(CONCEPTS).filter((_, i) => mask & (2 ** i));
  if (
    difficulty !== "custom" &&
    JSON.stringify(concepts) !==
      JSON.stringify(
        Object.keys(CONCEPTS).filter((k) => PRESETS[difficulty].includes(k)),
      )
  )
    throw Error("The difficulty and concepts in this Problem ID do not match.");
  return {
    id: `AP1-${m[1].toUpperCase()}-${m[2].toLowerCase()}-${m[3].toLowerCase()}`,
    difficulty,
    concepts,
  };
}
export function generate(id) {
  const config = parseSeed(id),
    rand = rng(config.id),
    pick = (a) => a[Math.floor(rand() * a.length)],
    amt = (a, b, step = 50) => (a + Math.floor(rand() * (b - a + 1))) * step;
  const has = (k) => config.concepts.includes(k),
    opening = {},
    entries = [],
    balance = {};
  const month = pick([1, 3, 4, 6, 8, 9, 10, 11]),
    year = 2026,
    monthName = new Date(year, month - 1, 1).toLocaleString("en-US", {
      month: "long",
    }),
    date = (day) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const company = `${pick(["Willow", "Juniper", "Clover", "Harbor", "Maple", "Cedar", "Meadow", "Sunbeam", "Fern", "Olive"])} ${pick(["Design", "Studio", "Consulting", "Creative", "Services", "Media"])} Co.`;
  if (has("opening")) {
    opening["101"] = amt(500, 800);
    opening["125"] = amt(100, 200);
    opening["301"] = -20000;
    opening["310"] = -Object.values(opening).reduce((a, b) => a + b, 0);
  }
  Object.assign(balance, opening);
  function add(concept, text, lines, explanation) {
    const entry = {
      id: entries.length,
      date: "",
      page: has("pages") ? 18 + Math.floor(entries.length / 5) : 18,
      concept,
      text,
      explanation,
      lines: lines.map(([account, value]) => ({
        account,
        debit: Math.max(value, 0),
        credit: Math.max(-value, 0),
      })),
    };
    if (lines.reduce((s, [, v]) => s + v, 0) !== 0)
      throw Error("Unbalanced template");
    for (const [a, v] of lines) balance[a] = (balance[a] || 0) + v;
    if (
      Object.entries(balance).some(
        ([a, v]) => byId[a].type === "asset" && v < 0,
      )
    )
      throw Error("Impossible asset balance");
    entries.push(entry);
  }
  let n = amt(700, 1200);
  add(
    "investment",
    `Issued common stock to shareholders for ${dollars(n)} cash.`,
    [
      ["101", n],
      ["301", -n],
    ],
    "Cash is an asset, so its increase is a debit. Common Stock is equity, so its increase is a credit.",
  );
  const cashWork = () => {
    n = amt(30, 160);
    add(
      "cash revenue",
      `Received ${dollars(n)} cash for services performed today.`,
      [
        ["101", n],
        ["401", -n],
      ],
      "The work is complete: debit Cash and credit Fees Earned.",
    );
  };
  const expense = (a, description, low = 4, high = 25) => {
    const value = amt(low, high);
    add(
      "expenses",
      `Paid ${dollars(value)} cash for ${description}.`,
      [
        [a, value],
        ["101", -value],
      ],
      `${byId[a].name} increases with a debit. Cash decreases with a credit.`,
    );
    return value;
  };
  expense("501", `${monthName} office rent`, 15, 50);
  cashWork();
  n = amt(10, 30);
  add(
    "supplies",
    `Purchased ${dollars(n)} of supplies for cash. All remain unused at purchase.`,
    [
      ["115", n],
      ["101", -n],
    ],
    "Unused supplies are an asset. Debit Supplies, not Supplies Expense.",
  );
  const blocks = [];
  if (has("receivables"))
    blocks.push(() => {
      const billed = amt(30, 110);
      add(
        "receivables",
        `Performed services and billed customers ${dollars(billed)} on account.`,
        [
          ["112", billed],
          ["401", -billed],
        ],
        "Revenue is earned now even though cash will arrive later. Debit Accounts Receivable and credit Fees Earned.",
      );
      const collected = Math.floor((billed * pick([0.4, 0.6, 0.8])) / 50) * 50;
      add(
        "receivables",
        `Received ${dollars(collected)} cash from customers on account, toward the earlier bill.`,
        [
          ["101", collected],
          ["112", -collected],
        ],
        "Cash increases and Accounts Receivable decreases. No new revenue: it was earned when the customer was billed.",
      );
      const purchased = amt(10, 30);
      add(
        "payables",
        `Purchased ${dollars(purchased)} of unused supplies on account.`,
        [
          ["115", purchased],
          ["201", -purchased],
        ],
        "Supplies increases; the unpaid bill creates Accounts Payable.",
      );
      const equipment = amt(30, 80);
      add(
        "payables",
        `Purchased ${dollars(equipment)} of equipment on account, payable next month.`,
        [
          ["125", equipment],
          ["201", -equipment],
        ],
        "Equipment is an asset, not an immediate expense. Credit Accounts Payable for the unpaid purchase.",
      );
      const paid = Math.floor(purchased / 100) * 50;
      add(
        "payables",
        `Paid a creditor ${dollars(paid)} cash on account toward the supplies bill.`,
        [
          ["201", paid],
          ["101", -paid],
        ],
        "Paying an existing debt reduces Accounts Payable with a debit. It does not create an expense.",
      );
    });
  if (has("prepaid"))
    blocks.push(() => {
      n = amt(12, 36);
      add(
        "prepaid",
        `Paid ${dollars(n)} for insurance coverage beginning next month. None applies to ${monthName}.`,
        [
          ["118", n],
          ["101", -n],
        ],
        "Future coverage is an asset: debit Prepaid Insurance. No insurance expense belongs to this month.",
      );
    });
  if (has("compound"))
    blocks.push(() => {
      const a = pick(["120", "125", "128"]),
        cost = amt(100, 300),
        down = amt(20, 50);
      add(
        "notes",
        `Purchased ${byId[a].name.toLowerCase()} for ${dollars(cost)}; paid ${dollars(down)} cash and signed a note for the remaining ${dollars(cost - down)}. No interest accrues this month.`,
        [
          [a, cost],
          ["101", -down],
          ["210", -(cost - down)],
        ],
        "Debit the asset for its full cost. Credit Cash for the down payment and Notes Payable for the financed amount.",
      );
    });
  if (has("unearned"))
    blocks.push(() => {
      n = amt(15, 40);
      add(
        "unearned",
        `Received ${dollars(n)} cash in advance for renting a spare office next month. No rent has been earned yet.`,
        [
          ["101", n],
          ["215", -n],
        ],
        "Cash increases now, but rent is not earned. Credit Unearned Rent, a liability for the future rental service.",
      );
      n = amt(8, 20);
      add(
        "rent revenue",
        `Received ${dollars(n)} cash for a separate room rental completed this month.`,
        [
          ["101", n],
          ["410", -n],
        ],
        "This rental is complete, so credit Rent Revenue. It is separate from the advance for next month.",
      );
    });
  if (has("returns"))
    blocks.push(() => {
      const cost = amt(10, 30),
        returned = amt(2, 5);
      add(
        "payables",
        `Purchased ${dollars(cost)} of additional supplies on account from Green Paper.`,
        [
          ["115", cost],
          ["201", -cost],
        ],
        "Debit the supplies asset and credit the amount owed.",
      );
      add(
        "returns",
        `Returned ${dollars(returned)} of the unused supplies to Green Paper, reducing the unpaid bill.`,
        [
          ["201", returned],
          ["115", -returned],
        ],
        "Debit Accounts Payable to reduce the debt and credit Supplies to remove the returned asset.",
      );
      const paid = expense("530", "advertising", 10, 25),
        refund = Math.floor(paid / 250) * 50;
      add(
        "refunds",
        `Received a ${dollars(refund)} cash refund for an overcharge included in the earlier advertising expense.`,
        [
          ["101", refund],
          ["530", -refund],
        ],
        "The refund reduces the previously recorded expense. Credit Advertising Expense; this is not new revenue.",
      );
    });
  // Shuffle independent blocks only; each dependent sequence stays chronological.
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }
  blocks.forEach((f) => f());
  if (has("supplies")) {
    n = Math.floor((balance["115"] * pick([0.2, 0.4, 0.6])) / 50) * 50;
    add(
      "supplies used",
      `Issued ${dollars(n)} of supplies to a completed job today. Record the documented usage immediately.`,
      [
        ["560", n],
        ["115", -n],
      ],
      "Used supplies become Supplies Expense. This documented usage is recorded during the month before the unadjusted trial balance.",
    );
  }
  cashWork();
  const optional = [
    ["520", "this month’s utilities"],
    ["540", "business vehicle operating costs"],
    ["550", "miscellaneous office expenses"],
    ["530", "this month’s advertising"],
  ];
  const count = config.difficulty === "beginner" ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const j = Math.floor(rand() * optional.length),
      [a, desc] = optional.splice(j, 1)[0];
    expense(a, desc);
  }
  let correction = null;
  if (has("corrections")) {
    const scenario = pick([
        { recorded: 1680, actual: 1860, type: "transposition" },
        { recorded: 420, actual: 4200, type: "slide" },
        { recorded: 2400, actual: 2100, type: "neither" },
      ]),
      scale = pick([1, 2, 5]);
    // Scaling transposed digits can destroy the transposition, so keep that pair intact.
    const recorded =
        scenario.recorded * (scenario.type === "transposition" ? 1 : scale),
      actual =
        scenario.actual * (scenario.type === "transposition" ? 1 : scale),
      delta = actual - recorded;
    add(
      "wages",
      `For this practice exercise, record the wages payment using the bookkeeper’s reported amount of ${dollars(recorded)}. A later audit is a separate correction task.`,
      [
        ["510", recorded],
        ["101", -recorded],
      ],
      "Record the supplied amount in the original journal and trial balance. The later audit correction is separate.",
    );
    correction = {
      recorded,
      actual,
      type: scenario.type,
      why: "equal",
      explanation:
        "Both the expense debit and cash credit were recorded at the same wrong amount, so total debits still equaled total credits. Correct only the difference; dividends are unrelated.",
      lines: [
        {
          account: delta > 0 ? "510" : "101",
          debit: Math.abs(delta),
          credit: 0,
        },
        {
          account: delta > 0 ? "101" : "510",
          debit: 0,
          credit: Math.abs(delta),
        },
      ],
    };
  } else expense("510", "wages earned this month", 20, 60);
  n = amt(4, 16);
  add(
    "dividends",
    `Paid shareholders ${dollars(n)} cash dividends.`,
    [
      ["320", n],
      ["101", -n],
    ],
    "Dividends reduce retained earnings but are not an expense. Debit Dividends and credit Cash.",
  );
  // Spread postings over the month, with unique dates and no impossible day numbers.
  entries.forEach((e, i) => {
    e.date = date(2 + Math.floor((i * 26) / Math.max(1, entries.length - 1)));
  });
  const accounts = ACCOUNTS.filter((a) => a.id in balance || a.id === "310");
  const problem = {
    ...config,
    company,
    monthName,
    month,
    year,
    start: date(1),
    end: date(new Date(year, month, 0).getDate()),
    opening,
    entries,
    accounts,
    correction,
  };
  problem.key = derive(problem);
  verify(problem);
  return problem;
}
export function derive(p) {
  const balances = Object.fromEntries(
      p.accounts.map((a) => [a.id, p.opening[a.id] || 0]),
    ),
    ledger = Object.fromEntries(p.accounts.map((a) => [a.id, []]));
  for (const e of p.entries)
    for (const l of e.lines) {
      balances[l.account] += l.debit - l.credit;
      ledger[l.account].push({
        date: e.date,
        item: `Transaction ${e.id + 1}`,
        ref: String(e.page),
        debit: l.debit,
        credit: l.credit,
        balance: balances[l.account],
        entry: e.id,
      });
    }
  const trial = p.accounts.map((a) => ({
    account: a.id,
    debit: Math.max(balances[a.id], 0),
    credit: Math.max(-balances[a.id], 0),
  }));
  const total = (type) =>
      p.accounts
        .filter((a) => a.type === type)
        .reduce((s, a) => s + balances[a.id], 0),
    revenue = -total("revenue"),
    expenses = total("expense"),
    net = revenue - expenses,
    dividends = total("dividend"),
    change = net - dividends,
    retained = -(p.opening["310"] || 0) + change;
  return {
    balances,
    ledger,
    trial,
    results: { revenue, expenses, net, dividends, change, retained },
  };
}
export function verify(p) {
  const insist = (ok, msg) => {
    if (!ok) throw Error(msg);
  };
  insist(
    Object.values(p.opening).reduce((s, n) => s + n, 0) === 0,
    "Opening balance mismatch",
  );
  const independent = { ...p.opening };
  for (const e of p.entries) {
    insist(
      e.lines.reduce((s, l) => s + l.debit - l.credit, 0) === 0,
      "Journal mismatch",
    );
    for (const l of e.lines) {
      insist(
        byId[l.account] &&
          Number.isSafeInteger(l.debit) &&
          Number.isSafeInteger(l.credit) &&
          l.debit >= 0 &&
          l.credit >= 0 &&
          !(l.debit && l.credit),
        "Invalid posting",
      );
      independent[l.account] =
        (independent[l.account] || 0) + l.debit - l.credit;
    }
  }
  for (const a of p.accounts) {
    let running = p.opening[a.id] || 0;
    const expected = p.entries.flatMap((e) =>
        e.lines.filter((l) => l.account === a.id).map((l) => ({ e, l })),
      ),
      posts = p.key.ledger[a.id];
    insist(posts.length === expected.length, "Posting count mismatch");
    posts.forEach((r, i) => {
      const { e, l } = expected[i];
      running += r.debit - r.credit;
      insist(
        r.date === e.date &&
          r.ref === String(e.page) &&
          r.debit === l.debit &&
          r.credit === l.credit &&
          running === r.balance,
        "Ledger mismatch",
      );
    });
    insist(
      running === (independent[a.id] || 0) && running === p.key.balances[a.id],
      "Ending balance mismatch",
    );
  }
  insist(
    p.key.trial.reduce((s, r) => s + r.debit - r.credit, 0) === 0,
    "Trial balance mismatch",
  );
  for (const row of p.key.trial)
    insist(
      row.debit === Math.max(independent[row.account] || 0, 0) &&
        row.credit === Math.max(-(independent[row.account] || 0), 0),
      "Trial account mismatch",
    );
  const r = p.key.results,
    revenue = p.entries
      .flatMap((e) => e.lines)
      .filter((l) => byId[l.account].type === "revenue")
      .reduce((s, l) => s + l.credit - l.debit, 0),
    expenses = p.entries
      .flatMap((e) => e.lines)
      .filter((l) => byId[l.account].type === "expense")
      .reduce((s, l) => s + l.debit - l.credit, 0);
  insist(
    r.revenue === revenue &&
      r.expenses === expenses &&
      r.net === revenue - expenses &&
      r.change === r.net - r.dividends &&
      r.retained === -(p.opening["310"] || 0) + r.change,
    "Financial results mismatch",
  );
  if (p.correction)
    insist(
      p.correction.lines.reduce((s, l) => s + l.debit - l.credit, 0) === 0,
      "Correction mismatch",
    );
  return true;
}
