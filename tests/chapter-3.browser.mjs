import assert from "node:assert/strict";
import {
  generateMonth,
  reasoningOptions,
  effectOptions,
  detective,
} from "../public/accounting-practice/chapter-3/engine.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const base = process.env.TEST_URL || "http://127.0.0.1:8765";
const KEY = "little-tools:chapter-3:v1",
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
const fill = async (k, v) => {
  await page.locator(`[data-field="${k}"]`).fill(String(v));
};
async function noOverflow() {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No page-level horizontal overflow",
  );
}
try {
  await page.goto(base + "/accounting-practice/chapter-3/");
  await page.locator("#topic-filter").selectOption("supplies");
  const s = await state(),
    m = generateMonth(s.seed + ":learn:" + s.round),
    a = m.adjustments[0];
  let options = reasoningOptions(a, s.seed + ":learn:" + s.round + "meaning");
  await page
    .locator(
      `[data-action="choose"][data-index="${options.findIndex((o) => !o.correct)}"]`,
    )
    .click();
  assert.match(await page.locator(".feedback").innerText(), /different timing/);
  await page.getByRole("button", { name: a.meaning, exact: false }).click();
  await click("learn-next");
  await fill("amount", m.v.remaining);
  await click("check");
  assert.match(await page.locator(".feedback").innerText(), /Recheck/);
  await fill("amount", a.amount);
  await page.reload();
  assert.equal(
    await page.locator('[data-field="amount"]').inputValue(),
    String(a.amount),
  );
  await click("check");
  await click("learn-next");
  await page.locator('[data-field="debit"]').selectOption(a.debit);
  await page.locator('[data-field="credit"]').selectOption("cash");
  await fill("debitAmount", a.amount);
  await fill("creditAmount", a.amount);
  await click("check");
  assert.match(
    await page.locator(".feedback").innerText(),
    /Cash does not belong/,
  );
  await page.locator('[data-field="credit"]').selectOption(a.credit);
  await click("check");
  assert.match(
    await page.locator(".notebook").innerText(),
    /AFTER THIS ADJUSTMENT/,
  );
  await click("learn-next");
  await page.getByRole("button", { name: a.effect, exact: false }).click();
  assert.match(
    await page.locator(".completion").innerText(),
    /whole adjustment/,
  );
  const statsBefore = (await state()).stats.supplies.completed;
  await page.reload();
  assert.equal((await state()).stats.supplies.completed, statsBefore);
  await page.screenshot({
    path: "/tmp/chapter-3-guided-desktop.png",
    fullPage: true,
  });
  await click("new-learn");
  const nextState = await state();
  assert.equal(nextState.round, s.round + 1);
  // All entry families, including hint/reveal accounting.
  for (const topic of [
    "insurance",
    "unearned",
    "revenue",
    "wages",
    "depreciation",
  ]) {
    await page.locator("#topic-filter").selectOption(topic);
    await click("skip-guidance");
    await click("hint");
    await click("reveal");
    assert.match(await page.locator(".feedback").innerText(), /Worked answer/);
  }
  // Complete every accounting-cycle stage through the UI.
  await page.locator('[data-mode="month"]').click();
  const cs = await state(),
    cm = generateMonth(cs.caseSeed);
  for (let i = 0; i < 8; i++) {
    const e = cm.transactions[i];
    const names = await page.locator(".choice").allTextContents();
    const { ACCOUNTS } =
      await import("../public/accounting-practice/chapter-3/engine.mjs");
    const wanted = `Debit ${ACCOUNTS[e.lines[0].account][0]}; credit ${ACCOUNTS[e.lines[1].account][0]}`;
    const idx = names.findIndex((n) => n.includes(wanted));
    assert.ok(idx >= 0);
    await page.locator(".choice").nth(idx).click();
    await click("transaction-next");
  }
  await fill("amount", cm.unadjusted.cash);
  await click("check");
  await click("case-next");
  for (const el of await page.locator("input[data-field]").all()) {
    const id = await el.getAttribute("data-field");
    await el.fill(String(Math.abs(cm.unadjusted[id])));
  }
  await click("check");
  assert.match(await page.locator(".feedback").innerText(), /That’s it/);
  await click("case-next");
  for (const a of cm.adjustments) {
    await page.locator('[data-field="debit"]').selectOption(a.debit);
    await page.locator('[data-field="credit"]').selectOption(a.credit);
    await fill("debitAmount", a.amount);
    await fill("creditAmount", a.amount);
    await click("check");
    assert.match(await page.locator(".feedback").innerText(), /Exactly/);
    await click("adjustment-next");
  }
  for (const el of await page.locator("input[data-field]").all()) {
    const id = await el.getAttribute("data-field");
    await el.fill(String(Math.abs(cm.adjusted[id])));
  }
  await click("check");
  assert.match(await page.locator(".feedback").innerText(), /That’s it/);
  await page.screenshot({
    path: "/tmp/chapter-3-trial-desktop.png",
    fullPage: true,
  });
  await click("case-next");
  for (const el of await page.locator("input[data-field]").all()) {
    const id = await el.getAttribute("data-field");
    await el.fill(String(cm.results[id]));
  }
  await click("check");
  assert.match(await page.locator(".completion").innerText(), /complete story/);
  assert.equal(await page.locator(".cycle .done").count(), 6);
  await page.reload();
  assert.equal(await page.locator(".cycle .done").count(), 6);
  assert.ok(await page.locator('[data-field="net"]').isDisabled());
  await page.locator('[data-action="case-stage"][data-index="3"]').click();
  await page.locator('[data-action="case-item"][data-index="3"]').click();
  assert.match(
    await page.locator(".notebook").innerText(),
    new RegExp((cm.v.cashRevenue + cm.v.earnedAdvance).toLocaleString("en-US")),
  );
  await page.locator('[data-mode="detective"]').click();
  await page.locator("#topic-filter").selectOption("mixed");
  for (let i = 0; i < 12; i++) {
    const ds = await state(),
      q = detective(ds.seed + ":detective:" + ds.detectiveRound, "mixed");
    await page
      .locator(".choice")
      .nth(q.options.findIndex((o) => o.correct))
      .click();
    assert.match(await page.locator(".feedback").innerText(), /That’s it/);
    await click("new-detective");
  }
  await page.locator("#progress-button").click();
  assert.ok(await page.locator("#progress-dialog").isVisible());
  await page.locator("#close-progress").click();
  // Navigation and responsive layouts, including dense tables.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const mode of ["learn", "month", "detective", "guide"]) {
      await page.locator(`[data-mode="${mode}"]`).click();
      await noOverflow();
      if (mode === "month") {
        for (const stage of [2, 4, 5]) {
          await page
            .locator(`[data-action="case-stage"][data-index="${stage}"]`)
            .click();
          await noOverflow();
        }
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-mode="learn"]').click();
  await click("new-learn");
  await page.screenshot({ path: "/tmp/chapter-3-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.screenshot({
    path: "/tmp/chapter-3-start-desktop.png",
    fullPage: true,
  });
  await page.locator('[data-mode="guide"]').click();
  for (const b of await page.locator('[data-action="lesson"]').all()) {
    await b.click();
    assert.ok((await page.locator(".guide article").innerText()).length > 300);
  }
  await page.goto(base + "/accounting-practice/");
  assert.equal(await page.locator('a[href="./chapter-3/"]').count(), 1);
  await page.goto(base + "/");
  assert.equal(
    await page.locator('a[href="/accounting-practice/chapter-3/"]').count(),
    1,
  );
  const bad = await browser.newContext();
  await bad.addInitScript((k) => localStorage.setItem(k, "{broken"), KEY);
  const badPage = await bad.newPage();
  await badPage.goto(base + "/accounting-practice/chapter-3/");
  assert.ok(await badPage.locator("#storage-notice").isVisible());
  assert.ok(await badPage.locator(".choices").isVisible());
  await bad.close();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error("blocked");
    };
  });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(base + "/accounting-practice/chapter-3/");
  assert.match(
    await blockedPage.locator("#storage-notice").innerText(),
    /could not save/,
  );
  await blockedPage.locator('[data-action="reveal"]').click();
  assert.match(
    await blockedPage.locator(".feedback").innerText(),
    /Worked answer/,
  );
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log(
    "Chapter 3 browser checks passed: guided, full cycle, detective, persistence, recovery, links, desktop and 320/390px layouts.",
  );
} finally {
  await browser.close();
}
