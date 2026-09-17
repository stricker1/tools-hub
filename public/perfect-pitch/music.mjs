// Pure music / statistics helpers. MIDI 60 is C4; MIDI 69 is A4.
export const SHARPS = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];
export const FLATS = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
];
export const TIMBRES = {
  sine: "Pure sine",
  piano: "Piano-like",
  organ: "Organ",
  soft: "Soft synth",
  bright: "Bright synth",
};
export const INTERVALS = [
  "Minor 2nd",
  "Major 2nd",
  "Minor 3rd",
  "Major 3rd",
  "Perfect 4th",
  "Tritone",
  "Perfect 5th",
  "Minor 6th",
  "Major 6th",
  "Minor 7th",
  "Major 7th",
  "Octave",
];
export const CHORDS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};
export const MODES = {
  single: ["Single note", "One sound. Twelve possibilities.", "01"],
  exact: ["Exact note", "Find the pitch. Pin down the octave.", "02"],
  interval: ["Interval", "Two notes. Name the distance.", "03"],
  chord: ["Chord quality", "Six colors of harmony.", "04"],
  root: ["Root + quality", "Hear the whole picture.", "05"],
  speed: ["Speed round", "60 seconds. Make every note count.", "60″"],
  streak: ["Streak mode", "Keep it going. One miss ends the run.", "∞"],
};
export const PRESETS = {
  easy: [4, 5],
  normal: [3, 5],
  hard: [1, 7],
  chaos: [1, 7],
};
export const DEFAULTS = {
  difficulty: "normal",
  low: 3,
  high: 5,
  timbre: "piano",
  randomTimbre: false,
  spelling: "both",
  auto: true,
  volume: 0.45,
  direction: "both",
  showTime: true,
};
export const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
export const octave = (midi) => Math.floor(midi / 12) - 1;
export function pitchName(pc, spelling = "both") {
  pc = ((pc % 12) + 12) % 12;
  return spelling === "flats"
    ? FLATS[pc]
    : spelling === "sharps" || SHARPS[pc] === FLATS[pc]
      ? SHARPS[pc]
      : `${SHARPS[pc]}/${FLATS[pc]}`;
}
export const noteName = (midi, spelling) =>
  `${pitchName(midi % 12, spelling)}${octave(midi)}`;
export function cleanSettings(raw) {
  const s = { ...DEFAULTS };
  if (!raw || typeof raw !== "object") return s;
  for (const [key, allowed] of Object.entries({
    difficulty: [...Object.keys(PRESETS), "custom"],
    timbre: Object.keys(TIMBRES),
    spelling: ["sharps", "flats", "both"],
    direction: ["ascending", "descending", "both"],
  })) {
    if (allowed.includes(raw[key])) s[key] = raw[key];
  }
  for (const key of ["randomTimbre", "auto", "showTime"])
    if (typeof raw[key] === "boolean") s[key] = raw[key];
  for (const key of ["low", "high"])
    if (Number.isInteger(raw[key]) && raw[key] >= 1 && raw[key] <= 7)
      s[key] = raw[key];
  if (s.low > s.high) [s.low, s.high] = [s.high, s.low];
  if (Number.isFinite(raw.volume))
    s.volume = Math.max(0, Math.min(1, raw.volume));
  return s;
}
function pick(items, random) {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}
export function rangeError(mode, settings) {
  return ["interval", "chord", "root"].includes(mode) &&
    settings.low === settings.high
    ? "Choose at least two octaves in Settings for intervals and open chord voicings."
    : "";
}
export function makeQuestion(
  mode,
  settings,
  previous = null,
  random = Math.random,
) {
  if (rangeError(mode, settings))
    throw new RangeError(rangeError(mode, settings));
  const low = (settings.low + 1) * 12,
    high = (settings.high + 1) * 12 + 11;
  const timbre =
    settings.randomTimbre || settings.difficulty === "chaos"
      ? pick(Object.keys(TIMBRES), random)
      : settings.timbre;
  const q = { mode, timbre };
  let offsets = [0];
  if (mode === "interval") {
    q.interval = 1 + Math.floor(random() * 12);
    q.direction =
      settings.direction === "both"
        ? pick(["ascending", "descending"], random)
        : settings.direction;
    offsets = q.direction === "ascending" ? [0, q.interval] : [0, -q.interval];
  } else if (mode === "chord" || mode === "root") {
    q.quality = pick(Object.keys(CHORDS), random);
    const [, third, fifth] = CHORDS[q.quality];
    // Root in the bass, upper voices spread across an octave. No muddy low clusters.
    offsets = random() < 0.5 ? [0, fifth, third + 12] : [0, third, fifth + 12];
  }
  const min = low - Math.min(...offsets),
    max = high - Math.max(...offsets);
  let candidates = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  // Remove the exact previous starting note, rather than repeatedly rerolling.
  if (previous && candidates.length > 1)
    candidates = candidates.filter((n) => n !== previous.midi);
  q.midi = pick(candidates, random);
  q.pc = q.midi % 12;
  q.octave = octave(q.midi);
  q.notes = offsets.map((n) => n + q.midi);
  return q;
}
export function isCorrect(q, answer) {
  if (q.mode === "interval") return answer.interval === q.interval;
  if (q.mode === "chord") return answer.quality === q.quality;
  if (q.mode === "root")
    return answer.pc === q.pc && answer.quality === q.quality;
  if (q.mode === "exact")
    return answer.pc === q.pc && answer.octave === q.octave;
  return answer.pc === q.pc;
}
export function answerLabel(q, spelling) {
  if (q.mode === "interval") return INTERVALS[q.interval - 1];
  if (q.mode === "chord") return q.quality;
  if (q.mode === "root") return `${pitchName(q.pc, spelling)} ${q.quality}`;
  return q.mode === "exact"
    ? noteName(q.midi, spelling)
    : pitchName(q.pc, spelling);
}
export const emptyStats = () => ({
  version: 1,
  total: 0,
  correct: 0,
  time: 0,
  bestStreak: 0,
  bestSpeed: 0,
  pitch: {},
  timbre: {},
  register: {},
  interval: {},
  quality: {},
  mode: {},
});
const validNumber = (n) =>
  Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
export function cleanStats(raw) {
  const out = emptyStats();
  if (!raw || raw.version !== 1) return out;
  for (const k of ["total", "correct", "time", "bestStreak", "bestSpeed"])
    if (validNumber(raw[k])) out[k] = raw[k];
  out.correct = Math.min(out.total, out.correct);
  const keys = {
    pitch: Array.from({ length: 12 }, (_, i) => String(i)),
    timbre: Object.keys(TIMBRES),
    register: ["1", "2", "3", "4", "5", "6", "7"],
    interval: Array.from({ length: 12 }, (_, i) => String(i + 1)),
    quality: Object.keys(CHORDS),
    mode: Object.keys(MODES),
  };
  for (const [group, allowed] of Object.entries(keys))
    for (const key of allowed) {
      const b = raw[group]?.[key];
      if (
        b &&
        ["total", "correct", "time"].every((k) => validNumber(b[k])) &&
        b.correct <= b.total
      ) {
        out[group][key] = {
          total: b.total,
          correct: b.correct,
          time: b.time,
          best: validNumber(b.best) ? b.best : 0,
        };
      }
    }
  return out;
}
export function recordAnswer(stats, q, correct, seconds, streak) {
  stats.total++;
  stats.correct += Number(correct);
  stats.time += seconds;
  stats.bestStreak = Math.max(stats.bestStreak, streak);
  function add(group, key) {
    const b = (stats[group][key] ||= {
      total: 0,
      correct: 0,
      time: 0,
      best: 0,
    });
    b.total++;
    b.correct += Number(correct);
    b.time += seconds;
    b.best = Math.max(b.best, streak);
  }
  add("mode", q.mode);
  add("timbre", q.timbre);
  add("register", q.octave);
  if (["single", "exact", "speed", "streak"].includes(q.mode))
    add("pitch", q.pc);
  if (q.mode === "interval") add("interval", q.interval);
  if (q.quality) add("quality", q.quality);
}
export function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return { value: value ? JSON.parse(value) : fallback, ok: true };
  } catch {
    return { value: fallback, ok: false };
  }
}
export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
