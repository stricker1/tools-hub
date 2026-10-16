import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNTS,
  CONCEPTS,
  temporary,
  generateCase,
  verifyCase,
  statements,
  closingEntries,
  checkJournal,
  conceptQuestion,
  parseMoney,
  balanceWhy,
} from "../public/accounting-practice/chapter-4/engine.mjs";

const replay = (b, entries) => {
  const result = { ...b };
  for (const e of entries) {
    assert.equal(
      e.lines.reduce((s, l) => s + l.amount, 0),
      0,
    );
    for (const l of e.lines) result[l.account] += l.amount;
  }
  return result;
};
test("2,000 seeded companies independently reconcile opening, adjustments, statements and both closing methods", () => {
  const outcomes = new Set(),
    adjustments = new Set(),
    issues = new Set();
  for (let i = 0; i < 2000; i++) {
    const c = generateCase(`verify-${i}`),
      b = c.adjusted,
      s = statements(c);
    assert.deepEqual(c, generateCase(`verify-${i}`));
    assert.deepEqual(replay(c.opening, c.transactions), c.before);
    assert.deepEqual(replay(c.before, c.adjustments), b);
    for (const balances of [c.opening, c.before, b, c.postClosing]) {
      assert.equal(
        Object.values(balances).reduce((s, n) => s + n, 0),
        0,
      );
      assert.ok(
        Object.values(balances).every(
          (n) => Number.isInteger(n) && n % 50 === 0 && Math.abs(n) < 10000,
        ),
      );
      for (const id of [
        "cash",
        "receivable",
        "supplies",
        "insurance",
        "equipment",
      ])
        assert.ok(balances[id] >= 0);
      assert.ok(balances.equipment + balances.accumulated > 0);
    }
    for (const a of c.adjustments) adjustments.add(a.id);
    assert.equal(c.adjustments.length, 4);
    assert.equal(b.retained, c.opening.retained);
    assert.equal(b.equipment, c.opening.equipment);
    const revenue = -b.fees - b.rentRevenue;
    const expense =
      b.wages +
      b.rent +
      b.suppliesExpense +
      b.insuranceExpense +
      b.depreciationExpense;
    const retained = -c.opening.retained + revenue - expense - b.dividends;
    const assets =
      b.cash +
      b.receivable +
      b.supplies +
      b.insurance +
      b.equipment +
      b.accumulated;
    const liabilities = -b.payable - b.wagesPayable - b.unearned - b.note;
    assert.equal(s.net, revenue - expense);
    assert.equal(s.retained, retained);
    assert.equal(s.assets, assets);
    assert.equal(assets, liabilities - b.stock + retained);
    assert.equal(s.issued, c.issued);
    outcomes.add(Math.sign(s.net));
    issues.add(c.issued);
    for (const method of ["summary", "direct"]) {
      const entries = closingEntries(c, method),
        after = replay(b, entries);
      assert.deepEqual(after, c.postClosing);
      for (const id of Object.keys(ACCOUNTS)) {
        if (temporary(id)) assert.equal(after[id], 0);
        else if (id === "retained") assert.equal(after[id], -retained || 0);
        else assert.equal(after[id], b[id]);
      }
      for (const entry of entries) {
        const rows = entry.lines.map((l) => ({
          account: l.account,
          debit: l.amount > 0 ? l.amount : "",
          credit: l.amount < 0 ? -l.amount : "",
        }));
        assert.ok(
          checkJournal(entry, rows.reverse()).ok,
          "Journal order is not graded",
        );
        rows[0].account = "cash";
        assert.equal(
          checkJournal(entry, rows).ok,
          false,
          "Balanced but wrong account must fail",
        );
      }
    }
  }
  assert.ok(outcomes.has(-1) && outcomes.has(1));
  assert.equal(adjustments.size, 6);
  assert.equal(issues.size, 3);
});
test("zero income skips the unnecessary Income Summary transfer and retained earnings deficits remain debits", () => {
  const c = generateCase("break-even");
  const net = statements(c).net;
  c.adjusted.fees += net;
  c.adjusted.cash -= net;
  c.postClosing = replay(c.adjusted, closingEntries(c));
  assert.equal(statements(c).net, 0);
  assert.equal(
    closingEntries(c).some((e) => e.id === "summary"),
    false,
  );
  assert.deepEqual(
    replay(c.adjusted, closingEntries(c, "direct")),
    c.postClosing,
  );
  let deficit;
  for (let i = 0; i < 1000 && !deficit; i++) {
    const d = generateCase(`deficit${i}`);
    if (d.postClosing.retained > 0) deficit = d;
  }
  assert.ok(deficit);
  assert.ok(statements(deficit).retained < 0);
});
test("verifier rejects balanced but inconsistent data", () => {
  const c = generateCase("damage");
  c.adjusted.cash += 50;
  c.adjusted.stock -= 50;
  assert.throws(() => verifyCase(c), /mismatch/);
});
test("journal validation detects missing accounts, reversed sides, wrong amounts and invalid input", () => {
  const c = generateCase("validation"),
    e = c.adjustments.find((e) => e.id === "supplies");
  const rows = e.lines.map((l) => ({
    account: l.account,
    debit: l.amount > 0 ? l.amount : "",
    credit: l.amount < 0 ? -l.amount : "",
  }));
  assert.ok(
    checkJournal(e, [...rows, { account: "", debit: "", credit: "" }]).ok,
  );
  assert.match(checkJournal(e, rows.slice(0, 1)).messages.join(" "), /missing/);
  assert.match(
    checkJournal(
      e,
      rows.map((r) => ({ ...r, debit: r.credit, credit: r.debit })),
    ).messages.join(" "),
    /wrong side/,
  );
  assert.match(
    checkJournal(e, [
      { account: "cash", debit: 100, credit: "" },
      { account: "fees", credit: 100, debit: "" },
    ]).messages.join(" "),
    /moves cash|move.*cash/,
  );
  for (const value of ["", -50, "abc", "1e2", "Infinity", "100.50"])
    assert.equal(
      checkJournal(e, [
        { account: e.lines[0].account, debit: value, credit: "" },
        rows[1],
      ]).ok,
      false,
    );
  assert.equal(
    checkJournal(e, [{ ...rows[0], credit: 50 }, rows[1]]).ok,
    false,
  );
  assert.equal(checkJournal(e, [...rows, rows[0]]).ok, false);
  assert.match(balanceWhy(c, "retained"), /beginning/);
  assert.match(balanceWhy(c, "fees", true), /temporary/);
});
test("strict money parsing accepts useful formats and rejects partial/malformed numbers", () => {
  for (const [text, n] of [
    ["$1,250", 1250],
    ["150.00", 150],
    ["-100", -100],
    [" 0 ", 0],
  ])
    assert.equal(parseMoney(text), n);
  for (const text of [
    "",
    " ",
    "1e3",
    "1,2",
    "100abc",
    "Infinity",
    "0x10",
    "1.5",
    "1 000",
    "--10",
  ])
    assert.equal(parseMoney(text), null, text);
});
test("concept decks cover all topics, reshuffle and always contain one distinct explained answer", () => {
  const orders = new Set(),
    positions = new Set();
  for (let i = 0; i < 100; i++) {
    const topics = [];
    for (let j = 0; j < CONCEPTS.length * 2; j++) {
      const q = conceptQuestion(`quiz${i}`, j);
      assert.equal(q.options.filter((o) => o.correct).length, 1);
      assert.equal(
        new Set(q.options.map((o) => o.text)).size,
        q.options.length,
      );
      assert.ok(q.options.every((o) => o.why.length > 25));
      positions.add(q.options.findIndex((o) => o.correct));
      if (j < CONCEPTS.length) topics.push(q.topic);
    }
    assert.deepEqual([...topics].sort(), [...CONCEPTS].sort());
    orders.add(topics.join(","));
  }
  assert.ok(orders.size > 90);
  assert.equal(positions.size, 3);
});
