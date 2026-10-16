import {
  ACCOUNTS,
  temporary,
  money,
  totals,
  generateCase,
  statements,
  closingEntries,
  checkJournal,
  balanceWhy,
  parseMoney,
  conceptQuestion,
  CONCEPTS,
  post,
} from "./engine.mjs";
import { STEPS, GUIDE } from "./lessons.mjs";
const KEY = "little-tools:chapter-4:v1";
const MODES = {
  learn: "The big picture",
  concepts: "Concept checks",
  journal: "Journal entries",
  statements: "Financial statements",
  cycle: "Full cycle",
};
const STAGES = [
  "Adjust",
  "Adjusted TB",
  "Statements",
  "Close",
  "Post-closing TB",
];
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const freshSeed = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const fresh = () => ({
  version: 1,
  seed: freshSeed(),
  mode: "learn",
  theme: "auto",
  method: "summary",
  journalKind: "adjusting",
  round: { concepts: 0, journal: 0, statements: 0, cycle: 0 },
  stage: 0,
  maxStage: 0,
  adjustment: 0,
  closing: 0,
  statement: 0,
  work: {},
  concepts: {},
  stats: { answered: 0, first: 0 },
});
let state = fresh(),
  notice = "";
function valid(s) {
  return (
    s &&
    s.version === 1 &&
    typeof s.seed === "string" &&
    s.seed.length < 100 &&
    Object.hasOwn(MODES, s.mode) &&
    ["auto", "light", "dark"].includes(s.theme) &&
    ["summary", "direct"].includes(s.method) &&
    ["adjusting", "closing"].includes(s.journalKind) &&
    s.round &&
    ["concepts", "journal", "statements", "cycle"].every(
      (k) => Number.isSafeInteger(s.round[k]) && s.round[k] >= 0,
    ) &&
    [s.stage, s.maxStage].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 5,
    ) &&
    s.stage <= s.maxStage &&
    [s.adjustment, s.closing, s.statement].every(
      (n) => Number.isInteger(n) && n >= 0 && n < 10,
    ) &&
    s.statement < 3 &&
    s.work &&
    typeof s.work === "object" &&
    !Array.isArray(s.work) &&
    Object.values(s.work).every(
      (w) =>
        w &&
        w.values &&
        typeof w.values === "object" &&
        Object.values(w.values).every((v) => typeof v === "string") &&
        Number.isInteger(w.hints) &&
        w.hints >= 0 &&
        w.hints <= 3 &&
        Number.isInteger(w.attempts) &&
        typeof w.done === "boolean" &&
        typeof w.assisted === "boolean" &&
        (w.feedback === null ||
          (w.feedback &&
            typeof w.feedback.ok === "boolean" &&
            Array.isArray(w.feedback.messages) &&
            w.feedback.messages.every((v) => typeof v === "string"))),
    ) &&
    s.concepts &&
    typeof s.concepts === "object" &&
    Object.entries(s.concepts).every(
      ([k, q]) =>
        /^\d+$/.test(k) &&
        q &&
        q.selected >= 0 &&
        q.selected < conceptQuestion(s.seed, Number(k)).options.length &&
        Array.isArray(q.tried) &&
        q.tried.every((n) => Number.isInteger(n) && n >= 0 && n < 4) &&
        typeof q.done === "boolean" &&
        Number.isInteger(q.selected),
    ) &&
    s.stats &&
    [s.stats.first, s.stats.answered].every(
      (n) => Number.isInteger(n) && n >= 0,
    )
  );
}
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (!valid(saved)) throw Error("Invalid save");
    state = saved;
  }
} catch {
  notice =
    "Saved progress could not be read. A fresh session is ready; practice still works.";
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    notice =
      "Progress could not be saved in this browser. You can keep practicing in this tab.";
  }
  updateNotice();
}
function updateNotice() {
  $("#storage-notice").hidden = !notice;
  $("#storage-notice").textContent = notice;
}
const cache = new Map();
function caseFor(mode) {
  const seed = `${state.seed}:${mode}:${state.round[mode]}`;
  if (!cache.has(seed)) cache.set(seed, generateCase(seed));
  return cache.get(seed);
}
function work(key) {
  return (state.work[key] ||= {
    values: {},
    hints: 0,
    attempts: 0,
    done: false,
    assisted: false,
    feedback: null,
  });
}
function prefix() {
  return state.mode === "cycle" ? "cycle" : state.mode;
}
function button(action, text, extra = "") {
  return `<button type="button" data-action="${action}" ${extra}>${text}</button>`;
}
function applyTheme() {
  if (state.theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = state.theme;
  $("#theme").textContent = `Theme: ${state.theme}`;
}
function input(key, name, label) {
  const w = work(key);
  return `<input class="money" inputmode="decimal" autocomplete="off" data-key="${key}" data-field="${name}" aria-label="${esc(label)}" value="${esc(w.values[name] || "")}" ${w.done ? "disabled" : ""}>`;
}
function select(key, name, label, options) {
  const w = work(key);
  return `<select data-key="${key}" data-field="${name}" aria-label="${esc(label)}" ${w.done ? "disabled" : ""}><option value="">Choose…</option>${options.map(([v, t]) => `<option value="${v}" ${w.values[name] === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
}
function feedback(key) {
  const w = work(key);
  if (!w.feedback) return "";
  return `<div class="feedback ${w.feedback.ok ? "" : "bad"} ${w.assisted ? "assisted" : ""}" role="status" tabindex="-1"><strong>${w.done ? (w.assisted ? "Completed with support" : "That’s it.") : "Keep going."}</strong>${w.feedback.messages.map((t) => `<p>${esc(t)}</p>`).join("")}</div>`;
}
function controls(key, hints) {
  const w = work(key);
  return `${
    w.hints
      ? `<aside class="hint">${hints
          .slice(0, w.hints)
          .map((h, i) => `<p><strong>Hint ${i + 1}.</strong> ${esc(h)}</p>`)
          .join("")}</aside>`
      : ""
  }<div class="actions">${button("check", "Check entry / work", `class="primary" ${w.done ? "disabled" : ""}`)}${button("hint", `Hint ${Math.min(w.hints + 1, 3)} of 3`, `${w.done || w.hints >= 3 ? "disabled" : ""}`)}${button("reveal", "Walk me through it", w.done ? "disabled" : "")}${button("reset", "Try this again")}</div>${feedback(key)}`;
}
function readTable(b, title) {
  const t = totals(b);
  return `<div class="table-wrap" tabindex="0" aria-label="${esc(title)}"><table><caption class="sr-only">${esc(title)}</caption><thead><tr><th scope="col">Account</th><th scope="col">Debit</th><th scope="col">Credit</th></tr></thead><tbody>${Object.entries(
    b,
  )
    .filter(([, v]) => v)
    .map(
      ([id, n]) =>
        `<tr><td>${esc(ACCOUNTS[id][0])}</td><td class="numeric">${n > 0 ? money(n) : "—"}</td><td class="numeric">${n < 0 ? money(-n) : "—"}</td></tr>`,
    )
    .join(
      "",
    )}<tr class="total"><td>Total</td><td class="numeric">${money(t.debit)}</td><td class="numeric">${money(t.credit)}</td></tr></tbody></table></div>`;
}
function reference(c, kind = "adjusted") {
  const b = kind === "before" ? c.before : c.adjusted;
  return `<aside class="panel reference"><details><summary>Company reference · ${esc(c.company)}</summary><p><strong>${esc(c.period)}</strong></p><p>Service company; one-year operating cycle. All amounts are dollars. The note is due in one payment in three years. Unearned services are due within three months. No taxes, interest, or other adjustments are required in this simplified case.</p><p>Beginning Common Stock: <strong>${money(-c.opening.stock)}</strong><br>Beginning Retained Earnings: <strong>${money(-c.opening.retained)}</strong><br>Stock issued in June: <strong>${money(c.issued)}</strong></p><p>Problem ID: ${esc(c.seed)}</p></details><details ${kind === "before" ? "open" : ""}><summary>${kind === "before" ? "Unadjusted" : "Adjusted"} trial balance</summary>${readTable(b, "Reference trial balance")}</details><details><summary>Recorded transactions · steps 1–3</summary><p>The following balanced entries have already been journalized and posted.</p>${c.transactions.map((t) => `<p><strong>${esc(t.description)}</strong><br>${t.lines.map((l) => `${esc(ACCOUNTS[l.account][0])}: ${signed(l.amount)}`).join("<br>")}</p>`).join("")}</details><details><summary>Adjustment clues</summary>${c.adjustments.map((a) => `<p>${esc(a.clue)}</p>`).join("")}</details><details><summary>Debit & credit reminder</summary><p>Assets, expenses, and Dividends normally have debits. Liabilities, equity, revenue, and contra assets normally have credits. Closing reverses the actual temporary balance.</p><p>Enter an amount on only one side per journal row. Blank extra rows are ignored. Journal order does not affect checking.</p></details></aside>`;
}
function toolbar() {
  return `<div class="section-top"><div><p class="eyebrow">${state.mode === "cycle" ? "A connected set of books" : "Short, focused practice"}</p><h2>${MODES[state.mode]}</h2></div>${button("new", state.mode === "concepts" ? "New question" : "New company / problem")}</div>`;
}
function methodControl() {
  return `<label>Closing method <select id="method"><option value="summary" ${state.method === "summary" ? "selected" : ""}>Income Summary · four steps</option><option value="direct" ${state.method === "direct" ? "selected" : ""}>Direct to Retained Earnings · two entries</option></select></label>`;
}
function renderLearn() {
  return `<div class="section-top"><div><p class="eyebrow">Start with the connection</p><h2>Ten steps. One continuous story.</h2></div>${button("start-cycle", "Start a full cycle →", 'class="primary"')}</div><p class="muted">Your Chapter 4 focus: the optional worksheet (5), financial statements (8), closing (9), and the post-closing trial balance (10). Open a step to see what it receives and what it makes possible.</p><div class="step-grid">${STEPS.map(([title, why, example, connection], i) => `<article class="cycle-step"><span class="step-number">${String(i + 1).padStart(2, "0")}</span><details ${i === 7 ? "open" : ""}><summary>${title}${i === 4 ? " · optional" : ""}</summary><p>${why}</p><p>${example}</p><p class="connection">${connection}</p></details></article>`).join("")}</div><div class="guide">${GUIDE.map(([t, p]) => `<article class="panel"><h3>${t}</h3><p>${p}</p></article>`).join("")}</div><section class="panel soft" style="margin-top:24px"><h3>Two routes. The same ending equity.</h3><p><strong>Income Summary:</strong> revenues → Income Summary; expenses → Income Summary; net income/loss → Retained Earnings; Dividends → Retained Earnings.</p><p><strong>Direct method:</strong> revenues and expenses → Retained Earnings in one compound entry; Dividends → Retained Earnings in a second entry. Choose the method your assignment requests. Both are available here.</p><p>A net loss reverses the net-income direction: debit Retained Earnings to reduce equity. If revenue equals expenses, Income Summary already has a zero balance and needs no transfer entry.</p>${button("start-journal", "Practice closing entries →")}</section>`;
}
function renderConcept() {
  const q = conceptQuestion(state.seed, state.round.concepts),
    k = state.round.concepts;
  const w = state.concepts[k] || { tried: [], done: false, selected: -1 };
  return `${toolbar()}<div class="panel"><p class="eyebrow">Question ${k + 1} · ${(k % CONCEPTS.length) + 1} of ${CONCEPTS.length} topics in this deck</p><h2>${esc(q.prompt)}</h2><p class="muted small">Click an answer to check it immediately. You can retry after reading the explanation.</p><div class="choices">${q.options.map((o, i) => `<button class="choice ${w.tried.includes(i) ? (o.correct ? "correct" : "incorrect") : ""}" data-action="choose" data-index="${i}" ${w.done ? "disabled" : ""}>${esc(o.text)}</button>`).join("")}</div>${w.selected >= 0 ? `<div class="feedback ${w.done ? "" : "bad"}" role="status"><strong>${w.done ? "Correct." : "Not quite."}</strong><p>${esc(q.options[w.selected].why)}</p></div>` : ""}${
    w.done
      ? `<details><summary>Why the other choices don’t fit</summary>${q.options
          .filter((o) => !o.correct)
          .map((o) => `<p><strong>${esc(o.text)}</strong> ${esc(o.why)}</p>`)
          .join("")}</details>`
      : ""
  }<div class="actions">${button("new", "Next question →", 'class="primary"')}</div></div>`;
}
function journalTask() {
  const c = caseFor(state.mode === "cycle" ? "cycle" : "journal");
  if (state.mode === "cycle") {
    const isClosing = state.stage === 3,
      entries = isClosing ? closingEntries(c, state.method) : c.adjustments;
    const index = isClosing
      ? Math.min(state.closing, entries.length - 1)
      : Math.min(state.adjustment, entries.length - 1);
    return {
      c,
      entry: entries[index],
      entries,
      index,
      key: `cycle:${isClosing ? "close:" + state.method : "adjust"}:${index}`,
      isClosing,
    };
  }
  const entries =
    state.journalKind === "closing"
      ? closingEntries(c, state.method)
      : c.adjustments;
  const index = state.round.journal % entries.length;
  return {
    c,
    entry: entries[index],
    entries,
    index,
    key: "journal:entry",
    isClosing: state.journalKind === "closing",
  };
}
function journalView(task) {
  const { c, entry, key, isClosing, entries, index } = task;
  const w = work(key);
  const rows = Math.max(3, entry.lines.length + 1);
  const options = Object.entries(ACCOUNTS).map(([id, a]) => [id, a[0]]);
  let ledger = "";
  if (w.done) {
    const before = isClosing
      ? entries.slice(0, index).reduce((b, e) => post(b, e.lines), c.adjusted)
      : c.adjustments
          .slice(0, index)
          .reduce((b, e) => post(b, e.lines), c.before);
    const after = post(before, entry.lines);
    ledger = `<details class="posted"><summary>Posted to the ledger · see what changed</summary><div class="table-wrap"><table><thead><tr><th>Account</th><th>Before</th><th>Entry</th><th>After</th></tr></thead><tbody>${entry.lines.map((l) => `<tr><td>${ACCOUNTS[l.account][0]}</td><td>${signed(before[l.account])}</td><td>${signed(l.amount)}</td><td>${signed(after[l.account])}</td></tr>`).join("")}</tbody></table></div></details>`;
  }
  return `${state.mode === "cycle" ? `<div class="subnav" aria-label="Entries">${entries.map((e, i) => button("entry", `${i + 1} · ${e.title}${work(`cycle:${isClosing ? "close:" + state.method : "adjust"}:${i}`).done ? " ✓" : ""}`, `data-index="${i}" ${i === index ? 'aria-current="page"' : ""} ${i > 0 && !entries.slice(0, i).every((_, j) => work(`cycle:${isClosing ? "close:" + state.method : "adjust"}:${j}`).done) ? "disabled" : ""}`)).join("")}</div>` : ""}<section class="panel"><p class="eyebrow">${isClosing ? "Closing" : "Adjusting"} entry${state.mode === "cycle" ? ` · ${index + 1} of ${entries.length}` : ""}</p><h2>${esc(entry.title)}</h2><p>${esc(entry.clue || (isClosing ? "Use the adjusted trial balance and the preceding closing steps. Clear these temporary balances without moving cash." : ""))}</p>${isClosing && entry.id === "summary" ? `<p class="badge">Income Summary after revenue and expense closing: ${signed(-statements(c).net)}</p>` : ""}<div class="table-wrap"><table class="journal"><caption class="sr-only">Journal entry</caption><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${Array.from({ length: rows }, (_, i) => `<tr><td>${select(key, `account${i}`, `Row ${i + 1} account`, options)}</td><td>${input(key, `debit${i}`, `Row ${i + 1} debit`)}</td><td>${input(key, `credit${i}`, `Row ${i + 1} credit`)}</td></tr>`).join("")}</tbody></table></div><p class="small muted">Extra rows can stay blank. Amounts accept dollars and commas.</p>${controls(key, journalHints(task))}${ledger}${w.done ? `<div class="actions">${button(state.mode === "cycle" ? "next" : "new", state.mode === "cycle" ? "Continue →" : "Next problem →", 'class="primary"')}</div>` : ""}</section>`;
}
function signed(n) {
  return n === 0 ? "$0" : `${money(Math.abs(n))} ${n > 0 ? "Dr" : "Cr"}`;
}
function journalHints({ entry, isClosing }) {
  return [
    isClosing
      ? "Find the actual balances of the accounts you are closing. Use the opposite side to make each one zero."
      : "Ask what was used, earned, or incurred this period, then identify the asset or liability that changes.",
    isClosing
      ? entry.id === "dividends"
        ? "Dividends bypass Income Summary because distributions are not expenses."
        : "Revenue normally has a credit balance; expenses normally have debits. Income Summary and Retained Earnings collect the difference."
      : "No cash moves in these adjustments. For a remaining-balance clue, subtract what remains from what the ledger currently shows.",
    entry.why,
  ];
}
function renderJournal() {
  const t = journalTask();
  return `${toolbar()}<div class="mode-tools"><label>Practice <select id="journal-kind"><option value="adjusting" ${state.journalKind === "adjusting" ? "selected" : ""}>Adjusting entries</option><option value="closing" ${state.journalKind === "closing" ? "selected" : ""}>Closing entries</option></select></label>${methodControl()}</div><div class="workspace-grid"><div>${journalView(t)}</div>${reference(t.c, t.isClosing ? "adjusted" : "before")}</div>`;
}
const statementNames = [
  "Income statement",
  "Stockholders’ equity",
  "Classified balance sheet",
];
function statementFields(c, tab) {
  const s = statements(c),
    b = c.adjusted;
  const f = (id, label, value, why, total = false) => ({
    id,
    label,
    value,
    why,
    total,
  });
  const from = (id) =>
    f(
      id,
      ACCOUNTS[id][0],
      Math.abs(b[id]),
      `${ACCOUNTS[id][0]} comes from the adjusted trial balance. Use its adjusted amount, not the unadjusted one.`,
    );
  if (tab === 0)
    return [
      ...["fees", "rentRevenue"].map(from),
      f(
        "revenue",
        "Total revenue",
        s.revenue,
        "Add Fees Earned and Rent Revenue.",
        true,
      ),
      ...Object.keys(b)
        .filter((id) => ACCOUNTS[id][1] === "expense" && b[id])
        .map(from),
      f(
        "expenses",
        "Total expenses",
        s.expenses,
        "Add only expense accounts. Dividends and asset purchases are not expenses.",
        true,
      ),
      f(
        "net",
        "Net income / (loss)",
        s.net,
        "Total revenue minus total expenses. Enter a negative number for a net loss.",
        true,
      ),
    ];
  if (tab === 1)
    return [
      f(
        "beginningStock",
        "Beginning Common Stock",
        s.beginningStock,
        "Use the company reference, before this month’s stock issuance.",
      ),
      f(
        "issued",
        "Add: stock issued",
        s.issued,
        "New shares increase Common Stock; they do not create revenue.",
      ),
      f(
        "stock",
        "Ending Common Stock",
        s.stock,
        "Beginning Common Stock + new stock issued.",
        true,
      ),
      f(
        "beginningRetained",
        "Beginning Retained Earnings",
        s.beginningRetained,
        "This equals Retained Earnings on the adjusted trial balance: closing has not happened yet.",
      ),
      f(
        "net",
        "Add: net income / (loss)",
        s.net,
        "Carry the result of the income statement. A net loss is negative.",
      ),
      f(
        "dividends",
        "Less: dividends (enter positive)",
        s.dividends,
        "Distributions reduce Retained Earnings. They do not reduce net income.",
      ),
      f(
        "retained",
        "Ending Retained Earnings",
        s.retained,
        "Beginning Retained Earnings + net income (or − loss) − dividends. Do not add the beginning balance twice.",
        true,
      ),
      f(
        "equity",
        "Total ending stockholders’ equity",
        s.equity,
        "Ending Common Stock + ending Retained Earnings.",
        true,
      ),
    ];
  return [
    ...["cash", "receivable", "supplies", "insurance"].map(from),
    f(
      "currentAssets",
      "Total current assets",
      s.currentAssets,
      "Sum cash, receivables, supplies, and prepaid insurance.",
      true,
    ),
    from("equipment"),
    f(
      "accumulated",
      "Less: accumulated depreciation (positive)",
      -b.accumulated,
      "Deduct this contra asset from Equipment. It is neither an expense nor a liability.",
    ),
    f(
      "ppe",
      "Net property, plant & equipment",
      s.ppe,
      "Equipment at historical cost − accumulated depreciation.",
      true,
    ),
    f(
      "assets",
      "Total assets",
      s.assets,
      "Current assets + net property, plant & equipment.",
      true,
    ),
    ...["payable", "wagesPayable", "unearned"].filter((id) => b[id]).map(from),
    f(
      "currentLiabilities",
      "Total current liabilities",
      s.currentLiabilities,
      "Sum obligations due in the next year, including Unearned Fees.",
      true,
    ),
    from("note"),
    f(
      "liabilities",
      "Total liabilities",
      s.liabilities,
      "Current liabilities + long-term note.",
      true,
    ),
    f(
      "stock",
      "Common Stock",
      s.stock,
      "Use ending Common Stock after any new shares.",
    ),
    f(
      "retained",
      "Retained Earnings",
      s.retained,
      "Use ending Retained Earnings from the equity statement, not its beginning balance on the adjusted trial balance.",
    ),
    f(
      "equity",
      "Total stockholders’ equity",
      s.equity,
      "Common Stock + ending Retained Earnings.",
      true,
    ),
    f(
      "liabilitiesEquity",
      "Total liabilities and stockholders’ equity",
      s.liabilitiesEquity,
      "Total liabilities + ending equity. This must equal total assets.",
      true,
    ),
  ];
}
const classifications = {
  cash: "current",
  insurance: "current",
  equipment: "ppe",
  accumulated: "ppe",
  unearned: "currentLiability",
  note: "longTerm",
  retained: "equity",
};
const categoryOptions = [
  ["current", "Current assets"],
  ["ppe", "Property, plant & equipment"],
  ["currentLiability", "Current liabilities"],
  ["longTerm", "Long-term liabilities"],
  ["equity", "Stockholders’ equity"],
];
function statementTask() {
  const mode = state.mode === "cycle" ? "cycle" : "statements";
  return {
    c: caseFor(mode),
    tab: state.statement,
    key: `${mode}:statement:${state.statement}`,
  };
}
function statementView() {
  const { c, tab, key } = statementTask(),
    w = work(key),
    fields = statementFields(c, tab),
    errors = w.feedback?.errors || {};
  const labels = {
    cash: "Current assets",
    equipment: "Property, plant & equipment",
    payable: "Current liabilities",
    note: "Long-term liabilities",
    stock: "Stockholders’ equity",
  };
  return `<div class="subnav" aria-label="Statement">${statementNames.map((name, i) => button("statement", `${name}${work(`${prefix()}:statement:${i}`).done ? " ✓" : ""}`, `data-index="${i}" ${tab === i ? 'aria-current="page"' : ""}`)).join("")}</div><section class="panel"><div class="statement-title"><strong>${esc(c.company)}</strong><h2>${statementNames[tab]}</h2><p>${tab === 2 ? c.date : c.period}</p></div>${
    tab === 2
      ? `<details open><summary>First, classify these accounts</summary><p class="small muted">Accumulated Depreciation belongs with the asset it reduces.</p>${Object.keys(
          classifications,
        )
          .map(
            (id) =>
              `<div class="classification"><label>${ACCOUNTS[id][0]}${errors["class-" + id] ? `<span class="field-feedback">${esc(errors["class-" + id])}</span>` : ""}</label>${select(key, `class-${id}`, `Classify ${ACCOUNTS[id][0]}`, categoryOptions)}</div>`,
          )
          .join("")}</details>`
      : ""
  }${button("carry-statement", "Carry source amounts · I’ll do the reasoning", w.done ? "disabled" : "")}<p class="small muted">Optional: carry copied balances automatically; you still calculate totals and classify accounts.</p><p class="small muted">Enter whole dollars; use a minus sign for a net loss or retained earnings deficit. “Less” amounts are entered as positive numbers.</p>${fields.map((f) => `${tab === 2 && labels[f.id] ? `<p class="statement-group">${labels[f.id]}</p>` : ""}<div class="statement-line ${f.total ? "total" : ""} ${errors[f.id] ? "row-bad" : w.done ? "row-good" : ""}"><label for="field-${f.id}">${esc(f.label)}${errors[f.id] ? `<span class="field-feedback">${esc(errors[f.id])}</span>` : ""}</label>${input(key, f.id, f.label).replace("<input", '<input id="field-' + f.id + '"')}</div>`).join("")}${controls(key, ["Start with the adjusted trial balance. The statement heading tells you whether it covers a period or reports a single date.", tab === 0 ? "Revenue − expenses = net income. Dividends do not belong here." : tab === 1 ? "Keep Common Stock and Retained Earnings separate. Stock issues go to Common Stock; profit/loss and dividends go to Retained Earnings." : "Use ending equity. Equipment less accumulated depreciation gives book value; the note is long-term.", tab === 0 ? "Add the two revenues, add all expenses, then subtract. Enter a loss as a negative amount." : tab === 1 ? "Beginning retained earnings + net income − dividends = ending retained earnings. Add ending Common Stock for total equity." : "Current assets + net PPE must equal current liabilities + long-term debt + ending stockholders’ equity."])}${w.done ? `<details><summary>How each line connects</summary>${fields.map((f) => `<p><strong>${esc(f.label)}: ${money(f.value)}.</strong> ${esc(f.why)}</p>`).join("")}</details><div class="actions">${button("next-statement", tab === 2 ? (state.mode === "cycle" ? "Continue to closing →" : "New statement case →") : "Next statement →", 'class="primary"')}</div>` : ""}</section>`;
}
function renderStatements() {
  const c = caseFor("statements");
  return `${toolbar()}<div class="workspace-grid"><div>${statementView()}</div>${reference(c)}</div>`;
}
function trialTask() {
  const c = caseFor("cycle"),
    ptb = state.stage === 4;
  return {
    c,
    ptb,
    key: ptb ? "cycle:ptb" : "cycle:atb",
    target: ptb ? c.postClosing : c.adjusted,
  };
}
function trialView() {
  const { c, ptb, key, target } = trialTask(),
    w = work(key);
  const ids = Object.keys(ACCOUNTS).filter(
    (id) => ptb || c.before[id] || target[id],
  );
  const errors = w.feedback?.errors || {};
  return `<section class="panel"><p class="eyebrow">Step ${ptb ? "10" : "7"} of the accounting cycle</p><h2>${ptb ? "Post-closing" : "Adjusted"} trial balance</h2><p>${ptb ? "Choose which accounts belong, then enter their ending balances. Omit zero balances and all closed temporary accounts." : "Post the adjustments to each balance. Retained Earnings is still the beginning balance here."}</p><p class="small muted">Use positive amounts and choose the side. Enter 0 for any zero balance that is included in the adjusted worksheet.</p>${!ptb ? button("carry", "Carry forward unchanged balances", w.done ? "disabled" : "") : ""}<div class="table-wrap" style="margin-top:14px"><table class="trial"><caption>${esc(c.company)} · June 30, 2026</caption><thead><tr><th>Account</th>${ptb ? "<th>Include?</th>" : "<th>Before</th>"}<th>Amount</th><th>Side</th></tr></thead><tbody>${ids
    .map(
      (id) =>
        `<tr class="${errors[id] ? "row-bad" : w.done ? "row-good" : ""}"><td>${esc(ACCOUNTS[id][0])}${errors[id] ? `<span class="field-feedback">${esc(errors[id])}</span>` : ""}</td><td>${
          ptb
            ? select(key, `include-${id}`, `Include ${ACCOUNTS[id][0]}`, [
                ["yes", "Include"],
                ["no", "Omit"],
              ])
            : signed(c.before[id])
        }</td><td>${input(key, `amount-${id}`, `${ACCOUNTS[id][0]} amount`)}</td><td>${select(
          key,
          `side-${id}`,
          `${ACCOUNTS[id][0]} side`,
          [
            ["debit", "Debit"],
            ["credit", "Credit"],
          ],
        )}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><p class="small muted">For omitted accounts, leave amount and side blank; any entered values are ignored. Totals are shown after checking so you can focus on the account logic.</p>${controls(key, [ptb ? "Permanent accounts survive closing; temporary accounts reset. Unearned Fees and Accumulated Depreciation are permanent." : "For each account, start with its recorded side and add or subtract the adjustment. A credit to a debit-balance asset usually reduces it.", ptb ? "Retained Earnings now includes income/loss and dividends. Common Stock is not closed." : "The adjustment’s debit and credit need not both increase the accounts. Think about each account’s starting side.", ptb ? "Assets, contra assets, liabilities, Common Stock, and ending Retained Earnings remain. Revenue, expenses, Dividends, and Income Summary are zero and omitted." : "Supplies decreases by supplies used; Accumulated Depreciation gains another credit. Retained Earnings does not change until closing."])}${w.done ? `<div class="actions">${button("next", "Continue →", 'class="primary"')}</div>` : ""}</section>`;
}
function renderCycle() {
  const c = caseFor("cycle");
  const completed = Object.entries(state.work).filter(
    ([k, w]) => k.startsWith("cycle:") && w.done,
  ).length;
  let view =
    state.stage === 0 || state.stage === 3
      ? journalView(journalTask())
      : state.stage === 1 || state.stage === 4
        ? trialView()
        : state.stage === 2
          ? statementView()
          : `<section class="panel complete"><div class="symbol">✓</div><p class="eyebrow">The books are closed</p><h2>Ready for a new month.</h2><p>You adjusted the ledger, prepared statements, closed temporary accounts, and checked the balances that carry forward.</p><p>Ending Retained Earnings: <strong>${money(statements(c).retained)}</strong><br>Temporary account balances: <strong>$0</strong></p><p class="muted">${Object.entries(state.work).filter(([k, w]) => k.startsWith("cycle:") && w.assisted).length} completed exercises used hints or walkthroughs. You can revisit any stage or reset the cycle for another attempt.</p>${button("new", "Try another company →", 'class="primary"')}</section>`;
  return `${toolbar()}<p class="muted">Steps 1–3 are recorded for you. Start with the unadjusted trial balance and adjustment clues, then finish this company’s month. Each verified stage supplies the next.</p><div class="mode-tools">${methodControl()}${button("reset-cycle", "Reset this cycle")}</div><div class="rail" aria-label="Cycle stages">${STAGES.map((s, i) => button("stage", `<span>${i < state.maxStage ? "✓" : String(i + 1).padStart(2, "0")}</span>${s}`, `data-index="${i}" ${state.stage === i ? 'aria-current="step"' : ""} ${i > state.maxStage ? "disabled" : ""}`)).join("")}</div><div class="meter" role="progressbar" aria-label="Completed cycle stages" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${state.maxStage}"><div style="width:${(state.maxStage / 5) * 100}%"></div></div><p class="small muted">${state.maxStage} of 5 stages complete · ${completed} exercises completed</p><div class="workspace-grid"><div>${view}</div>${reference(c, state.stage <= 1 ? "before" : "adjusted")}</div>`;
}
function render(focus = false) {
  applyTheme();
  $("#modes").innerHTML = Object.entries(MODES)
    .map(([id, title]) =>
      button(
        "mode",
        title,
        `data-mode="${id}" ${id === state.mode ? 'aria-current="page"' : ""}`,
      ),
    )
    .join("");
  $("#workspace").innerHTML = {
    learn: renderLearn,
    concepts: renderConcept,
    journal: renderJournal,
    statements: renderStatements,
    cycle: renderCycle,
  }[state.mode]();
  const done = Object.values(state.work).filter((w) => w.done);
  $("#progress-summary").textContent =
    `This set: ${done.length} exercises complete · ${done.filter((w) => w.assisted).length} with support. Concepts: ${state.stats.first}/${state.stats.answered} correct on first try.`;
  updateNotice();
  if (focus) $("#workspace").focus();
  save();
}
function active() {
  if (
    state.mode === "journal" ||
    (state.mode === "cycle" && [0, 3].includes(state.stage))
  ) {
    const t = journalTask();
    return { type: "journal", ...t };
  }
  if (
    state.mode === "statements" ||
    (state.mode === "cycle" && state.stage === 2)
  )
    return { type: "statement", ...statementTask() };
  if (state.mode === "cycle" && [1, 4].includes(state.stage))
    return { type: "trial", ...trialTask() };
  return null;
}
function evaluate(t) {
  const w = work(t.key),
    v = w.values;
  if (t.type === "journal") {
    const rows = Array.from(
      { length: Math.max(3, t.entry.lines.length + 1) },
      (_, i) => ({
        account: v[`account${i}`] || "",
        debit: v[`debit${i}`] || "",
        credit: v[`credit${i}`] || "",
      }),
    );
    return checkJournal(t.entry, rows);
  }
  const errors = {};
  if (t.type === "statement") {
    for (const f of statementFields(t.c, t.tab))
      if (parseMoney(v[f.id]) !== f.value) errors[f.id] = f.why;
    if (t.tab === 2)
      for (const [id, category] of Object.entries(classifications))
        if (v[`class-${id}`] !== category)
          errors[`class-${id}`] =
            id === "accumulated"
              ? "A contra asset reduces Equipment within PPE. A credit balance does not make it a liability."
              : `${ACCOUNTS[id][0]} belongs in ${categoryOptions.find(([x]) => x === category)[1]}. ${id === "unearned" ? "It is an obligation to provide future services, not earned revenue." : ""}`;
    return {
      ok: !Object.keys(errors).length,
      errors,
      messages: Object.keys(errors).length
        ? [
            "Review the marked lines. Each note explains the source or relationship; the adjusted trial balance is available in the reference.",
          ]
        : [
            "The statement reconciles. " +
              (t.tab === 0
                ? "Net income/loss flows into the equity statement."
                : t.tab === 1
                  ? "Ending equity flows into the balance sheet; the ledger catches up when you close."
                  : "Assets equal liabilities plus ending stockholders’ equity."),
          ],
    };
  }
  let enteredDebit = 0,
    enteredCredit = 0;
  for (const id of Object.keys(ACCOUNTS).filter(
    (id) => t.ptb || t.c.before[id] || t.target[id],
  )) {
    const expected = t.target[id];
    if (t.ptb && v[`include-${id}`] !== (expected ? "yes" : "no")) {
      errors[id] = balanceWhy(t.c, id, true);
      continue;
    }
    if (t.ptb && !expected) continue;
    const amount = parseMoney(v[`amount-${id}`]);
    const side = v[`side-${id}`];
    if (amount !== null && amount >= 0) {
      if (side === "debit") enteredDebit += amount;
      else if (side === "credit") enteredCredit += amount;
    }
    if (
      amount !== Math.abs(expected) ||
      (expected !== 0 && side !== (expected > 0 ? "debit" : "credit"))
    )
      errors[id] = balanceWhy(t.c, id, t.ptb);
  }
  return {
    ok: !Object.keys(errors).length,
    errors,
    messages: [
      `${Object.keys(errors).length ? "Review the marked accounts." : "Every account and balance is correct."} Entered debit total: ${money(enteredDebit)}; credit total: ${money(enteredCredit)}.`,
      t.ptb
        ? "Only permanent nonzero balances carry forward. Equal totals alone would not detect an incorrect account classification."
        : "The adjusted trial balance still includes temporary accounts; it is the source for financial statements.",
    ],
  };
}
function fill(t) {
  const v = work(t.key).values;
  if (t.type === "journal") {
    for (let i = 0; i < Math.max(3, t.entry.lines.length + 1); i++) {
      const l = t.entry.lines[i];
      v[`account${i}`] = l?.account || "";
      v[`debit${i}`] = l && l.amount > 0 ? String(l.amount) : "";
      v[`credit${i}`] = l && l.amount < 0 ? String(-l.amount) : "";
    }
  } else if (t.type === "statement") {
    for (const f of statementFields(t.c, t.tab)) v[f.id] = String(f.value);
    if (t.tab === 2)
      for (const [id, cat] of Object.entries(classifications))
        v[`class-${id}`] = cat;
  } else
    for (const [id, n] of Object.entries(t.target)) {
      v[`amount-${id}`] = n || !t.ptb ? String(Math.abs(n)) : "";
      v[`side-${id}`] = n > 0 ? "debit" : n < 0 ? "credit" : "";
      if (t.ptb) v[`include-${id}`] = n ? "yes" : "no";
    }
}
function clearWork(p) {
  for (const k of Object.keys(state.work))
    if (k.startsWith(p + ":")) delete state.work[k];
}
function resetCycle() {
  clearWork("cycle");
  state.stage =
    state.maxStage =
    state.adjustment =
    state.closing =
    state.statement =
      0;
}
function newProblem() {
  const mode = state.mode;
  const pending = Object.entries(state.work).some(
    ([k, w]) =>
      k.startsWith(mode + ":") &&
      ((!w.done && Object.values(w.values).some(Boolean)) ||
        (mode === "cycle" && state.maxStage < 5 && w.done)),
  );
  if (
    pending &&
    !confirm("Start fresh? This replaces the current company and its work.")
  )
    return;
  state.round[mode]++;
  if (mode === "cycle") resetCycle();
  else if (mode === "concepts") {
    state.concepts = {};
  } else {
    clearWork(mode);
    state.statement = 0;
  }
  cache.clear();
  render(true);
}
function advanceStage() {
  state.stage = Math.min(5, state.stage + 1);
  state.maxStage = Math.max(state.maxStage, state.stage);
  state.statement = 0;
  render(true);
}
function next() {
  const t = active();
  if (!t || !work(t.key).done) return;
  if (t.type === "journal") {
    if (t.index < t.entries.length - 1) {
      if (t.isClosing) state.closing++;
      else state.adjustment++;
      render(true);
    } else if (
      t.entries.every(
        (_, i) =>
          work(`cycle:${t.isClosing ? "close:" + state.method : "adjust"}:${i}`)
            .done,
      )
    )
      advanceStage();
  } else advanceStage();
}
function showFeedback() {
  render();
  $(".feedback")?.focus();
}
$("#theme").addEventListener("click", () => {
  state.theme = ["auto", "light", "dark"][
    (["auto", "light", "dark"].indexOf(state.theme) + 1) % 3
  ];
  applyTheme();
  save();
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.key && el.dataset.field) {
    const w = work(el.dataset.key);
    if (!w.done) {
      w.values[el.dataset.field] = el.value;
      save();
    }
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "method") {
    const value = e.target.value;
    if (
      Object.keys(state.work).some((k) => k.startsWith("cycle:close:")) &&
      !confirm(
        "Changing the closing method resets closing entries and the post-closing trial balance. Earlier work is kept.",
      )
    ) {
      e.target.value = state.method;
      return;
    }
    state.method = value;
    clearWork("journal");
    for (const k of Object.keys(state.work))
      if (k.startsWith("cycle:close:") || k === "cycle:ptb")
        delete state.work[k];
    state.closing = 0;
    state.maxStage = Math.min(state.maxStage, 3);
    state.stage = Math.min(state.stage, 3);
    render();
  }
  if (e.target.id === "journal-kind") {
    state.journalKind = e.target.value;
    clearWork("journal");
    render();
  }
});
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  if (action === "mode") {
    state.mode = el.dataset.mode;
    render(true);
    return;
  }
  if (action === "start-cycle") {
    state.mode = "cycle";
    render(true);
    return;
  }
  if (action === "start-journal") {
    state.mode = "journal";
    state.journalKind = "closing";
    clearWork("journal");
    render(true);
    return;
  }
  if (action === "new") {
    newProblem();
    return;
  }
  if (action === "reset-cycle") {
    if (confirm("Reset all work for this same company?")) {
      resetCycle();
      render(true);
    }
    return;
  }
  if (action === "stage") {
    const i = Number(el.dataset.index);
    if (i <= state.maxStage) {
      state.stage = i;
      render(true);
    }
    return;
  }
  if (action === "entry") {
    const i = Number(el.dataset.index);
    if (state.stage === 3) state.closing = i;
    else state.adjustment = i;
    render(true);
    return;
  }
  if (action === "statement") {
    state.statement = Number(el.dataset.index);
    render();
    return;
  }
  if (action === "choose") {
    const k = state.round.concepts,
      q = conceptQuestion(state.seed, k),
      i = Number(el.dataset.index),
      w = (state.concepts[k] ||= { tried: [], done: false, selected: -1 });
    if (w.done) return;
    if (!w.tried.length) {
      state.stats.answered++;
      if (q.options[i].correct) state.stats.first++;
    }
    if (!w.tried.includes(i)) w.tried.push(i);
    w.selected = i;
    w.done = q.options[i].correct;
    render();
    return;
  }
  if (action === "next-statement") {
    if (state.statement < 2) {
      state.statement++;
      render(true);
    } else if (state.mode === "cycle") {
      if ([0, 1, 2].every((i) => work(`cycle:statement:${i}`).done))
        advanceStage();
      else {
        state.statement = [0, 1, 2].find(
          (i) => !work(`cycle:statement:${i}`).done,
        );
        render(true);
      }
    } else newProblem();
    return;
  }
  if (action === "next") {
    next();
    return;
  }
  const t = active();
  if (!t) return;
  const w = work(t.key);
  if (action === "reset") {
    if (confirm("Clear this exercise and try the same numbers again?")) {
      delete state.work[t.key];
      if (state.mode === "cycle") {
        // Downstream work depends on verified earlier stages.
        const current = state.stage;
        for (const k of Object.keys(state.work)) {
          if (
            (current < 1 && k === "cycle:atb") ||
            (current < 2 && k.startsWith("cycle:statement:")) ||
            (current < 3 && k.startsWith("cycle:close:")) ||
            (current < 4 && k === "cycle:ptb")
          )
            delete state.work[k];
        }
        state.maxStage = Math.min(state.maxStage, current);
        if (current < 3) state.closing = 0;
        if (current < 2) state.statement = 0;
      }
      render();
    }
    return;
  }
  if (w.done) return;
  if (action === "hint") {
    w.hints = Math.min(3, w.hints + 1);
    w.assisted = true;
    render();
  }
  if (action === "carry-statement" && t.type === "statement") {
    for (const f of statementFields(t.c, t.tab))
      if (!f.total && f.id !== "net") w.values[f.id] = String(f.value);
    if (t.tab === 1 && work(`${prefix()}:statement:0`).done)
      w.values.net = String(statements(t.c).net);
    render();
  }
  if (action === "carry" && t.type === "trial") {
    for (const [id, n] of Object.entries(t.target))
      if (n === t.c.before[id]) {
        w.values[`amount-${id}`] = String(Math.abs(n));
        w.values[`side-${id}`] = n > 0 ? "debit" : n < 0 ? "credit" : "";
      }
    render();
  }
  if (action === "check") {
    w.attempts++;
    w.feedback = evaluate(t);
    w.done = w.feedback.ok;
    showFeedback();
  }
  if (action === "reveal") {
    w.assisted = true;
    fill(t);
    w.feedback = evaluate(t);
    w.feedback.messages.unshift(
      t.type === "journal"
        ? t.entry.why
        : t.type === "trial"
          ? "Walkthrough: each adjusted balance incorporates the relevant entry. After closing, remove temporary accounts and replace beginning Retained Earnings with its ending amount."
          : "Walkthrough: the filled lines show the correct statement. Net income connects the first two statements; ending equity connects the last two.",
    );
    w.done = true;
    showFeedback();
  }
});
render();
