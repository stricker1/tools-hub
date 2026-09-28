import {
  TOPICS,
  ACCOUNTS,
  money,
  rng,
  shuffle,
  generateMonth,
  ledger,
  totals,
  reasoningOptions,
  effectOptions,
  parseAmount,
  checkEntry,
  detective,
} from "./engine.mjs";
import { LESSONS } from "./lessons.mjs";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const KEY = "little-tools:chapter-3:v1";
const MODES = {
  learn: "Learn & practice",
  month: "Complete a month",
  detective: "Mistake detective",
  guide: "Field guide",
};
const STAGES = [
  "Transactions",
  "Ledger",
  "Unadjusted TB",
  "Adjustments",
  "Adjusted TB",
  "Statements",
];
const freshSeed = () => {
  const n = new Uint32Array(2);
  crypto.getRandomValues(n);
  return Array.from(n, (x) => x.toString(36)).join("-");
};
const fresh = () => ({
  version: 1,
  mode: "learn",
  filter: "mixed",
  seed: freshSeed(),
  round: 0,
  learnStep: 0,
  detectiveRound: 0,
  caseSeed: freshSeed(),
  caseStage: 0,
  transaction: 0,
  adjustment: 0,
  lesson: "start",
  tasks: {},
  stats: {},
});
let state = fresh();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    if (raw.length > 500000) throw Error();
    const s = JSON.parse(raw);
    if (
      s.version !== 1 ||
      !Object.hasOwn(MODES, s.mode) ||
      !["mixed", ...Object.keys(TOPICS)].includes(s.filter) ||
      typeof s.seed !== "string" ||
      typeof s.caseSeed !== "string" ||
      ![
        s.round,
        s.learnStep,
        s.detectiveRound,
        s.caseStage,
        s.transaction,
        s.adjustment,
      ].every(Number.isInteger) ||
      s.round < 0 ||
      s.detectiveRound < 0 ||
      s.learnStep < 0 ||
      s.learnStep > 3 ||
      s.caseStage < 0 ||
      s.caseStage > 5 ||
      s.transaction < 0 ||
      s.transaction > 7 ||
      s.adjustment < 0 ||
      s.adjustment > 5 ||
      !LESSONS.some((l) => l.id === s.lesson) ||
      !s.tasks ||
      typeof s.tasks !== "object" ||
      Array.isArray(s.tasks) ||
      !s.stats ||
      typeof s.stats !== "object" ||
      Array.isArray(s.stats)
    )
      throw Error();
    for (const t of Object.values(s.tasks)) {
      if (
        !t ||
        typeof t !== "object" ||
        !t.work ||
        typeof t.work !== "object" ||
        typeof t.attempts !== "number" ||
        !["done", "revealed", "hinted", "recorded"].every(
          (k) => typeof t[k] === "boolean",
        ) ||
        (t.feedback && typeof t.feedback.text !== "string")
      )
        throw Error();
    }
    for (const t of Object.values(s.stats)) {
      if (
        !t ||
        !["first", "completed", "revealed", "hinted"].every(
          (k) => Number.isSafeInteger(t[k]) && t[k] >= 0,
        )
      )
        throw Error();
    }
    state = s;
  }
} catch {
  notice(
    "Saved progress was unavailable or could not be restored. A fresh exercise is ready.",
  );
}
function notice(text) {
  $("#storage-notice").hidden = false;
  $("#storage-notice").textContent = text;
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    notice(
      "This browser could not save progress. You can keep working in this tab.",
    );
  }
}
const task = (k) =>
  (state.tasks[k] ??= {
    work: {},
    choice: null,
    attempts: 0,
    done: false,
    revealed: false,
    hinted: false,
    recorded: false,
    feedback: null,
  });
let active = null;
function record(t, topic) {
  if (t.recorded) return;
  const s = (state.stats[topic] ??= {
    first: 0,
    completed: 0,
    revealed: 0,
    hinted: 0,
  });
  s.completed++;
  if (t.revealed) s.revealed++;
  else if (t.attempts === 1 && !t.hinted) s.first++;
  if (t.hinted) s.hinted++;
  t.recorded = true;
}
function learnContext() {
  const seed = state.seed + ":learn:" + state.round;
  const m = generateMonth(seed);
  const order = shuffle(Object.keys(TOPICS), rng(state.seed + ":order"));
  const topic =
    state.filter === "mixed" ? order[state.round % order.length] : state.filter;
  return { m, a: m.adjustments.find((a) => a.topic === topic), seed };
}
const entryHTML = (lines) =>
  `<div class="mini-entry">${lines.map((l) => `<div><span>${l.amount > 0 ? "Dr" : "Cr"} ${esc(ACCOUNTS[l.account][0])}</span><span>${money(Math.abs(l.amount))}</span></div>`).join("")}</div>`;
const optionsHTML = (options, t) =>
  `<div class="choices">${options.map((o, i) => `<button class="choice ${t.done && o.correct ? "correct" : ""} ${t.choice === i && !o.correct ? "incorrect" : ""}" data-action="choose" data-index="${i}" ${t.done ? "disabled" : ""}><span class="letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${esc(o.text)}${t.done && o.correct ? " ✓" : ""}</span></button>`).join("")}</div>`;
const optionsAccounts = (selected) =>
  `<option value="">Choose an account</option>${Object.entries(ACCOUNTS)
    .map(
      ([id, [name]]) =>
        `<option value="${id}" ${selected === id ? "selected" : ""}>${esc(name)}</option>`,
    )
    .join("")}`;
function entryBuilder(t) {
  return `<div class="entry-builder"><label>Debit account<select data-field="debit" ${t.done ? "disabled" : ""}>${optionsAccounts(t.work.debit)}</select></label><label class="amount">Debit amount<input data-field="debitAmount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(t.work.debitAmount)}" ${t.done ? "disabled" : ""}></label><label>Credit account<select data-field="credit" ${t.done ? "disabled" : ""}>${optionsAccounts(t.work.credit)}</select></label><label class="amount">Credit amount<input data-field="creditAmount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(t.work.creditAmount)}" ${t.done ? "disabled" : ""}></label></div>`;
}
const feedbackHTML = (t) =>
  t.feedback
    ? `<div class="feedback ${t.feedback.ok ? "" : "wrong"}" role="status"><strong>${t.revealed ? "Worked answer" : t.feedback.ok ? "That’s it." : "Let’s look at the reasoning."}</strong><p>${esc(t.feedback.text)}</p></div>`
    : "";
function controls(
  t,
  { check = true, next = "", nextLabel = "Continue →" } = {},
) {
  return `${t.hinted && !t.done ? `<div class="hint"><strong>Hint:</strong> ${esc(active.hint)}</div>` : ""}${feedbackHTML(t)}<div class="actions">${!t.done ? `${check ? '<button class="primary" data-action="check">Check answer</button>' : ""}<button data-action="hint">Hint</button><button class="text-button push" data-action="reveal">Show worked answer</button>` : next ? `<button class="primary" data-action="${next}">${nextLabel}</button>` : ""}</div>`;
}
function notebook(a, m, show = false) {
  const before = m.unadjusted;
  return `<aside class="notebook"><p class="eyebrow">The story behind the numbers</p><h3>${esc(TOPICS[a.topic])}</h3><p>${esc(a.timing)}</p><hr><span class="small-label">BEFORE THE ADJUSTMENT</span>${[a.debit, a.credit].map((id) => `<div class="balance-row"><span>${esc(ACCOUNTS[id][0])}</span><b>${money(Math.abs(before[id]))}${before[id] ? " " + (before[id] > 0 ? "Dr" : "Cr") : ""}</b></div>`).join("")}${
    show
      ? `<hr><span class="small-label">THE ENTRY</span>${entryHTML(a.lines)}<hr><span class="small-label">AFTER THIS ADJUSTMENT</span>${[
          a.debit,
          a.credit,
        ]
          .map((id) => {
            const v = before[id] + a.lines.find((l) => l.account === id).amount;
            return `<div class="balance-row"><span>${esc(ACCOUNTS[id][0])}</span><b>${money(Math.abs(v))}${v ? " " + (v > 0 ? "Dr" : "Cr") : ""}</b></div>`;
          })
          .join("")}<p class="small">${esc(a.effect)}</p>`
      : `<p class="muted small">After you complete this exercise, compare the entry with the balances here.</p>`
  }<details><summary class="small">Debit / credit reminder</summary><p class="small">Assets and expenses increase with debits. Liabilities, equity, and revenue increase with credits. Accumulated Depreciation is a contra asset that increases with a credit.</p></details></aside>`;
}
const topicFilter = () =>
  `<label class="field">Focus<select id="topic-filter"><option value="mixed">Mix all six adjustments</option>${Object.entries(
    TOPICS,
  )
    .map(
      ([id, name]) =>
        `<option value="${id}" ${state.filter === id ? "selected" : ""}>${name}</option>`,
    )
    .join("")}</select></label>`;
function renderLearn() {
  const { m, a, seed } = learnContext(),
    key = `learn:${state.round}:${state.filter}:${state.learnStep}`,
    t = task(key),
    step = state.learnStep;
  active = {
    key,
    topic: a.topic,
    type: step === 1 ? "amount" : step === 2 ? "entry" : "choice",
    a,
    hint:
      step === 1
        ? "Find the amount used, earned, or incurred during this period. " +
          a.calculation
        : step === 2
          ? "Decide which account increased or decreased before choosing debit and credit. " +
            a.timing
          : a.timing,
  };
  if (step === 0) active.options = reasoningOptions(a, seed + "meaning");
  if (step === 3) active.options = effectOptions(a, seed + "effect");
  const questions = [
    "What actually happened?",
    "How much belongs to this month?",
    "Build the adjusting entry.",
    "What changes in the statements?",
  ];
  const content =
    step === 0 || step === 3
      ? optionsHTML(active.options, t)
      : step === 1
        ? `<label class="field number-answer">Adjustment amount ($)<input data-field="amount" inputmode="decimal" placeholder="Enter dollars" value="${esc(t.work.amount)}" ${t.done ? "disabled" : ""}></label>`
        : entryBuilder(t);
  return `<div class="toolbar">${topicFilter()}<span class="spacer"></span><button data-action="skip-guidance">Go straight to entry</button><button data-action="new-learn">New scenario ↻</button></div><div class="layout"><section class="panel"><div class="question-top"><span class="tag">${esc(TOPICS[a.topic])}</span><span class="muted small">${esc(m.company)} · ${m.month} 30</span></div><p class="scenario">${esc(a.text)}</p><div class="step-dots">${["Understand", "Calculate", "Record", "Connect"].map((s, i) => `<span class="${i === step ? "active" : ""}">${i + 1}. ${s}</span>`).join("")}</div><h2 id="task-heading" tabindex="-1">${questions[step]}</h2>${content}${controls(t, { check: step === 1 || step === 2, next: step === 3 ? "new-learn" : "learn-next", nextLabel: step === 3 ? "Try another scenario →" : "Continue →" })}${t.done && step === 3 ? `<div class="completion"><strong>You connected the whole adjustment.</strong><p>${esc(a.calculation)} ${esc(a.why)}</p></div>` : ""}</section>${notebook(a, m, t.done && step >= 2)}</div>`;
}
function renderDetective() {
  const q = detective(
      state.seed + ":detective:" + state.detectiveRound,
      state.filter,
    ),
    key = `detective:${state.detectiveRound}:${state.filter}`,
    t = task(key);
  active = {
    key,
    topic: q.topic,
    type: "choice",
    options: q.options,
    hint: "Start with what should have been recorded. Revenue increases net income; expenses decrease it. Cash timing alone does not determine profit.",
  };
  return `<div class="toolbar">${topicFilter()}<span class="spacer"></span><button data-action="new-detective">New question ↻</button></div><div class="layout"><section class="panel"><p class="eyebrow">Mistake detective</p><h2 id="task-heading" tabindex="-1">${esc(q.title)}</h2><p class="scenario">${esc(q.prompt)}</p>${optionsHTML(q.options, t)}${controls(t, { check: false, next: "new-detective", nextLabel: "Next case →" })}</section><aside class="notebook"><p class="eyebrow">Think before you calculate</p><h3>Which number tells the wrong story?</h3><p>Overstated = too high.<br>Understated = too low.</p><hr><p>Net income = revenue − expenses.</p><p>A missing expense makes profit too high. A missing revenue makes profit too low.</p><details><summary>Why a trial balance can still balance</summary><p>Omitting both sides of an entry leaves equal debits and credits missing. Equality does not prove completeness.</p></details><p class="small muted">Mix all topics for questions on accrual timing, book value, later payments, and vertical analysis, too.</p></aside></div>`;
}
function taskDone(key) {
  return !!state.tasks[key]?.done;
}
function stageDone(stage) {
  if (stage === 0)
    return Array.from({ length: 8 }, (_, i) =>
      taskDone(`case:transaction:${i}`),
    ).every(Boolean);
  if (stage === 3)
    return Array.from({ length: 6 }, (_, i) =>
      taskDone(`case:adjustment:${i}`),
    ).every(Boolean);
  return taskDone(`case:stage:${stage}`);
}
function transactionOptions(tr, seed) {
  const [d, c] = tr.lines,
    correct = {
      text: `Debit ${ACCOUNTS[d.account][0]}; credit ${ACCOUNTS[c.account][0]}`,
      correct: true,
      why: tr.why,
    };
  let wrong = [
    {
      text: `Debit ${ACCOUNTS[c.account][0]}; credit ${ACCOUNTS[d.account][0]}`,
      correct: false,
      why: "The sides are reversed. " + tr.why,
    },
  ];
  const candidates = [
    ["cash", "fees"],
    ["wagesExpense", "cash"],
    ["cash", "stock"],
    ["insurance", "cash"],
    ["cash", "unearned"],
    ["suppliesExpense", "cash"],
  ];
  for (const [dr, cr] of shuffle(candidates, rng(seed))) {
    const text = `Debit ${ACCOUNTS[dr][0]}; credit ${ACCOUNTS[cr][0]}`;
    if (text !== correct.text && !wrong.some((w) => w.text === text))
      wrong.push({ text, correct: false, why: tr.why });
    if (wrong.length === 3) break;
  }
  return shuffle([correct, ...wrong], rng(seed + "options"));
}
function monthReference(m) {
  return `<aside class="notebook"><p class="eyebrow">One business. One set of books.</p><h3>${m.company}</h3><p>${m.month} 1–30 · first month</p><p class="small">No beginning balances, no dividends. Use accrual accounting. Dollar amounts are exact; depreciation assumes a full month.</p><hr><h3>Original transactions</h3>${m.transactions.map((e, i) => `<details><summary class="small">${m.month} ${e.date} · ${["Owner investment", "Insurance payment", "Supplies purchase", "Equipment purchase", "Customer advance", "Completed services", "Wages paid", "Rent paid"][i]}</summary><p class="small">${esc(e.text)}</p>${taskDone(`case:transaction:${i}`) ? entryHTML(e.lines) : ""}</details>`).join("")}<hr><p class="small">Switch steps to explore. Each step keeps your work, and solved transactions show their entries here.</p></aside>`;
}
function tableExercise(m, adjusted, t) {
  const b = adjusted ? m.adjusted : m.unadjusted,
    keys = Object.keys(ACCOUNTS).filter((a) => b[a] !== 0),
    candidates = adjusted
      ? [
          "receivable",
          "supplies",
          "insurance",
          "payable",
          "unearned",
          "fees",
          "wagesExpense",
          "depreciation",
        ]
      : ["cash", "supplies", "insurance", "fees"];
  const blanks = shuffle(candidates, rng(m.seed + ":tb:" + adjusted)).slice(
    0,
    adjusted ? 5 : 3,
  );
  active = {
    ...active,
    type: "table",
    expected: Object.fromEntries(blanks.map((a) => [a, Math.abs(b[a])])),
    hint: "Use the ending ledger balance, not just the transaction or adjustment amount. Debits and credits are already placed on the correct side.",
    explanation: adjusted
      ? "These are balances after posting every adjustment. Cash is unchanged by the adjustments. Accumulated Depreciation is a credit; equipment stays at cost."
      : "The unadjusted trial balance uses the balances after ordinary transactions and before the month-end adjustments.",
  };
  return `<p>Fill the ${blanks.length} missing ending balances. The debit or credit side is provided.</p><div class="table-wrap"><table><thead><tr><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>${keys
    .map((id) => {
      const amount = Math.abs(b[id]),
        blank = blanks.includes(id);
      const cell = blank
        ? `<input aria-label="${esc(ACCOUNTS[id][0])} ${b[id] > 0 ? "debit" : "credit"} balance" data-field="${id}" inputmode="decimal" value="${esc(t.work[id])}" ${t.done ? "disabled" : ""}>`
        : money(amount);
      const checked = t.feedback && blank,
        correct = parseAmount(t.work[id]) === amount;
      return `<tr class="${checked ? (correct ? "row-good" : "row-bad") : ""}"><td>${esc(ACCOUNTS[id][0])}</td><td class="num">${b[id] > 0 ? cell : "—"}</td><td class="num">${b[id] < 0 ? cell : "—"}</td></tr>`;
    })
    .join(
      "",
    )}${t.done ? `<tr class="total"><td>Totals</td><td class="num">${money(totals(b).debit)}</td><td class="num">${money(totals(b).credit)}</td></tr>` : ""}</tbody></table></div>${adjusted ? `<details><summary>Trace each adjustment</summary>${m.adjustments.map((a) => `<p class="small"><strong>${TOPICS[a.topic]}:</strong> ${esc(a.calculation)}</p>${entryHTML(a.lines)}`).join("")}</details>` : ""}`;
}
function statementExercise(m, t) {
  const labels = {
    revenue: "Total revenue",
    expenses: "Total expenses",
    net: "Net income / loss",
    assets: "Total assets, net",
    liabilities: "Total liabilities",
    equity: "Total stockholders’ equity",
  };
  active = {
    ...active,
    type: "table",
    expected: Object.fromEntries(
      Object.keys(labels).map((k) => [k, m.results[k]]),
    ),
    hint: "Use the adjusted balances. Revenue − expenses = net income. Deduct accumulated depreciation from assets. Equity = common stock + ending retained earnings.",
    explanation: `Revenue ${money(m.results.revenue)} − expenses ${money(m.results.expenses)} = net income ${money(m.results.net)}. With no beginning retained earnings or dividends, ending retained earnings is ${money(m.results.net)}. Net assets ${money(m.results.assets)} = liabilities ${money(m.results.liabilities)} + equity ${money(m.results.equity)}.`,
  };
  return `<p>Finish the month using the adjusted balances. Enter a negative amount if there is a net loss.</p><div class="results-grid">${Object.entries(
    labels,
  )
    .map(
      ([k, label]) =>
        `<label class="field">${label}<input data-field="${k}" aria-label="${label}" inputmode="decimal" value="${esc(t.work[k])}" ${t.done ? "disabled" : ""}></label>`,
    )
    .join(
      "",
    )}</div><details><summary>View adjusted account balances</summary>${balanceTable(m.adjusted)}</details>${t.done ? `<div class="completion"><strong>The books tell a complete story.</strong><p>${esc(active.explanation)}</p><p class="small">The adjusted trial balance is before closing: revenue and expenses remain separate there. The statements use net income to compute ending retained earnings.</p></div>` : ""}`;
}
function balanceTable(b) {
  return `<div class="table-wrap"><table><thead><tr><th>Account</th><th class="num">Balance</th></tr></thead><tbody>${Object.entries(
    b,
  )
    .filter(([, n]) => n)
    .map(
      ([id, n]) =>
        `<tr><td>${ACCOUNTS[id][0]}</td><td class="num">${money(Math.abs(n))} ${n > 0 ? "Dr" : "Cr"}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}
function itemNav(count, selected, label) {
  return `<nav class="item-nav" aria-label="${label}">${Array.from({ length: count }, (_, i) => `<button data-action="case-item" data-index="${i}" aria-label="${label} ${i + 1}" ${i === selected ? 'aria-current="step"' : ""}>${i + 1}</button>`).join("")}</nav>`;
}
function renderMonth() {
  const m = generateMonth(state.caseSeed),
    stage = state.caseStage,
    key =
      stage === 0
        ? `case:transaction:${state.transaction}`
        : stage === 3
          ? `case:adjustment:${state.adjustment}`
          : `case:stage:${stage}`,
    t = task(key);
  active = { key, topic: "cycle", type: "amount" };
  let title,
    body,
    next = "case-next",
    nextLabel = "Next step →",
    aside = monthReference(m),
    check = true;
  if (stage === 0) {
    const tr = m.transactions[state.transaction];
    title = "Record the original transaction.";
    active = {
      ...active,
      type: "choice",
      options: transactionOptions(tr, m.seed + state.transaction),
      hint: "First decide whether this is an asset, liability, equity, revenue, or expense. Then decide which accounts increased or decreased.",
    };
    body = `${itemNav(8, state.transaction, "Transaction")}<p class="eyebrow">Transaction ${state.transaction + 1} of ${m.transactions.length} · ${m.month} ${tr.date}</p><p class="scenario">${esc(tr.text)}</p>${optionsHTML(active.options, t)}${t.done ? entryHTML(tr.lines) : ""}<p class="small muted">Both sides use ${money(tr.lines[0].amount)}. Selecting an answer records the entry for this learning case.</p>`;
    check = false;
    next = "transaction-next";
    nextLabel =
      state.transaction === 7 ? "See the ledger →" : "Next transaction →";
  }
  if (stage === 1) {
    title = "Post the entries. Find the balance.";
    active = {
      ...active,
      expected: { amount: m.unadjusted.cash },
      hint: "Add cash received from the owner, the advance, and completed work. Subtract insurance, supplies, equipment, wages, and rent payments.",
      explanation:
        "Posting transfers journal amounts into individual accounts. For Cash, total debits minus total credits gives the ending debit balance.",
    };
    body = `<p>Expand an account to inspect its postings. What is the ending Cash balance before adjustments?</p><label class="field number-answer">Cash debit balance ($)<input data-field="amount" inputmode="decimal" value="${esc(t.work.amount)}" ${t.done ? "disabled" : ""}></label><div class="ledger-list">${Object.entries(
      ACCOUNTS,
    )
      .filter(([id]) =>
        m.transactions.some((e) => e.lines.some((l) => l.account === id)),
      )
      .map(
        ([id, [name]]) =>
          `<details><summary>${name}</summary>${m.transactions.flatMap((e) => e.lines.filter((l) => l.account === id).map((l) => `<p>${m.month} ${e.date}: ${l.amount > 0 ? "Dr" : "Cr"} ${money(Math.abs(l.amount))}</p>`)).join("")}${id !== "cash" || t.done ? `<p><strong>Balance: ${money(Math.abs(m.unadjusted[id]))} ${m.unadjusted[id] > 0 ? "Dr" : "Cr"}</strong></p>` : ""}</details>`,
      )
      .join("")}</div>`;
  }
  if (stage === 2) {
    title = "Build the unadjusted trial balance.";
    body = tableExercise(m, false, t);
  }
  if (stage === 3) {
    const a = m.adjustments[state.adjustment];
    title = "Bring the books up to date.";
    active = {
      ...active,
      type: "entry",
      a,
      topic: a.topic,
      hint: a.timing + " " + a.calculation,
    };
    body = `${itemNav(6, state.adjustment, "Adjustment")}<p class="eyebrow">Adjustment ${state.adjustment + 1} of 6 · ${TOPICS[a.topic]}</p><p class="scenario">${esc(a.text)}</p>${entryBuilder(t)}`;
    aside = notebook(
      a,
      {
        ...m,
        unadjusted: ledger([
          ...m.transactions,
          ...m.adjustments.slice(0, state.adjustment),
        ]),
      },
      t.done,
    );
    next = "adjustment-next";
    nextLabel =
      state.adjustment === 5
        ? "Build the adjusted trial balance →"
        : "Next adjustment →";
  }
  if (stage === 4) {
    title = "Now use the adjusted balances.";
    body = tableExercise(m, true, t);
  }
  if (stage === 5) {
    title = "Turn the balances into statements.";
    body = statementExercise(m, t);
    next = "new-month";
    nextLabel = "Start another month →";
  }
  return `<div class="case-heading"><div><p class="eyebrow">Complete a month</p><h2>${m.company}</h2><p class="case-meta">${m.month} · first month of business · ${Object.keys(ACCOUNTS).length} accounts</p></div><button data-action="new-month">New business ↻</button></div><nav class="cycle" aria-label="Accounting cycle">${STAGES.map((s, i) => `<button data-action="case-stage" data-index="${i}" ${stage === i ? 'aria-current="step"' : ""} class="${stageDone(i) ? "done" : ""}">${i + 1}. ${s}</button>`).join("")}</nav><div class="layout"><section class="panel"><h2 id="task-heading" tabindex="-1">${title}</h2>${body}${controls(t, { check, next, nextLabel })}</section>${aside}</div>`;
}
function renderGuide() {
  active = null;
  const l = LESSONS.find((l) => l.id === state.lesson);
  return `<div class="guide"><nav class="guide-nav" aria-label="Chapter topics">${LESSONS.map((x) => `<button data-action="lesson" data-lesson="${x.id}" ${l.id === x.id ? 'aria-current="page"' : ""}>${x.title}</button>`).join("")}</nav><article class="panel"><p class="eyebrow">The chapter, in plain language</p><h2 id="task-heading" tabindex="-1">${l.title}</h2>${l.html}<div class="actions"><button class="primary" data-action="practice-lesson">Try it in practice →</button></div></article></div>`;
}
function render(focus = false) {
  $("#modes").innerHTML = Object.entries(MODES)
    .map(
      ([k, name]) =>
        `<button data-mode="${k}" ${state.mode === k ? 'aria-current="page"' : ""}>${name}</button>`,
    )
    .join("");
  $("#workspace").innerHTML =
    state.mode === "learn"
      ? renderLearn()
      : state.mode === "month"
        ? renderMonth()
        : state.mode === "detective"
          ? renderDetective()
          : renderGuide();
  persist();
  if (focus) $("#task-heading")?.focus({ preventScroll: true });
}
function finish(t, ok, text, reveal = false) {
  t.feedback = { ok, text };
  if (ok) {
    t.done = true;
    t.revealed = reveal;
    record(t, active.topic);
  }
  render(true);
}
function check() {
  const t = task(active.key);
  if (t.done) return;
  let result;
  if (active.type === "entry") result = checkEntry(active.a, t.work);
  else if (active.type === "amount" && active.a) {
    const n = parseAmount(t.work.amount);
    result = {
      ok: n === active.a.amount,
      text:
        n === active.a.amount
          ? `${active.a.calculation} ${active.a.why}`
          : n === null
            ? "Enter a dollar amount first."
            : `Recheck what belongs to this period. ${active.a.calculation}`,
    };
  } else {
    const wrong = Object.entries(active.expected).filter(
      ([k, n]) => parseAmount(t.work[k]) !== n,
    );
    result = {
      ok: !wrong.length,
      text: wrong.length
        ? `Check ${wrong.map(([k]) => ACCOUNTS[k]?.[0] ?? ({ amount: "Cash", revenue: "total revenue", expenses: "total expenses", net: "net income", assets: "net assets", liabilities: "liabilities", equity: "equity" }[k] || k)).join(", ")}. ${active.hint}`
        : active.explanation,
    };
  }
  t.attempts++;
  finish(t, result.ok, result.text);
}
function reveal() {
  const t = task(active.key);
  if (t.done) return;
  let text;
  if (active.type === "choice") {
    const o = active.options.find((o) => o.correct);
    t.choice = active.options.indexOf(o);
    text = o.why;
  } else if (active.type === "entry") {
    const a = active.a;
    t.work = {
      debit: a.debit,
      credit: a.credit,
      debitAmount: String(a.amount),
      creditAmount: String(a.amount),
    };
    text = a.calculation + " " + a.why;
  } else if (active.type === "amount" && active.a) {
    t.work.amount = String(active.a.amount);
    text = active.a.calculation + " " + active.a.why;
  } else {
    for (const [k, v] of Object.entries(active.expected)) t.work[k] = String(v);
    text = active.explanation;
  }
  finish(t, true, text, true);
}
function prune(prefix) {
  for (const key of Object.keys(state.tasks))
    if (key.startsWith(prefix)) delete state.tasks[key];
}
function progress() {
  const rows = Object.entries(state.stats);
  $("#progress-content").innerHTML = rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>Topic</th><th class="num">Completed</th><th class="num">Unaided first try</th><th class="num">Revealed</th></tr></thead><tbody>${rows.map(([k, s]) => `<tr><td>${esc(TOPICS[k] ?? ({ cycle: "Accounting cycle", balance: "Trial balance", cash: "Accrual timing", book: "Book value", settlement: "Later payment", vertical: "Vertical analysis" }[k] || k))}</td><td class="num">${s.completed}</td><td class="num">${s.first}</td><td class="num">${s.revealed}</td></tr>`).join("")}</tbody></table></div>`
    : "<p>Your completed questions will appear here. Start with one adjustment and follow the reasoning.</p>";
  $("#progress-dialog").showModal();
}
$("#modes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (!b) return;
  state.mode = b.dataset.mode;
  render(true);
});
$("#workspace").addEventListener("input", (e) => {
  const field = e.target.dataset.field;
  if (field && active) {
    task(active.key).work[field] = e.target.value;
    persist();
  }
});
$("#workspace").addEventListener("change", (e) => {
  if (e.target.id === "topic-filter") {
    state.filter = e.target.value;
    state.learnStep = 0;
    render(true);
  }
});
$("#workspace").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("input[data-field]")) {
    e.preventDefault();
    check();
  }
});
$("#workspace").addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "check") {
    check();
    return;
  }
  if (action === "reveal") {
    reveal();
    return;
  }
  if (action === "choose") {
    const t = task(active.key);
    if (t.done) return;
    const i = Number(b.dataset.index),
      o = active.options[i];
    t.choice = i;
    t.attempts++;
    finish(t, o.correct, o.why);
    return;
  }
  if (action === "hint") {
    task(active.key).hinted = true;
    render(true);
    return;
  }
  if (action === "learn-next")
    state.learnStep = Math.min(3, state.learnStep + 1);
  if (action === "skip-guidance") state.learnStep = 2;
  if (action === "new-learn") {
    state.round++;
    state.learnStep = 0;
    prune("learn:");
  }
  if (action === "new-detective") {
    state.detectiveRound++;
    prune("detective:");
  }
  if (action === "case-stage") state.caseStage = Number(b.dataset.index);
  if (action === "case-item") {
    if (state.caseStage === 0) state.transaction = Number(b.dataset.index);
    else if (state.caseStage === 3) state.adjustment = Number(b.dataset.index);
  }
  if (action === "case-next")
    state.caseStage = Math.min(5, state.caseStage + 1);
  if (action === "transaction-next") {
    if (state.transaction < 7) state.transaction++;
    else state.caseStage = 1;
  }
  if (action === "adjustment-next") {
    if (state.adjustment < 5) state.adjustment++;
    else state.caseStage = 4;
  }
  if (action === "new-month") {
    if (Object.keys(state.tasks).some((k) => k.startsWith("case:"))) {
      if (
        !confirm(
          "Start a new business? This replaces the current month’s work. Your practice statistics stay saved.",
        )
      )
        return;
    }
    state.caseSeed = freshSeed();
    state.caseStage = 0;
    state.transaction = 0;
    state.adjustment = 0;
    prune("case:");
  }
  if (action === "lesson") state.lesson = b.dataset.lesson;
  if (action === "practice-lesson") {
    const map = {
      supplies: "supplies",
      unearned: "unearned",
      accruals: "revenue",
      depreciation: "depreciation",
    };
    state.filter = map[state.lesson] ?? "mixed";
    state.mode =
      state.lesson === "errors" || state.lesson === "vertical"
        ? "detective"
        : state.lesson === "statements"
          ? "month"
          : "learn";
    state.learnStep = 0;
  }
  render(true);
});
$("#progress-button").addEventListener("click", progress);
$("#close-progress").addEventListener("click", () =>
  $("#progress-dialog").close(),
);
$("#reset-progress").addEventListener("click", () => {
  if (confirm("Reset practice statistics? Your current exercises will stay.")) {
    state.stats = {};
    persist();
    $("#progress-dialog").close();
    progress();
  }
});
render();
