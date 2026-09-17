# tools-hub

Personal collection of small web tools served from `sebas.moe` on Cloudflare Workers.

## Production architecture

`tools-hub` owns the `sebas.moe` custom domain.

- Static tools are served from `public/` through Cloudflare Static Assets.
- `src/index.js` runs only for `/class-scheduler*` requests.
- Those requests are forwarded internally to the `class-scheduler` Worker through the `CLASS_SCHEDULER` Service Binding.
- Cloudflare Access protects `sebas.moe/class-scheduler*` before the request reaches the scheduler.

Do not add a separate `sebas.moe/class-scheduler*` Worker Route to `class-scheduler`; that conflicts with this front-door routing setup.

## Layout

- `public/index.html` — Tools Hub home page
- `public/accounting-quizzer/index.html` — Accounting Account Trainer
- `src/index.js` — path router for the Class Scheduler service binding
- `wrangler.jsonc` — Worker, assets, and service-binding configuration

## Deploy

This repository is deployed through Cloudflare's Git integration. The `sebas.moe` custom domain is attached to the `tools-hub` Worker in Cloudflare.

For a manual deployment:

```bash
npx wrangler deploy
```

## Adding another static tool

Create a folder under `public/`, then add its relative URL to the `TOOLS` array in `public/index.html`.

## Safety notes

Do not commit `.dev.vars`, `.env*`, tokens, Wrangler state, or logs. These paths are covered by `.gitignore`.

## Perfect Pitch

`public/perfect-pitch/` is a dependency-free browser game at `/perfect-pitch/`.
It uses ES modules and Web Audio; serve it over HTTP rather than opening the HTML
as a `file://` URL. It needs no build step, API keys, database, or Worker changes.
All assets are local, with no network requests needed during play after loading.

```bash
python3 -m http.server 8765 --directory public
# Open http://localhost:8765/perfect-pitch/
```

### Features and behavior

- Single Note, Exact Note, Interval, Chord Quality, Root + Quality, 60-second
  Speed Round, and one-miss Streak Mode.
- Equal temperament: `frequency = 440 * 2 ** ((midi - 69) / 12)`; MIDI 60 is C4.
  Pitch classes are numeric, so enharmonic labels never affect correctness.
- Five additive timbres with envelopes, high-register attenuation, bounded
  harmonics, polyphony compensation, and an output compressor. No samples.
- Easy C4–B5, Normal C3–B5, Hard C1–B7, and Chaos C1–B7 with random timbres.
  Custom full-octave ranges are available in Settings. Intervals and open chord
  voicings need two or more octaves; every played note stays within the range.
- Settings → Include black keys can be turned off for white-key-only Single
  Note, Exact Note, Speed Round, and Streak Mode. The seven natural-note pads
  remain, and black-key keyboard shortcuts are ignored. Intervals/chords still
  use all notes; the separate Note names setting controls sharp/flat spelling.
- Exact Note and Root + Quality accept their two answer parts in either order;
  the second selection submits immediately. Replay keeps the original response
  clock running. Interval timing starts at the second note's onset.
- Correct answers score 100 points, plus up to 50 for speed and up to 50 for a
  streak. Wrong answers score zero and reset the streak. Speed records count
  correct answers in a completed 60-second run, not points or interrupted runs.
- Leaving the tab ends a run, saves answered questions, and cancels playback.
  This prevents hidden-tab timers from producing misleading speed records.
- Keyboard note keys: `A W S E D F T G Y H U J` = C through B. Exact Note also
  accepts octave keys 1–7. Space replays and Enter advances when focus is outside
  a button; focused controls retain native keyboard activation.
- Settings/statistics live only in `perfect-pitch.settings.v1` and
  `perfect-pitch.stats.v1` in localStorage. Blocked storage, malformed JSON, and
  write/quota failures fall back to in-memory play with a visible notice.
- Pitch stats cover Single, Exact, Speed, and Streak modes. Register means the
  starting note or chord root. Timbre accuracy mixes modes. Highlights require
  at least three pitch classes with ten answers each; displayed comparisons
  only include eligible classes. Reset is confirmation-protected.

### Verification

The music/statistics/storage tests need only Node.js:

```bash
node --test tests/perfect-pitch.test.mjs
```

The browser suite uses Playwright **only as a developer test dependency**. With
Playwright and Chromium installed, start the HTTP server above, then run:

```bash
node tests/perfect-pitch.browser.mjs
```

For an external Playwright installation, set `PLAYWRIGHT_MODULE` to its absolute
`index.mjs` path. Optional `CHROMIUM_PATH` selects a browser executable; `TEST_URL`
selects another local server. The suite checks seven modes, mobile overflow,
keyboard/auto advance, time expiry, storage failures, reset confirmation,
unsupported audio, and actual offline audio rendering. Screenshots go to `/tmp/`.

Before merging, listen on a physical phone and your usual headphones/speakers:
check first-tap playback and Replay in Safari/Chrome, comfortable volume across
registers and timbres, Exact/Root two-part answers, and the feel of a full speed
round. Browser automation does not substitute for a subjective listening check.
