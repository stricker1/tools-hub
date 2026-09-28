import test from "node:test";
import assert from "node:assert/strict";
import {
  generateMonth,
  ledger,
  totals,
  statements,
  reasoningOptions,
  effectOptions,
  detective,
  checkEntry,
  parseAmount,
  TOPICS,
} from "../public/accounting-practice/chapter-3/engine.mjs";

test("1,000 generated months balance and produce independently calculated financial statements", () => {
  for (let i = 0; i < 1000; i++) {
    const m = generateMonth("audit-" + i),
      v = m.v;
    const cash =
      v.stock +
      v.advance +
      v.cashRevenue -
      v.insurance -
      v.supplies -
      v.equipment -
      v.wages -
      v.rent;
    const revenue = v.cashRevenue + v.earnedAdvance + v.accruedRevenue;
    const expenses =
      v.wages +
      v.rent +
      (v.supplies - v.remaining) +
      v.monthlyInsurance +
      v.accruedWages +
      v.dep;
    const assets =
      cash +
      v.accruedRevenue +
      v.remaining +
      (v.insurance - v.monthlyInsurance) +
      v.equipment -
      v.dep;
    const liabilities = v.advance - v.earnedAdvance + v.accruedWages;
    assert.equal(m.adjusted.cash, cash);
    assert.equal(m.results.revenue, revenue);
    assert.equal(m.results.expenses, expenses);
    assert.equal(m.results.net, revenue - expenses);
    assert.equal(m.results.assets, assets);
    assert.equal(m.results.liabilities, liabilities);
    assert.equal(assets, liabilities + v.stock + revenue - expenses);
    assert.equal(m.adjusted.equipment, v.equipment);
    assert.equal(m.adjusted.depreciation, -v.dep);
    assert.equal(m.adjusted.supplies, v.remaining);
    assert.equal(m.adjusted.insurance, v.insurance - v.monthlyInsurance);
    assert.equal(totals(m.unadjusted).debit, totals(m.unadjusted).credit);
    assert.equal(totals(m.adjusted).debit, totals(m.adjusted).credit);
    for (let j = 1; j <= m.transactions.length; j++)
      assert.ok(
        ledger(m.transactions.slice(0, j)).cash >= 0,
        "No accidental overdraft",
      );
    for (const a of m.adjustments) {
      assert.equal(
        a.lines.reduce((s, l) => s + l.amount, 0),
        0,
      );
      assert.ok(a.amount > 0);
      assert.ok(!a.lines.some((l) => l.account === "cash"));
      assert.equal(a.amount, Math.round(a.amount));
      for (const opts of [
        reasoningOptions(a, "options" + i),
        effectOptions(a, "effects" + i),
      ]) {
        assert.equal(opts.filter((o) => o.correct).length, 1);
        assert.equal(new Set(opts.map((o) => o.text)).size, opts.length);
      }
    }
  }
});
test("omission errors follow accounting effects and keep the trial balance equal", () => {
  const m = generateMonth("omissions");
  for (const a of m.adjustments) {
    const omitted = ledger([
        ...m.transactions,
        ...m.adjustments.filter((x) => x !== a),
      ]),
      result = statements(omitted);
    assert.equal(totals(omitted).debit, totals(omitted).credit);
    const revenueAdjustment = ["revenue", "unearned"].includes(a.topic);
    assert.equal(
      result.net - m.results.net,
      revenueAdjustment ? -a.amount : a.amount,
    );
  }
});
test("entry checking distinguishes missing, reversed, cash, unbalanced, wrong amount, and correct entries", () => {
  const a = generateMonth("checks").adjustments[0];
  assert.equal(checkEntry(a, {}).ok, false);
  assert.match(
    checkEntry(a, { debit: a.credit, credit: a.debit }).text,
    /reversed/,
  );
  assert.match(
    checkEntry(a, { debit: a.debit, credit: "cash" }).text,
    /Cash does not/,
  );
  const w = {
    debit: a.debit,
    credit: a.credit,
    debitAmount: String(a.amount),
    creditAmount: String(a.amount),
  };
  assert.ok(checkEntry(a, w).ok);
  assert.ok(!checkEntry(a, { ...w, creditAmount: String(a.amount + 50) }).ok);
  assert.ok(!checkEntry(a, { ...w, debitAmount: "", creditAmount: "" }).ok);
});
test("detective questions have exactly one answer and do not repeat choice text", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++)
    for (const filter of ["mixed", ...Object.keys(TOPICS)]) {
      const q = detective("q-" + i, filter);
      seen.add(q.title);
      assert.equal(q.options.filter((o) => o.correct).length, 1);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map((o) => o.text)).size, 4);
      assert.ok(q.options.every((o) => o.why.length > 30));
    }
  assert.equal(seen.size, 6);
});
test("seeds reproduce cases while new seeds vary values; blank answers are not zero", () => {
  assert.deepEqual(generateMonth("same"), generateMonth("same"));
  assert.notDeepEqual(generateMonth("same").v, generateMonth("different").v);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("$1,200"), 1200);
  assert.equal(parseAmount("-250"), -250);
  assert.equal(parseAmount("0"), 0);
});
