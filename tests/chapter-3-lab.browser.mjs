import assert from "node:assert/strict";
import {
  ACCOUNTS,
  generateCase,
  wordingQuestion,
  conceptQuestion,
  money,
  totals,
} from "../public/accounting-practice/chapter-3/lab/engine.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const base = process.env.TEST_URL || "http://127.0.0.1:8765";
const KEY = "little-tools:chapter-3:lab:v1",
  errors = [];
const context = await browser.newContext({
  viewport: { width: 1360, height: 1000 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const state = () =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const click = (action) =>
  page.locator(`[data-action="${action}"]`).first().click();
const mode = (mode) => page.locator(`[data-mode="${mode}"]`).click();
const field = (id) => page.locator(`[data-field="${id}"]`);
const entry = async (q) => {
  await field("debit").selectOption(q.debit);
  await field("credit").selectOption(q.credit);
  await field("amount").fill(String(q.amount));
};
const checkEntry = () =>
  page.getByRole("button", { name: "Check entry", exact: true }).click();
const noOverflow = async () =>
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No page-level horizontal overflow",
  );
try {
  await page.goto(base + "/accounting-practice/chapter-3/");
  await page.locator('a[href="./lab/"]').click();
  await page.locator("#topic-filter").selectOption("supplies");
  let s = await state();
  let q = wordingQuestion(`${s.seed}:words:${s.round}`, s.filter);
  await page
    .locator(
      `[data-field="role"][value="${q.role === "change" ? "remaining" : "change"}"]`,
    )
    .check();
  await entry(q);
  await checkEntry();
  assert.match(await page.locator(".feedback").innerText(), /Read the phrase/);
  await page.locator(`[data-field="role"][value="${q.role}"]`).check();
  await page.reload();
  assert.equal(await field("amount").inputValue(), String(q.amount));
  await checkEntry();
  assert.equal((await state()).stats.practiced, 1);
  assert.match(
    await page.locator(".worked").innerText(),
    /Dr Supplies Expense/,
  );
  await page.reload();
  assert.equal(
    (await state()).stats.practiced,
    1,
    "Reload does not double count",
  );
  await page.screenshot({ path: "/tmp/ch3-lab-wording.png", fullPage: true });
  for (const topic of [
    "insurance",
    "unearned",
    "revenue",
    "wages",
    "depreciation",
  ]) {
    await page.locator("#topic-filter").selectOption(topic);
    s = await state();
    q = wordingQuestion(`${s.seed}:words:${s.round}`, s.filter);
    await page.locator(`[data-field="role"][value="${q.role}"]`).check();
    await entry(q);
    if (topic === "insurance") await click("hint");
    if (topic === "depreciation") {
      await field("credit").selectOption("equipment");
      await checkEntry();
      assert.match(
        await page.locator(".feedback").innerText(),
        /Accumulated Depreciation/,
      );
      await field("credit").selectOption(q.credit);
    }
    await checkEntry();
    assert.match(await page.locator(".feedback").innerText(), /You’ve got it/);
  }
  assert.deepEqual((await state()).stats, {
    first: 3,
    practiced: 3,
    revealed: 0,
  });
  await click("next-word");
  await click("reveal");
  assert.equal((await state()).stats.revealed, 1);
  await mode("rebuild");
  s = await state();
  const c = generateCase(`${s.seed}:case:${s.caseRound}`);
  for (let i = 0; i < 7; i++) {
    await page.locator(`[data-action="entry"][data-index="${i}"]`).click();
    await entry(c.adjustments[i]);
    await checkEntry();
    assert.match(await page.locator(".feedback").innerText(), /You’ve got it/);
  }
  assert.match(await page.locator(".tag").innerText(), /7 of 7/);
  await page.screenshot({ path: "/tmp/ch3-lab-rebuild.png", fullPage: true });
  await click("go-trial");
  assert.equal((await state()).caseRound, s.caseRound);
  assert.equal(await page.locator("tbody tr").count(), 14);
  const statsBeforeAuto = (await state()).stats;
  await click("fill-unchanged");
  assert.deepEqual((await state()).stats, statsBeforeAuto);
  // Same amount, wrong ending side: crediting Supplies does not leave a credit balance.
  await page.locator("#amount-supplies").fill(String(c.after.supplies));
  await page.locator("#side-supplies").selectOption("credit");
  await page.locator('[data-action="check-row"][data-id="supplies"]').click();
  assert.match(
    await page.locator('[data-row="supplies"] .row-feedback').innerText(),
    /ending side/,
  );
  // Explicit walkthrough assistance must survive refresh and affect scoring.
  await page.locator('[data-row-help="insurance"] summary').click();
  await page.waitForFunction(
    (k) => JSON.parse(localStorage.getItem(k)).work["row:0:insurance"].hinted,
    KEY,
  );
  await page.reload();
  const prior = (await state()).stats;
  for (const id of Object.keys(ACCOUNTS).filter(
    (id) => c.before[id] !== c.after[id],
  )) {
    await page.locator(`#amount-${id}`).fill(String(Math.abs(c.after[id])));
    await page
      .locator(`#side-${id}`)
      .selectOption(c.after[id] >= 0 ? "debit" : "credit");
  }
  assert.equal(
    await page.locator("#entered-debit").innerText(),
    money(totals(c.after).debit),
    "Totals update while typing",
  );
  await click("check-rows");
  assert.match(
    await page.locator("#entered-status").innerText(),
    /All balances correct/,
  );
  const next = (await state()).stats;
  assert.equal(next.first - prior.first, 12);
  assert.equal(next.practiced - prior.practiced, 2);
  await page.locator("#changed-only").uncheck();
  assert.equal(
    await page.locator("tbody tr").count(),
    Object.keys(ACCOUNTS).length,
  );
  await page.screenshot({ path: "/tmp/ch3-lab-trial.png", fullPage: true });
  await mode("concepts");
  s = await state();
  q = conceptQuestion(s.seed, s.conceptRound);
  await page
    .locator(
      `[data-action="choose"][data-index="${q.options.findIndex((o) => !o.correct)}"]`,
    )
    .click();
  assert.match(await page.locator(".feedback").innerText(), /Keep going/);
  await page
    .locator(
      `[data-action="choose"][data-index="${q.options.findIndex((o) => o.correct)}"]`,
    )
    .click();
  await page.locator(".option-explanations summary").click();
  assert.equal(await page.locator(".option-explanations p").count(), 4);
  await click("next-concept");
  await click("reveal");
  assert.equal((await state()).stats.revealed, 2);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const m of ["words", "rebuild", "trial", "concepts"]) {
      await mode(m);
      await noOverflow();
    }
  }
  await page.screenshot({ path: "/tmp/ch3-lab-mobile.png", fullPage: true });
  await mode("trial");
  await click("new-case");
  assert.equal((await state()).caseRound, 1);
  assert.equal(await page.locator(".row-good").count(), 0);
  assert.ok(
    !Object.keys((await state()).work).some((k) => k.startsWith("row:0:")),
  );
  // Corrupt storage is recoverable; unavailable storage still allows answering.
  await page.evaluate(
    (k) => localStorage.setItem(k, '{"version":1,"mode":"bad"}'),
    KEY,
  );
  await page.reload();
  assert.match(
    await page.locator("#storage-notice").innerText(),
    /fresh session/,
  );
  const blocked = await context.newPage();
  blocked.on("pageerror", (e) => errors.push(e.message));
  await blocked.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      value() {
        throw new Error("blocked");
      },
    });
  });
  await blocked.goto(base + "/accounting-practice/chapter-3/lab/");
  assert.match(
    await blocked.locator("#storage-notice").innerText(),
    /could not be saved/,
  );
  await blocked.locator('[data-action="reveal"]').click();
  assert.match(await blocked.locator(".feedback").innerText(), /Worked answer/);
  assert.deepEqual(errors, []);
  console.log(
    "Chapter 3 lab browser checks passed: all modes, feedback, full worksheet, progress, recovery, desktop and mobile.",
  );
} finally {
  await browser.close();
}
