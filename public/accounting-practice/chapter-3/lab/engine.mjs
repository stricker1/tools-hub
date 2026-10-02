import { rng, pick, shuffle, money, parseAmount, totals } from "../engine.mjs";
export { money, parseAmount, totals };
export const ACCOUNTS = {
  cash: ["Cash", "asset"],
  receivable: ["Accounts Receivable", "asset"],
  insurance: ["Prepaid Insurance", "asset"],
  supplies: ["Supplies", "asset"],
  land: ["Land", "asset"],
  building: ["Building", "asset"],
  depBuilding: ["Accumulated Depreciation—Building", "contra asset"],
  equipment: ["Equipment", "asset"],
  depEquipment: ["Accumulated Depreciation—Equipment", "contra asset"],
  accountsPayable: ["Accounts Payable", "liability"],
  unearned: ["Unearned Rent", "liability"],
  wagesPayable: ["Salaries and Wages Payable", "liability"],
  stock: ["Common Stock", "equity"],
  retained: ["Retained Earnings", "equity"],
  dividends: ["Dividends", "dividends"],
  fees: ["Fees Earned", "revenue"],
  rentRevenue: ["Rent Revenue", "revenue"],
  wagesExpense: ["Salaries and Wages Expense", "expense"],
  utilitiesExpense: ["Utilities Expense", "expense"],
  advertisingExpense: ["Advertising Expense", "expense"],
  repairsExpense: ["Repairs Expense", "expense"],
  miscExpense: ["Miscellaneous Expense", "expense"],
  insuranceExpense: ["Insurance Expense", "expense"],
  suppliesExpense: ["Supplies Expense", "expense"],
  depBuildingExpense: ["Depreciation Expense—Building", "expense"],
  depEquipmentExpense: ["Depreciation Expense—Equipment", "expense"],
};
export const TOPICS = {
  supplies: "Supplies",
  insurance: "Insurance",
  unearned: "Unearned rent",
  revenue: "Unbilled fees",
  wages: "Accrued wages",
  depreciation: "Depreciation",
};
export const ROLES = {
  remaining: "An ending balance: what is still left at the date",
  change: "A change: the amount used, earned, or incurred to record",
};
const num = (r, min, max, step = 5) =>
  (min + Math.floor(r() * (max - min + 1))) * step;
const adjustment = (
  id,
  target,
  debit,
  credit,
  amount,
  clue,
  why,
  calculation,
) => ({ id, target, debit, credit, amount, clue, why, calculation });
export const name = (id) => ACCOUNTS[id][0];
export const balanceText = (value) =>
  value === 0 ? "$0" : `${money(Math.abs(value))} ${value > 0 ? "Dr" : "Cr"}`;
export function generateCase(seed) {
  const r = rng(seed),
    n = (a, b, s) => num(r, a, b, s);
  const before = Object.fromEntries(Object.keys(ACCOUNTS).map((id) => [id, 0]));
  Object.assign(before, {
    cash: n(60, 150, 100),
    receivable: n(320, 500, 100),
    insurance: n(1200, 2200),
    supplies: n(900, 2300),
    land: n(900, 1200, 100),
    building: n(1500, 1850, 100),
    depBuilding: -n(600, 850, 100),
    equipment: n(1100, 1400, 100),
    depEquipment: -n(650, 900, 100),
    accountsPayable: -n(1600, 4600),
    unearned: -n(1200, 2400),
    stock: -n(600, 850, 100),
    dividends: n(1800, 3500),
    fees: -n(3000, 3400, 100),
    wagesExpense: n(1850, 2200, 100),
    utilitiesExpense: n(350, 460, 100),
    advertisingExpense: n(170, 240, 100),
    repairsExpense: n(120, 200, 100),
    miscExpense: n(45, 75, 100),
  });
  before.retained = -Object.values(before).reduce((a, b) => a + b, 0);
  const suppliesLeft = n(50, 480),
    insuranceLeft = n(200, 850),
    rentLeft = n(100, 600);
  const suppliesUsed = before.supplies - suppliesLeft;
  const insuranceUsed = before.insurance - insuranceLeft;
  const rentEarned = -before.unearned - rentLeft;
  const bDep = n(800, 1700),
    eDep = n(700, 2100),
    wages = n(350, 1800);
  const adjustments = [
    adjustment(
      "supplies",
      "supplies",
      "suppliesExpense",
      "supplies",
      suppliesUsed,
      `Supplies on hand at December 31, ${money(suppliesLeft)}.`,
      "The physical count is the asset still available. Supplies consumed during the year become an expense. Debit the expense to increase it; credit Supplies to remove what was used.",
      `${money(before.supplies)} recorded − ${money(suppliesLeft)} on hand = ${money(suppliesUsed)} used.`,
    ),
    adjustment(
      "insurance",
      "insurance",
      "insuranceExpense",
      "insurance",
      insuranceUsed,
      `Unexpired insurance at December 31, ${money(insuranceLeft)}.`,
      "Unexpired coverage is a future benefit that remains an asset. The expired portion belongs in this year's Insurance Expense.",
      `${money(before.insurance)} recorded − ${money(insuranceLeft)} unexpired = ${money(insuranceUsed)} expired.`,
    ),
    adjustment(
      "building",
      "depBuilding",
      "depBuildingExpense",
      "depBuilding",
      bDep,
      `Depreciation of the building for the year, ${money(bDep)}.`,
      "Depreciation Expense increases with a debit. Accumulated Depreciation is a contra asset and increases with a credit. Building keeps its recorded cost; its book value decreases.",
      `The depreciation for this year is already given: ${money(bDep)}.`,
    ),
    adjustment(
      "equipment",
      "depEquipment",
      "depEquipmentExpense",
      "depEquipment",
      eDep,
      `Depreciation of equipment for the year, ${money(eDep)}.`,
      "Credit Accumulated Depreciation—Equipment, not Equipment. This records allocation of cost to the period, not a new cash payment or an appraisal of market value.",
      `The depreciation for this year is already given: ${money(eDep)}.`,
    ),
    adjustment(
      "unearned",
      "unearned",
      "unearned",
      "rentRevenue",
      rentEarned,
      `Rent still unearned at December 31, ${money(rentLeft)}.`,
      "This company received rent in advance as a landlord. The amount still unearned is the obligation remaining. Reduce Unearned Rent with a debit for the portion now earned and credit Rent Revenue. There is no new receivable: cash was collected earlier.",
      `${money(-before.unearned)} recorded liability − ${money(rentLeft)} still owed in rental service = ${money(rentEarned)} earned.`,
    ),
    adjustment(
      "wages",
      "wagesPayable",
      "wagesExpense",
      "wagesPayable",
      wages,
      `Accrued salaries and wages at December 31, ${money(wages)}; not yet recorded.`,
      "Employees have already worked. The company has an expense now and owes payment later. Both expense and liability increase: debit Salaries and Wages Expense, credit Salaries and Wages Payable.",
      `Add the unrecorded ${money(wages)} to expense and the amount owed.`,
    ),
  ];
  const variant = pick(r, ["revenue", "utilities"]),
    amount = n(250, 2400);
  adjustments.push(
    variant === "revenue"
      ? adjustment(
          "revenue",
          "receivable",
          "receivable",
          "fees",
          amount,
          `Fees earned but unbilled at December 31, ${money(amount)}. This work has not yet been recorded.`,
          "Work is complete, so revenue belongs in this year. The customer owes payment: increase Accounts Receivable with a debit and Fees Earned with a credit. Unbilled literally means no invoice has been sent; this problem also tells you the work is unrecorded.",
          `Add ${money(amount)} of missing revenue; it does not replace the existing Fees Earned balance.`,
        )
      : adjustment(
          "utilities",
          "accountsPayable",
          "utilitiesExpense",
          "accountsPayable",
          amount,
          `Utilities used this year but not yet recorded or paid, ${money(amount)}. Record the amount owed in Accounts Payable.`,
          "The utility service has already been used. Expense increases with a debit. Accounts Payable increases with a credit because payment is still owed.",
          `Add the unrecorded ${money(amount)} to Utilities Expense and Accounts Payable.`,
        ),
  );
  const after = { ...before };
  for (const a of adjustments) {
    after[a.debit] += a.amount;
    after[a.credit] -= a.amount;
  }
  return {
    seed,
    before,
    after,
    adjustments,
    variant,
    company: pick(r, [
      "Juniper Editing",
      "Willow Design",
      "Cedar Consulting",
      "Maple Studio",
    ]),
    date: "December 31, 20Y1",
  };
}

export function wordingQuestion(seed, filter = "all") {
  const r = rng(seed),
    topic = filter === "all" ? pick(r, Object.keys(TOPICS)) : filter;
  const c = generateCase(seed + ":books"),
    a = c.adjustments.find(
      (a) => a.id === (topic === "depreciation" ? "equipment" : topic),
    );
  // Accrued revenue is available independently of the seven-entry case variant.
  const q = a
    ? { ...a }
    : adjustment(
        "revenue",
        "receivable",
        "receivable",
        "fees",
        num(r, 400, 2400),
        "",
        "Completed work creates revenue and an amount the customer owes. Debit Accounts Receivable and credit Fees Earned. Cash is collected later.",
        "",
      );
  const remaining =
    ["supplies", "insurance", "unearned"].includes(topic) && r() < 0.5;
  const end = Math.abs(c.before[q.target]) - q.amount;
  const figure = remaining ? end : q.amount;
  q.role = remaining ? "remaining" : "change";
  q.topic = topic;
  q.figure = figure;
  q.before = c.before;
  const variants = {
    supplies: remaining
      ? [
          `Supplies on hand at December 31, ${money(figure)}.`,
          `Supplies remaining at year-end total ${money(figure)}.`,
        ]
      : [
          `Supplies used during the year, ${money(figure)}.`,
          `A count shows that ${money(figure)} of supplies were consumed this year.`,
        ],
    insurance: remaining
      ? [
          `Unexpired insurance at December 31, ${money(figure)}.`,
          `Insurance coverage still available after year-end is valued at ${money(figure)}.`,
        ]
      : [
          `Insurance expired during the year, ${money(figure)}.`,
          `The portion of prepaid insurance used this year totals ${money(figure)}.`,
        ],
    unearned: remaining
      ? [
          `Rent still unearned at December 31, ${money(figure)}.`,
          `Of rent collected in advance, ${money(figure)} remains unearned at year-end.`,
        ]
      : [
          `Of rent received in advance, ${money(figure)} has now been earned.`,
          `Rental service provided this year used up ${money(figure)} of the advance payment.`,
        ],
    revenue: [
      `Fees earned but unbilled at December 31, ${money(figure)}. The work has not been recorded.`,
      `Services of ${money(figure)} were completed before year-end but are not yet recorded or billed.`,
    ],
    wages: [
      `Accrued salaries and wages at December 31, ${money(figure)}; not yet recorded.`,
      `Employees earned ${money(figure)} in unpaid wages by year-end. These wages have not been recorded.`,
    ],
    depreciation: [
      `Depreciation of equipment for the year, ${money(figure)}.`,
      `Allocate ${money(figure)} of equipment cost to this year's depreciation expense.`,
    ],
  };
  q.clue = pick(r, variants[topic]);
  if (!remaining && topic === "supplies")
    q.why =
      "The supplies consumed in operations have provided their benefit this period. Debit Supplies Expense to recognize that cost and credit Supplies to remove the used portion from the asset.";
  if (!remaining && topic === "insurance")
    q.why =
      "Expired coverage has already provided its benefit. Debit Insurance Expense to increase this period's cost and credit Prepaid Insurance to reduce the future benefit still recorded as an asset.";
  if (!remaining && topic === "unearned")
    q.why =
      "This company is the landlord. It has now provided the rental service covered by part of the advance payment. Debit Unearned Rent to reduce the obligation and credit Rent Revenue for the portion earned. No new cash or receivable is involved.";
  q.calculation = remaining
    ? `${money(Math.abs(c.before[q.target]))} recorded − ${money(figure)} remaining = ${money(q.amount)} to record.`
    : `${money(figure)} is the period's unrecorded change. Record that amount; do not subtract it from the existing balance to find the adjustment.`;
  q.hint = remaining
    ? "This number describes what remains AFTER adjusting. What portion of the recorded balance is no longer an asset or an obligation?"
    : "This number describes something that happened during the period. It is the missing change, not a replacement for the account balance.";
  return q;
}

export function checkJournal(expected, draft) {
  if (
    !draft.debit ||
    !draft.credit ||
    parseAmount(draft.amount) === null ||
    parseAmount(draft.amount) <= 0
  )
    return {
      ok: false,
      incomplete: true,
      text: "Choose both accounts and enter a positive dollar amount.",
    };
  if (draft.debit === "cash" || draft.credit === "cash")
    return {
      ok: false,
      text: "No cash moves in this adjustment. Cash was exchanged earlier or will be exchanged later. Which asset, liability, revenue, or expense changed now?",
    };
  if (draft.debit === expected.credit && draft.credit === expected.debit)
    return {
      ok: false,
      text: "You have the right accounts, but their sides are reversed. Assets and expenses increase with debits; liabilities and revenues increase with credits. A contra asset increases with a credit.",
    };
  if (
    expected.credit.startsWith("dep") &&
    ["equipment", "building"].includes(draft.credit)
  )
    return {
      ok: false,
      text: "Keep the asset's recorded cost in its original account. The credit belongs in Accumulated Depreciation, the contra asset that reduces book value.",
    };
  if (expected.id === "unearned" && draft.credit === "receivable")
    return {
      ok: false,
      text: "The tenant already paid. Earning that advance reduces your obligation and increases Rent Revenue; it does not create another amount to collect.",
    };
  if (draft.debit !== expected.debit || draft.credit !== expected.credit)
    return {
      ok: false,
      text:
        "Recheck the two accounts. Ask what has been used or earned, and what asset or obligation changes with it. " +
        expected.why,
    };
  if (parseAmount(draft.amount) !== expected.amount)
    return {
      ok: false,
      text:
        "Your accounts and sides are right. Recheck the amount: " +
        expected.calculation,
    };
  return { ok: true, text: expected.why };
}
export function rowExplanation(c, id) {
  const a = c.adjustments.find((a) => a.debit === id || a.credit === id);
  if (!a)
    return id === "retained"
      ? "No adjustment directly changes Retained Earnings in this case. Before closing, revenue and expense accounts still hold this year's income. Retained Earnings stays at its opening balance in the adjusted trial balance."
      : "No adjusting entry affects this account. Carry its unadjusted balance to the same side.";
  const change = a.debit === id ? a.amount : -a.amount;
  return (
    `${balanceText(c.before[id])} before; ${money(a.amount)} ${change > 0 ? "debit" : "credit"} adjustment; ${balanceText(c.after[id])} after. ` +
    (c.before[id] >= 0 && change < 0 && c.after[id] > 0
      ? "The credit reduces the debit balance. It does not turn the remaining balance into a credit. "
      : "") +
    (id.startsWith("dep") && ACCOUNTS[id][1] === "contra asset"
      ? "Two credits add together: the contra asset's credit balance increases. "
      : "") +
    a.why
  );
}

// Every distractor has its own explanation. Topic order cycles through a shuffled
// deck; a new deck and new amounts are generated after each complete pass.
export const CONCEPT_TOPICS = [
  "wording",
  "unbilled",
  "depreciation",
  "wages",
  "rent",
  "sides",
  "omissions",
  "balanced",
  "retained",
  "supplies",
  "timing",
  "insurance",
  "payday",
  "bookValue",
  "equation",
  "automation",
];
export function conceptQuestion(seed, round) {
  const r = rng(`${seed}:concept:${round}`),
    n = num(r, 100, 800),
    delta = num(r, 100, 600),
    b = n + (delta === n ? delta + 5 : delta),
    expense = num(r, 20, 80);
  const topic = shuffle(
    CONCEPT_TOPICS,
    rng(`${seed}:deck:${Math.floor(round / CONCEPT_TOPICS.length)}`),
  )[round % CONCEPT_TOPICS.length];
  const yes = (text, why) => ({ text, why, correct: true });
  const no = (text, why) => ({ text, why, correct: false });
  const bank = {
    wording: [
      "Same account. Different instruction.",
      `Prepaid Insurance has a ${money(b)} debit balance. “Unexpired insurance at year-end, ${money(n)}.” How much becomes expense?`,
      [
        yes(
          money(b - n),
          `Unexpired means the asset left. ${money(b)} − ${money(n)} = ${money(b - n)} of coverage used.`,
        ),
        no(
          money(n),
          "That is the remaining future benefit, not the coverage used up.",
        ),
        no(
          money(b),
          "Some coverage still benefits the future, so the entire prepaid balance has not expired.",
        ),
        no(
          money(b + n),
          "The ending asset is part of the recorded balance, not an additional cost.",
        ),
      ],
    ],
    unbilled: [
      "Read the whole situation",
      "Does “unbilled” always mean revenue has not been recorded?",
      [
        yes(
          "No. It means no invoice has been sent; check whether the work is recorded.",
          "Billing and recording are different actions. In an adjusting-entry question, earned-but-unbilled work is often also described or assumed to be unrecorded. Record it only if it is missing.",
        ),
        no(
          "Yes. Unbilled and unrecorded always mean the same thing.",
          "A business can accrue revenue before issuing an invoice. Do not turn a common textbook assumption into a universal definition.",
        ),
        no(
          "Without the word unbilled, every number is an ending balance.",
          "The full phrase decides: “fees earned during the period” describes activity, while “remaining unearned” describes a balance.",
        ),
        no(
          "Unbilled means the customer already paid.",
          "Unbilled describes the invoice, not whether cash has been received.",
        ),
      ],
    ],
    depreciation: [
      "Cost stays; book value changes",
      `Record ${money(n)} of equipment depreciation. Which credit is correct?`,
      [
        yes(
          "Accumulated Depreciation—Equipment",
          "Accumulated Depreciation is a contra asset. Its credit balance increases, reducing net book value while Equipment keeps its recorded cost.",
        ),
        no(
          "Equipment",
          "In this adjustment, accumulated depreciation tracks cost allocated so far. Do not reduce the Equipment cost account.",
        ),
        no(
          "Cash",
          "Depreciation does not represent a current cash payment or money set aside.",
        ),
        no(
          "Depreciation Expense—Equipment",
          "The expense increases with a debit. The corresponding credit goes to the contra asset.",
        ),
      ],
    ],
    wages: [
      "Whose past? Whose future?",
      `Employees have earned ${money(n)} that will be paid next month. It is not yet recorded. What happens now?`,
      [
        yes(
          "Expense increases; a liability increases.",
          "The work is in the past, payment is in the future, and the obligation exists now. Debit wages expense; credit wages payable.",
        ),
        no(
          "Expense decreases; a liability increases.",
          "Unpaid does not mean unused. The company has incurred more labor cost, so expense increases.",
        ),
        no(
          "Wait until payday to recognize the expense.",
          "Accrual accounting recognizes the cost when employees do the work, even if cash moves later.",
        ),
        no(
          "An asset increases; revenue increases.",
          "Those are the effects of earning unrecorded fees from customers. Here the company received employees' labor.",
        ),
      ],
    ],
    rent: [
      "The landlord's books",
      `Unearned Rent has a ${money(b)} credit balance. Rent still unearned at year-end is ${money(n)}. What entry is needed?`,
      [
        yes(
          `Debit Unearned Rent; credit Rent Revenue, ${money(b - n)}.`,
          `${money(n)} remains owed as rental service. The earned portion is ${money(b)} − ${money(n)} = ${money(b - n)}.`,
        ),
        no(
          `Debit Unearned Rent; credit Rent Revenue, ${money(n)}.`,
          "You used the liability that must remain instead of the portion that has been earned.",
        ),
        no(
          `Debit Rent Expense; credit Prepaid Rent, ${money(b - n)}.`,
          "That would fit a tenant using prepaid rent. This company is the landlord that received an advance.",
        ),
        no(
          `Debit Unearned Rent; credit Accounts Receivable, ${money(b - n)}.`,
          "Cash was already collected. Recognizing earned rent creates revenue, not a receivable adjustment.",
        ),
      ],
    ],
    sides: [
      "Entry side ≠ ending balance side",
      `Supplies has a ${money(b)} debit balance. You credit Supplies ${money(n)}. What is its new balance?`,
      [
        yes(
          `${money(b - n)} debit`,
          "The credit removes part of the debit balance. Because the debit was larger, the remainder is still a debit.",
        ),
        no(
          `${money(b - n)} credit`,
          "An account does not become a credit balance merely because the last entry was a credit.",
        ),
        no(
          `${money(b + n)} debit`,
          "Opposite sides offset each other. Subtract the credit from the debit.",
        ),
        no(
          `${money(n)} credit`,
          "The adjustment is only the change. Combine it with the existing balance.",
        ),
      ],
    ],
    omissions: [
      "Two missing entries",
      `Unrecorded earned fees are ${money(n)}. Unrecorded wages expense is ${money(expense)}. If both adjustments are omitted, how is net income misstated?`,
      [
        yes(
          `Understated by ${money(n - expense)}.`,
          `Missing revenue lowers income by ${money(n)}, while missing expense raises it by ${money(expense)}. Net effect: income is too low by ${money(n - expense)}.`,
        ),
        no(
          `Understated by ${money(n + expense)}.`,
          "The errors push net income in opposite directions. Subtract their effects instead of adding them.",
        ),
        no(
          `Overstated by ${money(n - expense)}.`,
          "The larger omitted amount is revenue, so the net result is too little income.",
        ),
        no(
          "Correct, because two errors cancel.",
          "They cancel only if their income effects are equal and opposite. These amounts differ.",
        ),
      ],
    ],
    balanced: [
      "A useful check, not a guarantee",
      "An adjusted trial balance has equal debit and credit totals. Must every adjustment be correct?",
      [
        yes(
          "No. A whole missing entry or a balanced wrong entry can still leave equal totals.",
          "Equality checks arithmetic and debit/credit balance. It does not prove completeness, correct accounts, correct amounts, or correct timing.",
        ),
        no(
          "Yes. Equal totals prove the books are correct.",
          "Omitting both sides of depreciation leaves totals equal but expense and accumulated depreciation wrong.",
        ),
        no(
          "Only if total debits are larger than before.",
          "The direction or size of the totals does not establish whether the entries reflect the events correctly.",
        ),
        no(
          "Yes, if every account has its normal balance.",
          "A missing accrued expense can leave every account on its normal side while understating both expense and liabilities.",
        ),
      ],
    ],
    retained: [
      "Adjusting comes before closing",
      "After recording this year's adjusting entries, what belongs in Retained Earnings on the adjusted trial balance? Assume no entry directly affected it this year.",
      [
        yes(
          "The opening Retained Earnings balance.",
          "Before closing, this year's revenues, expenses, and dividends are still in their own accounts. The retained earnings statement calculates ending retained earnings; closing entries later update the ledger.",
        ),
        no(
          "Opening balance plus net income minus dividends.",
          "That calculates ending retained earnings for the financial statements. Do not post the closing effect into the adjusted trial balance early.",
        ),
        no(
          "Zero.",
          "Revenues and expenses are temporary accounts. Retained Earnings is a permanent account and carries its balance forward.",
        ),
        no(
          "This year's revenue total.",
          "Retained Earnings reflects accumulated retained profit, not gross revenue for one year.",
        ),
      ],
    ],
    supplies: [
      "Why does used mean expense?",
      `Supplies recorded: ${money(b)}. Supplies on hand: ${money(n)}. Assume the difference was consumed in operations. Why is ${money(b - n)} an expense?`,
      [
        yes(
          "That portion's benefit was used in this period.",
          "Unused supplies remain an asset for future work. Consumed supplies supported this period's operations, so their cost becomes this period's expense.",
        ),
        no(
          "Every decrease in an asset is an expense.",
          "Collecting a receivable also decreases an asset, but it increases Cash without creating an expense. The event matters.",
        ),
        no(
          "Because supplies were paid for this period.",
          "Payment timing does not tell you when supplies were consumed. The adjustment recognizes use, not payment.",
        ),
        no(
          "Because Supplies normally has a credit balance.",
          "Supplies is an asset with a normal debit balance. Crediting it removes the used portion.",
        ),
      ],
    ],
    timing: [
      "Separate the work from the money",
      "Which situation is an accrued revenue adjustment?",
      [
        yes(
          "Finish a customer's work now; record the amount still owed before billing later.",
          "Earn now, collect later: debit Accounts Receivable, credit revenue for the unrecorded work.",
        ),
        no(
          "Receive money before doing the customer's work.",
          "Cash first, earning later is a deferral. Initially it creates an unearned revenue liability.",
        ),
        no(
          "Use insurance purchased earlier.",
          "Cash first, use later is a prepaid expense adjustment, not accrued revenue.",
        ),
        no(
          "Record employee work that will be paid next month.",
          "That is an accrued expense: expense now, payment later.",
        ),
      ],
    ],
    insurance: [
      "One word changes the number's job",
      `Prepaid Insurance is ${money(b)}. “Insurance expired during the year, ${money(n)}.” How much is the adjustment?`,
      [
        yes(
          money(n),
          "Expired describes coverage used. The change is given directly: debit Insurance Expense and credit Prepaid Insurance for that amount.",
        ),
        no(
          money(b - n),
          "That is the asset remaining after this adjustment. The question gives expired coverage, not unexpired coverage.",
        ),
        no(
          money(b),
          "Not all the recorded coverage expired. Use the amount specified as expired.",
        ),
        no(
          money(b + n),
          "This adjustment reallocates existing prepaid cost; it does not purchase more insurance.",
        ),
      ],
    ],
    payday: [
      "Count workdays already earned",
      `A five-day Monday–Friday payroll is ${money(n * 5)}. The last payday covered all work through Friday. This year ends on the following Tuesday, after two more workdays. How much salary is accrued?`,
      [
        yes(
          money(n * 2),
          `Daily payroll is ${money(n * 5)} ÷ 5 = ${money(n)}. Monday and Tuesday belong to this year: 2 × ${money(n)} = ${money(n * 2)}.`,
        ),
        no(
          money(n * 5),
          "Only two of the five workdays have occurred by year-end. Accrue work already done.",
        ),
        no(
          money(n * 4),
          "Saturday and Sunday are not paid workdays in this question. Count Monday and Tuesday.",
        ),
        no(
          "$0",
          "The next payday is later, but two days of labor cost already belong to this year.",
        ),
      ],
    ],
    bookValue: [
      "A contra asset in context",
      `Equipment cost is ${money(b * 10)}. Accumulated Depreciation is ${money(n)} before this year's ${money(expense)} depreciation. What is the book value after adjusting?`,
      [
        yes(
          money(b * 10 - n - expense),
          "Book value = recorded cost − total accumulated depreciation. This year's depreciation adds to the contra asset's credit balance; it does not change the cost account.",
        ),
        no(
          money(b * 10 - expense),
          "This ignores depreciation accumulated in earlier periods. Subtract the full accumulated amount.",
        ),
        no(
          money(b * 10),
          "Recorded cost stays the same, but book value deducts accumulated depreciation.",
        ),
        no(
          money(b * 10 - n + expense),
          "New depreciation reduces book value. It increases, rather than reverses, accumulated depreciation.",
        ),
      ],
    ],
    equation: [
      "Follow both sides",
      `A ${money(n)} accrued wages adjustment is omitted. What are the effects?`,
      [
        yes(
          `Liabilities understated ${money(n)}; expense understated ${money(n)}; net income overstated ${money(n)}.`,
          "Missing wages payable means too little liability. Missing wages expense means too much profit (and too much ending equity once income is incorporated). Assets are unchanged.",
        ),
        no(
          "Assets and revenue are both understated.",
          "Those are the effects of omitting accrued revenue. Wages owed create a liability and an expense.",
        ),
        no(
          "Expense and net income are both understated.",
          "Less expense makes income higher, not lower, if revenue is unchanged.",
        ),
        no(
          "Liabilities overstated; net income understated.",
          "Omitting an increase leaves the liability too low. Omitting an expense leaves income too high.",
        ),
      ],
    ],
    automation: [
      "What the accountant decides",
      "Accounting software posts debits and credits and builds a trial balance. What still needs judgment?",
      [
        yes(
          "Whether work, costs, and obligations belong in this period and are completely recorded.",
          "Software can do the arithmetic and automate configured entries. People still assess the facts, timing, estimates, and completeness and review the results.",
        ),
        no(
          "Only whether the debit and credit totals match.",
          "Equal totals can hide omissions, wrong accounts, and wrong periods. Reviewing the underlying events matters.",
        ),
        no(
          "Nothing; any generated trial balance is correct.",
          "Software processes the data and rules it receives. Missing or misclassified inputs can produce balanced but incorrect reports.",
        ),
        no(
          "Every ledger balance must always be added manually.",
          "The manual exercise teaches how entries flow through accounts. Software commonly handles posting and calculations.",
        ),
      ],
    ],
  };
  const [title, prompt, options] = bank[topic];
  return { topic, title, prompt, options: shuffle(options, r) };
}
