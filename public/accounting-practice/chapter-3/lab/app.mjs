import {
  ACCOUNTS,
  TOPICS,
  ROLES,
  name,
  money,
  parseAmount,
  totals,
  balanceText,
  generateCase,
  wordingQuestion,
  checkJournal,
  rowExplanation,
  conceptQuestion,
} from "./engine.mjs";

const KEY = "little-tools:chapter-3:lab:v1";
const modes = {
  words: "01 · Read the wording",
  rebuild: "02 · Rebuild seven entries",
  trial: "03 · Adjust the balances",
  concepts: "04 · Concept checks",
};
const fresh = () => ({
  version: 1,
  seed: String(Date.now()),
  mode: "words",
  filter: "all",
  round: 0,
  caseRound: 0,
  caseIndex: 0,
  conceptRound: 0,
  changedOnly: true,
  work: {},
  stats: { first: 0, practiced: 0, revealed: 0 },
});
let state = fresh(),
  storageMessage = "";
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) {
    const valid =
      saved.version === 1 &&
      typeof saved.seed === "string" &&
      saved.seed.length < 100 &&
      Object.hasOwn(modes, saved.mode) &&
      (saved.filter === "all" || Object.hasOwn(TOPICS, saved.filter)) &&
      [saved.round, saved.caseRound, saved.caseIndex, saved.conceptRound].every(
        (n) => Number.isSafeInteger(n) && n >= 0 && n < 1e7,
      ) &&
      saved.caseIndex < 7 &&
      typeof saved.changedOnly === "boolean" &&
      saved.work &&
      typeof saved.work === "object" &&
      !Array.isArray(saved.work) &&
      Object.values(saved.work).every(
        (w) =>
          w &&
          typeof w === "object" &&
          w.draft &&
          typeof w.draft === "object" &&
          !Array.isArray(w.draft),
      ) &&
      saved.stats &&
      [saved.stats.first, saved.stats.practiced, saved.stats.revealed].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      );
    if (valid) state = saved;
    else
      storageMessage =
        "Saved practice could not be read. A fresh session is ready.";
  }
} catch {
  storageMessage =
    "Browser storage is unavailable or could not be read. You can still practice here; progress may not survive a refresh.";
}
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const workspace = document.querySelector("#workspace");
function save() {
  // Keep only reachable worksheets; lifetime totals remain separate.
  for (const key of Object.keys(state.work)) {
    if (
      key !== wordKey() &&
      key !== conceptKey() &&
      !key.startsWith(`entry:${state.caseRound}:`) &&
      !key.startsWith(`row:${state.caseRound}:`)
    )
      delete state.work[key];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    storageMessage =
      "Progress could not be saved in this browser. You can keep practicing in this tab.";
    notice();
  }
}
function notice() {
  const node = document.querySelector("#storage-notice");
  node.hidden = !storageMessage;
  node.textContent = storageMessage;
}
const books = () => generateCase(`${state.seed}:case:${state.caseRound}`);
const words = () =>
  wordingQuestion(`${state.seed}:words:${state.round}`, state.filter);
const concept = () => conceptQuestion(state.seed, state.conceptRound);
const wordKey = () => `word:${state.round}:${state.filter}`;
const entryKey = (index) => `entry:${state.caseRound}:${index}`;
const rowKey = (id) => `row:${state.caseRound}:${id}`;
const conceptKey = () => `concept:${state.conceptRound}`;
function work(key) {
  return (state.work[key] ||= {
    draft: {},
    attempts: 0,
    hinted: false,
    done: false,
    revealed: false,
  });
}
function current() {
  if (state.mode === "words") return { key: wordKey(), question: words() };
  if (state.mode === "rebuild")
    return {
      key: entryKey(state.caseIndex),
      question: books().adjustments[state.caseIndex],
    };
  return { key: conceptKey(), question: concept() };
}
function finish(w, revealed = false) {
  if (w.done) return;
  w.done = true;
  w.revealed = revealed;
  if (revealed) state.stats.revealed++;
  else if (w.attempts === 1 && !w.hinted) state.stats.first++;
  else state.stats.practiced++;
}
function feedback(w) {
  return w.result
    ? `<div class="feedback ${w.result.ok ? "" : "wrong"}" role="status"><strong>${w.done ? (w.revealed ? "Worked answer" : "You’ve got it.") : "Keep going."}</strong><p>${escape(w.result.text)}</p></div>`
    : "";
}
const button = (action, label, extra = "") =>
  `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
function progress() {
  const s = state.stats;
  document.querySelector("#progress-summary").textContent =
    `${s.first} first try · ${s.practiced} with practice · ${s.revealed} revealed`;
}
function render(focus = false) {
  document.querySelector("#modes").innerHTML = Object.entries(modes)
    .map(([id, label]) =>
      button(
        "mode",
        label,
        `data-mode="${id}" ${state.mode === id ? 'aria-current="page"' : ""}`,
      ),
    )
    .join("");
  workspace.innerHTML =
    state.mode === "words"
      ? renderWords()
      : state.mode === "rebuild"
        ? renderRebuild()
        : state.mode === "trial"
          ? renderTrial()
          : renderConcept();
  notice();
  progress();
  save();
  if (focus) workspace.focus({ preventScroll: true });
}
function accountOptions(value) {
  return (
    `<option value="">Choose an account…</option>` +
    Object.entries(ACCOUNTS)
      .map(
        ([id, [label, type]]) =>
          `<option value="${id}" ${value === id ? "selected" : ""}>${escape(label)} (${type})</option>`,
      )
      .join("")
  );
}
function journalForm(key, q, w, includeRole = false) {
  return `<form data-form="journal" data-key="${key}" novalidate>
    <fieldset ${w.done ? "disabled" : ""}>
      ${
        includeRole
          ? `<legend class="question-legend">1. What is the number in the clue telling you?</legend><div class="role-choices">${Object.entries(
              ROLES,
            )
              .map(
                ([id, label]) =>
                  `<label><input type="radio" name="role" data-key="${key}" data-field="role" value="${id}" ${w.draft.role === id ? "checked" : ""} /> <span>${label}</span></label>`,
              )
              .join("")}</div><h3>2. Record the adjustment</h3>`
          : '<legend class="question-legend">Record the adjustment</legend>'
      }
      <div class="journal-fields">
        <label>Debit account<select data-key="${key}" data-field="debit">${accountOptions(w.draft.debit)}</select></label>
        <label>Credit account<select data-key="${key}" data-field="credit">${accountOptions(w.draft.credit)}</select></label>
        <label>Amount on each side<input inputmode="decimal" autocomplete="off" placeholder="$0" data-key="${key}" data-field="amount" value="${escape(w.draft.amount)}" /></label>
      </div>
      <button class="primary" type="submit">Check entry</button>
    </fieldset>
  </form>
  ${feedback(w)}
  ${w.hinted && !w.done ? `<div class="hint"><strong>Think it through</strong><p>${escape(includeRole ? q.hint : reverseHint(q))}</p></div>` : ""}
  ${w.done ? answer(q) : `<div class="actions">${button("hint", "Give me a hint")}${button("reveal", "Walk me through it")}</div>`}`;
}
function answer(q) {
  const before = q.before || books().before;
  const after = {
    [q.debit]: before[q.debit] + q.amount,
    [q.credit]: before[q.credit] - q.amount,
  };
  return `<section class="worked"><p class="eyebrow">Why this entry works</p><p>${escape(q.calculation)}</p><div class="mini-entry"><div><span>Dr ${escape(name(q.debit))}</span><strong>${money(q.amount)}</strong></div><div><span>Cr ${escape(name(q.credit))}</span><strong>${money(q.amount)}</strong></div></div><p class="eyebrow after-label">After posting this entry</p>${[q.debit, q.credit].map((id) => `<div class="balance-row"><span>${escape(name(id))}<span class="balance-before">Before: ${balanceText(before[id])}</span></span><b>${balanceText(after[id])}</b></div>`).join("")}</section>`;
}
function reverseHint(q) {
  const c = books();
  return `Compare ${name(q.target)}: ${balanceText(c.before[q.target])} before → ${balanceText(c.after[q.target])} after. Find the difference, then find the matching change in another account. Is the balance increasing or decreasing?`;
}
function balanceRows(before, ids) {
  return ids
    .map(
      (id) =>
        `<div class="balance-row"><span>${escape(name(id))}</span><b>${balanceText(before[id])}</b></div>`,
    )
    .join("");
}
function renderWords() {
  const q = words(),
    key = wordKey(),
    w = work(key);
  return `<div class="toolbar"><label class="field">Practice a topic<select id="topic-filter"><option value="all">Mix all topics</option>${Object.entries(
    TOPICS,
  )
    .map(
      ([id, label]) =>
        `<option value="${id}" ${state.filter === id ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></label><span class="spacer"></span>${button("next-word", "New wording & numbers ↻")}</div>
    <div class="layout"><section class="panel"><div class="question-top"><span class="tag">${TOPICS[q.topic]}</span><span class="small muted">Question ${state.round + 1}</span></div><h2>What is the number’s job?</h2><blockquote class="textbook">${escape(q.clue)}</blockquote><p class="small muted">Prepare the December 31 adjustment. All other transactions are recorded. ${q.topic === "unearned" ? "You are the landlord; the tenant paid in advance." : ""}</p>${journalForm(key, q, w, true)}${w.done ? `<div class="actions">${button("next-word", "Try another →", 'class="primary"')}</div>` : ""}</section>
    <aside class="notebook"><p class="eyebrow">Before adjusting</p><h3>Relevant recorded balances</h3>${balanceRows(q.before, [...new Set([q.target, q.debit, q.credit])])}<hr /><h3>Translate before calculating</h3><ol class="reading-steps"><li>What has happened by the date?</li><li>Is the figure a balance left over, or a change to record?</li><li>Which two accounts change?</li><li>Which side makes each change?</li></ol><p class="small">Read the whole phrase. “Expired” and “unexpired” give the number different jobs.</p><details><summary>Account direction reference</summary>${directionGuide()}</details></aside></div>`;
}
function directionGuide() {
  return `<dl class="direction-guide"><dt>Assets & expenses</dt><dd>Increase: debit · Decrease: credit</dd><dt>Liabilities, equity & revenue</dt><dd>Increase: credit · Decrease: debit</dd><dt>Accumulated depreciation</dt><dd>Contra asset. Increase: credit. It reduces book value; the asset’s recorded cost stays put.</dd></dl>`;
}
function caseToolbar(c) {
  return `<div class="case-heading"><div><p class="eyebrow">Shared case ${state.caseRound + 1} · Seven adjustments</p><h2>${c.company}</h2><p class="case-meta">${c.date} · Year-end · Before closing entries</p></div>${button("new-case", "New company & numbers ↻")}</div><p class="small muted">“Rebuild seven entries” and “Adjust the balances” use these same books. A new case replaces both worksheets; completed practice totals stay saved.</p>`;
}
function renderRebuild() {
  const c = books(),
    q = c.adjustments[state.caseIndex],
    key = entryKey(state.caseIndex),
    w = work(key);
  const completed = c.adjustments.filter(
    (_, i) => work(entryKey(i)).done,
  ).length;
  return `${caseToolbar(c)}<div class="entry-nav" aria-label="Choose adjusting entry">${c.adjustments.map((a, i) => button("entry", `${i + 1}. ${escape(name(a.target))}${work(entryKey(i)).done ? " ✓" : ""}`, `data-index="${i}" ${i === state.caseIndex ? 'aria-current="step"' : ""}`)).join("")}</div>
    <div class="layout reverse-layout"><section class="panel"><span class="tag">${completed} of 7 entries completed</span><h2>Find the missing entry</h2><p>Journalize the seven entries that adjusted the accounts at December 31. <strong>None of the accounts was affected by more than one adjusting entry.</strong></p><p class="focus-account">Start with <strong>${escape(name(q.target))}</strong>.</p><p class="small muted">Use the before-and-after balances in the reference table. The second account must change by the same amount on the opposite side.</p>${journalForm(key, q, w)}${w.done ? `<div class="actions">${state.caseIndex < 6 ? button("next-entry", "Next entry →", 'class="primary"') : button("go-trial", "Practice the adjusted balances →", 'class="primary"')}</div>` : ""}</section>
    <aside class="panel reference"><p class="eyebrow">Your evidence</p><h3>Unadjusted → adjusted</h3><p class="small muted">Every balance includes its debit or credit side. Rows without a change are included, just like a full worksheet.</p><div class="table-wrap" tabindex="0" aria-label="Before and after trial balance, scroll horizontally"><table><thead><tr><th scope="col">Account</th><th scope="col" class="num">Before</th><th scope="col" class="num">After</th></tr></thead><tbody>${Object.keys(
      ACCOUNTS,
    )
      .map(
        (id) =>
          `<tr class="${id === q.target ? "target-row" : ""}"><th scope="row">${escape(name(id))}${id === q.target ? '<span class="small"> ← start here</span>' : ""}</th><td class="num">${balanceText(c.before[id])}</td><td class="num">${balanceText(c.after[id])}</td></tr>`,
      )
      .join(
        "",
      )}</tbody><tfoot><tr><th>Debit totals</th><td class="num">${money(totals(c.before).debit)}</td><td class="num">${money(totals(c.after).debit)}</td></tr><tr><th>Credit totals</th><td class="num">${money(totals(c.before).credit)}</td><td class="num">${money(totals(c.after).credit)}</td></tr></tfoot></table></div></aside></div>`;
}
function rowFields(c, id) {
  const key = rowKey(id),
    w = work(key),
    disabled = w.done ? "disabled" : "";
  return `<div class="balance-input"><label class="sr-only" for="amount-${id}">${escape(name(id))} adjusted amount</label><input id="amount-${id}" inputmode="decimal" autocomplete="off" placeholder="Amount" data-key="${key}" data-field="amount" value="${escape(w.draft.amount)}" ${disabled} /><label class="sr-only" for="side-${id}">${escape(name(id))} adjusted side</label><select id="side-${id}" data-key="${key}" data-field="side" ${disabled}><option value="">Side…</option><option value="debit" ${w.draft.side === "debit" ? "selected" : ""}>Dr</option><option value="credit" ${w.draft.side === "credit" ? "selected" : ""}>Cr</option><option value="zero" ${w.draft.side === "zero" ? "selected" : ""}>Zero</option></select></div>`;
}
function enteredTotals() {
  let debit = 0,
    credit = 0,
    entered = 0;
  for (const id of Object.keys(ACCOUNTS)) {
    const d = work(rowKey(id)).draft,
      n = parseAmount(d.amount);
    if (n !== null && n >= 0 && ["debit", "credit", "zero"].includes(d.side)) {
      entered++;
      if (d.side === "debit") debit += n;
      if (d.side === "credit") credit += n;
    }
  }
  return { debit, credit, entered };
}
function renderTrial() {
  const c = books(),
    all = Object.keys(ACCOUNTS),
    ids = all.filter(
      (id) => !state.changedOnly || c.before[id] !== c.after[id],
    );
  const complete = all.filter((id) => work(rowKey(id)).done).length;
  const {
    debit: enteredDebit,
    credit: enteredCredit,
    entered,
  } = enteredTotals();
  return `${caseToolbar(c)}<div class="trial-intro"><div><h2>Move the change into the balance.</h2><p>The entry tells you what changed. The adjusted trial balance shows what remains in each account after posting all seven entries.</p></div><div class="rule-note"><strong>Same side? Add.</strong><br />Opposite sides? Subtract.<br />Keep the side of the larger total.</div></div>
    <details class="adjustment-reference" open><summary>Reference: the seven correct adjusting entries</summary><p class="small muted">These entries are supplied so you can focus on posting. Use “Rebuild seven entries” to practice deriving them yourself.</p><div class="adjustment-grid">${c.adjustments.map((a, i) => `<div><span class="eyebrow">Entry ${i + 1}</span><p>Dr ${escape(name(a.debit))}<br />Cr ${escape(name(a.credit))}<br /><strong>${money(a.amount)} each</strong></p></div>`).join("")}</div></details>
    <div class="toolbar"><label class="checkbox-label"><input type="checkbox" id="changed-only" ${state.changedOnly ? "checked" : ""} /> Focus on changed accounts</label>${button("fill-unchanged", "Fill unchanged rows")}${button("check-rows", "Check my balances", 'class="primary"')}<span class="spacer"></span><span class="small muted">${complete}/${all.length} rows complete</span></div>
    <p class="small muted">Enter positive amounts and select the ending side. For a zero balance, enter 0 and select Zero. Unchanged rows can be filled automatically; they don’t count toward practice statistics.</p>
    <div class="panel trial-panel"><div class="table-wrap" tabindex="0" aria-label="Adjusted trial balance worksheet, scroll horizontally"><table class="trial-table"><thead><tr><th scope="col">Account</th><th scope="col" class="num">Unadjusted</th><th scope="col">Your adjusted balance</th><th scope="col">Check & explanation</th></tr></thead><tbody>${ids
      .map((id) => {
        const w = work(rowKey(id));
        return `<tr data-row="${id}" class="${w.done ? "row-good" : w.result && !w.result.ok ? "row-bad" : ""}"><th scope="row">${escape(name(id))}<span class="account-type">${ACCOUNTS[id][1]}</span></th><td class="num">${balanceText(c.before[id])}</td><td>${rowFields(c, id)}</td><td class="row-action">${w.done ? `<span class="small">${w.revealed ? "Worked answer" : w.auto ? "Carried forward" : "✓ Correct"}</span>` : button("check-row", "Check", `data-id="${id}"`)}${w.result ? `<p class="row-feedback" role="status">${escape(w.result.text)}</p>` : ""}<details data-row-help="${id}" ${w.hinted ? "open" : ""}><summary>${w.done ? "Why this balance?" : "Walk me through this row"}</summary><p>${escape(rowExplanation(c, id))}</p>${!w.done ? button("reveal-row", "Use this balance", `data-id="${id}"`) : ""}</details></td></tr>`;
      })
      .join("")}</tbody></table></div></div>
    <div class="totals-strip"><div><span class="small-label">Your debit total</span><strong id="entered-debit">${money(enteredDebit)}</strong></div><div><span class="small-label">Your credit total</span><strong id="entered-credit">${money(enteredCredit)}</strong></div><div><span class="small-label">Worksheet status</span><strong id="entered-status">${complete === all.length ? "All balances correct ✓" : `${entered}/${all.length} rows filled`}</strong><span class="small">${complete === all.length ? "The full adjusted trial balance is ready." : "Totals include hidden rows. Equal totals alone do not prove accuracy."}</span></div></div>
    <p class="small muted">If only changed accounts are visible, use “Fill unchanged rows” to complete the full totals without copying them by hand. Retained Earnings stays at its opening balance here; closing entries come later.</p>`;
}
function renderConcept() {
  const q = concept(),
    key = conceptKey(),
    w = work(key);
  return `<div class="toolbar"><span class="tag">Understand the reason</span><span class="spacer"></span>${button("next-concept", "New concept check ↻")}</div><div class="layout"><section class="panel"><span class="eyebrow">Concept check ${state.conceptRound + 1}</span><h2>${q.title}</h2><p class="scenario">${escape(q.prompt)}</p><div class="choices">${q.options.map((o, i) => button("choose", `<span class="letter">${String.fromCharCode(65 + i)}</span><span>${escape(o.text)}${w.done && o.correct ? " ✓" : ""}</span>`, `data-index="${i}" class="choice ${w.done && o.correct ? "correct" : w.draft.choice === i && !o.correct ? "incorrect" : ""}" ${w.done ? "disabled" : ""}`)).join("")}</div>${feedback(w)}${w.done ? `<details class="option-explanations"><summary>Explain every option</summary>${q.options.map((o, i) => `<p><strong>${String.fromCharCode(65 + i)} · ${o.correct ? "Correct" : "Not quite"}</strong><br />${escape(o.why)}</p>`).join("")}</details><div class="actions">${button("next-concept", "Next concept →", 'class="primary"')}</div>` : button("reveal", "Explain the answer")}</section><aside class="notebook"><p class="eyebrow">A little less memorizing</p><h3>Ask what happened.</h3><p>Work can happen before or after cash changes hands. An adjustment brings the books up to date with what has actually been earned, used, or owed.</p><div class="timing-note"><span>PAST</span><strong>What already happened?</strong><span>AT THE REPORTING DATE</span><strong>What belongs in these books?</strong><span>LATER</span><strong>What is still to be paid or provided?</strong></div><hr /><p class="small">Each set covers 16 concepts in a shuffled order. Numbers and answer positions change. Wrong answers have their own explanations, and you can keep trying.</p><p class="small">First-try answers, practice after a mistake or hint, and revealed answers are counted separately. Progress saves in this browser.</p></aside></div>`;
}
function clearResultOnEdit(key) {
  const w = work(key);
  if (!w.done) w.result = null;
}
document.addEventListener("input", (event) => {
  const el = event.target;
  if (!el.dataset.field) return;
  work(el.dataset.key).draft[el.dataset.field] = el.value;
  clearResultOnEdit(el.dataset.key);
  save();
  if (state.mode === "trial") {
    const t = enteredTotals();
    document.querySelector("#entered-debit").textContent = money(t.debit);
    document.querySelector("#entered-credit").textContent = money(t.credit);
    document.querySelector("#entered-status").textContent =
      `${t.entered}/${Object.keys(ACCOUNTS).length} rows filled`;
  }
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.id === "topic-filter") {
    state.filter = el.value;
    state.round++;
    render();
  }
  if (el.id === "changed-only") {
    state.changedOnly = el.checked;
    render();
  }
});
// A walkthrough is assistance even when the learner types the answer themselves.
workspace.addEventListener(
  "toggle",
  (event) => {
    const id = event.target.dataset.rowHelp;
    if (id && event.target.open) {
      work(rowKey(id)).hinted = true;
      save();
    }
  },
  true,
);
document.addEventListener("submit", (event) => {
  if (event.target.dataset.form !== "journal") return;
  event.preventDefault();
  const { key, question: q } = current(),
    w = work(key);
  if (w.done) return;
  if (state.mode === "words" && !w.draft.role)
    w.result = {
      ok: false,
      text: "First choose whether the clue gives a remaining balance or a change to record.",
    };
  else if (state.mode === "words" && w.draft.role !== q.role) {
    w.attempts++;
    w.result = { ok: false, text: `Read the phrase again. ${q.hint}` };
  } else {
    w.result = checkJournal(q, w.draft);
    if (!w.result.incomplete) w.attempts++;
    if (w.result.ok) finish(w);
  }
  render();
});
function checkRow(id) {
  const c = books(),
    w = work(rowKey(id));
  if (w.done) return;
  const n = parseAmount(w.draft.amount),
    side = c.after[id] === 0 ? "zero" : c.after[id] > 0 ? "debit" : "credit";
  if (n === null || n < 0 || !w.draft.side) {
    w.result = {
      ok: false,
      text: "Enter a nonnegative amount and choose its ending side.",
    };
    return;
  }
  w.attempts++;
  if (n === Math.abs(c.after[id]) && w.draft.side === side) {
    w.result = { ok: true, text: "The amount and ending side are correct." };
    finish(w);
  } else if (n === Math.abs(c.after[id]))
    w.result = {
      ok: false,
      text: "The amount is right. Recheck the ending side: the adjustment's side is not necessarily the remaining balance's side.",
    };
  else
    w.result = {
      ok: false,
      text: "Recheck how the entry combines with the opening balance. Same side: add. Opposite sides: subtract. The row walkthrough can help.",
    };
}
function setRow(c, id, auto = false) {
  const w = work(rowKey(id));
  if (w.done) return;
  w.draft = {
    amount: String(Math.abs(c.after[id])),
    side: c.after[id] === 0 ? "zero" : c.after[id] > 0 ? "debit" : "credit",
  };
  if (auto) {
    w.done = true;
    w.auto = true;
  } else finish(w, true);
  w.result = {
    ok: true,
    text: auto
      ? "No adjustment: original balance carried forward."
      : rowExplanation(c, id),
  };
}
document.addEventListener("click", (event) => {
  const el = event.target.closest("button[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "mode") {
    state.mode = el.dataset.mode;
    render(true);
    return;
  }
  if (action === "next-word") {
    state.round++;
    render(true);
    return;
  }
  if (action === "next-concept") {
    state.conceptRound++;
    render(true);
    return;
  }
  if (action === "new-case") {
    state.caseRound++;
    state.caseIndex = 0;
    render(true);
    return;
  }
  if (action === "entry") {
    state.caseIndex = Number(el.dataset.index);
    render();
    return;
  }
  if (action === "next-entry") {
    state.caseIndex = Math.min(6, state.caseIndex + 1);
    render(true);
    return;
  }
  if (action === "go-trial") {
    state.mode = "trial";
    render(true);
    return;
  }
  if (action === "fill-unchanged") {
    const c = books();
    for (const id of Object.keys(ACCOUNTS))
      if (c.before[id] === c.after[id]) setRow(c, id, true);
    render();
    return;
  }
  if (action === "check-row") {
    checkRow(el.dataset.id);
    render();
    return;
  }
  if (action === "check-rows") {
    const c = books();
    for (const id of Object.keys(ACCOUNTS))
      if (!state.changedOnly || c.before[id] !== c.after[id]) checkRow(id);
    render();
    return;
  }
  if (action === "reveal-row") {
    setRow(books(), el.dataset.id);
    render();
    return;
  }
  const { key, question: q } = current(),
    w = work(key);
  if (w.done) return;
  if (action === "hint") {
    w.hinted = true;
  }
  if (action === "choose") {
    const i = Number(el.dataset.index),
      option = q.options[i];
    w.draft.choice = i;
    w.attempts++;
    w.result = { ok: option.correct, text: option.why };
    if (option.correct) finish(w);
  }
  if (action === "reveal") {
    finish(w, true);
    if (state.mode === "concepts") {
      const option = q.options.find((o) => o.correct);
      w.result = { ok: true, text: option.why };
    } else {
      w.draft = {
        role: q.role,
        debit: q.debit,
        credit: q.credit,
        amount: String(q.amount),
      };
      w.result = { ok: true, text: q.why };
    }
  }
  render();
});
render();
