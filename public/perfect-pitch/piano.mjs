// Real Salamander Grand Piano recordings. See assets/PIANO-LICENSE.txt.
// C1..C8, sampled every three semitones. Each recording occupies a 2.1 s slot.
export function pianoSample(midi) {
  const index = Math.max(0, Math.min(28, Math.round((midi - 24) / 3)));
  const root = 24 + index * 3;
  return { root, offset: index * 2.1, rate: 2 ** ((midi - root) / 12) };
}
export class PianoSampler {
  constructor() {
    this.bytes = null;
    this.decoding = null;
    this.buffer = null;
  }
  preload() {
    if (!this.bytes) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      this.bytes = fetch(new URL("./assets/piano.mp3", import.meta.url), {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Piano download failed");
          return response.arrayBuffer();
        })
        .catch(() => null)
        .finally(() => clearTimeout(timeout));
    }
    return this.bytes;
  }
  async prepare(context) {
    if (this.buffer) return;
    if (!this.decoding)
      this.decoding = (async () => {
        const bytes = await this.preload();
        if (!bytes) throw new Error("Piano download failed");
        const buffer = await context.decodeAudioData(bytes.slice(0));
        if (buffer.duration < 60) throw new Error("Incomplete piano recording");
        this.buffer = buffer;
      })();
    try {
      await this.decoding;
    } catch {
      throw new Error(
        "The piano recordings could not load. Reload to retry, or choose another timbre with Random timbre and Chaos off.",
      );
    }
  }
  tone(context, master, voices, midi, start, duration, chordScale) {
    if (!this.buffer)
      throw new Error("The acoustic piano is still loading. Try Start again.");
    const sample = pianoSample(midi);
    const oscillator = context.createBufferSource(),
      gain = context.createGain();
    oscillator.buffer = this.buffer;
    oscillator.playbackRate.value = sample.rate;
    // Keep the recorded hammer attack and natural decay; gently release the key.
    const level =
      1.6 *
      chordScale *
      Math.max(0.55, Math.min(1.15, 2 ** ((60 - midi) / 72)));
    const release = Math.min(duration + 0.22, 1.95 / sample.rate);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.002);
    gain.gain.setValueAtTime(level, start + Math.min(duration, release - 0.03));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + release);
    oscillator.connect(gain);
    gain.connect(master);
    const voice = { oscillator, gain };
    voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      voices.delete(voice);
    };
    oscillator.start(start, sample.offset);
    oscillator.stop(start + release + 0.01);
  }
}
