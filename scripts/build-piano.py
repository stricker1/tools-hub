"""Build the compact piano bank. Requires Python + numpy/scipy and ffmpeg.

npm pack @audio-samples/piano-mp3-velocity8@1.0.5 --pack-destination /tmp
mkdir -p /tmp/piano-source
tar -xzf /tmp/audio-samples-piano-mp3-velocity8-1.0.5.tgz -C /tmp/piano-source
python3 scripts/build-piano.py /tmp/piano-source/package/audio

Audio license and attribution: public/perfect-pitch/assets/PIANO-LICENSE.txt.
"""
from pathlib import Path
import subprocess
import sys
import tempfile
import json
from fractions import Fraction
import numpy as np
from scipy.signal import resample_poly

source = Path(sys.argv[1])
destination = Path(__file__).resolve().parents[1] / 'public/perfect-pitch/assets/piano.mp3'
rate = 44100
segments = []
tuning = []
# 29 real recordings, C1 to C8 in minor thirds. Each gets a 2.1-second slot.
for midi in range(24, 109, 3):
    name = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12]
    path = source / f'{name}{midi // 12 - 1}v8.mp3'
    decoded = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(rate), '-'])
    audio = np.frombuffer(decoded, dtype='<f4').reshape(-1, 2).copy()
    # Remove leading near-silence, preserving 3 ms before the attack.
    audible = np.flatnonzero(np.max(np.abs(audio), axis=1) > np.max(np.abs(audio)) * .02)
    start = max(0, int(audible[0]) - int(.003 * rate))
    audio = audio[start:]
    # Remove the original instrument's stretched tuning for the pitch game.
    # The second partial is more stable than the very weak fundamental below C4.
    harmonic = 2 if midi < 60 else 1
    begin, end = (.2, 1.2) if midi < 60 else (.05, .75)
    mono = audio[int(begin * rate):int(end * rate)].mean(axis=1)
    spectrum = np.abs(np.fft.rfft(mono * np.hanning(len(mono)), 524288))
    expected = 440 * 2 ** ((midi - 69) / 12)
    lo = round(expected * harmonic * .9 * 524288 / rate)
    hi = round(expected * harmonic * 1.1 * 524288 / rate)
    peak = lo + np.argmax(spectrum[lo:hi])
    y = np.log(np.maximum(spectrum[peak-1:peak+2], 1e-15))
    delta = (y[0] - y[2]) / (2 * (y[0] - 2*y[1] + y[2]))
    measured = (peak + delta) * rate / 524288 / harmonic
    ratio = Fraction(expected / measured).limit_denominator(1000)
    audio = resample_poly(audio, ratio.denominator, ratio.numerator, axis=0)
    tuning.append({'midi': midi, 'sourceHz': round(float(measured), 4),
                   'targetHz': round(expected, 4),
                   'correctionCents': round(float(1200*np.log2(expected/measured)), 3)})
    audio = audio[:rate * 2]
    attack = audio[int(.03 * rate):int(.3 * rate)]
    rms = float(np.sqrt(np.mean(attack ** 2)))
    level = min(8, .14 / max(rms, 1e-6), .8 / max(float(np.max(np.abs(audio))), 1e-6))
    audio *= level
    tuning[-1]['gain'] = round(level, 4)
    slot = np.zeros((int(rate * 2.1), 2), dtype='<f4')
    slot[:len(audio)] = audio
    # Retain the real attack/decay; only fade the unused end to avoid hard cuts.
    slot[int(rate * 1.9):rate * 2] *= np.linspace(1, 0, int(rate * .1))[:, None]
    segments.append(slot)
with tempfile.NamedTemporaryFile(suffix='.f32') as raw:
    raw.write(np.concatenate(segments).tobytes()); raw.flush()
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(rate), '-ac', '2', '-i', raw.name, '-c:a', 'libmp3lame', '-q:a', '4', '-map_metadata', '-1', str(destination)], check=True)
destination.with_name('piano-tuning.json').write_text(json.dumps(tuning, indent=2) + '\n')
print(f'{destination.name}: {destination.stat().st_size:,} bytes, {len(segments)} stereo recordings')
