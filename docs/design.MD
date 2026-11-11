# Piano Drill — Design Doc & Implementation Tickets

**Status:** Draft v1
**Name:** Piano Drill

---

## 1. Overview

A practice app that trains **instant sight-reading of small musical units** (a single interval or chord) rather than whole pieces. A bit of notation is flashed on screen, the user finds and plays it on a real piano, and the app listens through the microphone, verifies the notes, and records how long it took.

The core idea is the same as flashcards: short, repeated, timed reps on the exact skill that is weak (e.g. "bass clef, 4 flats, root-position triad"), with difficulty that can be tuned.

A second, separate mode drills **key signature recognition** with no playing involved.

### 1.1 Goals

- Fast, low-friction drill loop: flash → play → result → next, with no taps between reps.
- Accurate enough microphone verification of *which notes* were played, using an acoustic piano.
- Accurate-enough timing that improvement over days/weeks is visible and meaningful.
- Rich difficulty customization (clef, hand, note count, key signature complexity, chord/interval types), packaged into preset levels.
- Musically sensible content: two-hand material forms real chords/voicings, not random note clusters.
- Progress tracking broken down by the dimensions that matter (key, clef, chord type).

### 1.2 Non-goals (v1)

- Rhythm reading, note-length evaluation, or playing in time.
- Reading whole phrases or pieces.
- Dynamics/touch evaluation.
- Telling *which hand* played a note (a mic cannot know; see §6.6).
- Stats screens, charts, and adaptive (weak-spot) practice — cut from the MVP.
- Accounts/cloud sync/social features (local-only storage in v1).
- Teaching theory from scratch (some in-app hints, but not a curriculum).

### 1.3 Target user

An intermediate learner or returning pianist who can read slowly and wants to get *fast*, and who has a real piano or keyboard in the same room as their phone/laptop.

---

## 2. Core User Flows

### 2.1 Drill session (Play Mode)

1. User picks a level (or custom settings) and starts a session.
2. **Ready state:** a blank staff area with a short "get your hands on the keys" pause (user-configurable, or tap/spacebar to flash).
3. **Flash:** the target notation appears. The timer starts on the frame in which it is first painted.
4. User plays the notes.
5. App detects the correct note set → timer stops → brief positive feedback with the time (e.g. "1.42 s"). Auto-advances after a short delay.
6. If the user plays wrong notes, they are logged as errors; the timer keeps running until the correct set is played or the user skips/times out.
7. After N reps (e.g. 20) or when the user ends the session, show a summary: median time, accuracy, slowest items, comparison to previous sessions at the same level.

Timeout (configurable, default 10 s): the target is revealed with note names + a keyboard highlight, logged as a miss, and the session moves on.

### 2.2 Key Identification Mode

1. A staff with a **key signature only** is flashed (clef varies; optionally a tonic hint, see §7).
2. User answers by tapping a key button (circle-of-fifths wheel or a button grid), or optionally by playing the tonic on the piano.
3. Timed; correct/incorrect recorded; same summary/stat treatment as Play Mode.

### 2.3 Settings / Level Select

- Pick a preset level, or open **Custom** to edit every dimension.
- Save custom presets.
- Test microphone / calibrate (see §6.7).

---

## 3. Difficulty Model

Difficulty is a combination of independent dimensions. Presets (levels) are just named bundles of these values.

| Dimension | Options |
|---|---|
| **Hand configuration** | RH only · LH only · Either hand, one at a time (randomized per rep) · Both hands together |
| **Clef** | Treble · Bass · Both (random per rep; for both-hands this means a grand staff) |
| **Notes per hand** | 1–5 (1 = single note, 2 = interval, 3+ = chord) |
| **Key signature range** | 0 → N accidentals (sharps and/or flats; e.g. "up to 3 sharps/flats", or an explicit key set) |
| **Mode (major/minor)** | Major only · Minor only · Both |
| **Content type** | Single notes · Intervals · Triads · Seventh chords · Extended/other (later) |
| **Inversions** | Root position only · Allow inversions |
| **Accidentals beyond key sig** | Off · Occasional (chromatic alterations, e.g. harmonic minor leading tone) |
| **Register / ledger lines** | Staff only · Up to 1 ledger line · Up to 2–3 ledger lines |
| **Timeout** | Off / 5 / 10 / 20 s |
| **Octave strictness** | Exact octave required · Any octave (pitch class only) |

### 3.1 Proposed preset levels

| Level | Hands | Notes/hand | Keys | Content |
|---|---|---|---|---|
| 1 | RH, treble | 1 | C only | Single notes in staff |
| 2 | RH or LH, own clef | 1 | ≤1 accidental | Single notes |
| 3 | RH or LH | 1–2 | ≤2 accidentals | Notes + 2nds–5ths |
| 4 | RH or LH | 2 | ≤3 accidentals | All intervals up to octave |
| 5 | RH or LH | 3 | ≤3 accidentals | Root-position triads |
| 6 | RH or LH | 3 | ≤4 accidentals | Triads + inversions |
| 7 | Both hands | 1 + 1–2 | ≤2 accidentals | LH root/5th + RH interval/triad |
| 8 | Both hands | 1–2 + 3 | ≤4 accidentals | LH bass + RH triad/inversion |
| 9 | Both hands | 2–3 + 3–4 | ≤5 accidentals | Triads/7ths, inversions, ledger lines |
| 10 | Both hands | up to 5 + 5 | all 15 keys | Full range, accidentals, 7ths |

Levels are data (JSON), not code, so they can be tuned without a release.

### 3.2 Unlocking / progression

Each level has a **target** (e.g. "median < 2.0 s, ≥ 90% accuracy over 20 reps"). Meeting it unlocks the next level; all levels remain accessible via a "free play" toggle so users are never gated.

---

## 4. Content Generation (Music Theory Engine)

The generator produces **targets**: a set of pitches assigned to hands/clefs, plus the key signature, validated for playability and readability.

### 4.1 Data model (conceptual)

```ts
type Pitch = { midi: number; spelling: { letter: 'A'|'B'|...|'G'; accidental: -2|-1|0|1|2; octave: number } };

type KeySignature = { tonic: PitchClass; mode: 'major' | 'minor'; accidentals: number /* -7..+7 */ };

type HandPart = {
  hand: 'LH' | 'RH';
  clef: 'treble' | 'bass';
  pitches: Pitch[];            // sorted low → high
  label?: string;              // e.g. "Dm/F" (for feedback/debug)
};

type Target = {
  id: string;
  key: KeySignature;
  parts: HandPart[];           // 1 or 2 parts
  content: { type: 'note'|'interval'|'triad'|'seventh'|...; quality?: string; inversion?: number };
};
```

**Spelling matters.** Notation must use correct enharmonic spelling (F♯ vs G♭) according to the key and chord. The generator therefore works in *scale degrees / diatonic spelling*, not raw MIDI, and derives MIDI from that.

### 4.2 Generation rules

**Single notes:** pick a diatonic (or, if enabled, chromatic-altered) note within the allowed register for the clef.

**Intervals:** pick a lower note, then an upper note by diatonic interval size (2nd–octave, or larger later), spelled correctly in the key.

**Chords (one hand):** build from a diatonic scale degree using the key's triads (I, ii, iii, IV, V, vi, vii° in major; i, ii°, III, iv, v/V, VI, VII/vii° in minor), optionally with 7ths; apply inversion; choose octave so the chord fits the clef/register. If "notes per hand" < full chord size (e.g. 2 notes from a triad), pick a subset that keeps its identity (typically drop the 5th, never drop both the root and 3rd).

**Hand-span constraint:** a single hand's notes must fit a comfortable stretch — default max span of a **9th** (configurable), max 5 notes.

### 4.3 Two-hand coherence ("make a chord")

When both hands play together, the content must form a single harmony rather than two unrelated clusters. Strategy:

1. Choose **one chord** (root + quality, diatonic to the key) for the whole target.
2. Distribute chord tones between the hands using **voicing templates**:
   - *Bass + upper structure:* LH = root (or root + 5th, or root + octave); RH = triad/7th in any inversion.
   - *Shell voicing:* LH = root + 7th/3rd; RH = remaining tones.
   - *Split chord:* chord tones divided by register around middle C.
   - *Octave doubling:* LH doubles a RH note an octave (or two) below; occasionally allowed at low difficulty.
3. Enforce: LH below RH (no crossing) by default; LH range in bass clef zone, RH in treble zone (with ledger-line allowance per settings); avoid very low muddy intervals (e.g. thirds below C3) — use a "low interval limit" rule.
4. Doubled pitch classes are allowed (e.g. root in both hands) but total unique pitch classes should still identify the chord.

The templates are data-driven so new voicings can be added later.

### 4.4 "Either hand, one at a time" 

Randomly selects RH or LH per rep, then generates a one-part target in the matching clef (or, if the user selected "both clefs" for one-handed play, optionally the *opposite* clef — e.g. RH reading bass clef — to train cross-clef reading).

### 4.5 Repetition control

- Avoid repeating the exact same target back-to-back.
- Avoid too many consecutive items from the same key.

---

## 5. Notation Rendering

Requirements:

- Render treble, bass, and grand staff (both clefs with a brace) with key signatures from 7♭ to 7♯.
- Correct accidental display (courtesy accidentals not required; accidentals only when not implied by key signature).
- Notes: whole notes or quarter notes (stemless whole notes are simplest and avoid stem-direction complexity; configurable).
- Chords: correct handling of seconds (note-heads offset on either side of the stem/line) and ledger lines.
- Crisp on mobile/retina screens, scalable, with a **large-print** option.
- **Fast paint:** the render must be completed in a single frame so the timer start is honest. Pre-render the next target off-screen / cache SVG, then swap in.
- Optional note-name labels and keyboard-highlight overlay for the reveal/feedback state.

**Options considered:** VexFlow (mature, SVG/canvas, handles most engraving rules, a bit heavy) vs. custom SVG renderer (full control, lightweight, but more engraving work, especially chord note-head offsets). **Recommendation:** start with VexFlow for correctness; benchmark paint time; consider a custom renderer only if needed.

---

## 6. Input & Verification (the hard part)

### 6.1 Input abstraction

All verification logic sits behind one interface so the drill loop, tests, and alternate inputs share a path:

```ts
interface NoteInput {
  // Emits the set of currently sounding notes with timestamps
  onUpdate(cb: (state: { t: number; activeNotes: Map<number /*midi*/, number /*confidence 0..1*/>; onsets: Onset[] }) => void): void;
  start(): Promise<void>;
  stop(): void;
}
```

Implementations:

1. **`MicInput`** — Web Audio + DSP (primary, per the product requirement).
2. **`MidiInput`** — Web MIDI (exact, zero-latency; optional for users with digital pianos; hugely useful for development and test automation).
3. **`OnScreenKeyboardInput`** — tap keys on screen (fallback/dev/demo; also lets people try the app without a piano).
4. **`ScriptedInput`** — test harness that feeds recorded/synthetic note events.

### 6.2 Verification, not transcription

General polyphonic transcription from a mic is hard. But we have a big advantage: **we know the target.** So the matcher is designed as a *verifier*:

- For each expected pitch, compute a **presence score** from spectral energy at its fundamental and first several harmonics (using the expected spectral envelope of a piano), compared to the local noise/neighbor-bin energy.
- Compute an **extra-note score**: after "explaining away" energy from the expected notes (and their harmonics), is there significant remaining energy at other pitch-class bins consistent with a different note?
- A target is **satisfied** when all expected pitches have presence above threshold **and** no strong unexpected notes exist, for ≥ K consecutive analysis frames (to reject transients).

This is far more robust than blind transcription, particularly for chords where harmonics overlap (e.g. C and G share harmonics; octave doublings fully overlap).

### 6.3 Handling hard cases

| Problem | Mitigation |
|---|---|
| **Octave errors** (a C4 vs C5 look similar due to harmonics) | Weight lower harmonics' relative energy pattern; use expected-envelope template match; compare energy of octave-below candidate. Strict octave required by default; setting for "any octave" fallback. |
| **Low bass notes** (poor frequency resolution) | Larger FFT/CQT window for the bass band (multi-resolution analysis), parabolic interpolation, sub-bin phase info; accept slightly longer settle time for low notes. |
| **Piano inharmonicity** | Allow slightly stretched harmonic positions (partial frequencies drift sharp for high partials). |
| **Detuned piano** | Estimate user's tuning offset (e.g. A=438–445) during calibration and shift bins. Real pianos are also out of tune note-by-note, so a calibration mode builds a per-note tuning profile (see PD-312) that the verifier uses to shift expected bins. |
| **Room noise / other sounds** | Noise-floor estimate; calibrating gate; ignore frames below energy threshold. |
| **Sympathetic resonance / sustained previous notes** | Detect *onsets* (spectral flux) after flash; only notes whose onset is after t0 count. Ask user to release/dampen before the next flash (auto-wait until silence detected). |
| **Sustain pedal** | Same as above; recommend no pedal; "wait for quiet" before next flash. |
| **Extra notes / wrong notes** | Logged as errors; they do **not** pass verification; timer continues. Brief wrong-note tolerance: a wrong note followed by correction still counts as an error rep. |
| **Chord not struck simultaneously (rolled)** | Notes within a configurable window (e.g. 300 ms) are treated as one attempt; or simply require all notes to be present simultaneously at some frame. |
| **Digital piano through speakers** | Works; headphone-out into the device is not supported via mic (but MIDI would be). |

### 6.4 Timing

- **t₀** = timestamp of the frame where the target is first painted: record `performance.now()` inside `requestAnimationFrame` after the DOM/SVG swap, and map to the audio clock via `AudioContext.getOutputTimestamp()` / `currentTime` correlation.
- **t_first** = estimated onset of the first note of the attempt ("reaction time").
- **t_complete** = estimated onset of the last required note such that the full set is then satisfied ("completion time"). The **headline number** is `t_complete − t₀`.
- **Latency compensation:** subtract analysis-window delay (and calibrated input latency) so reported time reflects when the keys were struck, not when the algorithm became confident. Onset times are estimated from spectral flux peaks rather than from the moment the verifier fired.
- Show both *reaction* and *completion* in the detailed result; the session summary uses completion time.
- Verification itself must have low latency (target: < ~100 ms from keystroke to feedback) so the app feels responsive. Use short hops (e.g. 512–1024 samples) with overlapping, multi-resolution windows.

**Accuracy target:** ± 50 ms on timing is fine for a 1–5 s task; because the unit being trained is reading speed, systematic latency is less important than *consistency*, but keep it consistent across sessions (calibrate per device).

### 6.5 Tech for audio

- `getUserMedia` with `echoCancellation`, `noiseSuppression`, `autoGainControl` **disabled** (these distort musical signals).
- `AudioWorklet` for the capture + frame pipeline (off main thread); FFT in a worker or WASM.
- Candidate algorithms to spike: (a) template matching against expected note set (primary), (b) constant-Q / chromagram with harmonic weighting, (c) an on-device ML polyphonic model (e.g. Spotify's Basic Pitch / TF.js) as a comparison or fallback. Decision criterion: accuracy on a recorded test corpus vs. latency vs. battery/CPU.

### 6.6 Hand identification

The mic can only report pitches, not which hand played them. The app therefore verifies *pitches* and trusts that the user used the right hands. For two-hand targets, it checks the union of both parts. (With `MidiInput`, hand split could be inferred only heuristically too; not planned.)

### 6.7 Calibration & onboarding

A short wizard:

1. Mic permission and level check (play a note; show meter).
2. Noise floor measurement (silence for 2 s).
3. Tuning offset detection (play A, or a few notes).
4. Range check: play lowest and highest comfortably played note to confirm low-note detection works on this piano/device.
5. Latency estimation (optional: tap-to-click test or loopback metronome).

Results stored per input device.

---

## 7. Key Identification Mode

**Presentation:** a staff with a key signature (and clef) only; no notes. Optional variants:

- **Signature only** — answer by choosing how many sharps/flats (or the major key name).
- **Major/minor** — the signature is ambiguous between a major key and its relative minor. Options: (a) accept either as correct and ask the user to name the **major** key by default; (b) include a **tonic hint** (e.g. a single note, a cadence tone, or a dominant-tonic bass note) so the answer is unique; (c) ask for both "major / relative minor" names.
- **Answer method:** tap-based UI (circle-of-fifths wheel or 12-button grid with sharp/flat enharmonic handling, e.g. F♯/G♭ for 6 accidentals), or optionally *play the tonic* via the mic.

**Settings:** clef (treble/bass/random), accidental range, major only/minor only/both, answer format, timeout, enharmonic strictness (F♯ major vs G♭ major are different signatures but the same sound — the key signature determines the answer).

---

## 8. Session, Scoring & Progress

### 8.1 Per-rep record

```ts
type RepResult = {
  sessionId: string;
  targetId: string;
  dims: { clef: ...; hands: ...; key: ...; noteCount: ...; contentType: ...; /* etc. */ };
  reactionMs: number | null;
  completionMs: number | null;      // null if timed out/skipped
  errors: { t: number; notes: number[] }[];   // wrong notes detected
  outcome: 'correct' | 'correct_with_errors' | 'timeout' | 'skipped';
  timestamp: string;
};
```

### 8.2 Scoring

- Primary metric: **median completion time** (robust to outliers) over the last N reps per dimension bucket.
- Secondary: accuracy (% first-try correct), error rate, timeout rate.
- Optionally normalize time by note count (a 5-note chord should be allowed more time than a single note) so levels compare fairly: "time per note" or level-specific targets.

### 8.3 Session summary

Shown at the end of a session (see §2.1). Charts, heatmaps and cross-session analytics are out of scope for v1.

### 8.4 Storage

Local only for v1: IndexedDB (via Dexie or similar). Export/import JSON for backup. Data model designed to allow later sync.

---

## 9. Architecture

### 9.1 Platform recommendation

**Progressive Web App** (TypeScript + React/Vite):

- Runs on phones/tablets/laptops (the device sits on the piano music stand).
- `getUserMedia`, `AudioWorklet`, Web MIDI (Chrome/Edge/Android; limited on iOS Safari — MIDI input is optional so this is acceptable), IndexedDB, installable, offline-capable.
- No app store friction; fastest iteration on the DSP using browser tooling.

*Alternative:* native iOS/Android (Swift/Kotlin) for better audio latency control and Apple's `AVAudioEngine`/Accelerate; revisit if mobile web latency or Safari audio quirks are a blocker. The core logic (theory engine, scoring) is platform-independent TypeScript, which could be reused via React Native or ported.

### 9.2 Module layout

```
/src
  /theory        // pitch, intervals, scales, keys, chords, voicing templates, generator
  /levels        // level/preset definitions (JSON) + validation
  /notation      // staff rendering (VexFlow wrapper), layout, overlays
  /audio
    /capture     // getUserMedia, AudioWorklet, ring buffer
    /dsp         // FFT/CQT, onset detection, template matcher, noise floor
    /inputs      // NoteInput implementations: Mic, Midi, OnScreen, Scripted
    /calibration
  /session       // drill state machine, timing, scoring
  /keyid         // key-identification mode logic + UI
  /storage       // IndexedDB repositories
  /ui            // screens, components, theming, a11y
  /test-utils    // synthetic audio generator, fixtures, ScriptedInput
```

### 9.3 Drill state machine

```
IDLE → READY → FLASHED → (WRONG_NOTE → FLASHED)* → SUCCESS | TIMEOUT | SKIPPED → INTERSTITIAL → READY …
                    ↘ (PAUSE / END_SESSION)
```

`READY` waits for "silence" (from the input) and an optional delay before flashing, so leftover ring-out from the previous rep doesn't count.

### 9.4 Performance budget

- Target paint time < 1 frame (16 ms) for notation swap (pre-render).
- DSP frame processing < ~5 ms on a mid-range phone.
- End-to-end key-strike → UI feedback < ~150 ms.

---

## 10. UX Notes

- Primary screen is nearly just a **big staff**, a timer (optionally hidden to avoid anxiety; show result after), and minimal chrome.
- Keyboard/touch shortcuts: Space = skip/next, Esc = end session; big touch targets for mid-session controls.
- Optional pre-flash cue (e.g. 3-2-1 or a single beat) vs. "wait for silence then flash after random 0.5–1.5 s".
- Reveal on miss: show note names + a piano keyboard diagram highlighting target keys.
- Accessibility: high-contrast theme, large staff option, color-blind-safe feedback (don't rely on red/green only), reduced motion option.
- Sound effects optional (off by default since the mic is open — avoid feedback loops; and no audio playback during listening).

---

## 11. Testing Strategy

- **Theory engine:** unit tests for spelling, key signatures, chord construction, voicing validity (span, crossing), and property-based tests ("every generated target is readable and playable under the level's constraints").
- **Notation:** snapshot tests for a matrix of keys × clefs × chord shapes; manual visual review for engraving edge cases (seconds, ledger lines).
- **DSP:** a corpus of recordings: real piano (several instruments/rooms, phone positions), digital piano via speaker, plus synthetic audio (sampled piano rendered from MIDI) for deterministic regression tests. Measure: note-set precision/recall, octave-error rate, onset-time error, latency; run as a CI benchmark with thresholds.
- **Session logic:** deterministic tests using `ScriptedInput` and a fake clock.
- **Manual:** device matrix (iPhone Safari, Android Chrome, laptop Chrome/Firefox), low/high noise rooms.

---

## 12. Risks & Open Questions

| Risk / Question | Notes / Plan |
|---|---|
| **Polyphonic detection accuracy on phones** | Biggest risk. Front-load with a spike (Epic 3) before building the rest on top. MIDI/on-screen inputs keep the product developable regardless. |
| **Low-register detection** | Bass notes below ~C2 may be unreliable; cap default range, flag as known limitation. |
| **iOS Safari audio quirks** (AudioWorklet, autoplay/permissions, background throttling) | Test early; consider native wrapper if blocking. |
| **Timing honesty** (display latency, mic latency) | Calibrate; be explicit that absolute times are approximate and consistent per device. |
| **Major/minor ambiguity in key ID** | Decide default (see §7). Proposed default: ask for major key name; minor optional with tonic hint. |
| **What counts as "correct" when extra notes ring?** | Proposed: any unexpected strong note = error unless it's a rolled-chord overlap/sympathetic resonance below threshold. Tunable. |
| **Pedal / sustain** | Recommend no pedal; app waits for silence. |
| **Strict octave vs any octave** | Default strict; setting to relax. |
| **Whole vs quarter notes** | Default whole notes (simplest, cleanest). |
| **Name / brand** | TBD. |

---

## 13. Milestones

| Milestone | Contents | Exit criterion |
|---|---|---|
| **M0 — Feasibility** | Theory-engine skeleton, staff rendering demo, **mic verification spike** | Mic matcher correctly verifies single notes + triads on a real piano ≥ 90% in a quiet room |
| **M1 — Playable MVP** | Single/interval/triad drills, one-hand, key sigs, timing, results, with Mic + MIDI + on-screen input | A user can run a full session at levels 1–6 |
| **M2 — Two hands + Key ID** | Two-hand voicings, grand staff, key identification mode | Levels 7–10 and Key ID mode work end-to-end |
| **M3 — Polish** | Calibration wizard, custom presets, PWA, a11y | Beta-ready |

---

# Implementation Tickets

**Conventions:** Size = S (≤ 1 day), M (2–3 days), L (4–7 days), XL (> 1 week; consider splitting). Dependencies are listed by ID. Tickets are grouped into epics roughly in build order, but epics 1, 2, and 3 can proceed in parallel after Epic 0.

---

## Epic 0 — Project Foundations

### PD-001: Project scaffolding
**Size:** S
Set up Vite + React + TypeScript, linting, formatting, test runner (Vitest), CI to run lint/test/build, basic folder structure from §9.2.
**Acceptance:**
- `npm run dev/test/build` work; CI green on an empty test.

### PD-002: App shell & routing
**Size:** S · **Deps:** PD-001
Home screen, routes for Play, Key ID, Settings; placeholder screens; responsive layout; theme tokens (light/dark/high-contrast).
**Acceptance:**
- Navigation works on mobile and desktop widths; theme toggle persists.

### PD-003: Local storage layer
**Size:** M · **Deps:** PD-001
IndexedDB wrapper (Dexie or similar) with repositories for settings, custom presets, sessions, and rep results; schema versioning/migrations; JSON export/import.
**Acceptance:**
- CRUD tests pass; export → wipe → import restores data.

---

## Epic 1 — Music Theory Engine

### PD-101: Core pitch & spelling primitives
**Size:** M · **Deps:** PD-001
Types and utilities: letter/accidental/octave pitch spelling, MIDI conversion, transposition by interval, enharmonic handling, pitch-class sets, comparison/sorting.
**Acceptance:**
- Unit tests for spelling round-trips (including double sharps/flats), interval arithmetic, MIDI ↔ spelling.

### PD-102: Keys & key signatures
**Size:** M · **Deps:** PD-101
All 15 major and 15 minor key signatures (including enharmonic pairs), accidentals-per-staff-position tables for treble & bass (correct sharp/flat order and octave placement), scale generation, relative major/minor mapping, circle-of-fifths ordering.
**Acceptance:**
- Tests verify all keys' scale spellings and signature accidental placement per clef.

### PD-103: Diatonic chord & interval library
**Size:** M · **Deps:** PD-102
Interval qualities/sizes; triads and seventh chords built diatonically per key (major, natural/harmonic minor); inversions; chord naming (for labels/debug); partial-chord subset logic (§4.2).
**Acceptance:**
- Given a key + degree + quality + inversion, produces correct spelled pitches; test table covering all degrees in several keys.

### PD-104: Register, playability & readability constraints
**Size:** M · **Deps:** PD-101
Clef staff ranges, ledger-line counting, hand-span check, max-notes-per-hand, low-interval-limit rule, LH/RH crossing check, comfortable range defaults.
**Acceptance:**
- Validation functions with unit tests; given a candidate target returns pass/fail + reasons.

### PD-105: Target generator — single-hand content
**Size:** L · **Deps:** PD-103, PD-104
Generates single notes, intervals, triads, sevenths with inversions for one hand, respecting difficulty settings (clef, key set, mode, ledger lines, accidentals). Includes anti-repeat logic.
**Acceptance:**
- Property tests: 10k generated targets per config all satisfy constraints; distribution sanity checks (keys/degrees roughly uniform).

### PD-106: Two-hand voicing templates & generator
**Size:** L · **Deps:** PD-105
Data-driven voicing templates (bass + upper structure, shell, split, octave doubling); generator that picks one chord and splits it between hands per §4.3; no hand crossing; low-interval-limit rule; unique pitch class coverage check.
**Acceptance:**
- Every generated two-hand target is identifiable as a single diatonic chord; property tests pass; at least 4 templates implemented and selectable by level.

### PD-107: "Either hand, one at a time" & cross-clef options
**Size:** S · **Deps:** PD-105
Per-rep random hand selection; optional cross-clef (e.g. RH in bass clef) setting.
**Acceptance:**
- Settings produce expected hand/clef distribution in tests.

### PD-108: Level & preset schema
**Size:** M · **Deps:** PD-105, PD-106
JSON schema + validator for difficulty settings (§3); the 10 preset levels from §3.1; custom preset merge/override; defaults; migration-safe versioning.
**Acceptance:**
- All presets validate; invalid configs produce readable errors; generator can consume any valid config.

---

## Epic 2 — Notation Rendering

### PD-201: Single staff renderer (treble/bass) with key signature
**Size:** M · **Deps:** PD-102
VexFlow (or chosen lib) wrapper rendering a staff with clef, key signature, and notes. Responsive scaling, high-DPI.
**Acceptance:**
- Renders all 30 key signatures in both clefs correctly (visual snapshot tests).

### PD-202: Chords, intervals & accidentals
**Size:** M · **Deps:** PD-201
Correct chord layout including seconds clusters, ledger lines, accidentals not in key signature, and whole-note default with quarter-note option.
**Acceptance:**
- Snapshot test gallery for tricky cases (adjacent seconds, 3 ledger lines, double accidentals).

### PD-203: Grand staff renderer
**Size:** M · **Deps:** PD-202
Two-staff system with brace and aligned notes for two-hand targets; stable layout between reps (no layout jump).
**Acceptance:**
- Two-hand targets from the generator render correctly across all keys.

### PD-204: Flash performance & timing hook
**Size:** M · **Deps:** PD-201
Pre-render next target off-screen; atomic swap; expose a `onPainted(timestamp)` callback using `requestAnimationFrame` for accurate t₀. Benchmark paint time.
**Acceptance:**
- Swap completes within a single frame on a mid-range phone; the t₀ callback fires once per flash.

### PD-205: Overlays — note names & keyboard diagram
**Size:** M · **Deps:** PD-202
Optional note-name labels on notes; piano keyboard component highlighting target keys (for reveal-on-miss and on-screen input).
**Acceptance:**
- Reveal view shows correct names/highlights for any target.

### PD-206: Large-print & accessibility options
**Size:** S · **Deps:** PD-203
Staff size setting, high-contrast mode, non-color-only feedback styles.
**Acceptance:**
- Staff size scales without clipping; passes automated contrast checks.

---

## Epic 3 — Input & Verification

> **Risk-first epic.** PD-301–PD-304 should start early; PD-307 is the make-or-break spike.

### PD-301: `NoteInput` interface & `ScriptedInput`
**Size:** S · **Deps:** PD-001
Define the interface from §6.1 and a scripted/fake implementation with controllable timestamps for tests.
**Acceptance:**
- Session tests can drive notes deterministically.

### PD-302: On-screen keyboard input
**Size:** S · **Deps:** PD-301, PD-205
Tap/click keyboard implementing `NoteInput` (multi-touch for chords). Also acts as demo mode.
**Acceptance:**
- Multi-touch chord produces the combined active note set.

### PD-303: Web MIDI input
**Size:** M · **Deps:** PD-301
Device selection, note on/off tracking with timestamps, graceful degrade when unsupported, hot-plug handling.
**Acceptance:**
- Works with a USB/BT MIDI keyboard in Chrome; unsupported browsers show a clear message.

### PD-304: Mic capture pipeline
**Size:** L · **Deps:** PD-301
`getUserMedia` with processing disabled, `AudioWorklet` capture into a ring buffer, device selection, permission/error states, audio clock ↔ `performance.now()` mapping.
**Acceptance:**
- Level meter works on desktop and mobile; clock mapping error measured and documented.

### PD-305: Spectral analysis core
**Size:** L · **Deps:** PD-304
Multi-resolution FFT (or CQT) pipeline, windowing, parabolic interpolation, noise floor estimation, spectral flux onset detector. Runs off the main thread (worker/WASM as needed).
**Acceptance:**
- On synthetic piano audio, onset times within ±30 ms; pipeline runs < 5 ms/frame on target device.

### PD-306: Test corpus & benchmark harness
**Size:** L · **Deps:** PD-301
Record and label a corpus (acoustic piano, various phones/positions/rooms, plus digital piano/speaker and synthetic renders): single notes, intervals, triads, two-hand chords across the full range, plus negative cases (wrong note, extra note, silence, room noise). Harness computes precision/recall, octave-error rate, onset error, latency; CI regression thresholds.
**Acceptance:**
- One command produces a report; baseline numbers committed.

### PD-307: SPIKE — Target-aware note verifier
**Size:** XL · **Deps:** PD-305, PD-306
Implement the verifier of §6.2: expected-note presence scoring with harmonic templates, explaining-away residual for unexpected notes, temporal consistency (K frames), octave disambiguation, inharmonicity tolerance. Compare against alternatives (chromagram, Basic Pitch) on the corpus; write up a decision.
**Acceptance:**
- Meets the M0 exit criterion (≥ 90% correct verification on single notes + triads in a quiet room), < 100 ms detection latency, false-accept rate on wrong-note cases < 5%. Written findings and recommended thresholds.

### PD-308: Mic input implementation (`MicInput`)
**Size:** M · **Deps:** PD-307
Wrap capture + verifier as a `NoteInput`; support "expected set" being supplied to the verifier; emit satisfied/unexpected-note events with onset timestamps; "wait for silence" signal.
**Acceptance:**
- End-to-end: playing a target on a piano triggers success events with correct onset timing.

### PD-309: Onset-based timing & latency compensation
**Size:** M · **Deps:** PD-308
Compute reaction and completion times from onset estimates (not verifier fire time); subtract calibrated device latency; handle rolled chords and re-struck notes.
**Acceptance:**
- Timing error vs. ground truth (MIDI-synced recordings) within ±50 ms on corpus.

### PD-310: Low-register & octave robustness
**Size:** L · **Deps:** PD-307
Improvements for bass notes and octave confusion: low-band long windows, octave-ambiguity checks, per-note confidence, configurable range cap and strict/relaxed octave modes.
**Acceptance:**
- Octave-error rate on corpus < 3%; bass-clef notes down to the supported range pass benchmark thresholds; documented supported range.

### PD-311: Calibration wizard
**Size:** M · **Deps:** PD-308
Flow from §6.7: permission, level, noise floor, tuning offset, range check, optional latency test; per-device storage of results; "recalibrate" entry point.
**Acceptance:**
- A new user finishes calibration in < 90 s; results measurably reduce false rejects on a detuned test piano.

---

## Epic 4 — Drill Session (Play Mode)

### PD-401: Session state machine & timing core
**Size:** M · **Deps:** PD-301, PD-204
Implement states from §9.3 with a fake-clock-friendly design; start/pause/end; timeout; skip; wrong-note logging; "wait for silence" gating; t₀ capture.
**Acceptance:**
- Deterministic tests cover success, wrong-then-right, timeout, skip, and pause paths.

### PD-402: Drill screen UI
**Size:** M · **Deps:** PD-401, PD-203
Main play screen: big staff, minimal chrome, optional timer visibility, success/miss feedback, reveal on miss (using PD-205), shortcuts, input source selector.
**Acceptance:**
- Full rep loop works with on-screen keyboard input at levels 1–10.

### PD-403: Session summary screen
**Size:** M · **Deps:** PD-402, PD-003
End-of-session stats: median/mean time, accuracy, slowest 5 targets, per-rep list, comparison to previous session at same level; save results.
**Acceptance:**
- Results persisted and viewable; comparison correct against seeded history.

### PD-404: Level select & custom settings UI
**Size:** L · **Deps:** PD-108, PD-002
Level list with targets/locks, custom preset editor for all dimensions in §3, live preview of sample targets, save/load/delete presets, "free play" unlock toggle.
**Acceptance:**
- Any valid configuration can be created, previewed, saved, and launched.

### PD-405: Level progression & unlocking
**Size:** S · **Deps:** PD-403, PD-404
Evaluate level targets from §3.2 after each session; unlock next level; surface progress.
**Acceptance:**
- Seeded session data unlocks as expected; free-play bypass works.

### PD-406: Mic-driven play end-to-end integration
**Size:** M · **Deps:** PD-308, PD-309, PD-402
Wire `MicInput` into drill loop; handle permission-denied, mic loss, noisy environment warnings, input switching mid-session.
**Acceptance:**
- Complete a 20-rep session on a real piano using only the mic.

---

## Epic 5 — Key Identification Mode

### PD-501: Key-ID question generator
**Size:** S · **Deps:** PD-102
Generate key-signature questions respecting settings (clef, accidental range, major/minor/both, tonic hint, enharmonic rules); anti-repeat.
**Acceptance:**
- Tests verify each generated question has an unambiguous correct answer under the selected answer format.

### PD-502: Answer UI (circle-of-fifths / button grid)
**Size:** M · **Deps:** PD-002
Touch-friendly answer input with proper enharmonic labelling; major/minor toggle where applicable; keyboard shortcuts.
**Acceptance:**
- All 30 keys can be selected correctly on mobile and desktop.

### PD-503: Key-ID session screen & scoring
**Size:** M · **Deps:** PD-501, PD-502, PD-401
Flash → answer → timed result; reuse session machine/summary; record confusion data (answered vs. correct).
**Acceptance:**
- Full session works; results stored with the same `RepResult` shape (mode flag).

### PD-504: Play-the-tonic answer option
**Size:** S · **Deps:** PD-503, PD-308
Alternative answer method: play the tonic note on the piano and verify via mic/MIDI.
**Acceptance:**
- Works with at least mic and MIDI inputs; settings toggle between tap and play.

### PD-505: Key-ID settings & levels
**Size:** S · **Deps:** PD-503, PD-404
Presets (e.g. ≤2 accidentals → all keys; major → minor), custom options UI.
**Acceptance:**
- Presets selectable from the level screen.

---

## Epic 7 — Polish, Quality & Release

### PD-701: Onboarding & first-run flow
**Size:** M · **Deps:** PD-311, PD-404
Intro, how to place the device, calibration, choice of input method, first level suggestion.
**Acceptance:**
- New user can reach their first rep in < 3 minutes.

### PD-702: PWA setup (offline, installable)
**Size:** S · **Deps:** PD-002
Service worker, manifest, icons, offline operation for everything except nothing-requires-network features.
**Acceptance:**
- Installs on iOS/Android/desktop; fully functional offline.

### PD-703: Settings screen
**Size:** S · **Deps:** PD-003
Input device, timeout default, pre-flash delay, notation size, note head style, sound effects, data export/import/reset.
**Acceptance:**
- Settings persist and take effect without reload.

### PD-704: Cross-device/browser QA & fixes
**Size:** L · **Deps:** PD-406, PD-503
Test matrix per §11; fix iOS Safari audio, permission, throttling, and layout bugs; document known limitations.
**Acceptance:**
- Checklist passes on the device matrix; issues triaged.

### PD-705: Performance & battery pass
**Size:** M · **Deps:** PD-406
Profile DSP on low-end devices, reduce CPU, pause analysis when idle, verify memory stability over a 30-minute session.
**Acceptance:**
- Meets §9.4 budget on the lowest-spec target device.

### PD-706: Documentation & help content
**Size:** S · **Deps:** PD-701
In-app help (mic placement, pedal advice, troubleshooting) and developer README (architecture, running benchmarks, adding levels/voicings).
**Acceptance:**
- Docs reviewed; troubleshooting covers each calibration failure mode.

---

## Suggested Build Order

1. **PD-001 → PD-003** (foundations)
2. In parallel:
   - **Theory:** PD-101 → PD-105 → PD-108
   - **Notation:** PD-201 → PD-202 → PD-204
   - **Mic risk spike:** PD-301 → PD-304 → PD-305 → PD-306 → **PD-307**
3. **M0 gate:** decide go/no-go on mic approach (fallback: ship MIDI/on-screen first, keep mic as beta).
4. **M1:** PD-302, PD-303, PD-401 → PD-403, PD-308 → PD-309, PD-404 → PD-406
5. **M2:** PD-106, PD-107, PD-203, then Epic 5
6. **M3:** PD-310, PD-311, Epic 7

## Ticket Index

| Epic | Tickets |
|---|---|
| 0 Foundations | PD-001 – PD-003 |
| 1 Theory Engine | PD-101 – PD-108 |
| 2 Notation | PD-201 – PD-206 |
| 3 Input & Verification | PD-301 – PD-311 |
| 4 Drill Session | PD-401 – PD-406 |
| 5 Key ID Mode | PD-501 – PD-505 |
| 7 Polish & Release | PD-701 – PD-706 |