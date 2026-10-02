import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNTS,
  TOPICS,
  CONCEPT_TOPICS,
  generateCase,
  wordingQuestion,
  conceptQuestion,
  checkJournal,
  rowExplanation,
  totals,
} from "../public/accounting-practice/chapter-3/lab/engine.mjs";

test("1,000 reproducible year-end cases balance and contain exactly seven independent adjustments", () => {
  const variants = new Set();
  for (let i = 0; i < 1000; i++) {
    const c = generateCase(`case-${i}`);
    assert.deepEqual(c, generateCase(`case-${i}`));
    variants.add(c.variant);
    assert.equal(c.adjustments.length, 7);
    for (const balances of [c.before, c.after]) {
      assert.equal(totals(balances).debit, totals(balances).credit);
      for (const [id, value] of Object.entries(balances)) {
        assert.ok(Number.isInteger(value));
        if (["asset", "expense", "dividends"].includes(ACCOUNTS[id][1]))
          assert.ok(value >= 0, `${id} expected debit`);
        else assert.ok(value <= 0, `${id} expected credit`);
      }
    }
    const affected = new Set();
    for (const a of c.adjustments) {
      assert.ok(a.amount > 0);
      assert.ok(
        !affected.has(a.debit) && !affected.has(a.credit),
        "One adjustment per affected account",
      );
      affected.add(a.debit);
      affected.add(a.credit);
      assert.equal(c.after[a.debit] - c.before[a.debit], a.amount);
      assert.equal(c.after[a.credit] - c.before[a.credit], -a.amount);
      assert.equal(
        checkJournal(a, { debit: a.debit, credit: a.credit, amount: a.amount })
          .ok,
        true,
      );
      assert.equal(
        checkJournal(a, { debit: a.credit, credit: a.debit, amount: a.amount })
          .ok,
        false,
      );
    }
    assert.equal(affected.size, 14);
    assert.equal(c.before.retained, c.after.retained);
    assert.equal(c.before.equipment, c.after.equipment);
    assert.equal(c.before.building, c.after.building);
    assert.ok(c.after.equipment + c.after.depEquipment > 0);
    assert.ok(c.after.building + c.after.depBuilding > 0);
    // Independent accounting equation after this year's income and dividends.
    let assets = 0,
      liabilities = 0,
      income = 0;
    for (const [id, value] of Object.entries(c.after)) {
      const type = ACCOUNTS[id][1];
      if (["asset", "contra asset"].includes(type)) assets += value;
      if (type === "liability") liabilities -= value;
      if (["revenue", "expense"].includes(type)) income -= value;
    }
    assert.equal(
      assets,
      liabilities -
        c.after.stock -
        c.after.retained +
        income -
        c.after.dividends,
    );
  }
  assert.deepEqual([...variants].sort(), ["revenue", "utilities"]);
});

test("wording changes the figure's role without changing correct recognition", () => {
  for (const topic of Object.keys(TOPICS)) {
    const roles = new Set();
    for (let i = 0; i < 150; i++) {
      const q = wordingQuestion(`word-${i}`, topic);
      roles.add(q.role);
      assert.ok(q.figure > 0 && q.amount > 0);
      if (q.role === "remaining")
        assert.equal(q.amount, Math.abs(q.before[q.target]) - q.figure);
      else assert.equal(q.amount, q.figure);
      assert.equal(
        checkJournal(q, {
          debit: q.debit,
          credit: q.credit,
          amount: `$${q.amount.toLocaleString("en-US")}`,
        }).ok,
        true,
      );
      if (topic === "revenue") {
        assert.equal(q.debit, "receivable");
        assert.equal(q.credit, "fees");
        assert.match(q.clue, /not.*recorded/);
      }
      if (topic === "depreciation") assert.equal(q.credit, "depEquipment");
    }
    assert.equal(
      roles.size,
      ["supplies", "insurance", "unearned"].includes(topic) ? 2 : 1,
    );
  }
});

test("targeted feedback catches known misconceptions and does not accept invalid numbers", () => {
  const q = wordingQuestion("explanation", "depreciation");
  assert.match(
    checkJournal(q, { debit: q.debit, credit: "equipment", amount: q.amount })
      .text,
    /recorded cost/,
  );
  assert.match(
    checkJournal(q, { debit: q.debit, credit: "cash", amount: q.amount }).text,
    /No cash moves/,
  );
  for (const amount of ["", "-2", "Infinity", "1e5", "hello"])
    assert.equal(
      checkJournal(q, { debit: q.debit, credit: q.credit, amount }).ok,
      false,
    );
  const c = generateCase("row-explanations");
  assert.match(rowExplanation(c, "retained"), /Before closing/);
  assert.match(rowExplanation(c, "supplies"), /does not turn.*into a credit/);
  assert.match(rowExplanation(c, "depEquipment"), /Two credits add/);
});

test("concept decks cover every topic without repeats and have one explained answer", () => {
  const positions = new Set();
  for (let i = 0; i < 100; i++) {
    for (let deck = 0; deck < 2; deck++) {
      const topics = new Set();
      for (let round = deck * 16; round < (deck + 1) * 16; round++) {
        const q = conceptQuestion(`concept-${i}`, round);
        topics.add(q.topic);
        assert.equal(q.options.filter((o) => o.correct).length, 1);
        assert.equal(
          new Set(q.options.map((o) => o.text)).size,
          q.options.length,
        );
        for (const o of q.options) assert.ok(o.why.length > 20);
        positions.add(q.options.findIndex((o) => o.correct));
      }
      assert.deepEqual([...topics].sort(), [...CONCEPT_TOPICS].sort());
    }
  }
  assert.equal(positions.size, 4);
});
