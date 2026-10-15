"""Rebuild the shared wooden effects; leave music and the existing clear/charge motifs alone."""
import math, random, struct, sys, wave
from pathlib import Path
RATE=44100
ROOT=Path(__file__).resolve().parents[1]/'assets/audio'
def tone(out, start, duration, frequency, gain, decay, soft=.006):
    for i in range(int(duration*RATE)):
        k=int(start*RATE)+i
        if k>=len(out):break
        t=i/RATE
        attack=min(1,t/soft)**2
        tail=min(1,(duration-t)/.04)
        # Rounded wooden fundamental with a quiet upper partial.
        value=math.sin(2*math.pi*frequency*t)+.18*math.sin(2*math.pi*frequency*2*t)*math.exp(-t*12)
        out[k]+=gain*attack*tail*math.exp(-decay*t)*value

def write(name, data, peak_db):
    # Smooth endpoints remove accidental digital clicks, including on ice transients.
    for i in range(len(data)):
        data[i]*=min(1,i/(RATE*.003),(len(data)-1-i)/(RATE*.025))
    peak=max(map(abs,data));scale=10**(peak_db/20)/peak
    pcm=[round(x*scale*32767) for x in data]
    assert max(map(abs,pcm))<32767 and pcm[0]==pcm[-1]==0
    with wave.open(str(ROOT/(name+'.wav')),'wb') as w:
        w.setparams((1,2,RATE,0,'NONE','not compressed'))
        w.writeframes(struct.pack('<'+'h'*len(pcm),*pcm))
    rms=math.sqrt(sum((x/32768)**2 for x in pcm)/len(pcm))
    print(name, 'seconds',len(pcm)/RATE, 'peak dB',peak_db,'RMS dB',round(20*math.log10(rms),1))

# A small D-major opening, using the same rounded wood as the other effects.
# --bloom-only makes the new asset without rewriting any approved sounds or music.
bloom=[0.0]*int(.38*RATE)
tone(bloom,0,.25,587.33,.8,14,.008)
tone(bloom,.085,.295,739.99,.7,13,.009)
tone(bloom,.085,.295,1174.66,.10,17,.01)
write('bloom',bloom,-12)
if '--bloom-only' in sys.argv:raise SystemExit(0)

# Success: D-major rising notes, then a small warm resolution (no long piercing bell).
win=[0.0]*int(1.12*RATE)
for time,freq,gain in [(0,587.33,.8),(.14,739.99,.7),(.28,880,.65),(.43,1174.66,.48)]:
    tone(win,time,.62,freq,gain,6)
for freq in [293.66,440,587.33]:tone(win,.43,.69,freq,.23,4,.018)
write('win',win,-6)
# End: two soft, descending wooden notes; an invitation to retry rather than a buzzer.
over=[0.0]*int(.60*RATE)
tone(over,0,.34,440,.7,9,.01)
tone(over,.15,.45,293.66,1,8,.012)
write('over',over,-10)
# Frequent actions share the success motif's rounded wooden tone and a soft attack.
tap=[0.0]*int(.055*RATE)
tone(tap,0,.055,1174.66,1,65,.003)
write('tap',tap,-14)
place=[0.0]*int(.095*RATE)
tone(place,0,.095,880,1,38,.004)
tone(place,0,.095,440,.25,30,.004)
write('place',place,-13)
undo=[0.0]*int(.21*RATE)
tone(undo,0,.14,880,.8,25,.004)
tone(undo,.065,.145,587.33,1,24,.004)
write('undo',undo,-12)
# A root and its octave can move through D/E/F#/A without shifting an entire
# major chord into out-of-key notes. Higher tiers keep the same instrument.
combo=[0.0]*int(.40*RATE)
tone(combo,0,.4,587.33,1,10,.005)
tone(combo,.035,.365,1174.66,.24,12,.006)
write('combo',combo,-12)
# Ice: three short filtered cracks plus very brief resonances, no metallic tail.
ice=[0.0]*int(.24*RATE);rng=random.Random(2309)
for start,gain in [(0,1),(.033,.5),(.071,.23)]:
    low=slow=smooth=0.0
    for i in range(int(.14*RATE)):
        k=int(start*RATE)+i
        if k>=len(ice):break
        t=i/RATE;n=rng.uniform(-1,1)
        low+=.35*(n-low);slow+=.07*(n-slow)
        smooth+=.23*((low-slow)-smooth)
        ice[k]+=smooth*gain*min(1,t/.002)*math.exp(-t*60)
    for freq in [1760,2350,3100]:tone(ice,start,.13,freq,.055*gain,45,.002)
write('ice',ice,-8)
