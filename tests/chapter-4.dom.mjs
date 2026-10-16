// DOM integration without a browser or preview server. linkedom is a developer-only dependency.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  ACCOUNTS,
  generateCase,
  statements,
  closingEntries,
  conceptQuestion,
} from "../public/accounting-practice/chapter-4/engine.mjs";
const { parseHTML } = await import(process.env.LINKEDOM_MODULE || "linkedom");
const html = await readFile(
  new URL(
    "../public/accounting-practice/chapter-4/index.html",
    import.meta.url,
  ),
  "utf8",
);
const KEY = "little-tools:chapter-4:v1",
  data = new Map();
let document,
  window,
  load = 0;
const read = () => JSON.parse(data.get(KEY));
const query = (s) => {
  const el = document.querySelector(s);
  assert.ok(el, `Missing ${s}`);
  return el;
};
const click = (action, extra = "") => {
  const el = query(`[data-action="${action}"]${extra}`);
  assert.equal(el.disabled, false, `Disabled ${action}`);
  el.click();
};
const mode = (m) => click("mode", `[data-mode="${m}"]`);
function enter(el, value) {
  if (el.tagName === "SELECT") {
    for (const o of el.querySelectorAll("option")) {
      if (o.value === String(value)) o.setAttribute("selected", "");
      else o.removeAttribute("selected");
    }
  } else el.value = String(value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}
const field = (name, value) => enter(query(`[data-field="${name}"]`), value);
const change = (id, value) => {
  const el = query("#" + id);
  enter(el, value);
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
};
async function boot({ blocked = false, denied = false } = {}) {
  ({ window, document } = parseHTML(html));
  globalThis.window = window;
  globalThis.document = document;
  globalThis.confirm = () => true;
  globalThis.localStorage = {
    getItem: (k) => {
      if (denied) throw Error("denied");
      return data.get(k) || null;
    },
    setItem: (k, v) => {
      if (blocked) throw Error("quota");
      data.set(k, v);
    },
  };
  await import(
    pathToFileURL(
      new URL(
        "../public/accounting-practice/chapter-4/app.mjs",
        import.meta.url,
      ).pathname,
    ).href + `?dom=${load++}`
  );
}
function company(m = "cycle") {
  const s = read();
  return generateCase(`${s.seed}:${m}:${s.round[m]}`);
}
function journal(entry) {
  entry.lines.forEach((l, i) => {
    field(`account${i}`, l.account);
    field(`debit${i}`, l.amount > 0 ? l.amount : "");
    field(`credit${i}`, l.amount < 0 ? -l.amount : "");
  });
  click("check");
  assert.match(query(".feedback").textContent, /That’s it/);
}
function trial(b, ptb = false) {
  for (const [id, n] of Object.entries(b)) {
    if (!document.querySelector(`[data-field="amount-${id}"]`)) continue;
    if (ptb) field(`include-${id}`, n ? "yes" : "no");
    if (!ptb || n) {
      field(`amount-${id}`, Math.abs(n));
      if (n) field(`side-${id}`, n > 0 ? "debit" : "credit");
    }
  }
  click("check");
  assert.match(
    query(".feedback").textContent,
    /Every account and balance is correct/,
  );
}
const classes = {
  cash: "current",
  insurance: "current",
  equipment: "ppe",
  accumulated: "ppe",
  unearned: "currentLiability",
  note: "longTerm",
  retained: "equity",
};
function statement(c) {
  const vals = {
    ...Object.fromEntries(
      Object.entries(c.adjusted).map(([id, n]) => [id, Math.abs(n)]),
    ),
    ...statements(c),
  };
  for (const el of document.querySelectorAll("[data-field]")) {
    const key = el.dataset.field;
    if (key.startsWith("class-")) enter(el, classes[key.slice(6)]);
    else {
      assert.ok(key in vals, key);
      enter(el, vals[key]);
    }
  }
  click("check");
  assert.match(query(".feedback").textContent, /statement reconciles/);
}
await boot();
assert.equal(document.querySelectorAll(".cycle-step").length, 10);
assert.equal(document.querySelectorAll('a[target="_blank"]').length, 0);
mode("concepts");
let q = conceptQuestion(read().seed, 0),
  wrong = q.options.findIndex((o) => !o.correct),
  right = q.options.findIndex((o) => o.correct);
click("choose", `[data-index="${wrong}"]`);
assert.match(query(".feedback").textContent, /Not quite/);
click("choose", `[data-index="${right}"]`);
assert.match(query(".feedback").textContent, /Correct/);
assert.equal(read().stats.answered, 1);
assert.equal(read().stats.first, 0);
click("new");
q = conceptQuestion(read().seed, 1);
click("choose", `[data-index="${q.options.findIndex((o) => o.correct)}"]`);
assert.equal(read().stats.first, 1);
await boot();
assert.equal(read().mode, "concepts");
assert.match(query(".feedback").textContent, /Correct/);
mode("journal");
click("check");
assert.match(query(".feedback").textContent, /missing/);
const task = company("journal").adjustments[0];
field("account0", task.lines[0].account);
field("debit0", 50);
await boot();
assert.equal(query('[data-field="debit0"]').value, "50");
click("hint");
assert.match(query(".hint").textContent, /Hint 1/);
click("reveal");
assert.match(query(".feedback").textContent, /Completed with support/);
assert.match(query(".posted").textContent, /After/);
change("journal-kind", "closing");
change("method", "direct");
journal(closingEntries(company("journal"), "direct")[0]);
mode("statements");
click("carry-statement");
assert.ok(query('[data-field="fees"]').value);
assert.equal(query('[data-field="revenue"]').value, "");
for (let i = 0; i < 3; i++) {
  click("statement", `[data-index="${i}"]`);
  statement(company("statements"));
}
// Full unassisted cycles for both closing methods, including seeded loss cases.
for (const [method, sign] of [
  ["summary", 1],
  ["summary", -1],
  ["direct", -1],
]) {
  const saved = read();
  let i = 0;
  while (Math.sign(statements(generateCase(`flow${i}:cycle:0`)).net) !== sign)
    i++;
  saved.seed = `flow${i}`;
  saved.round.cycle = 0;
  saved.work = {};
  saved.concepts = {};
  saved.stage =
    saved.maxStage =
    saved.adjustment =
    saved.closing =
    saved.statement =
      0;
  data.set(KEY, JSON.stringify(saved));
  await boot();
  mode("cycle");
  click("reset-cycle");
  change("method", method);
  const c = company();
  assert.equal(query('[data-action="stage"][data-index="1"]').disabled, true);
  for (const entry of c.adjustments) {
    journal(entry);
    click("next");
  }
  assert.equal(read().stage, 1);
  click("carry");
  assert.equal(
    query('[data-field="amount-cash"]').value,
    String(c.before.cash),
  );
  assert.equal(query('[data-field="amount-supplies"]').value, "");
  trial(c.adjusted);
  click("next");
  assert.equal(read().stage, 2);
  // Completing balance sheet first must return to an unfinished statement.
  click("statement", '[data-index="2"]');
  statement(c);
  click("next-statement");
  assert.equal(read().stage, 2);
  assert.equal(read().statement, 0);
  statement(c);
  click("next-statement");
  statement(c);
  click("next-statement");
  click("next-statement");
  assert.equal(read().stage, 3);
  for (const entry of closingEntries(c, method)) {
    journal(entry);
    click("next");
  }
  assert.equal(read().stage, 4);
  trial(c.postClosing, true);
  click("next");
  assert.equal(read().stage, 5);
  assert.match(query(".complete").textContent, /Ready for a new month/);
  await boot();
  assert.equal(read().stage, 5);
  // Resetting a completed earlier stage invalidates its downstream work.
  click("stage", '[data-index="0"]');
  click("reset");
  assert.equal(read().maxStage, 0);
  assert.equal(read().closing, 0);
  assert.equal(
    Object.keys(read().work).some((k) => k.startsWith("cycle:close:")),
    false,
  );
}
// Wrong normal side and PTB classifications are rejected, even with correct amounts.
mode("cycle");
click("reset-cycle");
for (let i = 0; i < 4; i++) {
  click("reveal");
  click("next");
}
click("reveal");
click("next");
for (let i = 0; i < 3; i++) {
  click("reveal");
  click("next-statement");
}
while (read().stage === 3) {
  click("reveal");
  click("next");
}
field("include-fees", "yes");
field("amount-fees", 100);
field("side-fees", "credit");
click("check");
assert.match(
  query(".row-bad").textContent,
  /unchanged|temporary|beginning|starts/,
);
assert.equal(read().work["cycle:ptb"].done, false);
click("reveal");
assert.equal(query('[data-field="include-fees"]').value, "no");
click("next");
mode("journal");
const old = read().round.journal;
click("new");
assert.equal(read().round.journal, old + 1);
assert.equal(read().work["journal:entry"].done, false);
query("#theme").click();
assert.equal(document.documentElement.dataset.theme, "light");
query("#theme").click();
assert.equal(document.documentElement.dataset.theme, "dark");
await boot();
assert.equal(document.documentElement.dataset.theme, "dark");
// Invalid and unavailable storage must leave a working fresh tool.
data.set(KEY, '{"version":1,"mode":"bad"}');
await boot();
assert.match(query("#storage-notice").textContent, /fresh session/);
await boot({ blocked: true });
assert.match(query("#storage-notice").textContent, /could not be saved/);
mode("concepts");
click("choose", '[data-index="0"]');
assert.ok(query(".feedback"));
await boot({ denied: true });
assert.match(query("#storage-notice").textContent, /could not be read/);
console.log(
  "Chapter 4 DOM checks passed: all modes, journal feedback, source carry, all statements, both full cycles, gating, reset dependencies, reload, theme, corrupt/blocked storage.",
);
