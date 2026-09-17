// Run with Playwright installed externally; no runtime dependency is added to the tool.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/perfect-pitch.browser.mjs
import assert from "node:assert/strict";
import {
  DEFAULTS,
  makeQuestion,
  answerLabel,
} from "../public/perfect-pitch/music.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const base = process.env.TEST_URL || "http://127.0.0.1:8765";
const errors = [];
const settings = {
  ...DEFAULTS,
  difficulty: "custom",
  low: 4,
  high: 5,
  timbre: "sine",
  auto: false,
};
async function newPage(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...options,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((s) => {
    if (!localStorage.getItem("perfect-pitch.settings.v1"))
      localStorage.setItem("perfect-pitch.settings.v1", JSON.stringify(s));
    Math.random = () => 0.41;
  }, settings);
  await page.goto(`${base}/perfect-pitch/`);
  return page;
}
async function startMode(page, mode) {
  await page.locator(`[data-mode="${mode}"]`).click();
  await page.locator("#start").click();
  await page.waitForFunction(() => !document.querySelector("#replay").disabled);
}
async function correctAnswer(page, mode, q) {
  if (mode === "exact")
    await page.locator(`#octaves [data-value="${q.octave}"]`).click();
  if (!["interval", "chord"].includes(mode))
    await page.locator(`#pitch-buttons [data-value="${q.pc}"]`).click();
  if (mode === "interval")
    await page.locator(`#choice-buttons [data-value="${q.interval}"]`).click();
  if (["root", "chord"].includes(mode))
    await page.locator(`#choice-buttons [data-value="${q.quality}"]`).click();
  await page.locator("#arena.correct").waitFor();
}
try {
  const page = await newPage();
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of ["play", "settings", "stats"]) {
      await page.locator(`[data-screen="${screen}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${screen} overflow at ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.locator('[data-screen="play"]').click();
  await page.screenshot({
    path: "/tmp/perfect-pitch-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/perfect-pitch-mobile.png",
    fullPage: true,
  });
  console.log("PASS: lobby/settings/stats layouts at five viewport widths");
  for (const mode of [
    "single",
    "exact",
    "interval",
    "chord",
    "root",
    "speed",
    "streak",
  ]) {
    await startMode(page, mode);
    let q = makeQuestion(mode, settings, null, () => 0.41);
    if (mode === "single" || mode === "root")
      await page.screenshot({
        path: `/tmp/perfect-pitch-${mode}-game.png`,
        fullPage: true,
      });
    await correctAnswer(page, mode, q);
    assert.match(
      await page.locator("#feedback").textContent(),
      new RegExp("✓"),
    );
    // Double submissions cannot add extra questions.
    await page.evaluate(() =>
      document.querySelector("#pitch-buttons button").click(),
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("perfect-pitch.stats.v1")).mode[
            document.querySelector("[data-mode][aria-pressed=true]").dataset
              .mode
          ].total,
      ),
      1,
    );
    await page.locator("#next").click();
    await page.waitForFunction(
      () => !document.querySelector("#replay").disabled,
    );
    q = makeQuestion(mode, settings, q, () => 0.41);
    // Replay does not add an answer or reset the question.
    await page.locator("#replay").click();
    if (mode === "exact")
      await page
        .locator(`#octaves [data-value="${q.octave === 4 ? 5 : 4}"]`)
        .click();
    if (!["interval", "chord"].includes(mode))
      await page
        .locator(`#pitch-buttons [data-value="${(q.pc + 1) % 12}"]`)
        .click();
    if (mode === "interval")
      await page
        .locator(`#choice-buttons [data-value="${q.interval === 1 ? 2 : 1}"]`)
        .click();
    if (["root", "chord"].includes(mode))
      await page
        .locator(
          `#choice-buttons [data-value="${q.quality === "major" ? "minor" : "major"}"]`,
        )
        .click();
    await page.locator("#arena.wrong").waitFor();
    assert.ok(
      (await page.locator("#feedback").textContent()).includes(
        answerLabel(q, settings.spelling),
      ),
    );
    assert.equal(await page.locator("#streak").textContent(), "0");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (mode === "streak")
      await page.locator("#summary:not([hidden])").waitFor();
    else await page.locator("#finish").click();
    await page.locator("#choose-mode").click();
    console.log(`PASS: ${mode} correct/wrong/replay/summary`);
  }
  // Repeated notes and quick auto-advance, with keyboard input.
  await page.locator('[data-screen="settings"]').click();
  await page.locator('[name="auto"]').check();
  await page.locator('[name="showTime"]').uncheck();
  await page.locator('[data-screen="play"]').click();
  await startMode(page, "single");
  let q = makeQuestion("single", settings, null, () => 0.41);
  await page.keyboard.press(
    ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j"][q.pc],
  );
  await page.waitForFunction(
    () => document.querySelector("#question-number").textContent === "SOUND 02",
  );
  assert.equal(await page.locator("#time-metric").isVisible(), false);
  assert.ok(!(await page.locator("#feedback").textContent()).includes(" s"));
  await page.locator("#finish").click();
  await page.locator("#choose-mode").click();
  await page.locator('[data-screen="settings"]').click();
  await page.locator('[name="auto"]').uncheck();
  await page.locator('[data-screen="play"]').click();
  console.log(
    "PASS: keyboard input, automatic advance, hidden response-time UI",
  );
  // Complete a whole minute with the browser clock; wrong answers do not end it.
  await page.clock.install();
  await startMode(page, "speed");
  q = makeQuestion("speed", settings, null, () => 0.41);
  await correctAnswer(page, "speed", q);
  await page.clock.fastForward(61000);
  await page.locator("#summary:not([hidden])").waitFor();
  assert.ok(
    (await page.locator("#summary-best").textContent()).includes(
      "Best speed round: 1 correct",
    ),
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("perfect-pitch.stats.v1")).bestSpeed,
    ),
    1,
  );
  await page.locator('[data-screen="stats"]').click();
  assert.equal(await page.locator(".pitch-stat").count(), 12);
  await page.screenshot({
    path: "/tmp/perfect-pitch-stats.png",
    fullPage: true,
  });
  await page.locator("#reset-stats").click();
  await page.locator('[value="cancel"]').click();
  assert.ok(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("perfect-pitch.stats.v1")).total > 0,
    ),
  );
  await page.locator("#reset-stats").click();
  await page.locator('[value="reset"]').click();
  await page.clock.runFor(100);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("perfect-pitch.stats.v1")).total,
    ),
    0,
  );
  console.log("PASS: speed expiry/record, statistics, reset confirmation");
  await page.context().close();

  const blocked = await browser.newPage({
    viewport: { width: 320, height: 740 },
  });
  blocked.on("pageerror", (e) => errors.push(e.message));
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    }),
  );
  await blocked.goto(`${base}/perfect-pitch/`);
  await blocked.locator("#storage-notice:not([hidden])").waitFor();
  await blocked.locator("#start").click();
  await blocked.waitForFunction(
    () => !document.querySelector("#replay").disabled,
  );
  await blocked.locator("#pitch-buttons button").first().click();
  assert.ok(await blocked.locator("#arena.correct, #arena.wrong").count());
  await blocked.locator("#finish").click();
  console.log("PASS: fully blocked localStorage still allows a game");
  const unsupported = await browser.newPage();
  unsupported.on("pageerror", (e) => errors.push(e.message));
  await unsupported.addInitScript(() => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  await unsupported.goto(`${base}/perfect-pitch/`);
  await unsupported.locator("#start").click();
  await unsupported.locator("#start-error:not([hidden])").waitFor();
  assert.match(
    await unsupported.locator("#start-error").textContent(),
    /does not support Web Audio/,
  );
  console.log("PASS: useful Web Audio unavailable message");
  const audio = await newPage();
  const rendered = await audio.evaluate(async () => {
    const { Sound } = await import("./audio.mjs");
    const results = [];
    for (const timbre of ["sine", "piano", "organ", "soft", "bright"]) {
      const ctx = new OfflineAudioContext(1, 48000 * 2, 48000),
        s = new Sound();
      s.context = ctx;
      s.master = ctx.createGain();
      s.master.gain.value = 0.32;
      s.master.connect(ctx.destination);
      if (timbre === "piano") await s.piano.prepare(ctx);
      s.tone(69, timbre, 0.05, 0.75, 1);
      const buffer = await ctx.startRendering(),
        samples = buffer.getChannelData(0);
      let peak = 0,
        energy = 0,
        crossings = 0;
      for (let i = 4800; i < 24000; i++) {
        peak = Math.max(peak, Math.abs(samples[i]));
        energy += samples[i] ** 2;
        if (samples[i - 1] <= 0 && samples[i] > 0) crossings++;
      }
      results.push({
        timbre,
        peak,
        rms: Math.sqrt(energy / 19200),
        hz: crossings / 0.4,
        finite: samples.every(Number.isFinite),
      });
    }
    return results;
  });
  for (const r of rendered) {
    assert.ok(r.finite);
    assert.ok(r.peak > 0 && r.peak < 1);
    assert.ok(r.rms > 0);
  }
  assert.ok(Math.abs(rendered[0].hz - 440) < 3);
  assert.equal(new Set(rendered.map((r) => r.rms.toFixed(5))).size, 5);
  console.log(
    "PASS: five OfflineAudioContext renders including real piano samples; finite, unclipped, distinct envelopes; A4 sine at 440 Hz",
  );
  const whites = await newPage({ viewport: { width: 320, height: 740 } });
  await whites.locator('[data-screen="settings"]').click();
  await whites.locator('[name="includeBlackKeys"]').uncheck();
  await whites.reload();
  await whites.locator('[data-screen="settings"]').click();
  assert.equal(
    await whites.locator('[name="includeBlackKeys"]').isChecked(),
    false,
  );
  await whites.locator('[data-screen="play"]').click();
  assert.match(
    await whites.locator("#setup-description").textContent(),
    /White keys only/,
  );
  for (const mode of ["single", "exact", "speed", "streak"]) {
    await startMode(whites, mode);
    assert.equal(await whites.locator("#pitch-buttons button").count(), 7);
    assert.equal(await whites.locator("#pitch-buttons .accidental").count(), 0);
    await whites.keyboard.press("w");
    assert.equal(
      await whites.locator("#arena.correct, #arena.wrong").count(),
      0,
    );
    const q = makeQuestion(
      mode,
      { ...settings, includeBlackKeys: false },
      null,
      () => 0.41,
    );
    await correctAnswer(whites, mode, q);
    assert.ok(
      await whites.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (mode === "single")
      await whites.screenshot({
        path: "/tmp/perfect-pitch-white-keys.png",
        fullPage: true,
      });
    await whites.locator("#finish").click();
    await whites.locator("#choose-mode").click();
  }
  await whites.locator('[data-screen="settings"]').click();
  await whites.locator('[name="includeBlackKeys"]').check();
  await whites.locator('[data-screen="play"]').click();
  await startMode(whites, "single");
  assert.equal(await whites.locator("#pitch-buttons button").count(), 12);
  assert.equal(await whites.locator("#pitch-buttons .accidental").count(), 5);
  console.log(
    "PASS: white-key toggle persists, filters four note modes and keyboard input, fits 320px, and restores black keys",
  );
  await whites.context().close();
  const sampledPitches = await audio.evaluate(async () => {
    const { Sound } = await import("./audio.mjs");
    const results = [];
    for (const midi of [24, 69, 70, 107]) {
      const ctx = new OfflineAudioContext(1, 48000 * 2, 48000),
        s = new Sound();
      s.context = ctx;
      s.master = ctx.createGain();
      s.master.gain.value = 0.32;
      s.master.connect(ctx.destination);
      await s.piano.prepare(ctx);
      s.tone(midi, "piano", 0.05, 0.75, 1);
      const buffer = await ctx.startRendering(),
        a = buffer.getChannelData(0);
      const harmonic = midi < 60 ? 2 : 1,
        expected = 440 * 2 ** ((midi - 69) / 12) * harmonic;
      let best = 0,
        measured = 0;
      // Compare spectral energy around the requested pitch (including the top register).
      for (let step = -60; step <= 60; step++) {
        const hz = expected * (1 + step / 1000),
          coefficient = 2 * Math.cos((2 * Math.PI * hz) / 48000);
        let p = 0,
          pp = 0;
        for (let i = 7200; i < 28800; i++) {
          const v =
            a[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * (i - 7200)) / 21600)) +
            coefficient * p -
            pp;
          pp = p;
          p = v;
        }
        const energy = p * p + pp * pp - coefficient * p * pp;
        if (energy > best) {
          best = energy;
          measured = hz;
        }
      }
      results.push({
        midi,
        cents: 1200 * Math.log2(measured / expected),
        peak: Math.max(...a.map(Math.abs)),
        tail: a.slice(60000).every((v) => Math.abs(v) < 1e-7),
      });
    }
    return results;
  });
  for (const r of sampledPitches) {
    assert.ok(Math.abs(r.cents) < 10, JSON.stringify(r));
    assert.ok(r.peak > 0 && r.peak < 1);
    assert.ok(r.tail);
  }
  console.log(
    "PASS: recorded low/A4/transposed/high notes render within 10 cents of target with silent release tails",
  );
  const pianoPage = await newPage();
  await pianoPage.locator('[data-screen="settings"]').click();
  await pianoPage.locator('[name="timbre"]').selectOption("piano");
  await pianoPage.locator("#preview-sound").click();
  await pianoPage.waitForFunction(
    () => !document.querySelector("#preview-sound").disabled,
  );
  assert.equal(await pianoPage.locator("#preview-error").isVisible(), false);
  await pianoPage.locator('[data-screen="play"]').click();
  await startMode(pianoPage, "single");
  // No network is available after the bank is prepared: replay and next still work.
  await pianoPage.context().setOffline(true);
  await pianoPage.locator("#replay").click();
  let pianoQuestion = makeQuestion(
    "single",
    { ...settings, timbre: "piano" },
    null,
    () => 0.41,
  );
  await correctAnswer(pianoPage, "single", pianoQuestion);
  await pianoPage.locator("#next").click();
  await pianoPage.waitForFunction(
    () => !document.querySelector("#replay").disabled,
  );
  pianoQuestion = makeQuestion(
    "single",
    { ...settings, timbre: "piano" },
    pianoQuestion,
    () => 0.41,
  );
  await correctAnswer(pianoPage, "single", pianoQuestion);
  assert.equal(await pianoPage.locator("#game-error").isVisible(), false);
  await pianoPage.context().close();
  const missingPiano = await browser.newPage();
  missingPiano.on("pageerror", (e) => errors.push(e.message));
  await missingPiano.route("**/assets/piano.mp3", (route) => route.abort());
  await missingPiano.goto(`${base}/perfect-pitch/`);
  await missingPiano.locator("#start").click();
  await missingPiano.locator("#start-error:not([hidden])").waitFor();
  assert.match(
    await missingPiano.locator("#start-error").textContent(),
    /piano recordings could not load/,
  );
  await missingPiano.locator('[data-screen="settings"]').click();
  await missingPiano.locator('[name="timbre"]').selectOption("sine");
  await missingPiano.locator('[data-screen="play"]').click();
  await startMode(missingPiano, "single");
  await missingPiano.context().close();
  console.log(
    "PASS: sampled piano preview/play/replay/next work offline after load; failed downloads explain recovery and other timbres remain playable",
  );
  assert.deepEqual(errors, []);
  console.log("PASS: no uncaught browser errors");
} finally {
  await browser.close();
}
