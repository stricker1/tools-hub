import test from "node:test";
import assert from "node:assert/strict";
import {
  generate,
  encodeSeed,
  parseSeed,
  PRESETS,
  CONCEPTS,
  ACCOUNTS,
  verify,
} from "../public/accounting-practice/engine.mjs";
import {
  amount,
  newWork,
  validate,
  validateEntry,
  answerSection,
} from "../public/accounting-practice/validation.mjs";
import {
  load,
  save,
  freshStats,
  recordCheck,
} from "../public/accounting-practice/storage.mjs";
const make = (d = "advanced", seed = "test") =>
  generate(encodeSeed(d, PRESETS[d], seed));
const sum = (a) => a.reduce((s, n) => s + n, 0);
test("3,000 preset problems and all 512 custom combinations obey independent accounting invariants", () => {
  let loss = false;
  const corrections = new Set(),
    patterns = new Set();
  const cases = [];
  for (const d of Object.keys(PRESETS))
    for (let i = 0; i < 1000; i++)
      cases.push(encodeSeed(d, PRESETS[d], `test${i}`));
  for (let mask = 0; mask < 512; mask++)
    cases.push(
      encodeSeed(
        "custom",
        Object.keys(CONCEPTS).filter((k, i) => mask & (2 ** i)),
        `custom${mask}`,
      ),
    );
  for (const id of cases) {
    const p = generate(id),
      balances = Object.fromEntries(
        p.accounts.map((a) => [a.id, p.opening[a.id] || 0]),
      );
    let revenue = 0,
      expenses = 0,
      dividends = 0;
    assert.equal(sum(Object.values(balances)), 0);
    for (const e of p.entries) {
      assert.equal(
        sum(e.lines.map((l) => l.debit)),
        sum(e.lines.map((l) => l.credit)),
      );
      assert.ok(e.date >= p.start && e.date <= p.end);
      for (const l of e.lines) {
        balances[l.account] += l.debit - l.credit;
        const type = ACCOUNTS.find((a) => a.id === l.account).type;
        if (type === "revenue") revenue += l.credit - l.debit;
        if (type === "expense") expenses += l.debit - l.credit;
        if (type === "dividend") dividends += l.debit - l.credit;
        assert.ok(l.debit >= 0 && l.credit >= 0);
      }
    }
    assert.deepEqual(p.key.balances, balances);
    assert.equal(
      sum(p.key.trial.map((r) => r.debit)),
      sum(p.key.trial.map((r) => r.credit)),
    );
    for (const a of p.accounts) {
      const expected = p.entries.flatMap((e) =>
        e.lines.filter((l) => l.account === a.id).map((l) => ({ e, l })),
      );
      let running = p.opening[a.id] || 0;
      assert.equal(p.key.ledger[a.id].length, expected.length);
      expected.forEach(({ e, l }, i) => {
        running += l.debit - l.credit;
        const r = p.key.ledger[a.id][i];
        assert.deepEqual(
          [r.date, r.ref, r.debit, r.credit, r.balance],
          [e.date, String(e.page), l.debit, l.credit, running],
        );
      });
      const t = p.key.trial.find((r) => r.account === a.id);
      assert.equal(t.debit, Math.max(running, 0));
      assert.equal(t.credit, Math.max(-running, 0));
    }
    assert.deepEqual(p.key.results, {
      revenue,
      expenses,
      net: revenue - expenses,
      dividends,
      change: revenue - expenses - dividends,
      retained: -(p.opening["310"] || 0) + revenue - expenses - dividends,
    });
    if (p.correction) {
      const c = p.correction;
      corrections.add(c.type);
      const wages = c.lines.find((l) => l.account === "510"),
        cash = c.lines.find((l) => l.account === "101");
      assert.equal(c.recorded + wages.debit - wages.credit, c.actual);
      assert.equal(cash.debit - cash.credit, c.recorded - c.actual);
      if (c.type === "transposition")
        assert.equal(
          [...String(c.recorded)].sort().join(""),
          [...String(c.actual)].sort().join(""),
        );
      if (c.type === "slide")
        assert.ok([10, 0.1].includes(c.actual / c.recorded));
    }
    if (p.difficulty === "beginner") {
      assert.deepEqual(p.opening, {});
      assert.ok(p.entries.every((e) => e.lines.length === 2));
    }
    loss ||= p.key.results.net < 0;
    patterns.add(p.entries.map((e) => e.concept).join(","));
  }
  assert.ok(loss, "Both profits and losses occur");
  assert.deepEqual([...corrections].sort(), [
    "neither",
    "slide",
    "transposition",
  ]);
  assert.ok(patterns.size > 100);
  console.log(
    `Verified ${cases.length} problems and ${patterns.size} transaction patterns.`,
  );
});
test("seed round trips and rejects incompatible settings", () => {
  const p = make();
  assert.deepEqual(generate(p.id), p);
  assert.deepEqual(generate(p.id.toLowerCase()), p);
  for (const s of ["bad", "AP2-B-0-test", "AP1-B-e7-test", "AP1-C-zzz-test"])
    assert.throws(() => parseSeed(s));
});
test("runtime verifier rejects damaged journal, ledger, trial balance and results", () => {
  const p = make();
  for (const change of [
    (p) => p.entries[0].lines[0].debit++,
    (p) => (p.key.ledger["101"][0].ref = "J18"),
    (p) => p.key.ledger["101"][0].balance++,
    (p) => {
      p.key.trial[0].debit++;
      p.key.trial[1].credit++;
    },
    (p) => p.key.results.expenses++,
    (p) => p.key.results.retained++,
  ]) {
    const copy = structuredClone(p);
    change(copy);
    assert.throws(() => verify(copy));
  }
});
test("natural dollar input and invalid formats", () => {
  for (const s of ["5800", "5,800", "$5,800", "5800.00"])
    assert.equal(amount(s), 5800);
  assert.equal(amount(""), 0);
  assert.equal(amount("-$20"), NaN);
  assert.equal(amount("-20"), -20);
  for (const s of ["5,80", "1e3", "12x", "Infinity", "1.234", "1,2,3"])
    assert.ok(Number.isNaN(amount(s)));
});
test("blank work fails and revealed keys pass every section including zero results", () => {
  for (const d of Object.keys(PRESETS)) {
    const p = make(d),
      w = newWork(p);
    for (const s of ["journal", "ledger", "trial", "results", "corrections"]) {
      if (s === "corrections" && !p.correction) continue;
      assert.equal(validate(p, w, s).ok, false);
      answerSection(p, w, s);
      assert.equal(validate(p, w, s).ok, true, s);
    }
  }
});
test("journal diagnoses wrong account, side, amount and reference; accepts reordered lines", () => {
  const p = make(),
    e = p.entries[0],
    rows = e.lines.map((l) => ({ ...l, date: e.date, ref: l.account }));
  assert.ok(
    validateEntry(e.lines, rows.toReversed(), p.accounts, { date: e.date }).ok,
  );
  const side = structuredClone(rows);
  [side[0].debit, side[0].credit] = [side[0].credit, side[0].debit];
  assert.equal(validateEntry(e.lines, side, p.accounts).rows[0].debit, "side");
  const wrong = structuredClone(rows);
  wrong[0].account = "201";
  assert.equal(
    validateEntry(e.lines, wrong, p.accounts).rows[0].account,
    "account",
  );
  wrong[0] = { ...rows[0], debit: 10 };
  assert.equal(
    validateEntry(e.lines, wrong, p.accounts).rows[0].debit,
    "amount",
  );
  wrong[0] = { ...rows[0], ref: "18" };
  assert.equal(
    validateEntry(e.lines, wrong, p.accounts).rows[0].ref,
    "reference",
  );
  const extra = [
    ...rows,
    { account: "", date: e.date, ref: "", debit: "", credit: "" },
  ];
  assert.ok(validateEntry(e.lines, extra, p.accounts).ok);
  assert.ok(!validateEntry(e.lines, [...rows, rows[0]], p.accounts).ok);
});
test("balanced wrong trial accounts fail and incorrect earlier ledger entries carry forward", () => {
  const p = make(),
    w = newWork(p);
  answerSection(p, w, "trial");
  w.trial[0].debit += 100;
  w.trial[1].debit -= 100;
  assert.equal(validate(p, w, "trial").ok, false);
  answerSection(p, w, "ledger");
  w.ledger["101"][0].debit++;
  const v = validate(p, w, "ledger");
  assert.equal(v.cells["ledger.101.1.balance"], "balance");
});
test("first check stats exclude reveals and resist repeated checks", () => {
  const p = make(),
    w = newWork(p),
    s = { recorded: {}, revealed: {} },
    stats = freshStats(),
    v = validate(p, w, "journal");
  recordCheck(stats, s, "journal", v);
  recordCheck(stats, s, "journal", v);
  assert.equal(stats.accuracy.journal.total, v.total);
  s.revealed.ledger = ["ledger.101.0.debit"];
  recordCheck(stats, s, "ledger", validate(p, w, "ledger"));
  assert.equal(stats.accuracy.ledger, undefined);
});
test("storage failures and malformed values recover safely", () => {
  assert.ok(load(undefined).notice);
  assert.equal(save(undefined, {}), false);
  assert.ok(load({ getItem: () => "{bad" }).notice);
  assert.ok(
    load({
      getItem: () =>
        JSON.stringify({ version: 1, stats: { attempted: "bad" } }),
    }).notice,
  );
  const mem = {
    getItem() {
      return this.value;
    },
    setItem(k, v) {
      this.value = v;
    },
  };
  assert.equal(save(mem, { stats: freshStats(), session: null }), true);
  assert.deepEqual(load(mem).stats, freshStats());
});
