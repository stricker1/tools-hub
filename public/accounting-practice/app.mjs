import {
  generate,
  encodeSeed,
  PRESETS,
  CONCEPTS,
  money,
  dollars,
} from "./engine.mjs";
import {
  amount,
  formatted,
  accountId,
  newWork,
  validate,
  answerSection,
  blankLine,
} from "./validation.mjs";
import { load, save, freshStats, recordCheck } from "./storage.mjs";
const $ = (s) => document.querySelector(s),
  escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const SECTIONS = ["journal", "ledger", "trial", "results", "corrections"],
  NAMES = ["Journal", "Ledger", "Trial balance", "Results", "Corrections"];
const resultLabels = {
  revenue: "Total revenues",
  expenses: "Total expenses",
  net: "Net income / net loss",
  dividends: "Dividends",
  change: "Change in retained earnings",
  retained: "Ending retained earnings",
};
let storage;
try {
  storage = window.localStorage;
} catch {
  /* private mode can block the getter */
}
let data = load(storage),
  stats = data.stats,
  session,
  problem,
  feedbacks = {},
  explanation = false,
  hint = false;
const notice = (message) => {
  const n = $("#storage-notice");
  n.hidden = false;
  n.textContent = message;
};
if (data.notice) notice(data.notice);
function persist() {
  if (!save(storage, { stats, session }))
    notice(
      "Your browser could not save progress. Your work stays available in this tab.",
    );
}
function isShape(template, value) {
  if (Array.isArray(template))
    return (
      Array.isArray(value) &&
      value.length >= template.length &&
      value.length < 500 &&
      value.every((v, i) =>
        isShape(template[Math.min(i, template.length - 1)], v),
      )
    );
  if (template && typeof template === "object")
    return (
      value &&
      typeof value === "object" &&
      Object.keys(template).every((k) => isShape(template[k], value[k]))
    );
  return typeof value === "string" || typeof value === "number";
}
function start(id) {
  problem = generate(id);
  session = {
    id: problem.id,
    work: newWork(problem),
    section: "journal",
    checked: {},
    passed: {},
    revealed: {},
    recorded: {},
    completed: false,
  };
  stats.attempted++;
  feedbacks = {};
  hint = false;
  explanation = false;
  persist();
  render();
}
try {
  if (data.session) {
    problem = generate(data.session.id);
    if (
      !isShape(newWork(problem), data.session.work) ||
      !SECTIONS.includes(data.session.section) ||
      !["checked", "passed", "revealed", "recorded"].every(
        (k) => data.session[k] && typeof data.session[k] === "object",
      )
    )
      throw Error("Invalid progress");
    session = data.session;
    for (const section of SECTIONS)
      if (session.checked[section])
        feedbacks[section] = validate(problem, session.work, section);
  }
} catch {
  session = undefined;
  notice("The saved problem could not be restored. A fresh problem is ready.");
}
function randomId() {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return [...values].map((v) => v.toString(36)).join("");
}
function chosenId() {
  const d = $("#difficulty").value,
    concepts =
      d === "custom"
        ? [...document.querySelectorAll("#concepts input:checked")].map(
            (n) => n.value,
          )
        : PRESETS[d];
  return encodeSeed(d, concepts, randomId());
}
$("#concepts").innerHTML = Object.entries(CONCEPTS)
  .map(
    ([k, v]) =>
      `<label><input type="checkbox" value="${k}" checked>${v}</label>`,
  )
  .join("");
const get = (path) => path.split(".").reduce((v, k) => v[k], session.work);
function set(path, value) {
  const keys = path.split("."),
    last = keys.pop();
  keys.reduce((v, k) => v[k], session.work)[last] = value;
}
const dateLabel = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const statusLabels = {
  account: "Check account",
  side: "Check debit / credit side",
  amount: "Check amount",
  date: "Check date",
  reference: "Check posting reference",
  answer: "Try another answer",
  balance: "Check earlier postings",
};
function status(path) {
  return feedbacks[session.section]?.cells[path];
}
function cellClass(path) {
  const s = status(path);
  if (session.revealed[session.section]?.includes(path))
    return "field-revealed";
  return s === "ok" ? "field-ok" : s ? "field-error" : "";
}
function input(
  path,
  { type = "text", label = "", account = false, numeric = false } = {},
) {
  const s = status(path),
    v = get(path),
    value = numeric
      ? String(v) === "0"
        ? path.startsWith("results.")
          ? "0"
          : ""
        : formatted(v)
      : account
        ? problem.accounts.find((a) => a.id === String(v))?.name || v
        : v;
  return `<input data-path="${path}" ${numeric ? 'data-money="true" inputmode="decimal"' : ""} ${account ? 'list="accounts" autocomplete="off"' : ""} type="${type}" value="${escape(value)}" aria-label="${escape(label)}" class="${cellClass(path)}" ${s && s !== "ok" ? `aria-invalid="true" aria-describedby="error-${path}"` : ""}>${s && s !== "ok" ? `<span class="error-label" id="error-${path}">${statusLabels[s]}</span>` : ""}`;
}
function render() {
  $("#difficulty").value = problem.difficulty;
  $("#custom").hidden = problem.difficulty !== "custom";
  if (problem.difficulty === "custom")
    document
      .querySelectorAll("#concepts input")
      .forEach((n) => (n.checked = problem.concepts.includes(n.value)));
  $("#seed").value = problem.id;
  $("#accounts").innerHTML = problem.accounts
    .map((a) => `<option value="${a.name}">${a.id} · ${a.name}</option>`)
    .join("");
  renderReference();
  renderSteps();
  renderWork();
}
function renderSteps() {
  const current = SECTIONS.indexOf(session.section);
  $("#steps").innerHTML = SECTIONS.map(
    (s, i) =>
      `<button data-step="${s}" ${session.section === s ? 'aria-current="step"' : ""} class="${session.passed[s] ? "done" : ""}"><span class="step-number">${session.passed[s] ? "✓" : i + 1}</span><span>${NAMES[i]}</span></button>`,
  ).join("");
  $("#next").hidden = current === 4;
  $("#check").textContent = `Check ${NAMES[current].toLowerCase()}`;
  $("#explain").hidden = !session.checked[session.section];
  $("#check").disabled =
    session.section === "corrections" && !problem.correction;
  $("#reveal").disabled = $("#check").disabled;
}
function renderReference() {
  $("#reference").innerHTML =
    `<section class="card company-card"><p class="eyebrow">your practice company</p><h2>${escape(problem.company)}</h2><p class="muted">A small incorporated service business.</p><p>${problem.monthName} ${problem.year}</p><span class="badge">${problem.difficulty} · ${problem.entries.length} transactions</span><p><small>Use only the facts provided. All amounts are in dollars; no taxes, depreciation, or other adjustments are required.</small></p></section>
  <details class="card" open><summary>Chart of accounts</summary><ul class="account-list">${problem.accounts.map((a) => `<li><code>${a.id}</code><span>${a.name}</span></li>`).join("")}</ul><small>Type an account title or number in the journal.</small></details>
  <details class="card"><summary>Opening trial balance</summary>${
    Object.keys(problem.opening).length
      ? `<p><small>${dateLabel(problem.start)} · before this month’s transactions</small></p><table class="mini-table"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${problem.accounts
          .filter((a) => problem.opening[a.id])
          .map((a) => {
            const n = problem.opening[a.id];
            return `<tr><td>${a.name}</td><td>${n > 0 ? money(n) : ""}</td><td>${n < 0 ? money(-n) : ""}</td></tr>`;
          })
          .join("")}<tr><td>Total</td><td>${money(
          Object.values(problem.opening)
            .filter((n) => n > 0)
            .reduce((s, n) => s + n, 0),
        )}</td><td>${money(
          -Object.values(problem.opening)
            .filter((n) => n < 0)
            .reduce((s, n) => s + n, 0),
        )}</td></tr></tbody></table>`
      : "<p>All beginning balances are zero. The company starts this month.</p>"
  }</details>
  <details class="card"><summary>Transaction list</summary><ol class="transaction-list">${problem.entries.map((e) => `<li><b>${dateLabel(e.date)} · p. ${e.page}</b><br>${escape(e.text)}</li>`).join("")}</ol></details>
  <details class="card"><summary>DEALER reference</summary><p><b>D</b>ividends<br><b>E</b>xpenses<br><b>A</b>ssets<br>→ Normal <b>debit</b> balance</p><p><b>L</b>iabilities<br><b>E</b>quity<br><b>R</b>evenue<br>→ Normal <b>credit</b> balance</p><small>Normal describes the usual ending balance. Decreases go on the opposite side. Dividends reduce equity and are not expenses.</small></details>`;
}
const descriptions = {
  journal:
    "Record each transaction. Type an account name or number; put account numbers in Post Ref. as posting practice. Add rows for compound entries.",
  ledger:
    "Post transactions in date order. Use journal page numbers (18, 19, …) as Post. Ref. Running balances update from your entries. Item is an optional memo.",
  trial:
    "Transfer ending ledger balances to their normal debit or credit columns. Leave zero balances blank. Equal totals alone do not prove the accounts are correct.",
  results:
    "Use this month’s recorded revenues, expenses, and dividends. For net loss or a decrease, enter a negative amount.",
  corrections:
    "This audit happens after the original trial balance and results. Keep your original work; record only the separate correcting entry below.",
};
function renderWork() {
  const section = session.section,
    openAccounts = [...document.querySelectorAll("[data-ledger][open]")].map(
      (n) => n.dataset.ledger,
    );
  $("#workspace").innerHTML =
    `<div class="section-head"><div><p class="eyebrow">step ${SECTIONS.indexOf(section) + 1} of 5</p><h2>${{ journal: "Analyze & journalize", ledger: "Build the general ledger", trial: "Bring the balances together", results: "What do the books tell you?", corrections: "A second look at the books" }[section]}</h2><p>${descriptions[section]}</p></div></div>${session.revealed[section]?.length ? '<div class="revealed-banner">Purple fields were revealed. Green fields were correct before reveal.</div>' : ""}<div id="help"></div>${section === "journal" ? journal() : section === "ledger" ? ledger() : section === "trial" ? trial() : section === "results" ? results() : corrections()}`;
  if (section === "ledger")
    document.querySelectorAll("[data-ledger]").forEach((n) => {
      n.open =
        openAccounts.includes(n.dataset.ledger) ||
        !!n.querySelector(".field-error") ||
        (!openAccounts.length && n.dataset.ledger === "101");
    });
  renderHelp();
  renderSteps();
  updateTotals();
}
function journalRows(rows, prefix, date = true) {
  return `<div class="table-wrap"><table class="journal-table"><thead><tr>${date ? "<th>Date</th>" : ""}<th>Account</th>${date ? "<th>Post Ref.</th>" : ""}<th>Debit</th><th>Credit</th><th aria-label="Remove row"></th></tr></thead><tbody>${rows.map((r, i) => `<tr>${date ? `<td class="date">${input(`${prefix}.${i}.date`, { type: "date", label: `Row ${i + 1} date` })}</td>` : ""}<td class="account ${amount(r.credit) > 0 && !amount(r.debit) ? "credit-title" : ""}">${input(`${prefix}.${i}.account`, { account: true, label: `Row ${i + 1} account` })}</td>${date ? `<td class="ref">${input(`${prefix}.${i}.ref`, { label: `Row ${i + 1} posting reference` })}</td>` : ""}<td class="money">${input(`${prefix}.${i}.debit`, { numeric: true, label: `Row ${i + 1} debit` })}</td><td class="money">${input(`${prefix}.${i}.credit`, { numeric: true, label: `Row ${i + 1} credit` })}</td><td class="remove"><button data-remove="${prefix}.${i}" aria-label="Remove row ${i + 1}" ${rows.length <= 2 ? "disabled" : ""}>×</button></td></tr>`).join("")}</tbody></table></div><div class="row-footer"><button data-add="${prefix}">+ Add line</button><small>Credit titles indent automatically</small></div>`;
}
function journal() {
  return problem.entries
    .map(
      (e, i) =>
        `<article class="paper" id="entry-${i}"><div class="transaction"><div class="kicker">${String(i + 1).padStart(2, "0")} · ${dateLabel(e.date)} · Journal page ${e.page}</div><p>${escape(e.text)}</p></div>${journalRows(session.work.journal[i], `journal.${i}`)}${feedbacks.journal?.units[i]?.missing ? `<p class="error-label missing" style="padding:0 18px">An expected account is missing. Check the transaction and add a line if needed.</p>` : ""}</article>`,
    )
    .join("");
}
function ledger() {
  return `<p class="muted"><small>Opening balances are supplied. Expand an account to post its activity. Journal page assignments appear in the transaction list.</small></p>${problem.accounts.map((a) => `<details class="paper ledger-account" data-ledger="${a.id}" ${a.id === "101" ? "open" : ""}><summary>${a.id} · ${a.name}<span>${problem.key.ledger[a.id].length} postings</span></summary><div class="table-wrap"><table class="ledger-table"><thead><tr><th>Date</th><th>Item</th><th>Post. Ref.</th><th>Debit</th><th>Credit</th><th>Balance Debit</th><th>Balance Credit</th></tr></thead><tbody>${problem.opening[a.id] ? `<tr class="opening-row"><td>${dateLabel(problem.start)}</td><td>Balance</td><td>✓</td><td></td><td></td><td>${problem.opening[a.id] > 0 ? money(problem.opening[a.id]) : ""}</td><td>${problem.opening[a.id] < 0 ? money(-problem.opening[a.id]) : ""}</td></tr>` : ""}${session.work.ledger[a.id].map((r, i) => `<tr><td class="date">${input(`ledger.${a.id}.${i}.date`, { type: "date", label: `${a.name} posting ${i + 1} date` })}</td><td>${input(`ledger.${a.id}.${i}.item`, { label: `${a.name} posting ${i + 1} memo (optional)` })}</td><td class="ref">${input(`ledger.${a.id}.${i}.ref`, { label: `${a.name} posting ${i + 1} journal page` })}</td><td class="money">${input(`ledger.${a.id}.${i}.debit`, { numeric: true, label: `${a.name} posting ${i + 1} debit` })}</td><td class="money">${input(`ledger.${a.id}.${i}.credit`, { numeric: true, label: `${a.name} posting ${i + 1} credit` })}</td><td class="balance-cell ${cellClass(`ledger.${a.id}.${i}.balance`)}" data-balance="${a.id}.${i}.debit"></td><td class="balance-cell ${cellClass(`ledger.${a.id}.${i}.balance`)}" data-balance="${a.id}.${i}.credit"></td></tr>`).join("")}${!session.work.ledger[a.id].length ? '<tr><td colspan="7">No activity this month. Carry forward the opening balance, if any.</td></tr>' : ""}</tbody></table></div></details>`).join("")}`;
}
function trial() {
  return `<article class="paper"><div class="transaction"><h3>${escape(problem.company)}</h3>Unadjusted Trial Balance · ${dateLabel(problem.end)}, ${problem.year}</div><div class="table-wrap"><table class="trial-table"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${problem.accounts.map((a, i) => `<tr><td><small>${a.id}</small> ${a.name}</td><td class="money">${input(`trial.${i}.debit`, { numeric: true, label: `${a.name} trial balance debit` })}</td><td class="money">${input(`trial.${i}.credit`, { numeric: true, label: `${a.name} trial balance credit` })}</td></tr>`).join("")}<tr class="totals"><td>Totals</td><td id="trial-debits"></td><td id="trial-credits"></td></tr></tbody></table></div></article><p id="trial-difference" class="muted"></p><p class="muted"><small>Retained Earnings here is the beginning balance. Current revenues, expenses, and dividends have not been closed yet.</small></p>`;
}
function results() {
  return `<div class="result-grid">${Object.keys(problem.key.results)
    .map(
      (k) =>
        `<div class="result-card"><label for="result-${k}">${resultLabels[k]}</label>${input(`results.${k}`, { numeric: true, label: resultLabels[k] }).replace("<input", '<input id="result-' + k + '"')}<p>${{ revenue: "Include all revenue accounts.", expenses: "Use net expense balances after any refunds.", net: "Revenues minus expenses. Enter a loss as negative.", dividends: "Distributions to shareholders, separate from expenses.", change: "Net income (or loss) minus dividends. Use a minus sign for a decrease.", retained: "Beginning retained earnings plus this month’s change; the balance after closing." }[k]}</p></div>`,
    )
    .join(
      "",
    )}</div><div class="help">The original trial balance comes before closing entries. Calculate the resulting ending retained earnings here, without changing the trial balance.</div>`;
}
function corrections() {
  if (!problem.correction)
    return '<div class="paper transaction"><h3>No audit correction in this problem</h3><p>Finish the first four sections to complete this problem. Choose Advanced or enable Error correction in Custom to practice correcting entries.</p></div>';
  const c = problem.correction;
  return `<article class="paper"><div class="transaction"><div class="kicker">After the trial balance · audit finding</div><p>The bank confirms that the wages payment was actually <b>${dollars(c.actual)}</b>. The bookkeeper debited Wages Expense and credited Cash for <b>${dollars(c.recorded)}</b>. Both sides were already posted at that incorrect amount.</p></div><div class="correction-questions">${select(
    "correction.why",
    "Why did the trial balance still balance?",
    [
      ["equal", "Both debit and credit were wrong by the same amount."],
      ["cash", "Cash transactions never affect the trial balance."],
      ["correct", "Equal totals prove that every entry was correct."],
    ],
  )}${select("correction.type", "What kind of recording error was this?", [
    ["transposition", "Transposition — digits exchanged places"],
    ["slide", "Slide — decimal point shifted"],
    ["neither", "Neither"],
  ])}</div><div class="transaction"><h3>Record the correcting journal entry</h3><p>Adjust only the difference. Date and posting references are not required for this separate audit task.</p></div>${journalRows(session.work.correction.lines, "correction.lines", false)}</article>`;
}
function select(path, label, options) {
  const s = status(path);
  return `<label>${label}<select data-path="${path}" aria-label="${label}" class="${cellClass(path)}" ${s && s !== "ok" ? 'aria-invalid="true"' : ""}><option value="">Choose an answer…</option>${options.map(([v, t]) => `<option value="${v}" ${get(path) === v ? "selected" : ""}>${t}</option>`).join("")}</select>${s && s !== "ok" ? '<span class="error-label">Try another answer</span>' : ""}</label>`;
}
function updateTotals() {
  if (session.section === "ledger")
    for (const a of problem.accounts) {
      let running = problem.opening[a.id] || 0;
      session.work.ledger[a.id].forEach((r, i) => {
        running += amount(r.debit) - amount(r.credit);
        for (const side of ["debit", "credit"]) {
          const n = $(`[data-balance="${a.id}.${i}.${side}"]`);
          if (n)
            n.textContent = Number.isFinite(running)
              ? side === "debit" && running > 0
                ? money(running)
                : side === "credit" && running < 0
                  ? money(-running)
                  : "—"
              : "Invalid amount";
        }
      });
    }
  if (session.section === "trial") {
    const d = session.work.trial.reduce((s, r) => s + amount(r.debit), 0),
      c = session.work.trial.reduce((s, r) => s + amount(r.credit), 0);
    $("#trial-debits").textContent = money(d);
    $("#trial-credits").textContent = money(c);
    $("#trial-difference").textContent = !Number.isFinite(d + c)
      ? "Check the format of your amounts."
      : d === c
        ? "Totals agree. Check the section to verify each account."
        : `${dollars(Math.abs(d - c))} difference · ${d > c ? "debits" : "credits"} are higher.`;
  }
}
function renderHelp() {
  const s = session.section;
  let html = "";
  if (hint) {
    const hints = {
      journal:
        "Use DEALER to decide which side increases an account. “On account” means an amount owed, not necessarily revenue or expense. A compound entry can have three or more lines.",
      ledger:
        "For each account, start with its opening balance and add debits, then subtract credits. Positive is a debit balance; negative is a credit balance. Post. Ref. is the number of the journal page.",
      trial:
        "Use the last running balance for each ledger account. Carry over a balance even if the account had no transactions this month. Leave the opposite column blank.",
      results:
        "Add revenue credits, subtract net expense debits, then subtract dividends to find the change in retained earnings. Beginning retained earnings is in the opening trial balance.",
      corrections:
        "Compare the amount actually paid with the amount recorded. If expense was understated, debit it for the difference; if overstated, credit it. A balanced entry can still have wrong amounts.",
    };
    html += `<div class="help"><b>A small nudge</b><p>${hints[s]}</p></div>`;
  }
  if (explanation && session.checked[s]) {
    const text =
      s === "journal"
        ? problem.entries
            .map(
              (e, i) =>
                `<li><b>Transaction ${i + 1}:</b> ${e.explanation}</li>`,
            )
            .join("")
        : s === "ledger"
          ? "<li>Asset, expense, and dividend balances usually remain debits. A credit reduces them; it does not automatically turn the entire balance into a credit balance.</li><li>Journal references point to account numbers; ledger references point back to journal pages. The two references serve different purposes.</li>"
          : s === "trial"
            ? "<li>A trial balance checks equality of debits and credits, but a balanced wrong account or a duplicated entry can still make it inaccurate.</li><li>Retained Earnings remains at its opening amount until closing; revenues, expenses, and dividends are still listed separately.</li>"
            : s === "results"
              ? "<li>Net income is earned revenue minus expenses, not cash receipts minus payments. Collecting a receivable and receiving unearned rent do not create new revenue.</li><li>Dividends are distributions to owners, not business expenses. Subtract them from net income to calculate the change in retained earnings.</li>"
              : `<li>${problem.correction?.explanation || "This problem has no correction scenario."}</li>`;
    html += `<details class="help" open><summary>Why it works</summary><ul>${text}</ul></details>`;
  }
  $("#help").innerHTML = html;
}
function setFeedback(t) {
  $("#feedback").textContent = t;
}
function check() {
  const s = session.section,
    result = validate(problem, session.work, s);
  feedbacks[s] = result;
  session.checked[s] = true;
  session.passed[s] = result.ok;
  recordCheck(stats, session, s, result);
  complete();
  persist();
  renderWork();
  setFeedback(
    result.ok
      ? `${NAMES[SECTIONS.indexOf(s)]} checks out. ${session.revealed[s]?.length ? "Includes revealed answers." : "Nicely done."}`
      : `${result.correct} of ${result.total} ${s === "journal" ? "entries" : "items"} correct. Your answers are kept; review the marked cells.`,
  );
}
function complete() {
  const sections = problem.correction ? SECTIONS : SECTIONS.slice(0, 4);
  if (!session.completed && sections.every((s) => session.passed[s])) {
    session.completed = true;
    stats.completed++;
    if (Object.values(session.revealed).some((v) => v.length)) stats.assisted++;
  }
}
async function confirmAction(title, text) {
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  const d = $("#confirm-dialog");
  d.showModal();
  return new Promise((resolve) =>
    d.addEventListener("close", () => resolve(d.returnValue === "confirm"), {
      once: true,
    }),
  );
}
function navigate(s) {
  session.section = s;
  hint = false;
  explanation = false;
  persist();
  renderWork();
  setFeedback(
    session.passed[s]
      ? "This section has checked out."
      : "Your work is saved. Continue whenever you’re ready.",
  );
  $("#workspace").focus();
}
$("#steps").addEventListener("click", (e) => {
  const b = e.target.closest("[data-step]");
  if (b) navigate(b.dataset.step);
});
$("#workspace").addEventListener("input", (e) => {
  const path = e.target.dataset.path;
  if (!path) return;
  set(path, e.target.value);
  session.passed[session.section] = false;
  delete feedbacks[session.section];
  document
    .querySelectorAll("#workspace .field-ok, #workspace .field-error")
    .forEach((n) => {
      n.classList.remove("field-ok", "field-error");
      n.removeAttribute("aria-invalid");
    });
  document
    .querySelectorAll("#workspace .error-label")
    .forEach((n) => n.remove());
  e.target.classList.remove("field-ok", "field-error");
  e.target.removeAttribute("aria-invalid");
  e.target.parentElement.querySelector(".error-label")?.remove();
  if (session.revealed[session.section]?.includes(path))
    e.target.classList.add("field-revealed");
  const tr = e.target.closest("tr");
  if (
    (tr && path.startsWith("journal.")) ||
    (tr && path.startsWith("correction.lines."))
  ) {
    const prefix = path.split(".").slice(0, -1).join("."),
      r = get(prefix);
    tr.querySelector(".account")?.classList.toggle(
      "credit-title",
      amount(r.credit) > 0 && !amount(r.debit),
    );
  }
  updateTotals();
  renderSteps();
  persist();
});
$("#workspace").addEventListener("focusout", (e) => {
  if (e.target.dataset.money)
    e.target.value =
      e.target.dataset.path.startsWith("results.") &&
      String(e.target.value).trim() !== "" &&
      amount(e.target.value) === 0
        ? "0"
        : formatted(e.target.value);
  if (e.target.getAttribute("list") === "accounts") {
    const id = accountId(e.target.value, problem.accounts),
      a = problem.accounts.find((a) => a.id === id);
    if (a) {
      set(e.target.dataset.path, id);
      e.target.value = a.name;
      persist();
    }
  }
});
$("#workspace").addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]"),
    remove = e.target.closest("[data-remove]");
  if (add) {
    const rows = get(add.dataset.add);
    if (rows.length >= 12) return;
    const row = blankLine();
    if (add.dataset.add.startsWith("journal"))
      row.date = problem.entries[Number(add.dataset.add.split(".")[1])].date;
    rows.push(row);
  } else if (remove) {
    const keys = remove.dataset.remove.split("."),
      i = Number(keys.pop());
    get(keys.join(".")).splice(i, 1);
  } else return;
  session.passed[session.section] = false;
  delete feedbacks[session.section];
  persist();
  renderWork();
});
$("#check").onclick = check;
$("#next").onclick = () =>
  navigate(SECTIONS[SECTIONS.indexOf(session.section) + 1]);
$("#hint").onclick = () => {
  hint = !hint;
  renderHelp();
};
$("#explain").onclick = () => {
  explanation = !explanation;
  renderHelp();
};
$("#reveal").onclick = async () => {
  if (
    !(await confirmAction(
      "Reveal this section?",
      "Answers you have not already checked correctly will be marked purple. This section will not count toward unassisted accuracy.",
    ))
  )
    return;
  const s = session.section,
    before = validate(problem, session.work, s),
    previous = structuredClone(session.work),
    oldRevealed = session.revealed[s] || [];
  answerSection(problem, session.work, s);
  const after = validate(problem, session.work, s);
  session.revealed[s] = Object.keys(after.cells).filter((path) => {
    const old = path.split(".").reduce((v, k) => v?.[k], previous),
      now = path.split(".").reduce((v, k) => v?.[k], session.work);
    const equal = path.endsWith(".account")
      ? accountId(old, problem.accounts) === accountId(now, problem.accounts)
      : /(debit|credit)$/.test(path) || path.startsWith("results.")
        ? amount(old) === amount(now)
        : String(old ?? "") === String(now ?? "");
    return oldRevealed.includes(path) || before.cells[path] !== "ok" || !equal;
  });
  session.checked[s] = true;
  feedbacks[s] = after;
  session.passed[s] = true;
  complete();
  persist();
  renderWork();
  setFeedback(
    "Answer key shown. Purple fields were revealed; green fields were already correct.",
  );
};
$("#difficulty").onchange = () => {
  $("#custom").hidden = $("#difficulty").value !== "custom";
  setFeedback("Press New problem to apply these settings.");
};
$("#new").onclick = async () => {
  if (
    !(await confirmAction(
      "Start a new problem?",
      "Your current answers will be replaced. Your statistics stay saved. Copy this Problem ID first if you want to return to the same exercise.",
    ))
  )
    return;
  start(chosenId());
  setFeedback("A fresh set of books. Start with the first transaction.");
};
$("#reset").onclick = async () => {
  if (
    !(await confirmAction(
      "Reset your answers?",
      "Clear the current problem’s work and start another attempt with the same transactions. Your earlier statistics stay saved.",
    ))
  )
    return;
  start(problem.id);
  setFeedback("Answers cleared. Same problem, fresh attempt.");
};
$("#copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(problem.id);
    setFeedback("Problem ID copied. It includes the difficulty and concepts.");
  } catch {
    $("#seed").focus();
    $("#seed").select();
    setFeedback("Select and copy the Problem ID using your keyboard.");
  }
};
$("#open-seed").onclick = async () => {
  let id;
  try {
    id = generate($("#seed").value).id;
  } catch (e) {
    setFeedback(e.message);
    return;
  }
  if (id === problem.id) {
    $("#seed").value = id;
    setFeedback(
      "This problem is already open. Use Reset problem for a fresh attempt.",
    );
    return;
  }
  if (
    await confirmAction(
      "Open this problem?",
      "Replace your current work with the problem for this ID?",
    )
  )
    start(id);
};
$("#seed").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#open-seed").click();
});
function showStats() {
  const missed = Object.entries(stats.missed).sort((a, b) => b[1] - a[1]);
  $("#stats-content").innerHTML =
    `<div class="stat-grid"><div><strong>${stats.attempted}</strong><small>attempted</small></div><div><strong>${stats.completed}</strong><small>completed</small></div><div><strong>${stats.assisted}</strong><small>with reveals</small></div></div><h3>First-check accuracy</h3><p class="muted"><small>Each section’s first unassisted check counts once per attempt. Rechecking does not inflate accuracy; revealed sections are excluded.</small></p><table class="stats-table"><tbody>${SECTIONS.map(
      (s) => {
        const a = stats.accuracy[s];
        return `<tr><td>${NAMES[SECTIONS.indexOf(s)]}</td><td>${a?.total ? `${Math.round((a.correct / a.total) * 100)}% · ${a.correct}/${a.total}` : "—"}</td></tr>`;
      },
    ).join(
      "",
    )}</tbody></table><h3 style="margin-top:22px">Concepts to revisit</h3>${
      missed.length
        ? `<ul>${missed
            .slice(0, 6)
            .map(
              ([k, v]) =>
                `<li>${escape(k)} <small>· ${v} missed items</small></li>`,
            )
            .join("")}</ul>`
        : '<p class="muted">Missed concepts will appear here after a check.</p>'
    }`;
}
$("#stats-button").onclick = () => {
  showStats();
  $("#stats-dialog").showModal();
};
$("#close-stats").onclick = () => $("#stats-dialog").close();
$("#reset-stats").onclick = async () => {
  if (
    await confirmAction(
      "Reset statistics?",
      "Clear your practice statistics. Your current answers will stay intact.",
    )
  ) {
    stats = freshStats();
    stats.attempted = 1;
    session.recorded = {};
    session.completed = false;
    complete();
    persist();
    showStats();
  }
};
if (session) render();
else start(encodeSeed("beginner", [], randomId()));
