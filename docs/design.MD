# Piano Drill — Design Doc & Implementation Tickets

**Status:** Draft v1
**Name:** Piano Drill

> **Input (decided 2026-11-12, final 2026-11-17):** the app reads notes from **a digital piano over MIDI** on desktop Chromium, or from an on-screen piano. Microphone input was tried, did not reach the bar, and was cut from the project completely on 2026-11-17. See docs/tickets.md (PD-313, PD-314) and docs/midi.md.

---

## 1. Overview

A practice app that trains **instant sight-reading of small musical units** (a single interval or chord) rather than whole pieces. A bit of notation is flashed on screen, the user finds and plays it on a digital piano (or an on-screen one), and the app reads the notes over MIDI and records how long it took.

The core idea is the same as flashcards: short, repeated, timed reps on the exact skill that is weak (e.g. "bass clef, 4 flats, root-position triad"), with difficulty that can be tuned.

A second, separate mode drills **key signature recognition** with no playing involved.

### 1.1 Goals

- Fast, low-friction drill loop: flash → play → result → next, with no taps between reps.
- Exact note detection from a digital piano over MIDI.
- Accurate-enough timing that improvement over days/weeks is visible and meaningful.
- Rich difficulty customization (clef, hand, note count, key signature complexity, chord/interval types), packaged into preset levels.
- Musically sensible content: two-hand material forms real chords/voicings, not random note clusters.
- Progress tracking broken down by the dimensions that matter (key, clef, chord type).

### 1.2 Non-goals (v1)

- Rhythm reading, note-length evaluation, or playing in time.
- Reading whole phrases or pieces.
- Dynamics/touch evaluation.
- Telling *which hand* played a note (MIDI reports pitches, not hands; see §6.6).
- Stats screens, charts, and adaptive (weak-spot) practice — cut from the MVP.
- Acoustic-piano input (microphone) — cut from the project.
- Accounts/cloud sync/social features (local-only storage in v1).
- Teaching theory from scratch (some in-app hints, but not a curriculum).

### 1.3 Target user

An intermediate learner or returning pianist who can read slowly and wants to get *fast*, and who has a digital piano or keyboard connected to their laptop.

---

## 2. Core User Flows

### 2.1 Drill session (Play Mode)

1. User picks a level (or custom settings) and starts a session.
2. **Ready state:** a blank staff area with a short "get your hands on the keys" pause (user-configurable, or tap/spacebar to flash).
3. **Flash:** the target notation appears. The timer starts on the frame in which it is first painted.
4. User plays the notes.
5. As each expected note is detected it gets a green shadow on the staff (**per-note feedback**). When every expected note has been heard → timer stops → brief positive feedback with the time (e.g. "1.42 s"). Auto-advances after a short delay. Notes do not have to sound together (see §6.2).
6. If the user plays wrong notes, they are logged as errors; the timer keeps running until the correct set is played or the user skips/times out.
7. After N reps (e.g. 20) or when the user ends the session, show a summary: median time, accuracy, slowest items, comparison to previous sessions at the same level.

Timeout (configurable, default 10 s): the target is revealed with note names + a keyboard highlight, logged as a miss, and the session moves on.

### 2.2 Key Identification Mode

1. A staff with a **key signature only** is flashed (clef varies; optionally a tonic hint, see §7).
2. User answers by tapping a key button (the circle-of-fifths wheel), or (with a MIDI piano) by playing a checklist on it (§7).
3. Timed; correct/incorrect recorded; same summary/stat treatment as Play Mode.

### 2.3 Settings / Level Select

- Pick a preset level, or open **Custom** to edit every dimension.
- Save custom presets.
- Test the MIDI connection.

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
| **Register / ledger lines** | Staff only · Up to 1 ledger line · Up to 2–3 ledger lines (**MVP: range C2–C6: up to 2 ledger lines past the treble and bass staves; levels 1–2 use 1, levels 3–10 use 2**) |
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

> **MVP range: C2–C6** (decided 2026-11-12, replacing the earlier G2–F5). Each hand reads its own clef and may go up to two ledger lines past the staff: C6 is on the second ledger line above the treble staff and C2 on the second below the bass staff. Levels 1 and 2 use one ledger line, levels 3 to 10 use two. It is not a setting in Play.

Levels are data (JSON), not code, so they can be tuned without a release.

### 3.2 Unlocking / progression

Each level has a **target** (e.g. "median < 2.0 s, ≥ 90% accuracy over 20 reps"). Meeting it unlocks the next level; all levels remain accessible via a "free play" toggle so users are never gated. **Post-MVP (decided 2026-11-12):** for the MVP every level is open from the start; the targets stay in the level data.

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

When both hands play together, the content must form a single harmony rather than two unrelated clusters. The settings for both hands are the **same as for one hand**: "notes per hand" (1, 2, 3 or 4), and each hand gets a count from the chosen list. There are no voicing options for the user or the level data; the generator chooses a sensible arrangement itself. Strategy:

1. Choose **one chord** (root + quality, diatonic to the key) for the whole target: a triad, or a seventh chord when a hand has 4 notes.
2. The **left hand plays the root as its lowest note**, plus chord tones above it (a fifth, the root an octave up, and so on). The **right hand plays chord tones** above that. With "inversions" off, the right hand is in root position; with it on, any inversion and octave doublings are allowed.
3. Enforce: LH below RH (no crossing); LH in the bass-clef zone, RH in the treble-clef zone (with the ledger-line allowance per settings); each hand within a comfortable span; avoid very low muddy intervals (e.g. thirds below C3) via the "low interval limit" rule.
4. Together the hands always include the root and third, and every chord tone whenever there are enough notes to do so. Doubled pitch classes are allowed (e.g. root in both hands) but the unique pitch classes still identify the chord.

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
- Notes: whole notes only (stemless, which avoids stem-direction complexity).
- Chords: correct handling of seconds (note-heads offset on either side of the stem/line) and ledger lines.
- Crisp on mobile/retina screens, scalable, with a **large-print** option.
- **Fast paint:** the render must be completed in a single frame so the timer start is honest. Pre-render the next target off-screen / cache SVG, then swap in.
- Optional note-name labels and keyboard-highlight overlay for the reveal/feedback state.

**Options considered:** VexFlow (mature, SVG/canvas, handles most engraving rules, a bit heavy) vs. custom SVG renderer (full control, lightweight, but more engraving work, especially chord note-head offsets). **Recommendation:** start with VexFlow for correctness; benchmark paint time; consider a custom renderer only if needed.

---

## 6. Input & Verification

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

1. **`MidiInput`** — a digital piano over Web MIDI (the MVP's primary input; exact notes and timing, so no verification is needed).
2. **`OnScreenKeyboardInput`** — tap keys on screen (fallback/dev/demo; also lets people try the app without a piano).
3. **`ScriptedInput`** — test harness that feeds recorded/synthetic note events.

### 6.2 Verification

With MIDI there is nothing to transcribe: a note-on message carries the exact pitch and a timestamp. A target is **satisfied** when every expected pitch has been played (each is latched once heard, with an onset after t₀). **The goal is to get all the notes, not a perfectly synchronized chord:** notes can be played together, rolled or re-played individually. Unexpected notes are logged as errors but do not undo notes already heard. The UI shows per-note progress (see **Per-note feedback** in §10).

### 6.3 Hard cases

| Problem | Handling |
|---|---|
| **Wrong or extra notes** | Logged as errors; they do **not** pass verification; the timer continues. |
| **Ring-out from the previous rep** | MIDI has no ring-out; only note-ons after t₀ count. |
| **Sustain pedal** | Pedal messages are ignored. |
| **Piano unplugged mid-session** | The drill pauses with a clear message and resumes when the piano is back. |
| **Browsers without Web MIDI** | Reported in words; the on-screen piano still works (see docs/midi.md). |

### 6.4 Timing

- **t₀** = timestamp of the frame where the target is first painted: `performance.now()` inside `requestAnimationFrame` after the DOM/SVG swap. A MIDI message's timestamp is on the same clock.
- **t_complete** = onset of the note that completed the set, i.e. the last expected note to be heard. The **headline number** is `t_complete − t₀`.

### 6.5 Hand identification

MIDI reports pitches, not which hand played them. The app verifies *pitches* and trusts that the user used the right hands. For two-hand targets, it checks the union of both parts.

---

## 7. Key Identification Mode

**Presentation:** a staff with a key signature, in the treble or the bass clef (chosen at random for each question, one at a time; it is not a setting). The question is always "name the key". Which keys are asked decides what is drawn:

- **Major keys only** or **minor keys only** — the signature alone; the answer is the key it names in that mode. No note is shown (it would give the answer away).
- **Major and minor mixed** — a major key and its relative minor share a signature, so a whole note on the **tonic** is shown with it and the answer is unique.

F♯ major and G♭ major sound the same but have different signatures; they are always different answers.

**Answering:** three views on the main screen, switchable at any time: the circle-of-fifths **wheel**, **typing** (a text box with no visual cue: a wheel lets you count around it, so typing is the harder, more direct test), and **playing the key** (a MIDI piano on a desktop screen; the tab is greyed out otherwise): a checklist done in any order, with the hand that reads the clef (treble: right hand, at or above middle C; bass: left hand, below it): the scale up and down, and the tonic chord and its two inversions. A slip resets only the row in progress; the other hand's notes are ignored; the on-screen piano just mirrors the keys held. Because it takes longer, the question's time limit is 8 seconds longer, and the question scores 150 instead of 100 plus the usual speed bonus against a goal time that is also 8 seconds longer.

**Gameplay (decided 2026-11-12):** modelled on Play. A wrong guess is marked ✕ and stays marked, but it does not end the question or reveal the answer: you keep guessing until you get it, time runs out, or you skip. Only a timeout or a skip shows the answer. Each wrong guess costs 25 points like a wrong note in Play; getting it after wrong guesses counts as correct with errors.

**Settings** (kept small): level, up to how many sharps/flats, major only/minor only/both, questions per session, time limit. The clef (random, treble or bass), the question type, enharmonic strictness and the answer method are not settings.

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

Arcade-style (decided 2026-11-12). Each target you get right earns 100 points plus a speed bonus of up to 100 (full if you finish within the level's goal time, fading to zero at twice the goal time), minus 25 per wrong note; a timeout, a skip or a wrong key-ID answer scores 0. A perfect, fast 20-target session is 4000. **Key Signatures is weighted by the view the question was answered in (2026-11-16):** the wheel shows every key, so it is worth three quarters of typing (75 plus a speed bonus of up to 75, the wrong-guess penalty scaled the same, so a perfect session is 3000); typing is the base (4000); a played MIDI checklist is a flat 250 per question (5000). Each question is scored by the view that gave its correct answer, and results saved before this are scored like typing. Each preset level has a top-ten board per mode, kept with three initials. Only finished sessions on preset levels are scored for a board. The level goals in §3.2 (median time, accuracy) still decide unlocking.

### 8.3 Session summary

Shown at the end of a session as a modal: the score, how many were correct, total time, and (for a new top-ten score) an initials box. A High scores screen shows each level's board. Charts, heatmaps and per-target analytics are out of scope for v1.

### 8.4 Storage

Local only for v1: IndexedDB (via Dexie or similar). Export/import JSON for backup. Data model designed to allow later sync.

---

## 9. Architecture

### 9.1 Platform recommendation

**Progressive Web App** (TypeScript + React/Vite):

- Runs on phones/tablets/laptops (the device sits on or near the piano).
- Web MIDI (desktop Chromium), IndexedDB, installable, offline-capable.
- No app store friction.

*Alternative:* native iOS/Android (Swift/Kotlin), which would be needed for MIDI on iPhone/iPad (Safari has no Web MIDI). The core logic (theory engine, scoring) is platform-independent TypeScript, which could be reused via React Native or ported.

### 9.2 Module layout

```
/src
  /theory        // pitch, intervals, scales, keys, chords, voicing templates, generator
  /levels        // level/preset definitions (JSON) + validation
  /notation      // staff rendering (VexFlow wrapper), layout, overlays
  /audio
    /inputs      // NoteInput implementations: Midi, OnScreen, Scripted, Merged
  /session       // drill state machine, timing, scoring
  /keyid         // key-identification mode logic + UI
  /storage       // IndexedDB repositories
  /ui            // screens, components, theming, a11y
  /test-utils    // fixtures, fake MIDI, ScriptedInput
```

### 9.3 Drill state machine

```
IDLE → READY → FLASHED → (WRONG_NOTE → FLASHED)* → SUCCESS | TIMEOUT | SKIPPED → INTERSTITIAL → READY …
                    ↘ (PAUSE / END_SESSION)
```

`READY` waits for an optional delay before flashing.

### 9.4 Performance budget

- Target paint time < 1 frame (16 ms) for notation swap (pre-render).
- End-to-end key-strike → UI feedback < ~150 ms.

---

## 10. UX Notes

- Primary screen is nearly just a **big staff**, a timer (optionally hidden to avoid anxiety; show result after), and minimal chrome.
- Keyboard/touch shortcuts: Space = skip/next, Esc = end session; big touch targets for mid-session controls.
- A fixed **"Get ready"**: 4 seconds at the start of a session (and after a resume), then 1 second between targets, with the room quiet each time. Not a setting.
- **Per-note feedback** (the point is to tell the user *which* note to fix, and how):
  - Each expected note is **heard** (solid green halo plus a check mark) or **missing** (no marking). Never color alone.
  - Wrong notes are marked ✕.
  - A "3 / 5 notes" counter; the timer stops on the last note.
- Reveal on miss: show note names + a piano keyboard diagram highlighting target keys.
- Accessibility: high-contrast theme, large staff option, color-blind-safe feedback (don't rely on red/green only), reduced motion option.
- Sound effects optional (off by default).

---

## 11. Testing Strategy

- **Theory engine:** unit tests for spelling, key signatures, chord construction, voicing validity (span, crossing), and property-based tests ("every generated target is readable and playable under the level's constraints").
- **Notation:** snapshot tests for a matrix of keys × clefs × chord shapes; manual visual review for engraving edge cases (seconds, ledger lines).
- **Session logic:** deterministic tests using `ScriptedInput` and a fake clock.
- **Manual:** desktop Chromium with a real digital piano; phone layout checks.

---

## 12. Risks & Open Questions

| Risk / Question | Notes / Plan |
|---|---|
| **Major/minor ambiguity in key ID** | Decide default (see §7). Proposed default: ask for major key name; minor optional with tonic hint. |
| **Whole vs quarter notes** | Decided: whole notes only. |
| **Name / brand** | TBD. |

---

## 13. Milestones

| Milestone | Contents | Exit criterion |
|---|---|---|
| **M0 — Feasibility** | Theory-engine skeleton, staff rendering demo, **MIDI input** | Notes played on a real digital piano arrive with the right pitch and timing |
| **M1 — Playable MVP** | Single/interval/triad drills, one-hand, key sigs, timing, results, with MIDI + on-screen input | A user can run a full session at levels 1–6 |
| **M2 — Two hands + Key Signatures** | Two-hand voicings, grand staff, key identification mode | Levels 7–10 and Key Signatures mode work end-to-end |
| **M3 — Polish** | Custom presets, PWA, a11y | Beta-ready |

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
Home screen, routes for Sight-Read, Key Signatures, Settings; placeholder screens; responsive layout; theme tokens (light/dark/high-contrast).
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
Correct chord layout including seconds clusters, ledger lines, accidentals not in key signature, and whole notes (no quarter notes in the MVP).
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









---

## Epic 4 — Drill Session (Play Mode)

### PD-401: Session state machine & timing core
**Size:** M · **Deps:** PD-301, PD-204
Implement states from §9.3 with a fake-clock-friendly design; start/pause/end; timeout; skip; wrong-note logging; t₀ capture.
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


---

## Epic 5 — Key Identification Mode

### PD-501: Key-signature question generator
**Size:** S · **Deps:** PD-102
Generate key-signature questions respecting settings (clef, accidental range, major/minor/both, tonic hint, enharmonic rules); anti-repeat.
**Acceptance:**
- Tests verify each generated question has an unambiguous correct answer under the selected answer format.

### PD-502: Answer UI (circle-of-fifths wheel / typing)
**Size:** M · **Deps:** PD-002
Touch-friendly answer input with proper enharmonic labelling; major/minor toggle where applicable; keyboard shortcuts.
**Acceptance:**
- All 30 keys can be selected correctly on mobile and desktop.

### PD-503: Key-signature session screen & scoring
**Size:** M · **Deps:** PD-501, PD-502, PD-401
Flash → answer → timed result; reuse session machine/summary; record confusion data (answered vs. correct).
**Acceptance:**
- Full session works; results stored with the same `RepResult` shape (mode flag).

### PD-504: Play-the-tonic answer option
**Size:** S · **Deps:** PD-503
Alternative answer method: play on a MIDI piano.
**Acceptance:**
- Works with the MIDI input; toggles between tap and play.

### PD-505: Key-signature settings & levels
**Size:** S · **Deps:** PD-503, PD-404
Presets (e.g. ≤2 accidentals → all keys; major → minor), custom options UI.
**Acceptance:**
- Presets selectable from the level screen.

---

## Epic 7 — Polish, Quality & Release

### PD-701: Onboarding & first-run flow
**Size:** M · **Deps:** PD-404
Intro, how to connect the piano, choice of input method, first level suggestion.
**Acceptance:**
- New user can reach their first rep in < 3 minutes.

### PD-702: PWA setup (offline, installable)
**Size:** S · **Deps:** PD-002
Service worker, manifest, icons, offline operation for everything except nothing-requires-network features.
**Acceptance:**
- Installs on iOS/Android/desktop; fully functional offline.

### PD-703: Settings screen
**Size:** S · **Deps:** PD-003
Input device, timeout default, notation size, sound effects, data export/import/reset.
**Acceptance:**
- Settings persist and take effect without reload.

### PD-704: Cross-device/browser QA & fixes
**Size:** L · **Deps:** PD-503
Test matrix per §11; fix permission and layout bugs; document known limitations.
**Acceptance:**
- Checklist passes on the device matrix; issues triaged.

### PD-705: Performance & battery pass
**Size:** M · **Deps:** PD-503
Profile rendering and input handling on low-end devices, reduce CPU, verify memory stability over a 30-minute session.
**Acceptance:**
- Meets §9.4 budget on the lowest-spec target device.

### PD-706: Documentation & help content
**Size:** S · **Deps:** PD-701
In-app help (troubleshooting) and developer README (architecture, adding levels/voicings).
**Acceptance:**
- Docs reviewed; troubleshooting covers each MIDI connection failure mode.

---

## Suggested Build Order

1. **PD-001 → PD-003** (foundations)
2. In parallel:
   - **Theory:** PD-101 → PD-105 → PD-108
   - **Notation:** PD-201 → PD-202 → PD-204
   - **Input:** PD-301 → PD-302, then PD-313 → PD-315 (MIDI)
3. **M1:** PD-401 → PD-404
4. **M2:** PD-106, PD-107, PD-203, then Epic 5
5. **M3:** Epic 7

## Ticket Index

| Epic | Tickets |
|---|---|
| 0 Foundations | PD-001 – PD-003 |
| 1 Theory Engine | PD-101 – PD-108 |
| 2 Notation | PD-201 – PD-206 |
| 3 Input & Verification | PD-301, PD-302, PD-313 – PD-315 (PD-303 cut) |
| 4 Drill Session | PD-401 – PD-405 |
| 5 Key Signatures Mode | PD-501 – PD-505 |
| 7 Polish & Release | PD-701 – PD-706 |