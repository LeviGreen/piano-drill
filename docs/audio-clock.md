# Audio clock mapping (PD-304)

Timing in the drill is measured against `performance.now()`, but audio arrives on the audio clock
(`AudioContext` time). `ClockMap` (src/audio/capture/clockMap.ts) maps one onto the other using
pairs from `AudioContext.getOutputTimestamp()`, sampled every 250 ms. The offset is the median of
the last 200 samples.

**What this measures:** how stable the audio-clock to `performance.now()` link is (jitter).
**What it does not measure:** absolute input latency (mic to application). That is estimated by the
calibration latency test (PD-311) and applied in PD-309.

Use the Mic test screen (Settings > Mic test) to reproduce these numbers. Let it run ~30 s.

## Measurements

| Date | Device / browser | Sample rate | Samples | Jitter (std dev) | Worst deviation | Processing flags |
|---|---|---|---|---|---|---|
| 2026-11-11 | MacBook Pro built-in mic, Chrome (desktop) | 48000 Hz | 200 | 0.419 ms | 0.967 ms | echoCancellation / noiseSuppression / autoGainControl all `false` |
| | iPhone, Safari | | | | | |
| | Android, Chrome | | | | | |

Reported by the browser (not a measured input latency): baseLatency 5.3 ms, outputLatency 28.0 ms
on the desktop run above.

## Conclusion so far

Mapping jitter on desktop is under 1 ms, far inside the ±50 ms timing target (design §6.4). The
remaining timing error will come from input latency and onset estimation, not from this mapping.
