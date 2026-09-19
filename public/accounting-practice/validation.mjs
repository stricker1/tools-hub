import { money } from "./engine.mjs";
export function amount(value) {
  const s = String(value ?? "").trim();
  if (!s) return 0;
  const clean = s.replace(/^\$\s*/, "");
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(clean)) return NaN;
  return Number(clean.replaceAll(",", ""));
}
export const formatted = (value) =>
  Number.isFinite(amount(value))
    ? amount(value) === 0
      ? ""
      : money(amount(value))
    : value;
export const accountId = (value, accounts) => {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return (
    accounts.find(
      (a) =>
        a.id === v ||
        a.name.toLowerCase() === v ||
        `${a.id} · ${a.name}`.toLowerCase() === v,
    )?.id || v
  );
};
export const blankLine = () => ({
  account: "",
  date: "",
  ref: "",
  debit: "",
  credit: "",
});
export function newWork(p) {
  return {
    journal: p.entries.map((e) =>
      [0, 1].map(() => ({ ...blankLine(), date: e.date })),
    ),
    ledger: Object.fromEntries(
      p.accounts.map((a) => [
        a.id,
        p.key.ledger[a.id].map(() => ({
          date: "",
          item: "",
          ref: "",
          debit: "",
          credit: "",
        })),
      ]),
    ),
    trial: p.accounts.map(() => ({ debit: "", credit: "" })),
    results: Object.fromEntries(Object.keys(p.key.results).map((k) => [k, ""])),
    correction: { why: "", type: "", lines: [blankLine(), blankLine()] },
  };
}
// Match by account, not row order: valid credit-first entries receive equal credit.
export function validateEntry(
  expected,
  rows,
  accounts,
  { date, ref = true } = {},
) {
  const used = new Set(),
    feedback = [];
  for (const row of rows) {
    const id = accountId(row.account, accounts),
      index = expected.findIndex((l, i) => l.account === id && !used.has(i));
    const empty = !row.account && !row.ref && !row.debit && !row.credit;
    if (empty) {
      feedback.push({});
      continue;
    }
    const f = {};
    if (index < 0) {
      f.account = "account";
    } else {
      used.add(index);
      f.account = "ok";
      const line = expected[index],
        d = amount(row.debit),
        c = amount(row.credit);
      for (const side of ["debit", "credit"]) {
        const value = side === "debit" ? d : c;
        f[side] =
          value === line[side]
            ? "ok"
            : (line.debit && c > 0) || (line.credit && d > 0)
              ? "side"
              : "amount";
      }
      if (ref) f.ref = String(row.ref).trim() === id ? "ok" : "reference";
    }
    if (date) f.date = row.date === date ? "ok" : "date";
    feedback.push(f);
  }
  const missing = expected.length - used.size;
  return {
    rows: feedback,
    missing,
    ok:
      missing === 0 &&
      feedback.every((f) => Object.values(f).every((v) => v === "ok")),
  };
}
export function validate(p, work, section) {
  const cells = {},
    units = [];
  const put = (path, status) => {
    cells[path] = status;
  };
  if (section === "journal" || section === "corrections") {
    const list =
      section === "journal"
        ? p.entries.map((e, i) => ({
            expected: e.lines,
            rows: work.journal[i],
            date: e.date,
            prefix: `journal.${i}`,
            concept: e.concept,
          }))
        : p.correction
          ? [
              {
                expected: p.correction.lines,
                rows: work.correction.lines,
                prefix: "correction.lines",
                concept: "corrections",
              },
            ]
          : [];
    for (const item of list) {
      const v = validateEntry(item.expected, item.rows, p.accounts, {
        date: item.date,
        ref: section === "journal",
      });
      v.rows.forEach((r, i) =>
        Object.entries(r).forEach(([k, s]) =>
          put(`${item.prefix}.${i}.${k}`, s),
        ),
      );
      units.push({
        ok: v.ok,
        concept: item.concept,
        missing: v.missing,
        prefix: item.prefix,
      });
    }
    if (section === "corrections" && p.correction)
      for (const k of ["why", "type"]) {
        const ok = work.correction[k] === p.correction[k];
        put(`correction.${k}`, ok ? "ok" : "answer");
        units.push({ ok, concept: "corrections" });
      }
  }
  if (section === "ledger")
    for (const a of p.accounts) {
      let running = p.opening[a.id] || 0;
      p.key.ledger[a.id].forEach((expected, i) => {
        const row = work.ledger[a.id][i],
          prefix = `ledger.${a.id}.${i}`;
        let ok = true;
        for (const k of ["date", "ref", "debit", "credit"]) {
          const actual = ["debit", "credit"].includes(k)
              ? amount(row[k])
              : String(row[k]).trim(),
            good = actual === expected[k];
          put(
            `${prefix}.${k}`,
            good
              ? "ok"
              : k === "ref"
                ? "reference"
                : k === "date"
                  ? "date"
                  : amount(row[k === "debit" ? "credit" : "debit"]) > 0 &&
                      expected[k] > 0
                    ? "side"
                    : "amount",
          );
          ok &&= good;
        }
        running += amount(row.debit) - amount(row.credit);
        put(
          `${prefix}.balance`,
          running === expected.balance ? "ok" : "balance",
        );
        ok &&= running === expected.balance;
        units.push({ ok, concept: p.entries[expected.entry].concept });
      });
    }
  if (section === "trial")
    p.key.trial.forEach((r, i) => {
      let ok = true;
      for (const k of ["debit", "credit"]) {
        const good = amount(work.trial[i][k]) === r[k];
        put(
          `trial.${i}.${k}`,
          good
            ? "ok"
            : amount(work.trial[i][k === "debit" ? "credit" : "debit"]) > 0 &&
                r[k] > 0
              ? "side"
              : "amount",
        );
        ok &&= good;
      }
      units.push({ ok, concept: "trial balance" });
    });
  if (section === "results")
    for (const [k, v] of Object.entries(p.key.results)) {
      const ok =
        String(work.results[k]).trim() !== "" && amount(work.results[k]) === v;
      put(`results.${k}`, ok ? "ok" : "amount");
      units.push({
        ok,
        concept: ["change", "retained", "dividends"].includes(k)
          ? "retained earnings"
          : "net income",
      });
    }
  return {
    cells,
    units,
    ok: units.every((u) => u.ok),
    correct: units.filter((u) => u.ok).length,
    total: units.length,
  };
}
export function answerSection(p, work, section) {
  if (section === "journal")
    work.journal = p.entries.map((e) =>
      e.lines.map((l) => ({ ...l, date: e.date, ref: l.account })),
    );
  if (section === "ledger") work.ledger = structuredClone(p.key.ledger);
  if (section === "trial") work.trial = structuredClone(p.key.trial);
  if (section === "results") work.results = structuredClone(p.key.results);
  if (section === "corrections" && p.correction)
    work.correction = {
      ...structuredClone(p.correction),
      lines: p.correction.lines.map((line) => ({ ...blankLine(), ...line })),
    };
}
