// Chapter 4 v1. Positive ledger amounts are debits; negative amounts are credits.
// Reuse the existing deterministic random helpers; keep all money in whole dollars.
import { rng, pick, shuffle, money, totals } from "../chapter-3/engine.mjs";
export { money, totals };
export const ACCOUNTS = {
  cash: ["Cash", "current asset", "debit"],
  receivable: ["Accounts Receivable", "current asset", "debit"],
  supplies: ["Supplies", "current asset", "debit"],
  insurance: ["Prepaid Insurance", "current asset", "debit"],
  equipment: ["Equipment", "property, plant & equipment", "debit"],
  accumulated: ["Accumulated Depreciation—Equipment", "contra asset", "credit"],
  payable: ["Accounts Payable", "current liability", "credit"],
  wagesPayable: ["Wages Payable", "current liability", "credit"],
  unearned: ["Unearned Fees", "current liability", "credit"],
  note: ["Notes Payable", "long-term liability", "credit"],
  stock: ["Common Stock", "equity", "credit"],
  retained: ["Retained Earnings", "equity", "credit"],
  dividends: ["Dividends", "dividends", "debit"],
  fees: ["Fees Earned", "revenue", "credit"],
  rentRevenue: ["Rent Revenue", "revenue", "credit"],
  wages: ["Wages Expense", "expense", "debit"],
  rent: ["Rent Expense", "expense", "debit"],
  suppliesExpense: ["Supplies Expense", "expense", "debit"],
  insuranceExpense: ["Insurance Expense", "expense", "debit"],
  depreciationExpense: ["Depreciation Expense", "expense", "debit"],
  summary: ["Income Summary", "clearing", "either"],
};
export const temporary = (id) =>
  ["dividends", "revenue", "expense", "clearing"].includes(ACCOUNTS[id][1]);
export const zeroLedger = () =>
  Object.fromEntries(Object.keys(ACCOUNTS).map((id) => [id, 0]));
export function post(balances, lines) {
  const b = { ...balances };
  if (lines.reduce((s, l) => s + l.amount, 0) !== 0)
    throw Error("Unbalanced journal entry");
  for (const l of lines) {
    if (!ACCOUNTS[l.account] || !Number.isInteger(l.amount))
      throw Error("Invalid journal line");
    b[l.account] += l.amount;
  }
  return b;
}
const pair = (debit, credit, amount) => [
  { account: debit, amount },
  { account: credit, amount: -amount },
];
const sumType = (b, type) =>
  Object.entries(b)
    .filter(([id]) => ACCOUNTS[id][1] === type)
    .reduce((s, [, n]) => s + n, 0);
export function statements(c) {
  const b = c.adjusted;
  const revenue = -sumType(b, "revenue"),
    expenses = sumType(b, "expense"),
    net = revenue - expenses;
  const beginningStock = -c.opening.stock,
    issued = -b.stock - beginningStock;
  const beginningRetained = -c.opening.retained,
    dividends = b.dividends;
  const retained = beginningRetained + net - dividends,
    stock = -b.stock;
  const currentAssets = sumType(b, "current asset"),
    ppe = b.equipment + b.accumulated;
  const currentLiabilities = -sumType(b, "current liability"),
    longTerm = -b.note;
  const assets = currentAssets + ppe,
    liabilities = currentLiabilities + longTerm;
  const equity = stock + retained;
  return {
    revenue,
    expenses,
    net,
    beginningStock,
    issued,
    stock,
    beginningRetained,
    dividends,
    retained,
    currentAssets,
    ppe,
    currentLiabilities,
    longTerm,
    assets,
    liabilities,
    equity,
    liabilitiesEquity: liabilities + equity,
  };
}
export function closingEntries(c, method = "summary") {
  const b = c.adjusted,
    s = statements(c);
  const revenues = Object.keys(b).filter(
    (id) => ACCOUNTS[id][1] === "revenue" && b[id],
  );
  const expenses = Object.keys(b).filter(
    (id) => ACCOUNTS[id][1] === "expense" && b[id],
  );
  const close = (ids) =>
    ids.map((account) => ({ account, amount: -b[account] }));
  const result =
    method === "direct"
      ? [
          {
            id: "income",
            title: "Close revenues and expenses directly to Retained Earnings",
            lines: [
              ...close(revenues),
              ...close(expenses),
              ...(s.net ? [{ account: "retained", amount: -s.net }] : []),
            ],
            why: `Debit revenues to remove their credits; credit expenses to remove their debits. The difference is ${money(Math.abs(s.net))} of net ${s.net >= 0 ? "income, credited" : "loss, debited"} to Retained Earnings.`,
          },
        ]
      : [
          {
            id: "revenue",
            title: "Close revenues to Income Summary",
            lines: [
              ...close(revenues),
              { account: "summary", amount: -s.revenue },
            ],
            why: "Revenue accounts have credit balances. Debit each revenue to zero it, and credit Income Summary for total revenue.",
          },
          {
            id: "expenses",
            title: "Close expenses to Income Summary",
            lines: [
              { account: "summary", amount: s.expenses },
              ...close(expenses),
            ],
            why: "Expenses have debit balances. Credit each expense to zero it, and debit Income Summary for total expenses.",
          },
          ...(s.net
            ? [
                {
                  id: "summary",
                  title: "Close Income Summary to Retained Earnings",
                  lines: pair(
                    s.net > 0 ? "summary" : "retained",
                    s.net > 0 ? "retained" : "summary",
                    Math.abs(s.net),
                  ),
                  why: `After revenues and expenses close, Income Summary has a ${s.net > 0 ? "credit" : "debit"} balance of ${money(Math.abs(s.net))}. Reverse it. Net ${s.net > 0 ? "income increases" : "loss decreases"} Retained Earnings.`,
                },
              ]
            : []),
        ];
  if (s.dividends)
    result.push({
      id: "dividends",
      title: "Close Dividends to Retained Earnings",
      lines: pair("retained", "dividends", s.dividends),
      why: "Dividends are distributions to owners, not expenses. Credit Dividends to zero its debit balance; debit Retained Earnings to reduce accumulated earnings. Income Summary is not involved.",
    });
  return result;
}
export function generateCase(seed) {
  const r = rng(`CH4-v1:${seed}`),
    n = (lo, hi) => (lo + Math.floor(r() * (hi - lo + 1))) * 50;
  const c = {
    seed: String(seed),
    company: pick(r, [
      "Willow Design Co.",
      "Cedar Tutoring Co.",
      "Moss Studio Inc.",
      "Juniper Consulting Co.",
    ]),
    date: "June 30, 2026",
    period: "Month ended June 30, 2026",
    opening: zeroLedger(),
    transactions: [],
    adjustments: [],
  };
  Object.assign(c.opening, {
    cash: n(65, 75),
    receivable: n(4, 8),
    supplies: n(6, 10),
    insurance: 600,
    equipment: n(36, 44),
    accumulated: -n(2, 5),
    payable: -n(4, 8),
    note: -1000,
    retained: -n(10, 16),
  });
  c.opening.stock = -Object.values(c.opening).reduce((s, v) => s + v, 0);
  let b = { ...c.opening };
  const tx = (description, lines) => {
    c.transactions.push({ description, lines });
    b = post(b, lines);
  };
  const fees = n(16, 24),
    loss = r() < 0.3;
  tx("Services completed and collected in cash.", pair("cash", "fees", fees));
  tx(
    "Office space sublet; this month’s rent collected and earned.",
    pair("cash", "rentRevenue", n(2, 4)),
  );
  tx(
    "Wages paid and recorded for this month.",
    pair("wages", "cash", loss ? n(30, 34) : n(6, 10)),
  );
  tx("This month’s office rent paid.", pair("rent", "cash", n(4, 6)));
  tx(
    "Cash received in advance for services.",
    pair("cash", "unearned", n(6, 10)),
  );
  tx("Cash dividends declared and paid.", pair("dividends", "cash", n(1, 3)));
  c.issued = pick(r, [0, 200, 400]);
  if (c.issued)
    tx(
      "Additional common stock issued for cash.",
      pair("cash", "stock", c.issued),
    );
  c.before = b;
  const add = (id, title, clue, lines, why) =>
    c.adjustments.push({ id, title, clue, lines, why });
  const used = n(2, 4),
    remaining = b.supplies - used;
  add(
    "supplies",
    "Supplies used",
    `The Supplies ledger balance is ${money(b.supplies)}. A June 30 count finds ${money(remaining)} on hand.`,
    pair("suppliesExpense", "supplies", used),
    `On hand is the ending asset, not the expense. ${money(b.supplies)} recorded − ${money(remaining)} remaining = ${money(used)} used. Debit Supplies Expense and credit Supplies.`,
  );
  add(
    "depreciation",
    "Monthly depreciation",
    `June equipment depreciation is ${money(100)} and has not been recorded.`,
    pair("depreciationExpense", "accumulated", 100),
    "Debit Depreciation Expense for this month’s use. Credit Accumulated Depreciation, a contra asset. Keep Equipment at historical cost; no cash changes hands.",
  );
  if (r() < 0.5)
    add(
      "insurance",
      "Insurance expired",
      "Prepaid Insurance includes a $600 six-month policy that began June 1. Record one month of expiration.",
      pair("insuranceExpense", "insurance", 100),
      "One of six months has expired: $600 ÷ 6 = $100 expense. Debit Insurance Expense; credit Prepaid Insurance. The remaining $500 still benefits future months.",
    );
  else {
    const earned = n(2, 4);
    add(
      "unearned",
      "Advance now earned",
      `Of the ${money(-b.unearned)} in Unearned Fees, ${money(earned)} of services were completed in June but not yet recorded as revenue.`,
      pair("unearned", "fees", earned),
      `The ${money(earned)} describes work completed, not the ending liability. Debit Unearned Fees to reduce the obligation and credit Fees Earned. Cash was received earlier.`,
    );
  }
  const accrual = n(2, 4);
  if (r() < 0.5)
    add(
      "wages",
      "Unpaid wages",
      `Employees earned ${money(accrual)} in June wages that remain unpaid and unrecorded on June 30.`,
      pair("wages", "wagesPayable", accrual),
      "The work belongs to June, so debit Wages Expense now and credit Wages Payable. Paying later will reduce the liability, not create this expense again.",
    );
  else
    add(
      "revenue",
      "Unrecorded services",
      `${money(accrual)} of services were completed in June but are unbilled AND unrecorded on June 30.`,
      pair("receivable", "fees", accrual),
      "Completed work creates revenue even before collection. Debit Accounts Receivable and credit Fees Earned. “Unbilled” alone does not prove an item is unrecorded; this clue explicitly says both.",
    );
  c.adjustments = shuffle(c.adjustments, r);
  c.adjusted = c.adjustments.reduce((b, a) => post(b, a.lines), c.before);
  c.postClosing = closingEntries(c).reduce(
    (b, e) => post(b, e.lines),
    c.adjusted,
  );
  verifyCase(c);
  return c;
}
export function verifyCase(c) {
  for (const b of [c.opening, c.before, c.adjusted, c.postClosing]) {
    if (
      Object.keys(b).length !== Object.keys(ACCOUNTS).length ||
      Object.values(b).some((n) => !Number.isInteger(n)) ||
      totals(b).debit !== totals(b).credit
    )
      throw Error("Invalid trial balance");
  }
  for (const [start, entries, end] of [
    [c.opening, c.transactions, c.before],
    [c.before, c.adjustments, c.adjusted],
    [c.adjusted, closingEntries(c), c.postClosing],
    [c.adjusted, closingEntries(c, "direct"), c.postClosing],
  ]) {
    const calculated = entries.reduce((b, e) => post(b, e.lines), start);
    if (Object.keys(ACCOUNTS).some((id) => calculated[id] !== end[id]))
      throw Error("Ledger mismatch");
  }
  const s = statements(c);
  if (
    s.assets !== s.liabilitiesEquity ||
    c.postClosing.retained !== -s.retained ||
    Object.keys(ACCOUNTS).some((id) => temporary(id) && c.postClosing[id] !== 0)
  )
    throw Error("Closing mismatch");
  return true;
}
export function parseMoney(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/^\$/, "");
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.00)?$/.test(text)) return null;
  const n = Number(text.replaceAll(",", ""));
  return Number.isSafeInteger(n) ? n : null;
}
export function checkJournal(expected, rows) {
  const messages = [],
    entered = {};
  let debit = 0,
    credit = 0;
  for (const row of rows) {
    if (
      !row.account &&
      !String(row.debit || "").trim() &&
      !String(row.credit || "").trim()
    )
      continue;
    const d = String(row.debit ?? "").trim() ? parseMoney(row.debit) : 0;
    const cr = String(row.credit ?? "").trim() ? parseMoney(row.credit) : 0;
    if (
      !ACCOUNTS[row.account] ||
      d === null ||
      cr === null ||
      d < 0 ||
      cr < 0 ||
      d > 0 === cr > 0
    )
      return {
        ok: false,
        messages: [
          "Choose an account and enter a positive amount on exactly one side of each used row. Leave extra rows blank.",
        ],
      };
    if (Object.hasOwn(entered, row.account))
      return {
        ok: false,
        messages: [
          "Use each account once in an entry. Combine its amounts on one row.",
        ],
      };
    entered[row.account] = d - cr;
    debit += d;
    credit += cr;
  }
  const target = Object.fromEntries(
    expected.lines.map((l) => [l.account, l.amount]),
  );
  for (const id of new Set([...Object.keys(target), ...Object.keys(entered)])) {
    if (entered[id] === target[id]) continue;
    const name = ACCOUNTS[id][0];
    if (!target[id])
      messages.push(
        `${name} does not belong in this entry. ${id === "cash" ? "Neither an adjustment here nor a closing entry moves cash." : id === "equipment" ? "Equipment stays at cost; depreciation uses its contra account." : "Consider which account must change and which must stay open."}`,
      );
    else if (entered[id] === undefined)
      messages.push(
        `${name} is missing. ${temporary(id) ? "A closing entry reverses a temporary balance; an adjustment records current activity." : "Consider the asset, obligation, or accumulated equity affected."}`,
      );
    else if (Math.sign(entered[id]) !== Math.sign(target[id]))
      messages.push(
        `${name} is on the wrong side. ${ACCOUNTS[id][2] === "either" ? "Reverse the current Income Summary balance." : `Its normal balance is a ${ACCOUNTS[id][2]}; increasing and removing that balance use opposite sides.`}`,
      );
    else
      messages.push(
        `${name}: the side is right; revisit the amount. ${expected.why}`,
      );
  }
  if (debit !== credit)
    messages.unshift(
      `Debits (${money(debit)}) and credits (${money(credit)}) differ. A valid entry needs equal totals, but equal totals alone do not prove the accounts are correct.`,
    );
  return {
    ok: messages.length === 0,
    messages: messages.length ? messages : [expected.why],
  };
}
export function balanceWhy(c, id, postClosing = false) {
  if (postClosing && temporary(id))
    return `${ACCOUNTS[id][0]} is temporary. Its balance was transferred during closing, so it is zero and omitted from the post-closing trial balance.`;
  if (id === "retained")
    return postClosing
      ? `Beginning retained earnings ${money(-c.opening.retained)} + net income (or − net loss) ${money(statements(c).net)} − dividends ${money(c.adjusted.dividends)} = ${money(statements(c).retained)}. This is the amount carried into next month.`
      : "Retained Earnings stays at its beginning balance until closing. Financial statements calculate ending retained earnings separately.";
  const adjustments = c.adjustments.filter((a) =>
    a.lines.some((l) => l.account === id),
  );
  return adjustments.length
    ? `${ACCOUNTS[id][0]} starts at ${money(Math.abs(c.before[id]))} ${c.before[id] < 0 ? "credit" : "debit"}. ${adjustments.map((a) => a.why).join(" ")}`
    : `${ACCOUNTS[id][0]} is unchanged by these adjustments${postClosing ? " and is a permanent balance carried into next month" : ""}. Keep its recorded amount and side.`;
}
export const CONCEPTS = [
  "permanence",
  "normal",
  "adjusting",
  "trial",
  "retained",
  "dividends",
  "loss",
  "contra",
  "sequence",
  "current",
  "balanced",
  "summary",
];
export function conceptQuestion(seed, round = 0) {
  const r = rng(`${seed}:concept:${round}`),
    topic = shuffle(
      CONCEPTS,
      rng(`${seed}:deck:${Math.floor(round / CONCEPTS.length)}`),
    )[round % CONCEPTS.length];
  const n = pick(r, [100, 150, 200, 250]),
    id = pick(
      r,
      Object.keys(ACCOUNTS).filter((id) => id !== "summary"),
    );
  let prompt, choices;
  const option = (text, correct, why) => ({ text, correct, why });
  switch (topic) {
    case "permanence":
      prompt = `What happens to ${ACCOUNTS[id][0]} during closing?`;
      choices = [
        option(
          "It is closed to zero.",
          temporary(id),
          "Revenues, expenses, Dividends, and Income Summary are temporary; their balances are cleared for a new period.",
        ),
        option(
          "It carries forward as a permanent account.",
          !temporary(id),
          "Assets (including contra assets), liabilities, Common Stock, and Retained Earnings carry forward.",
        ),
      ];
      break;
    case "normal":
      prompt = `What is the normal balance of ${ACCOUNTS[id][0]}?`;
      choices = ["debit", "credit"].map((side) =>
        option(
          side === "debit" ? "Debit" : "Credit",
          ACCOUNTS[id][2] === side,
          `${ACCOUNTS[id][0]} is ${ACCOUNTS[id][1]}. Its normal balance is a ${ACCOUNTS[id][2]}. Normal means the usual increase side, not a guarantee that every actual balance is on that side.`,
        ),
      );
      break;
    case "adjusting":
      prompt = `June wages of ${money(n)} are unpaid and unrecorded. What is needed?`;
      choices = [
        option(
          "Adjusting entry: debit Wages Expense; credit Wages Payable.",
          true,
          "Recognize the June work and the obligation before preparing statements.",
        ),
        option(
          "Closing entry: debit Retained Earnings; credit Wages Expense.",
          false,
          "Closing clears an already-recorded expense. It cannot replace recognition of an unrecorded liability.",
        ),
        option(
          "No entry until cash is paid.",
          false,
          "Accrual accounting recognizes expenses when incurred, even before payment.",
        ),
      ];
      break;
    case "trial":
      prompt =
        "Which account may appear on an adjusted trial balance but is omitted from a post-closing trial balance?";
      choices = [
        option(
          "Fees Earned",
          true,
          "The adjusted trial balance still contains temporary accounts. Closing resets revenue to zero.",
        ),
        option(
          "Unearned Fees",
          false,
          "Unearned fees are an obligation to do future work, so this liability survives closing.",
        ),
        option(
          "Accumulated Depreciation",
          false,
          "This contra asset carries the equipment’s cumulative depreciation forward.",
        ),
      ];
      break;
    case "retained":
      prompt = `Beginning retained earnings are $600, net income is ${money(n + 300)}, and dividends are ${money(n)}. What are ending retained earnings?`;
      choices = [
        option(
          "$900",
          true,
          "$600 + net income − dividends = $900. This ending amount appears on the balance sheet and, after closing, the ledger.",
        ),
        option(
          money(n + 900),
          false,
          "That adds net income but forgets dividends, which reduce retained earnings.",
        ),
        option(
          "$600",
          false,
          "That is the beginning balance shown on the adjusted trial balance, not the ending balance after closing.",
        ),
      ];
      break;
    case "dividends":
      prompt = "Why are dividends absent from the income statement?";
      choices = [
        option(
          "They distribute earnings to owners rather than create an expense.",
          true,
          "Dividends reduce retained earnings on the equity statement and close directly to Retained Earnings.",
        ),
        option(
          "They are a permanent asset.",
          false,
          "Dividends are a temporary equity distribution, not an asset.",
        ),
        option(
          "They increase revenue.",
          false,
          "A distribution to owners is not revenue earned from customers.",
        ),
      ];
      break;
    case "loss":
      prompt = `Income Summary has a ${money(n)} debit balance after revenues and expenses close. How do you close it?`;
      choices = [
        option(
          "Debit Retained Earnings; credit Income Summary.",
          true,
          "A debit balance means expenses exceeded revenue: a net loss. Credit Income Summary to zero it and debit Retained Earnings to reduce equity.",
        ),
        option(
          "Debit Income Summary; credit Retained Earnings.",
          false,
          "That is the net-income direction. Here it would enlarge the debit balance instead of removing it.",
        ),
        option(
          "Debit Dividends; credit Cash.",
          false,
          "A loss is not a dividend payment, and closing does not move cash.",
        ),
      ];
      break;
    case "contra":
      prompt =
        "Where does Accumulated Depreciation belong on a classified balance sheet?";
      choices = [
        option(
          "Deduct it from equipment within property, plant & equipment.",
          true,
          "It is a permanent contra asset: cost less accumulated depreciation gives book value.",
        ),
        option(
          "List it as a current liability.",
          false,
          "A credit balance does not automatically make an account a liability. This account reduces an asset’s carrying value.",
        ),
        option(
          "Omit it because all depreciation accounts close.",
          false,
          "Depreciation Expense closes, but Accumulated Depreciation stays open.",
        ),
      ];
      break;
    case "sequence":
      prompt = "Why prepare financial statements before closing entries?";
      choices = [
        option(
          "Statements need this period’s revenue and expense balances before they are reset.",
          true,
          "The adjusted trial balance supplies the statements. Closing then transfers the period’s results into permanent equity.",
        ),
        option(
          "Closing records the missing adjustments.",
          false,
          "Adjusting entries update recognition before statements; closing has a different purpose.",
        ),
        option(
          "The post-closing trial balance contains all income statement accounts.",
          false,
          "It contains only permanent accounts with remaining balances.",
        ),
      ];
      break;
    case "current":
      prompt =
        "A note is due in one payment three years from now. Where is it classified?";
      choices = [
        option(
          "Long-term liabilities",
          true,
          "No principal is due in the coming year. These practice cases assume a one-year operating cycle.",
        ),
        option(
          "Current liabilities",
          false,
          "Current liabilities are due within a year or the operating cycle, whichever is longer. This note is due in three years.",
        ),
        option(
          "Stockholders’ equity",
          false,
          "Borrowed money creates an obligation, not an ownership contribution.",
        ),
      ];
      break;
    case "balanced":
      prompt =
        "The post-closing trial balance totals agree. Does that prove every entry is correct?";
      choices = [
        option(
          "No. Equal totals cannot detect every wrong account or omitted balanced entry.",
          true,
          "Trial balances verify debit-credit equality. A balanced entry posted to the wrong accounts can still produce equal totals.",
        ),
        option(
          "Yes. Equal totals prove the books are error-free.",
          false,
          "Using the wrong account on the correct side may leave the totals equal.",
        ),
      ];
      break;
    case "summary":
      prompt =
        "Which closing entry bypasses Income Summary even when using the four-step method?";
      choices = [
        option(
          "Closing Dividends to Retained Earnings",
          true,
          "Dividends are not part of net income; transfer them straight to Retained Earnings.",
        ),
        option(
          "Closing expenses",
          false,
          "Expenses first transfer to Income Summary, where revenue minus expenses becomes net income or loss.",
        ),
        option(
          "Closing revenues",
          false,
          "Revenues first transfer to Income Summary in this method.",
        ),
      ];
      break;
  }
  return { topic, prompt, options: shuffle(choices, r) };
}
