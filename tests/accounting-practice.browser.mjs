import assert from "node:assert/strict";
import {
  generate,
  encodeSeed,
  PRESETS,
} from "../public/accounting-practice/engine.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const base = process.env.TEST_URL || "http://127.0.0.1:8765",
  errors = [];
const id = encodeSeed("advanced", PRESETS.advanced, "browser"),
  problem = generate(id);
async function confirm(page) {
  await Promise.all([
    page.evaluate(
      () =>
        new Promise((resolve) =>
          document
            .querySelector("#confirm-dialog")
            .addEventListener("close", () => requestAnimationFrame(resolve), {
              once: true,
            }),
        ),
    ),
    page.locator('#confirm-dialog [value="confirm"]').click(),
  ]);
}
async function put(page, path, value) {
  const n = page.locator(`[data-path="${path}"]`);
  await n.fill(String(value));
  await n.blur();
}
async function keyIntoUI(page, section) {
  await page.evaluate(
    async ({ id, section }) => {
      const { generate } = await import("./engine.mjs");
      const { newWork, answerSection } = await import("./validation.mjs");
      const p = generate(id),
        w = newWork(p);
      answerSection(p, w, section);
      if (section === "journal")
        p.entries.forEach((e, i) => {
          while (
            document.querySelectorAll(`#entry-${i} tbody tr`).length <
            e.lines.length
          )
            document.querySelector(`[data-add="journal.${i}"]`).click();
        });
      for (const el of document.querySelectorAll("#workspace [data-path]")) {
        const value = el.dataset.path.split(".").reduce((v, k) => v[k], w);
        el.value = value ?? "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      }
    },
    { id, section },
  );
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/accounting-practice/`);
  await page.locator("#seed").fill(id);
  await page.locator("#open-seed").click();
  await confirm(page);
  assert.equal(await page.locator("#difficulty").inputValue(), "advanced");
  assert.equal(
    await page.locator(".journal-table").count(),
    problem.entries.length,
  );
  await page.screenshot({
    path: "/tmp/accounting-practice-desktop.png",
    fullPage: true,
  });
  await put(page, "journal.0.0.account", "101");
  await put(page, "journal.0.0.credit", "$5,800");
  assert.equal(
    await page.locator('[data-path="journal.0.0.account"]').inputValue(),
    "Cash",
  );
  assert.equal(
    await page.locator('[data-path="journal.0.0.credit"]').inputValue(),
    "5,800",
  );
  assert.ok(await page.locator("#entry-0 .credit-title").count());
  await page.locator("#check").click();
  assert.match(
    await page.locator("#entry-0").textContent(),
    /Check debit \/ credit side/,
  );
  assert.equal(
    await page.locator('[data-path="journal.0.0.credit"]').inputValue(),
    "5,800",
  );
  await page.locator("#explain").click();
  assert.match(await page.locator("#help").textContent(), /No new revenue/);
  await keyIntoUI(page, "journal");
  await page.locator("#check").click();
  assert.match(await page.locator("#feedback").textContent(), /checks out/);
  assert.ok(
    (await page.locator(".credit-title").count()) >= problem.entries.length,
  );
  await page.reload();
  assert.equal(
    await page.locator('[data-path="journal.0.0.debit"]').inputValue(),
    new Intl.NumberFormat("en-US").format(problem.entries[0].lines[0].debit),
  );
  assert.equal(
    await page.locator('[data-step="journal"]').getAttribute("class"),
    "done",
  );
  console.log(
    "PASS: seed open, dollar formats, indentation, account picker, targeted feedback, full journal check and restored work",
  );
  await page.locator('[data-step="ledger"]').click();
  await put(page, "ledger.101.0.debit", 5800);
  assert.equal(
    await page.locator('[data-balance="101.0.debit"]').textContent(),
    new Intl.NumberFormat("en-US").format((problem.opening["101"] || 0) + 5800),
  );
  await keyIntoUI(page, "ledger");
  await page.locator("#check").click();
  assert.match(await page.locator("#feedback").textContent(), /checks out/);
  await page.screenshot({
    path: "/tmp/accounting-practice-ledger.png",
    fullPage: true,
  });
  await page.locator('[data-step="trial"]').click();
  await keyIntoUI(page, "trial");
  await page.locator("#check").click();
  assert.match(await page.locator("#feedback").textContent(), /checks out/);
  assert.match(
    await page.locator("#trial-difference").textContent(),
    /Totals agree/,
  );
  await page.locator('[data-step="results"]').click();
  await keyIntoUI(page, "results");
  await page.locator("#check").click();
  assert.match(await page.locator("#feedback").textContent(), /checks out/);
  await page.locator('[data-step="corrections"]').click();
  await keyIntoUI(page, "corrections");
  await page.locator("#check").click();
  assert.match(await page.locator("#feedback").textContent(), /checks out/);
  await page.locator("#stats-button").click();
  assert.match(
    await page.locator("#stats-content").textContent(),
    /1completed/,
  );
  await page.locator("#close-stats").click();
  console.log(
    "PASS: independently entered answer keys pass all five sections; running ledger totals and completion stats",
  );
  // Preserve user-correct cells while distinguishing reveal; resets never touch other tools.
  await page.evaluate(() =>
    localStorage.setItem("perfect-pitch.settings.v1", "sentinel"),
  );
  await page.locator("#reset").click();
  await page.locator('#confirm-dialog [value="cancel"]').click();
  assert.equal(
    await page.locator('[data-step="corrections"]').getAttribute("class"),
    "done",
  );
  await page.locator("#reset").click();
  await confirm(page);
  await put(page, "journal.0.0.account", "101");
  await put(page, "journal.0.0.debit", problem.entries[0].lines[0].debit);
  await put(page, "journal.0.0.ref", "101");
  await page.locator("#check").click();
  await page.locator("#reveal").click();
  await confirm(page);
  assert.ok((await page.locator(".field-revealed").count()) > 0);
  assert.ok((await page.locator(".field-ok").count()) > 0);
  await page.reload();
  assert.ok((await page.locator(".field-revealed").count()) > 0);
  await page.locator("#stats-button").click();
  await page.locator("#reset-stats").click();
  await confirm(page);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("perfect-pitch.settings.v1"),
    ),
    "sentinel",
  );
  await page.locator("#close-stats").click();
  console.log(
    "PASS: reveal provenance, confirmation cancel, statistics reset and isolated storage",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of [
      "journal",
      "ledger",
      "trial",
      "results",
      "corrections",
    ]) {
      await page.locator(`[data-step="${section}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${section} overflow ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-step="journal"]').click();
  await page.screenshot({
    path: "/tmp/accounting-practice-mobile.png",
    fullPage: true,
  });
  await page.locator("#difficulty").selectOption("custom");
  await page.locator("#concepts input").first().uncheck();
  await page.locator("#new").click();
  await confirm(page);
  assert.equal(await page.locator("#difficulty").inputValue(), "custom");
  assert.equal(
    await page.locator("#concepts input").first().isChecked(),
    false,
  );
  await page.locator("#seed").fill("bad");
  await page.locator("#open-seed").click();
  assert.match(
    await page.locator("#feedback").textContent(),
    /full Problem ID/,
  );
  console.log(
    "PASS: all five sections at four viewport widths, custom concepts and invalid seeds",
  );
  // A revealed correction must retain the full saved-work shape on reload.
  await page.locator("#seed").fill(id);
  await page.locator("#open-seed").click();
  await confirm(page);
  await page.locator('[data-step="corrections"]').click();
  await page.locator("#reveal").click();
  await confirm(page);
  await page.reload();
  assert.equal(await page.locator("#seed").inputValue(), id);
  assert.equal(
    await page
      .locator('[data-step="corrections"]')
      .getAttribute("aria-current"),
    "step",
  );
  assert.ok((await page.locator(".field-revealed").count()) > 0);
  const blocked = await browser.newPage();
  blocked.on("pageerror", (e) => errors.push(e.message));
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    }),
  );
  await blocked.goto(`${base}/accounting-practice/`);
  await blocked.locator("#storage-notice:not([hidden])").waitFor();
  await blocked.locator("#check").click();
  assert.match(await blocked.locator("#feedback").textContent(), /correct/);
  const corrupt = await browser.newPage();
  corrupt.on("pageerror", (e) => errors.push(e.message));
  await corrupt.addInitScript(() =>
    localStorage.setItem("accounting-practice.v1", '{"version":1,"stats":{}}'),
  );
  await corrupt.goto(`${base}/accounting-practice/`);
  await corrupt.locator("#storage-notice:not([hidden])").waitFor();
  assert.ok((await corrupt.locator(".journal-table").count()) > 0);
  await page.goto(base);
  await page.locator("#searchInput").fill("Accounting Practice");
  assert.equal(
    await page.locator('a[href="/accounting-practice/"]').count(),
    1,
  );
  await page.goto(`${base}/accounting-quizzer/`);
  assert.ok((await page.title()).length > 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: blocked/corrupt storage, searchable homepage link, existing quiz route and no uncaught browser errors",
  );
} finally {
  await browser.close();
}
