import {
  SHARPS,
  WHITE_KEYS,
  usesWhiteKeys,
  TIMBRES,
  INTERVALS,
  CHORDS,
  MODES,
  PRESETS,
  cleanSettings,
  cleanStats,
  emptyStats,
  pitchName,
  makeQuestion,
  rangeError,
  isCorrect,
  answerLabel,
  recordAnswer,
  readStored,
  writeStored,
} from "./music.mjs";
import { Sound } from "./audio.mjs";

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = "perfect-pitch.settings.v1",
  STATS_KEY = "perfect-pitch.stats.v1";
const storedSettings = readStored(SETTINGS_KEY, null),
  storedStats = readStored(STATS_KEY, null);
let settings = cleanSettings(storedSettings.value),
  stats = cleanStats(storedStats.value);
let mode = "single",
  run = null,
  question = null,
  selection = {},
  token = 0;
let advanceTimer,
  readyTimer,
  animationTimer,
  clockTimer,
  busy = false;
const sound = new Sound();
const KEYS = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j"];
const percent = (correct, total) =>
  total ? `${Math.round((correct / total) * 100)}%` : "—";
const seconds = (value) => `${value.toFixed(2)} s`;
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function storageStatus(ok) {
  if (!ok) $("storage-notice").hidden = false;
}
storageStatus(storedSettings.ok && storedStats.ok);
function saveSettings() {
  storageStatus(writeStored(SETTINGS_KEY, settings));
}
function saveStats() {
  storageStatus(writeStored(STATS_KEY, stats));
}
function error(id, message = "") {
  $(id).textContent = message;
  $(id).hidden = !message;
}
function clearTimers() {
  clearTimeout(advanceTimer);
  clearTimeout(readyTimer);
  clearTimeout(animationTimer);
  clearInterval(clockTimer);
}
function setNavigationLocked(locked) {
  document.querySelectorAll("[data-screen]").forEach((b) => {
    b.disabled = locked;
  });
}
function showScreen(screen) {
  if (run?.active || busy) return;
  sound.stop();
  for (const name of ["play", "stats", "settings"])
    $(`${name}-screen`).hidden = name !== screen;
  document.querySelectorAll("[data-screen]").forEach((b) => {
    if (b.dataset.screen === screen) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (screen === "stats") renderStats();
}
document
  .querySelectorAll("[data-screen]")
  .forEach((b) =>
    b.addEventListener("click", () => showScreen(b.dataset.screen)),
  );
for (const [key, [name, description, number]] of Object.entries(MODES)) {
  const b = node("button", "mode-card");
  b.type = "button";
  b.dataset.mode = key;
  b.setAttribute("aria-pressed", String(key === mode));
  b.append(
    node("span", "mode-number", number),
    node("strong", "", name),
    node("small", "", description),
  );
  b.addEventListener("click", () => {
    mode = key;
    document
      .querySelectorAll("[data-mode]")
      .forEach((btn) =>
        btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode)),
      );
    error("start-error");
    updateSetup();
  });
  $("mode-grid").append(b);
}
function updateSetup() {
  $("difficulty").value = settings.difficulty;
  const random = settings.randomTimbre || settings.difficulty === "chaos";
  $("setup-description").textContent =
    `C${settings.low}–B${settings.high} · ${random ? "Random timbre" : TIMBRES[settings.timbre]} · ${usesWhiteKeys(mode, settings) ? "White keys only" : "All notes"} · ${settings.auto ? "Auto advance" : "Tap for next"}`;
}
$("difficulty").addEventListener("change", (e) => {
  settings.difficulty = e.target.value;
  if (PRESETS[settings.difficulty])
    [settings.low, settings.high] = PRESETS[settings.difficulty];
  saveSettings();
  syncSettings();
  updateSetup();
});
for (let o = 1; o <= 7; o++)
  for (const id of ["low", "high"]) {
    const option = node("option", "", `${o} · ${id === "low" ? "C" : "B"}${o}`);
    option.value = o;
    $(id).append(option);
  }
function syncSettings() {
  for (const el of $("settings-form").elements) {
    if (!(el.name in settings)) continue;
    if (el.type === "checkbox") el.checked = settings[el.name];
    else el.value = settings[el.name];
  }
  $("volume-label").textContent = `${Math.round(settings.volume * 100)}%`;
}
$("settings-form").addEventListener("submit", (e) => e.preventDefault());
$("settings-form").addEventListener("input", (e) => {
  const el = e.target;
  if (!(el.name in settings)) return;
  settings[el.name] =
    el.type === "checkbox"
      ? el.checked
      : ["low", "high", "volume"].includes(el.name)
        ? Number(el.value)
        : el.value;
  if (el.name === "low" || el.name === "high") {
    settings.difficulty = "custom";
    if (settings.low > settings.high)
      settings[el.name === "low" ? "high" : "low"] = settings[el.name];
  }
  settings = cleanSettings(settings);
  syncSettings();
  updateSetup();
  saveSettings();
  if (sound.context && el.name === "volume")
    sound.master.gain.setTargetAtTime(
      settings.volume * 0.32,
      sound.context.currentTime,
      0.015,
    );
});
$("preview-sound").addEventListener("click", async () => {
  $("preview-sound").disabled = true;
  try {
    await sound.unlock(settings.volume);
    sound.play({ mode: "single", notes: [69], timbre: settings.timbre });
    error("preview-error");
  } catch (e) {
    error("preview-error", e.message);
  } finally {
    $("preview-sound").disabled = false;
  }
});

function showLobby() {
  document.body.classList.remove("playing");
  $("lobby").hidden = false;
  $("game").hidden = true;
  $("summary").hidden = true;
  updateSetup();
}
async function start() {
  if (busy || run?.active) return;
  const issue = rangeError(mode, settings);
  if (issue) {
    showLobby();
    error("start-error", issue);
    return;
  }
  busy = true;
  const ticket = ++token;
  $("start").disabled = true;
  $("again").disabled = true;
  setNavigationLocked(true);
  try {
    await sound.unlock(settings.volume);
    if (ticket !== token || document.hidden) return;
    clearTimers();
    run = {
      active: true,
      total: 0,
      correct: 0,
      score: 0,
      streak: 0,
      best: 0,
      time: 0,
      deadline: null,
      ready: false,
      answered: false,
      record: stats.mode[mode]?.best || 0,
      speedRecord: stats.bestSpeed,
    };
    question = null;
    $("lobby").hidden = true;
    $("summary").hidden = true;
    $("game").hidden = false;
    document.body.classList.add("playing");
    document.body.dataset.gameMode = mode;
    $("game-title").textContent = MODES[mode][0];
    $("game-context").textContent =
      `${settings.difficulty.toUpperCase()} / C${settings.low}–B${settings.high}${usesWhiteKeys(mode, settings) ? " / WHITE KEYS" : ""}`;
    $("timer-track").hidden = mode !== "speed";
    error("start-error");
    error("game-error");
    buildAnswers();
    nextQuestion();
    if (mode === "speed") {
      run.deadline = run.started + 60000;
      clockTimer = setInterval(updateClock, 50);
      updateClock();
    }
  } catch (e) {
    if (run?.active) finish("audio");
    showLobby();
    error("start-error", e.message);
    setNavigationLocked(false);
  } finally {
    busy = false;
    $("start").disabled = false;
    $("again").disabled = false;
    if (!run?.active) setNavigationLocked(false);
  }
}
$("start").addEventListener("click", start);
$("again").addEventListener("click", start);
$("choose-mode").addEventListener("click", showLobby);
$("finish").addEventListener("click", () => finish("manual"));
function buildAnswers() {
  $("pitch-buttons").replaceChildren();
  $("octaves").replaceChildren();
  $("choice-buttons").replaceChildren();
  $("pitch-area").hidden = ["interval", "chord"].includes(mode);
  $("octave-area").hidden = mode !== "exact";
  $("choice-area").hidden = !["interval", "chord", "root"].includes(mode);
  $("pitch-heading").textContent =
    mode === "root" ? "Pick the root" : "Name that note";
  $("choice-heading").textContent =
    mode === "interval" ? "Name the interval" : "Pick the chord quality";
  const whiteKeysOnly = usesWhiteKeys(mode, settings);
  $("pitch-buttons").classList.toggle("white-keys", whiteKeysOnly);
  for (let pc = 0; pc < 12; pc++) {
    if (whiteKeysOnly && !WHITE_KEYS.includes(pc)) continue;
    const b = answerButton(pitchName(pc, settings.spelling), "pc", pc);
    b.classList.toggle("accidental", SHARPS[pc].includes("♯"));
    b.classList.toggle("both", settings.spelling === "both");
    b.append(node("small", "", KEYS[pc].toUpperCase()));
    b.setAttribute(
      "aria-label",
      `${pitchName(pc, settings.spelling)}${mode === "root" ? " root" : ""}, shortcut ${KEYS[pc].toUpperCase()}`,
    );
    $("pitch-buttons").append(b);
  }
  for (let o = settings.low; o <= settings.high; o++) {
    const b = answerButton(String(o), "octave", o);
    b.setAttribute("aria-label", `Octave ${o}`);
    $("octaves").append(b);
  }
  if (mode === "interval")
    INTERVALS.forEach((name, i) =>
      $("choice-buttons").append(answerButton(name, "interval", i + 1)),
    );
  else
    for (const quality of Object.keys(CHORDS))
      $("choice-buttons").append(
        answerButton(
          quality.charAt(0).toUpperCase() + quality.slice(1),
          "quality",
          quality,
        ),
      );
  $("keyboard-help").textContent =
    mode === "interval" || mode === "chord"
      ? "Keyboard: Tab + Enter to answer · Space to replay · Enter for next"
      : `Keyboard: ${whiteKeysOnly ? "A S D F G H J" : "A W S E D F T G Y H U J"}${mode === "exact" ? " · 1–7 for octave" : ""} · Space to replay`;
}
function answerButton(label, part, value) {
  const b = node("button", "answer", label);
  b.type = "button";
  b.dataset.part = part;
  b.dataset.value = value;
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => choose(part, value));
  return b;
}
function enableAnswers(enabled) {
  document.querySelectorAll("#game .answer").forEach((b) => {
    b.disabled = !enabled;
  });
}
function nextQuestion() {
  if (!run?.active) return;
  if (mode === "speed" && run.deadline && performance.now() >= run.deadline) {
    finish("time");
    return;
  }
  if (sound.context.state !== "running") {
    run.ready = false;
    enableAnswers(false);
    $("next").hidden = false;
    $("next").textContent = "Resume audio →";
    error("game-error", "Audio was interrupted. Tap Resume audio to continue.");
    return;
  }
  clearTimeout(advanceTimer);
  clearTimeout(readyTimer);
  question = makeQuestion(mode, settings, question);
  selection = {};
  run.ready = false;
  run.answered = false;
  $("arena").className = "arena";
  $("next").hidden = true;
  $("next").textContent = "Next sound →";
  $("replay").disabled = true;
  enableAnswers(false);
  document.querySelectorAll("#game .answer").forEach((b) => {
    b.classList.remove("right", "miss");
    b.setAttribute("aria-pressed", "false");
  });
  $("selection-hint").textContent =
    mode === "root"
      ? "Root + quality, either order"
      : mode === "exact"
        ? "Note + octave, either order"
        : "";
  $("question-number").textContent =
    `SOUND ${String(run.total + 1).padStart(2, "0")}`;
  $("prompt").textContent =
    mode === "interval"
      ? "What’s the interval?"
      : ["chord", "root"].includes(mode)
        ? "What’s the chord?"
        : "What’s the note?";
  $("feedback").textContent =
    mode === "exact"
      ? "Choose a note and its octave."
      : mode === "root"
        ? "Choose a root and a quality."
        : "Listen. Trust your first instinct.";
  const latency = sound.play(question);
  run.started = performance.now() + latency;
  animateSound();
  const ticket = token;
  readyTimer = setTimeout(() => {
    if (!run?.active || ticket !== token) return;
    run.ready = true;
    enableAnswers(true);
    $("replay").disabled = false;
  }, latency);
  updateMetrics();
}
function animateSound() {
  clearTimeout(animationTimer);
  $("arena").classList.add("sounding");
  animationTimer = setTimeout(
    () => $("arena").classList.remove("sounding"),
    900,
  );
}
async function replay() {
  if (!run?.active || !question || run.answered || busy) return;
  busy = true;
  const ticket = token;
  $("replay").disabled = true;
  try {
    await sound.unlock(settings.volume);
    if (run?.active && ticket === token) {
      sound.play(question);
      animateSound();
      error("game-error");
    }
  } catch (e) {
    error("game-error", e.message);
  } finally {
    busy = false;
    if (run?.active && !run.answered) $("replay").disabled = false;
  }
}
$("replay").addEventListener("click", replay);
$("next").addEventListener("click", async () => {
  if (!run?.active || busy) return;
  busy = true;
  const ticket = token;
  try {
    await sound.unlock(settings.volume);
    if (run?.active && ticket === token) {
      error("game-error");
      nextQuestion();
    }
  } catch (e) {
    error("game-error", e.message);
  } finally {
    busy = false;
  }
});
function choose(part, value) {
  if (!run?.active || !run.ready || run.answered) return;
  if (mode === "speed" && performance.now() >= run.deadline) {
    finish("time");
    return;
  }
  if (
    part === "pc" &&
    usesWhiteKeys(mode, settings) &&
    !WHITE_KEYS.includes(value)
  )
    return;
  selection[part] = value;
  document
    .querySelectorAll("#game .answer")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(String(selection[b.dataset.part]) === b.dataset.value),
      ),
    );
  const complete =
    mode === "exact"
      ? selection.pc !== undefined && selection.octave !== undefined
      : mode === "root"
        ? selection.pc !== undefined && selection.quality !== undefined
        : true;
  if (!complete) {
    $("selection-hint").textContent =
      mode === "exact"
        ? selection.pc === undefined
          ? "Now pick a note"
          : "Now pick an octave"
        : selection.pc === undefined
          ? "Now pick a root"
          : "Now pick a quality";
    return;
  }
  run.answered = true;
  run.ready = false;
  enableAnswers(false);
  $("replay").disabled = true;
  sound.stop();
  clearTimeout(animationTimer);
  $("arena").classList.remove("sounding");
  const correct = isCorrect(question, selection),
    elapsed = Math.max(0, (performance.now() - run.started) / 1000);
  run.total++;
  run.correct += Number(correct);
  run.time += elapsed;
  run.streak = correct ? run.streak + 1 : 0;
  run.best = Math.max(run.best, run.streak);
  // 100 base + up to 50 speed bonus + a capped streak bonus. No negative scores.
  if (correct)
    run.score +=
      100 +
      Math.max(0, Math.round((2 - elapsed) * 25)) +
      Math.min(50, (run.streak - 1) * 5);
  recordAnswer(stats, question, correct, elapsed, run.streak);
  saveStats();
  $("arena").classList.add(correct ? "correct" : "wrong");
  const praise =
    run.streak >= 50
      ? "Unreal ears."
      : run.streak >= 25
        ? "Absolutely dialed in."
        : run.streak >= 10
          ? "On a wavelength."
          : run.streak >= 5
            ? "Finding your flow."
            : "Right on.";
  $("prompt").textContent = correct ? praise : "Almost. Keep listening.";
  $("feedback").textContent =
    `${correct ? "✓" : "× Correct answer:"} ${answerLabel(question, settings.spelling)}${settings.showTime ? ` · ${seconds(elapsed)}` : ""}${correct && run.streak >= 5 ? ` · ${run.streak} in a row` : ""}`;
  $("selection-hint").textContent = "";
  document.querySelectorAll("#game .answer").forEach((b) => {
    const part = b.dataset.part,
      value = b.dataset.value;
    b.classList.toggle("right", String(question[part]) === value);
    b.classList.toggle(
      "miss",
      String(selection[part]) === value && String(question[part]) !== value,
    );
  });
  updateMetrics();
  if (mode === "streak" && !correct) {
    advanceTimer = setTimeout(() => finish("miss"), 850);
    return;
  }
  if (settings.auto)
    advanceTimer = setTimeout(
      nextQuestion,
      correct ? (mode === "speed" ? 180 : 350) : mode === "speed" ? 420 : 750,
    );
  else {
    $("next").hidden = false;
  }
}
function updateMetrics() {
  $("score").textContent = run.score;
  $("accuracy").textContent = percent(run.correct, run.total);
  $("streak").textContent = run.streak;
  $("time-metric").hidden = !settings.showTime && mode !== "speed";
  $("time-label").textContent = mode === "speed" ? "Seconds left" : "Avg. time";
  if (mode !== "speed")
    $("time-value").textContent = run.total
      ? seconds(run.time / run.total)
      : "—";
  $("best-label").textContent = `Best streak ${stats.mode[mode]?.best || 0}`;
}
function updateClock() {
  if (!run?.active || mode !== "speed") return;
  const remaining = Math.max(0, run.deadline - performance.now());
  $("time-value").textContent = `${Math.ceil(remaining / 1000)}s`;
  $("timer-fill").style.transform = `scaleX(${Math.min(1, remaining / 60000)})`;
  if (remaining <= 0) finish("time");
}
function finish(reason) {
  if (!run?.active) return;
  document.body.classList.remove("playing");
  run.active = false;
  run.ready = false;
  token++;
  clearTimers();
  sound.stop();
  setNavigationLocked(false);
  const completedSpeed = mode === "speed" && reason === "time";
  if (completedSpeed) {
    stats.bestSpeed = Math.max(stats.bestSpeed, run.correct);
    saveStats();
  }
  $("game").hidden = true;
  $("summary").hidden = false;
  $("lobby").hidden = true;
  $("summary-eyebrow").textContent = MODES[mode][0].toUpperCase();
  $("summary-title").textContent = completedSpeed
    ? "That was a quick minute."
    : reason === "miss"
      ? "A streak worth chasing."
      : "Nice listening.";
  const detail =
    reason === "hidden"
      ? "Run ended when you left the tab. Your answered questions are saved."
      : reason === "miss"
        ? `The last sound was ${answerLabel(question, settings.spelling)}. Ready for another run?`
        : completedSpeed
          ? `${run.correct} correct notes in 60 seconds. Take a breath. Go again.`
          : "A little sharper with every round.";
  $("summary-detail").textContent = detail;
  const entries = [
    ["Score", run.score],
    ["Accuracy", percent(run.correct, run.total)],
    ["Best streak", run.best],
    ["Avg. time", run.total ? seconds(run.time / run.total) : "—"],
  ];
  $("summary-metrics").replaceChildren(
    ...entries.map(([label, value]) => {
      const el = node("div");
      el.append(node("span", "", label), node("strong", "", String(value)));
      return el;
    }),
  );
  $("summary-best").textContent = completedSpeed
    ? `${run.correct > run.speedRecord ? "New personal best! " : ""}Best speed round: ${stats.bestSpeed} correct`
    : `${run.best > run.record ? "New personal best! " : ""}${run.total} answered · Best ${MODES[mode][0].toLowerCase()} streak: ${stats.mode[mode]?.best || 0}`;
  $("summary-title").focus({ preventScroll: true });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (run?.active) finish("hidden");
    sound.stop();
  }
});
window.addEventListener("pagehide", () => {
  if (run?.active) finish("hidden");
  sound.stop();
});
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    !run?.active ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)
  )
    return;
  // Preserve native Enter/Space activation for focused controls.
  if (e.key === " " && e.target.tagName !== "BUTTON") {
    e.preventDefault();
    replay();
  }
  if (e.key === "Enter" && e.target.tagName !== "BUTTON" && !$("next").hidden) {
    e.preventDefault();
    $("next").click();
  }
  const pc = KEYS.indexOf(e.key.toLowerCase());
  if (pc >= 0 && !$("pitch-area").hidden) {
    e.preventDefault();
    choose("pc", pc);
  }
  if (
    mode === "exact" &&
    /^[1-7]$/.test(e.key) &&
    Number(e.key) >= settings.low &&
    Number(e.key) <= settings.high
  ) {
    e.preventDefault();
    choose("octave", Number(e.key));
  }
});

function renderStats() {
  const root = $("stats-content");
  root.replaceChildren();
  const overview = node("div", "stats-overview");
  for (const [label, value, detail] of [
    ["Questions", stats.total, "all modes"],
    [
      "Accuracy",
      percent(stats.correct, stats.total),
      `${stats.correct} correct`,
    ],
    [
      "Avg. response",
      stats.total ? seconds(stats.time / stats.total) : "—",
      "from sound onset",
    ],
    ["Speed record", stats.bestSpeed, "correct in 60 seconds"],
  ]) {
    const tile = node("div", "stat-tile");
    tile.append(
      node("small", "", label),
      node("strong", "", String(value)),
      node("small", "", detail),
    );
    overview.append(tile);
  }
  root.append(overview);
  if (!stats.total) {
    const empty = node("div", "empty-stats");
    empty.append(
      node("h2", "", "Your first note is waiting."),
      node(
        "p",
        "small",
        "Play a round to see your pitch map, personal records, and musical strengths.",
      ),
    );
    root.append(empty);
    return;
  }
  const eligible = Object.entries(stats.pitch).filter(([, b]) => b.total >= 10);
  if (eligible.length >= 3) {
    const ranked = [...eligible].sort(
      (a, b) => b[1].correct / b[1].total - a[1].correct / a[1].total,
    );
    const fastest = [...eligible].sort(
      (a, b) => a[1].time / a[1].total - b[1].time / b[1].total,
    )[0];
    const insights = node("div", "insights");
    for (const [label, [pc, b], time] of [
      ["Strongest note", ranked[0], false],
      ["Weakest note", ranked.at(-1), false],
      ["Fastest pitch", fastest, true],
    ]) {
      const card = node("div", "insight");
      card.append(
        node("h3", "", label),
        node(
          "p",
          "",
          `${pitchName(Number(pc), settings.spelling)} · ${time ? seconds(b.time / b.total) : percent(b.correct, b.total)}`,
        ),
        node(
          "small",
          "",
          `${b.total} answers · among notes with 10+ attempts; ties possible`,
        ),
      );
      insights.append(card);
    }
    root.append(insights);
  } else
    root.append(
      node(
        "p",
        "small settings-foot",
        "Your pitch profile is taking shape. Highlights appear after 10 answers each on at least 3 pitch classes.",
      ),
    );
  const pitchSection = node("section", "stats-section");
  pitchSection.append(
    node("h2", "", "Your pitch map"),
    node(
      "p",
      "small",
      "Accuracy around the chromatic scale. Time is the average of all answers.",
    ),
  );
  const pitches = node("div", "pitch-stats");
  for (let pc = 0; pc < 12; pc++) {
    const b = stats.pitch[pc],
      tile = node("div", "pitch-stat"),
      ring = node("div", "ring");
    ring.style.setProperty(
      "--amount",
      b?.total ? `${(b.correct / b.total) * 100}%` : "0%",
    );
    ring.append(node("span", "", percent(b?.correct, b?.total)));
    tile.append(
      node("strong", "", pitchName(pc, settings.spelling)),
      ring,
      node("small", "", `${b?.total || 0} answers`),
      node("small", "", b?.total ? seconds(b.time / b.total) : "No timing yet"),
    );
    pitches.append(tile);
  }
  pitchSection.append(pitches);
  root.append(pitchSection);
  const groups = node("div", "breakdowns");
  for (const [title, key, labels] of [
    ["By timbre", "timbre", TIMBRES],
    [
      "By register",
      "register",
      Object.fromEntries(
        Array.from({ length: 7 }, (_, i) => [i + 1, `Octave ${i + 1}`]),
      ),
    ],
    [
      "Intervals",
      "interval",
      Object.fromEntries(INTERVALS.map((n, i) => [i + 1, n])),
    ],
    [
      "Chord qualities",
      "quality",
      Object.fromEntries(
        Object.keys(CHORDS).map((k) => [
          k,
          k.charAt(0).toUpperCase() + k.slice(1),
        ]),
      ),
    ],
    [
      "By mode",
      "mode",
      Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, v[0]])),
    ],
  ]) {
    const section = node("section", "stats-section");
    section.append(node("h2", "", title));
    for (const [value, label] of Object.entries(labels)) {
      const b = stats[key][value],
        row = node("div", "bar-row"),
        text = node("div", "bar-label"),
        track = node("div", "bar-track"),
        fill = node("i");
      text.append(
        node("span", "", label),
        node(
          "span",
          "",
          b?.total
            ? `${percent(b.correct, b.total)} · ${b.total} played${key === "mode" ? ` · best ${b.best}` : ""}`
            : "Not played",
        ),
      );
      fill.style.width = b?.total ? `${(b.correct / b.total) * 100}%` : "0%";
      track.append(fill);
      row.append(text, track);
      section.append(row);
    }
    groups.append(section);
  }
  root.append(groups);
}
$("reset-stats").addEventListener("click", () => {
  $("reset-dialog").returnValue = "cancel";
  $("reset-dialog").showModal();
});
$("reset-dialog")
  .querySelector("form")
  .addEventListener("submit", (event) => {
    if (event.submitter?.value !== "reset") return;
    stats = emptyStats();
    saveStats();
    renderStats();
  });
syncSettings();
updateSetup();
