# Audio benchmark (PD-306)

`npm run bench` runs the audio analysis over a labelled corpus and writes `bench/report.md` (human
readable) and `bench/report.json`. It also fails if any synthetic-corpus metric is worse than
`bench/baseline.json` by more than its tolerance (0.02 for rates, 5 ms for times). CI runs it on every push.

- `npm run bench:update` rewrites the baseline. Do this deliberately, when an improvement or an accepted
  trade-off changes the numbers, and commit `bench/baseline.json` with the change that caused it.
- The report is not committed; the baseline is.

## Corpus

- **Synthetic (70 clips, generated on the fly, deterministic):** singles across the range (plus noisy and
  detuned variants), intervals, triads, two-hand chords, and negative cases: wrong note (semitone, octave
  up/down, wrong quality), extra note, silence, room noise, clicks/thumps/rustles.
- **Recorded (your clips, optional):** WAV + JSON label pairs in `corpus/recorded/`, captured with
  Settings > Corpus recorder. See `corpus/README.md`. Reported separately; not part of the regression gate
  because the audio is not committed.

## Metrics

| Metric | Meaning |
|---|---|
| Correct-accept rate | Target played exactly, verifier accepts. PD-307 target: >= 90% on singles + triads. |
| False-accept rate | Wrong note, extra note, or nothing played, but the verifier accepts. PD-307 target: < 5%. |
| Note precision / recall | Detected notes vs notes actually played. |
| Octave-error rate | Played notes that were missed but heard in another octave. PD-310 target: < 3%. |
| Onset error | Detected onset time vs ground truth (synthetic clips only). |
| Onset miss rate / false onsets | Note played but no onset; onsets reported on silence, noise or clicks. |
| Detection latency | How long after the onset the analyzer reported it (includes the pitched-peak confirmation). |

## Baseline (naive verifier, synthetic corpus, 2026-11-11)

The verifier is a deliberately naive stand-in (`src/bench/naiveVerifier.ts`); PD-307 replaces it. The onset
numbers come from the real analyzer (PD-305).

| Metric | Baseline |
|---|---|
| Correct-accept rate | 72.9% (48 clips) |
| False-accept rate | 4.5% (22 clips) |
| Note precision / recall | 84.7% / 93.8% |
| Octave-error rate | 2.3% |
| Onset error, mean / 95th percentile | 0.2 ms / 0.4 ms |
| Onset miss rate | 0.0% |
| False onsets per silent/noise clip | 0.00 |
| Detection latency, mean / 95th percentile | 47.2 ms / 60.9 ms |

Where the naive verifier fails (what PD-307 is for): detuned notes are missed entirely, octave doublings are
dropped as "harmonics", two-hand chords get phantom notes an octave or a fifth above, and low fundamentals
below about C2 are unreliable.

## Recorded baseline (12 clips, naive verifier, 2026-11-11)

Recorded on a MacBook Pro built-in mic with a digital keyboard playing through its speakers, in a living
room, laptop on the music stand. Informational only (the audio is not in git).

| Metric | Recorded |
|---|---|
| Correct-accept rate | 37.5% (8 clips) |
| False-accept rate | 0.0% (4 clips) |
| Note precision / recall | 76.0% / 79.2% |
| Octave-error rate | 12.5% |
| False onsets per silent/noise clip | 2.00 (1 in silence, 3 in everyday room noise) |
| Detection latency, mean / 95th percentile | 54.4 ms / 103.6 ms |

| Clip | Result |
|---|---|
| single C4, G3 | accepted |
| single E5 | verifier heard nothing |
| single C2 | below the MVP range (G2-F5); heard phantom notes |
| triad C4 E4 G4 | accepted |
| triad A3 C4 E4 | heard an extra A4 (octave of the root) |
| interval C4 G4 | heard an extra E5 (a harmonic of C4) |
| two-hand C3 G3 E4 G4 C5 | heard only C4 E4 G4; missed C3, G3 and C5 |
| wrong note, extra note, silence, room noise | all correctly rejected |

Takeaways for PD-307: real recordings are much harder than the synthetic ones (37.5% vs 72.9% correct-accept),
the verifier must not report overtones as played notes, low and high notes need better handling, and the
onset detector still reports a stray onset on mouse clicks and desk noise (the verifier ignores them).
**MVP range: G2-F5.**
