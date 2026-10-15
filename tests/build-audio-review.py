"""Create a listening comparison and a separate music proposal; never replace game music.

python3 tests/build-audio-review.py [/path/to/before-audio-and-feedback.js]
Uses the installed NumPy for spectral checks, and stdlib WAV writing.
"""
import hashlib, json, math, re, struct, sys, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'assets/audio'
OUT = ROOT / 'docs/previews/audio-review'
OUT.mkdir(parents=True, exist_ok=True)
RATE = 44100
NAMES = ['tap', 'place', 'undo', 'clear', 'combo', 'energy', 'ice', 'over', 'win']

def read(path):
    with wave.open(str(path), 'rb') as w:
        assert w.getsampwidth() == 2
        rate = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float).reshape(-1,w.getnchannels()).mean(axis=1) / 32768
        return np.interp(np.arange(0,len(x)-1,rate/RATE),np.arange(len(x)),x) if rate != RATE else x

def write(path, x):
    assert np.isfinite(x).all() and abs(x).max() < 1, 'Audio clips: ' + str(path)
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        w.writeframes(np.round(x * 32767).astype('<i2').tobytes())

def gains(code):
    return {name: float(re.search(r"audio/" + name + r"\.wav', ([\d.]+)", code)[1]) for name in NAMES}

def stats(x):
    size = min(len(x), int(.05 * RATE))
    rms = np.sqrt(np.convolve(x*x, np.ones(size)/size, 'valid')).max()
    spectrum = abs(np.fft.rfft(x * np.hanning(len(x))))
    freq = np.fft.rfftfreq(len(x), 1/RATE)
    return {'seconds': round(len(x)/RATE, 3), 'peak_db': round(float(20*np.log10(abs(x).max())), 1),
            'max_50ms_db': round(float(20*np.log10(rms)), 1),
            'centroid_hz': round(float(sum(spectrum*freq)/sum(spectrum))),
            'above_3500hz_pct': round(float(100*sum(spectrum[freq>3500]**2)/sum(spectrum**2)), 1)}

# Fixed action sequence, with all four combo pitch tiers and both result sounds.
EVENTS = [(.4,'tap',1),(1.0,'place',1),(1.5,'place',1),(2.2,'clear',1),
          (3.2,'combo',1),(3.8,'combo',1.122),(4.45,'combo',1.26),(5.1,'combo',1.498),
          (6.3,'ice',1),(7.2,'energy',1),(8.4,'undo',1),(9.4,'over',1),(11.3,'win',1)]

def scene(folder, volumes, bgm, filename):
    mix = bgm[:int(13.4*RATE)].copy() * .3
    for start, name, rate in EVENTS:
        x = read(folder/(name+'.wav')) * volumes[name]
        x = np.interp(np.arange(0, len(x)-1, rate), np.arange(len(x)), x)
        first = int(start*RATE)
        mix[first:first+len(x)] += x
    mix[-int(.15*RATE):] *= np.linspace(1, 0, int(.15*RATE))
    # The same monitoring gain on both comparisons; relative in-game levels retained.
    write(OUT/filename, mix*2)

code = (ROOT/'js/platform/feedback.js').read_text()
volumes = gains(code)
bgm = read(AUDIO/'bgm-v2.wav')
assert hashlib.sha1((AUDIO/'bgm-v2.wav').read_bytes()).hexdigest() == 'a122d1fa2322749f61db14c3943abb35c3b8c033'
report = {name: stats(read(AUDIO/(name+'.wav'))*volumes[name]) for name in NAMES}
assert report['tap']['max_50ms_db'] < report['place']['max_50ms_db'] < report['clear']['max_50ms_db'] < report['win']['max_50ms_db']
assert report['ice']['above_3500hz_pct'] < 12
for name in NAMES:
    x = read(AUDIO/(name+'.wav'))
    assert abs(x).max() < .99 and max(abs(x[0]), abs(x[-1])) < .005, name
scene(AUDIO, volumes, bgm, 'effects-after.wav')
if len(sys.argv) > 1:
    before = Path(sys.argv[1])
    scene(before, gains((before/'feedback.js').read_text()), read(before/'bgm-v2.wav'), 'effects-before.wav')
    for name in ['win', 'over', 'clear', 'energy', 'bgm-v2']:
        assert (AUDIO/(name+'.wav')).read_bytes() == (before/(name+'.wav')).read_bytes(), name+' should stay unchanged'

# A separate 88 BPM, eight-bar D-pentatonic proposal. Sparse wooden plucks,
# a slow soft backing, and no drums. Not referenced anywhere in game assets.
beat = 60/88
length = round(32*beat*RATE)
music = np.zeros(length)

def note(start, duration, frequency, gain, decay, attack=.015):
    t = np.arange(int(duration*RATE))/RATE
    envelope = np.minimum(1,t/attack)**2 * np.minimum(1,(duration-t)/.16) * np.exp(-decay*t)
    sound = gain*envelope*(np.sin(2*math.pi*frequency*t)+.10*np.sin(4*math.pi*frequency*t)*np.exp(-5*t))
    # Wrap the tails into the loop's beginning instead of cutting them off.
    positions = (round(start*RATE)+np.arange(len(t))) % length
    np.add.at(music,positions,sound)

chords = [(146.83,220,293.66),(123.47,185,293.66),(196,246.94,293.66),(110,164.81,220)]*2
for bar, chord in enumerate(chords):
    for freq in chord: note(bar*4*beat,4.8*beat,freq,.075,.48,.30)
    note((bar*4+.1)*beat,2.6*beat,chord[0]*2,.07,2.6)
melody = [(0,587.33),(1.5,659.25),(3,739.99),(5,880),(7,739.99),
          (8.5,659.25),(10.5,587.33),(13,493.88),(15,440),
          (16,587.33),(18,739.99),(19.5,880),(21.5,987.77),
          (23,880),(25,739.99),(27,659.25),(29,587.33)]
for when, freq in melody:
    note(when*beat,1.6,freq,.23,4)
    note(when*beat+.19,.9,freq,.025,5,.025)
music *= 10**(-24/20)/np.sqrt(np.mean(music*music))
assert abs(music[0]-music[-1]) < .003, 'loop boundary discontinuity'
write(OUT/'garden-bgm-proposal.wav', music)
scene(AUDIO, volumes, np.resize(music,len(bgm)), 'proposal-with-effects.wav')
(OUT/'audio-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: nine effects, level hierarchy, softened ice, unclipped gameplay mix, unchanged background and approved motifs')
print('Music proposal:',round(len(music)/RATE,2),'seconds; saved only under docs/previews/audio-review')
