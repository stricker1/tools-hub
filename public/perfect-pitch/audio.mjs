import { frequency } from "./music.mjs";

// Additive synthesis keeps the fundamental clear and excludes above-Nyquist partials.
const PARTIALS = {
  sine: [[1, 1]],
  piano: [
    [1, 1],
    [2, 0.42],
    [3, 0.2],
    [4, 0.1],
    [5, 0.055],
  ],
  organ: [
    [1, 1],
    [2, 0.52],
    [3, 0.18],
    [4, 0.32],
    [6, 0.08],
  ],
  soft: [
    [1, 1],
    [2, 0.14],
    [3, 0.1],
  ],
  bright: [
    [1, 1],
    [2, 0.5],
    [3, 0.3],
    [4, 0.18],
    [5, 0.12],
    [6, 0.07],
  ],
};
export class Sound {
  constructor() {
    this.context = null;
    this.voices = new Set();
  }
  async unlock(volume) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext)
      throw new Error(
        "This browser does not support Web Audio. Try a current version of Safari, Chrome, Firefox, or Edge.",
      );
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 8;
      limiter.ratio.value = 8;
      this.master.connect(limiter);
      limiter.connect(this.context.destination);
    }
    await this.context.resume();
    if (this.context.state !== "running")
      throw new Error(
        "Audio is paused by your browser. Tap Start or Replay to enable sound.",
      );
    this.master.gain.setTargetAtTime(
      volume * 0.32,
      this.context.currentTime,
      0.015,
    );
  }
  stop() {
    for (const { oscillator, gain } of this.voices) {
      try {
        gain.gain.cancelScheduledValues(this.context.currentTime);
        gain.gain.setTargetAtTime(0, this.context.currentTime, 0.008);
        oscillator.stop(this.context.currentTime + 0.04);
      } catch {
        /* Already stopped. */
      }
    }
    this.voices.clear();
  }
  tone(midi, timbre, start, duration, chordScale) {
    const ctx = this.context,
      hz = frequency(midi);
    const partials = PARTIALS[timbre].filter(
      ([multiple]) => hz * multiple < Math.min(12000, ctx.sampleRate * 0.45),
    );
    const total = partials.reduce((sum, [, amplitude]) => sum + amplitude, 0);
    // Roll off high registers and upper partials, with a restrained boost to low notes.
    const registerGain = Math.min(1.2, Math.max(0.42, (440 / hz) ** 0.16));
    for (const [multiple, amplitude] of partials) {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = hz * multiple;
      const peak =
        (amplitude / total) *
        registerGain *
        chordScale *
        (multiple > 1 ? Math.min(1, 2400 / (hz * multiple)) : 1);
      const attack =
        timbre === "soft" ? 0.065 : timbre === "piano" ? 0.006 : 0.018;
      const release = timbre === "organ" ? 0.07 : 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, peak * (timbre === "piano" ? 0.16 : 0.8)),
        start + duration,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + duration + release,
      );
      oscillator.connect(gain);
      gain.connect(this.master);
      const voice = { oscillator, gain };
      this.voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
      };
      oscillator.start(start);
      oscillator.stop(start + duration + release + 0.02);
    }
  }
  play(q) {
    this.stop();
    const start = this.context.currentTime + 0.025;
    if (q.mode === "interval") {
      this.tone(q.notes[0], q.timbre, start, 0.32, 1);
      this.tone(q.notes[1], q.timbre, start + 0.5, 0.65, 1);
    } else {
      const chordScale = 1 / Math.sqrt(q.notes.length);
      q.notes.forEach((n) =>
        this.tone(
          n,
          q.timbre,
          start,
          q.notes.length > 1 ? 1 : 0.75,
          chordScale,
        ),
      );
    }
    // Response time starts at the audible onset of the last note, not at the click.
    return (
      (q.mode === "interval" ? 525 : 25) +
      (this.context.baseLatency || 0) * 1000
    );
  }
}
