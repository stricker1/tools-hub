import { pianoSample } from "../public/perfect-pitch/piano.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULTS,
  CHORDS,
  MODES,
  frequency,
  octave,
  pitchName,
  makeQuestion,
  isCorrect,
  rangeError,
  cleanSettings,
  cleanStats,
  emptyStats,
  recordAnswer,
  readStored,
  writeStored,
} from "../public/perfect-pitch/music.mjs";

test("concert pitch and scientific octave numbering", () => {
  assert.equal(frequency(69), 440);
  assert.ok(Math.abs(frequency(60) - 261.6255653005986) < 1e-10);
  assert.equal(frequency(81), 880);
  assert.equal(octave(60), 4);
  assert.equal(octave(59), 3);
  for (let midi = 24; midi < 107; midi++)
    assert.ok(
      Math.abs(frequency(midi + 1) / frequency(midi) - 2 ** (1 / 12)) < 1e-12,
    );
});
test("enharmonic spellings change labels, not pitch-class scoring", () => {
  assert.equal(pitchName(1, "sharps"), "C♯");
  assert.equal(pitchName(1, "flats"), "D♭");
  assert.equal(pitchName(1), "C♯/D♭");
  assert.ok(
    isCorrect({ mode: "single", pc: 1, octave: 2 }, { pc: 1, octave: 7 }),
  );
  assert.ok(
    !isCorrect({ mode: "exact", pc: 1, octave: 2 }, { pc: 1, octave: 7 }),
  );
  assert.ok(
    !isCorrect(
      { mode: "root", pc: 1, quality: "minor" },
      { pc: 1, quality: "major" },
    ),
  );
});
test("all modes remain in range, avoid repeated starting MIDI, and preserve musical structure", () => {
  let seed = 42;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const seenIntervals = new Set(),
    seenQualities = new Set(),
    seenTimbres = new Set();
  for (const mode of Object.keys(MODES))
    for (const [low, high] of [
      [1, 7],
      [4, 5],
      [6, 7],
    ]) {
      let previous;
      for (let i = 0; i < 500; i++) {
        const q = makeQuestion(
          mode,
          { ...DEFAULTS, low, high, randomTimbre: true },
          previous,
          random,
        );
        assert.ok(
          q.notes.every(
            (n) =>
              Number.isInteger(n) &&
              n >= (low + 1) * 12 &&
              n <= (high + 1) * 12 + 11,
          ),
        );
        if (previous) assert.notEqual(q.midi, previous.midi);
        assert.ok(isCorrect(q, q));
        seenTimbres.add(q.timbre);
        if (mode === "interval") {
          assert.equal(Math.abs(q.notes[1] - q.notes[0]), q.interval);
          assert.equal(
            Math.sign(q.notes[1] - q.notes[0]),
            q.direction === "ascending" ? 1 : -1,
          );
          seenIntervals.add(q.interval);
        }
        if (q.quality) {
          assert.deepEqual(
            q.notes.map((n) => (n - q.midi) % 12).sort((a, b) => a - b),
            [...CHORDS[q.quality]].sort((a, b) => a - b),
          );
          assert.ok(Math.max(...q.notes) - Math.min(...q.notes) > 12);
          seenQualities.add(q.quality);
        }
        previous = q;
      }
    }
  assert.equal(seenIntervals.size, 12);
  assert.equal(seenQualities.size, 6);
  assert.equal(seenTimbres.size, 5);
});
test("directions, chaos timbres, and one-octave limitations are explicit", () => {
  for (const direction of ["ascending", "descending"])
    for (let i = 0; i < 50; i++)
      assert.equal(
        makeQuestion("interval", { ...DEFAULTS, direction }).direction,
        direction,
      );
  assert.ok(rangeError("chord", { ...DEFAULTS, low: 4, high: 4 }));
  assert.equal(rangeError("single", { ...DEFAULTS, low: 4, high: 4 }), "");
  assert.throws(
    () => makeQuestion("interval", { ...DEFAULTS, low: 4, high: 4 }),
    RangeError,
  );
  assert.equal(
    makeQuestion(
      "single",
      { ...DEFAULTS, difficulty: "chaos" },
      null,
      () => 0.99,
    ).timbre,
    "bright",
  );
});
test("statistics isolate pitch answers from interval/chord roots and track modes", () => {
  const s = emptyStats();
  recordAnswer(
    s,
    { mode: "single", pc: 4, octave: 4, timbre: "piano" },
    true,
    0.5,
    1,
  );
  recordAnswer(
    s,
    { mode: "interval", pc: 4, octave: 4, timbre: "sine", interval: 7 },
    false,
    1.5,
    0,
  );
  recordAnswer(
    s,
    { mode: "root", pc: 8, octave: 3, timbre: "organ", quality: "minor" },
    true,
    1,
    2,
  );
  assert.equal(s.total, 3);
  assert.equal(s.correct, 2);
  assert.equal(s.time, 3);
  assert.equal(s.pitch[4].total, 1);
  assert.equal(s.pitch[8], undefined);
  assert.equal(s.interval[7].correct, 0);
  assert.equal(s.quality.minor.correct, 1);
  assert.equal(s.bestStreak, 2);
  assert.equal(s.mode.root.best, 2);
  assert.deepEqual(cleanStats(JSON.parse(JSON.stringify(s))), s);
});
test("malformed settings and stats are sanitized", () => {
  assert.deepEqual(cleanSettings(null), DEFAULTS);
  const s = cleanSettings({
    low: 7,
    high: 2,
    volume: Infinity,
    timbre: "<script>",
    spelling: "bad",
    auto: "false",
  });
  assert.equal(s.low, 2);
  assert.equal(s.high, 7);
  assert.equal(s.volume, DEFAULTS.volume);
  assert.equal(s.timbre, DEFAULTS.timbre);
  assert.equal(s.auto, true);
  const stats = cleanStats({
    version: 1,
    total: 2,
    correct: 999,
    time: -4,
    pitch: { 0: { total: 5, correct: 7, time: 1 } },
    timbre: { evil: { total: 1, correct: 1, time: 0 } },
  });
  assert.equal(stats.correct, 2);
  assert.equal(stats.time, 0);
  assert.deepEqual(stats.pitch, {});
  assert.deepEqual(stats.timbre, {});
});
test("blocked storage and corrupt JSON never throw", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  assert.deepEqual(readStored("test", {}), { value: {}, ok: false });
  assert.equal(writeStored("test", {}), false);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "{broken",
      setItem: () => {
        throw new Error("quota");
      },
    },
  });
  assert.equal(readStored("test", null).ok, false);
  assert.equal(writeStored("test", {}), false);
  delete globalThis.localStorage;
});

test("white-key setting filters note modes across ranges without changing harmony modes", () => {
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11];
  assert.equal(cleanSettings({}).includeBlackKeys, true);
  assert.equal(
    cleanSettings({ includeBlackKeys: false }).includeBlackKeys,
    false,
  );
  assert.equal(
    cleanSettings({ includeBlackKeys: "false" }).includeBlackKeys,
    true,
  );
  for (const mode of ["single", "exact", "speed", "streak"]) {
    for (const [low, high] of [
      [1, 1],
      [4, 5],
      [1, 7],
    ]) {
      const s = { ...DEFAULTS, low, high, includeBlackKeys: false };
      const seen = new Set();
      let previous;
      for (let i = 0; i < 100; i++) {
        const q = makeQuestion(mode, s, previous, () => i / 100);
        assert.ok(whiteKeys.includes(q.pc));
        assert.ok(q.midi >= (low + 1) * 12 && q.midi <= (high + 1) * 12 + 11);
        if (previous) assert.notEqual(q.midi, previous.midi);
        seen.add(q.pc);
        previous = q;
      }
      assert.equal(seen.size, 7);
    }
  }
  for (const mode of ["interval", "chord", "root"]) {
    assert.deepEqual(
      makeQuestion(
        mode,
        { ...DEFAULTS, includeBlackKeys: false },
        null,
        () => 0.41,
      ),
      makeQuestion(mode, DEFAULTS, null, () => 0.41),
    );
  }
  const all = new Set(
    Array.from(
      { length: 120 },
      (_, i) => makeQuestion("single", DEFAULTS, null, () => i / 120).pc,
    ),
  );
  assert.equal(all.size, 12);
});

test("piano samples cover every playable MIDI note with at most one semitone of transposition", () => {
  for (let midi = 24; midi <= 107; midi++) {
    const sample = pianoSample(midi);
    assert.ok(Math.abs(midi - sample.root) <= 1);
    assert.ok(sample.offset >= 0 && sample.offset <= 58.8 + 1e-9);
    assert.ok(
      Math.abs(frequency(sample.root) * sample.rate - frequency(midi)) < 1e-10,
    );
    assert.ok(sample.offset + 1.23 * sample.rate < sample.offset + 2.1);
  }
  assert.deepEqual(pianoSample(69), { root: 69, offset: 31.5, rate: 1 });
});
