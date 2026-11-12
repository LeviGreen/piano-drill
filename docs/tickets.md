# Piano Drill — Ticket Tracker

This file is the **only** task tracker for the project (no GitHub Issues, Jira, etc.). It was built from the "Implementation Tickets" section of [design.MD](design.MD). It is a living document: tickets, wording, and dependencies may evolve as the design does, so edit freely, and keep this file in sync with the code.

## How to use

- When you finish a ticket's work, set its **Status** line to `Done` and tick every acceptance checkbox that is met (`- [x]`).
- Status is one of: `Todo`, `In progress`, `Blocked`, `Deferred`, `Done`. Update it as work starts or stalls, not just at the end.
- Cross out the ticket's row in the **Status at a glance** table below when it is Done.
- Update the epic's **Progress** line (`Progress: X/N tickets done`) whenever a ticket's Status changes to or from `Done`.
- If scope changes, edit the ticket here in the same change as the code. Don't let this file drift from reality.

**Size legend:** S = ≤ 1 day · M = 2–3 days · L = 4–7 days · XL = > 1 week (consider splitting). Dependencies are listed by ticket ID. Epics 1, 2, and 3 can proceed in parallel after Epic 0.

## Status at a glance

Cross out a row (`~~text~~` in each cell) when its ticket is Done. Rows that are not crossed out are still open; add `(in progress)`, `(blocked)` or `(deferred)` to the description while a ticket is in one of those states.

| Epic | Ticket | Short description |
|---|---|---|
| ~~0 Project Foundations~~ | ~~PD-001~~ | ~~Project scaffolding~~ |
| ~~0 Project Foundations~~ | ~~PD-002~~ | ~~App shell & routing~~ |
| ~~0 Project Foundations~~ | ~~PD-003~~ | ~~Local storage layer~~ |
| 0 Project Foundations | PD-004 | GitHub Pages deploy & routing |
| ~~1 Music Theory Engine~~ | ~~PD-101~~ | ~~Core pitch & spelling primitives~~ |
| ~~1 Music Theory Engine~~ | ~~PD-102~~ | ~~Keys & key signatures~~ |
| ~~1 Music Theory Engine~~ | ~~PD-103~~ | ~~Diatonic chord & interval library~~ |
| ~~1 Music Theory Engine~~ | ~~PD-104~~ | ~~Register, playability & readability constraints~~ |
| ~~1 Music Theory Engine~~ | ~~PD-105~~ | ~~Target generator — single-hand content~~ |
| ~~1 Music Theory Engine~~ | ~~PD-106~~ | ~~Two-hand voicing templates & generator~~ |
| ~~1 Music Theory Engine~~ | ~~PD-107~~ | ~~Ledger-line register (notes above and below the staves)~~ |
| ~~1 Music Theory Engine~~ | ~~PD-108~~ | ~~Level & preset schema~~ |
| ~~2 Notation Rendering~~ | ~~PD-201~~ | ~~Single staff renderer (treble/bass) with key signature~~ |
| ~~2 Notation Rendering~~ | ~~PD-202~~ | ~~Chords, intervals & accidentals~~ |
| ~~2 Notation Rendering~~ | ~~PD-203~~ | ~~Grand staff renderer~~ |
| ~~2 Notation Rendering~~ | ~~PD-204~~ | ~~Flash performance & timing hook~~ |
| ~~2 Notation Rendering~~ | ~~PD-205~~ | ~~Overlays — note names & keyboard diagram~~ |
| ~~3 Input & Verification~~ | ~~PD-301~~ | ~~`NoteInput` interface & `ScriptedInput`~~ |
| ~~3 Input & Verification~~ | ~~PD-302~~ | ~~On-screen keyboard input~~ |
| ~~3 Input & Verification~~ | ~~PD-304~~ | ~~Mic capture pipeline~~ |
| ~~3 Input & Verification~~ | ~~PD-305~~ | ~~Spectral analysis core~~ |
| ~~3 Input & Verification~~ | ~~PD-306~~ | ~~Test corpus & benchmark harness~~ |
| 3 Input & Verification | PD-313 | MIDI keyboard input (`MidiInput`) & test screen |
| 3 Input & Verification | PD-314 | MIDI-driven Play and Key ID |
| ~~4 Drill Session (Play Mode)~~ | ~~PD-401~~ | ~~Session state machine & timing core~~ |
| ~~4 Drill Session (Play Mode)~~ | ~~PD-402~~ | ~~Drill screen UI~~ |
| ~~4 Drill Session (Play Mode)~~ | ~~PD-403~~ | ~~Session results & high scores~~ |
| ~~4 Drill Session (Play Mode)~~ | ~~PD-404~~ | ~~Level select & custom settings UI~~ |
| ~~5 Key Identification Mode~~ | ~~PD-501~~ | ~~Key-ID question generator~~ |
| ~~5 Key Identification Mode~~ | ~~PD-502~~ | ~~Answer UI (circle-of-fifths wheel / typing)~~ |
| ~~5 Key Identification Mode~~ | ~~PD-503~~ | ~~Key-ID session screen & scoring~~ |
| ~~5 Key Identification Mode~~ | ~~PD-504~~ | ~~Play-the-tonic answer option~~ |
| ~~5 Key Identification Mode~~ | ~~PD-505~~ | ~~Key-ID settings & levels~~ |
| 7 Polish, Quality & Release | PD-701 | Onboarding & first-run flow |
| 7 Polish, Quality & Release | PD-702 | PWA setup (offline, installable) |
| 7 Polish, Quality & Release | PD-703 | Settings screen |
| 7 Polish, Quality & Release | PD-704 | Cross-device/browser QA & fixes |
| 7 Polish, Quality & Release | PD-705 | Performance & battery pass |
| 7 Polish, Quality & Release | PD-706 | Documentation & help content |
| 8 Post-MVP | PD-307 | SPIKE — Target-aware note verifier |
| 8 Post-MVP | PD-308 | Mic input implementation (`MicInput`) |
| 8 Post-MVP | PD-309 | Onset-based timing & latency compensation |
| 8 Post-MVP | PD-310 | Low-register & octave robustness |
| 8 Post-MVP | PD-311 | Calibration wizard |
| 8 Post-MVP | PD-312 | Per-note tuning profile (out-of-tune piano) |
| 8 Post-MVP | PD-405 | Level progression & unlocking |
| 8 Post-MVP | PD-406 | Mic-driven play end-to-end integration |

## Suggested Build Order

1. **PD-001 → PD-003** (foundations; PD-004, the Pages deploy, comes last of all)
2. **Theory and notation:** PD-101 → PD-108, PD-201 → PD-205
3. **Input:** PD-301, PD-302 (on-screen piano), PD-304 → PD-306 (mic capture, analysis and benchmark, built before the mic was shelved), then **PD-313 → PD-314 (MIDI, the MVP's input)**
4. **Play and Key ID screens:** PD-401 → PD-404, Epic 5
5. **Polish:** Epic 7
6. **After the MVP:** Epic 8 (the mic verifier and calibration, mic-driven play, level unlocking)

## Ticket Index

| Epic | Tickets |
|---|---|
| 0 Foundations | PD-001 – PD-004 |
| 1 Theory Engine | PD-101 – PD-108 |
| 2 Notation | PD-201 – PD-205 (PD-206 cut) |
| 3 Input & Verification | PD-301, PD-302, PD-304 – PD-306, PD-313, PD-314 (PD-303 cut) |
| 4 Drill Session | PD-401 – PD-404 |
| 5 Key ID Mode | PD-501 – PD-505 |
| 7 Polish & Release | PD-701 – PD-706 |
| 8 Post-MVP | PD-307 – PD-312, PD-405, PD-406 |

---

## Epic 0 — Project Foundations

Progress: 3/4 tickets done

### PD-001: Project scaffolding

**Size:** S  
**Deps:** None  
**Status:** Done

Set up Vite + React + TypeScript, linting, formatting, test runner (Vitest), CI to run lint/test/build, basic folder structure from §9.2.

**Acceptance:**
- [x] `npm run dev/test/build` work; CI green on an empty test.

### PD-002: App shell & routing

**Size:** S  
**Deps:** PD-001  
**Status:** Done

Home screen, routes for Play, Key ID, Settings; placeholder screens; responsive layout; theme tokens (light/dark/high-contrast).

**Acceptance:**
- [x] Navigation works on mobile and desktop widths; theme toggle persists.

### PD-003: Local storage layer

**Size:** M  
**Deps:** PD-001  
**Status:** Done

IndexedDB wrapper (Dexie or similar) with repositories for settings, custom presets, sessions, and rep results; schema versioning/migrations; JSON export/import.

**Acceptance:**
- [x] CRUD tests pass; export → wipe → import restores data.

**Notes:** `src/storage/`: `PianoDrillDB` (Dexie, schema version 1; later changes go in as a new `version(n)` with an upgrade step), a `Storage` object with sessions (saved together with their reps), custom presets and remembered settings, and `exportBackup` / `parseBackup` / `importBackup` (replace or merge; a checked, versioned JSON file). `getStorage()` gives the app's shared instance. The tests use `fake-indexeddb` (a dev dependency). High scores are saved through it (PD-403; the session and rep tables exist but nothing writes to them for now); the Play and Key ID settings still live in localStorage until PD-404/703 move them over. Schema version 2 added the high-score `scores` table.

### PD-004: GitHub Pages deploy & routing

**Size:** S  
**Deps:** PD-002  
**Status:** Todo

Publish the app as a GitHub Pages site. Set the Vite `base` for the repo subpath, make direct URLs and reloads work (e.g. `HashRouter` or a `404.html` fallback), and add a Pages deploy job to CI. **Do this last, at the very end of the project (per Levi).** Not to be started earlier, even to unlock phone testing.

**Acceptance:**
- [ ] The app loads at its GitHub Pages URL, and reloading or deep-linking (e.g. `/key-id`) works.

## Epic 1 — Music Theory Engine

Progress: 8/8 tickets done

### PD-101: Core pitch & spelling primitives

**Size:** M  
**Deps:** PD-001  
**Status:** Done

Types and utilities: letter/accidental/octave pitch spelling, MIDI conversion, transposition by interval, enharmonic handling, pitch-class sets, comparison/sorting.

**Acceptance:**
- [x] Unit tests for spelling round-trips (including double sharps/flats), interval arithmetic, MIDI ↔ spelling.

### PD-102: Keys & key signatures

**Size:** M  
**Deps:** PD-101  
**Status:** Done

All 15 major and 15 minor key signatures (including enharmonic pairs), accidentals-per-staff-position tables for treble & bass (correct sharp/flat order and octave placement), scale generation, relative major/minor mapping, circle-of-fifths ordering.

**Acceptance:**
- [x] Tests verify all keys' scale spellings and signature accidental placement per clef.

### PD-103: Diatonic chord & interval library

**Size:** M  
**Deps:** PD-102  
**Status:** Done

Interval qualities/sizes; triads and seventh chords built diatonically per key (major, natural/harmonic minor); inversions; chord naming (for labels/debug); partial-chord subset logic (§4.2).

**Acceptance:**
- [x] Given a key + degree + quality + inversion, produces correct spelled pitches; test table covering all degrees in several keys.

### PD-104: Register, playability & readability constraints

**Size:** M  
**Deps:** PD-101  
**Status:** Done

Clef staff ranges, ledger-line counting, hand-span check, max-notes-per-hand, low-interval-limit rule, LH/RH crossing check, comfortable range defaults. **MVP defaults: note range G2–F5 plus 1 ledger line (middle C needs one in both clefs).** Both stay configurable.

**Acceptance:**
- [x] Validation functions with unit tests; given a candidate target returns pass/fail + reasons.

### PD-105: Target generator — single-hand content

**Size:** L  
**Deps:** PD-103, PD-104  
**Status:** Done

Generates single notes, intervals, triads, sevenths with inversions for one hand, respecting difficulty settings (clef, key set, mode, ledger lines, accidentals). Includes anti-repeat logic.

**Acceptance:**
- [x] Property tests: 10k generated targets per config all satisfy constraints; distribution sanity checks (keys/degrees roughly uniform).

**Notes:** `notesPerHand` (1 note, 2 interval, 3 triad, 4 seventh) and `hands` (one picked per target) are the config. Verified with the Generator preview (Settings). Inversions and occasional chromatic notes are always on in the preview.

### PD-106: Two-hand voicing templates & generator

**Size:** L  
**Deps:** PD-105  
**Status:** Done

Generator that picks one chord and splits it between the hands per §4.3 (left hand rooted, right hand above); no hand crossing; low-interval-limit rule; coverage check so the chord stays identifiable. Uses the same notes-per-hand settings as one hand; no voicing options (the generator chooses the arrangement).

**Acceptance:**
- [x] Every generated two-hand target is identifiable as a single diatonic chord; property tests pass. (Changed from "4 selectable voicing templates": the user found voicing options too granular, so two hands use the same notes-per-hand settings as one hand.)

**Notes:** `TwoHandGenerator`: each hand gets a count from `notesPerHand`; the left hand plays the chord root (lowest) plus chord tones, the right hand chord tones above; only playable results are kept. Reworked after verification to drop named voicings (too granular). Verified in the Generator preview (Both hands).

### PD-107: Ledger-line register (notes above and below the staves)

**Size:** S  
**Deps:** PD-105, PD-106  
**Status:** Done

Reworked on 2026-11-12 (it was "either hand, one at a time & cross-clef options"; the either-hand part was already built in PD-105, and cross-clef reading was dropped). What it is now: the right hand reads treble clef and the left hand reads bass clef, and each clef offers a few notes above and below its staff using **ledger lines**, with no setting for it in Play. **Levels 1 and 2 allow up to 1 ledger line, levels 3 to 10 allow up to 2.** The playable range becomes **C2 to C6**, which is exactly two ledger lines past the outer ends (C6 sits on the second ledger line above the treble staff, C2 on the second below the bass staff). That replaces the mic-era range of G2 to F5.

**Acceptance:**
- [x] Levels 1 and 2 use at most 1 ledger line and levels 3 to 10 at most 2, in both clefs, and every note stays within C2 to C6 (tests generate hundreds of targets per level and check).
- [x] Levels 3 to 10 really do reach notes needing 2 ledger lines in the treble and in the bass clef.
- [x] The grand staff leaves room for two ledger lines above, below and between the staves, at a fixed size so nothing shifts.
- [x] The on-screen piano spans C2 to C6.
- [x] Checked by eye on the Play screen (the piano is cramped on a phone; left as it is for now).

**Notes:** `src/theory/constraints.ts` (`RANGE_LOW_MIDI` = 36, `RANGE_HIGH_MIDI` = 84, default 2 ledger lines), `src/levels/levels.json` (per-level ledger lines and range), `renderGrandStaff` (default `ledgerRoom` 2), `PianoKeyboard` (default range), and the two-hand search window (left hand up to F4, right hand down to G3).

### PD-108: Level & preset schema

**Size:** M  
**Deps:** PD-105, PD-106  
**Status:** Done

JSON schema + validator for difficulty settings (§3); the 10 preset levels from §3.1; custom preset merge/override; defaults; migration-safe versioning. Both hands use the same settings as one hand (notes per hand), with no voicing options. **MVP range note:** all content must fit G2–F5; levels 9 and 10 (which rely on extra ledger lines and the full range) need rethinking.

**Acceptance:**
- [x] All presets validate; invalid configs produce readable errors; generator can consume any valid config.

## Epic 2 — Notation Rendering

Progress: 5/5 tickets done

**Notes:** `src/levels/`: `settings.ts` (types, defaults, validation with field-named errors, merge, migration; version 2), `levels.json` (the 10 levels, data not code, adapted to the MVP range and with no voicing options), `levelGenerator.ts` (`createLevelGenerator(settings)`). Both hands use the same notes-per-hand settings as one hand. Verified in the Generator preview via the Level picker.

### PD-201: Single staff renderer (treble/bass) with key signature

**Size:** M  
**Deps:** PD-102  
**Status:** Done

VexFlow (or chosen lib) wrapper rendering a staff with clef, key signature, and notes. Responsive scaling, high-DPI.

**Acceptance:**
- [x] Renders all 30 key signatures in both clefs correctly (visual snapshot tests).

**Notes:** verified by eye in the Notation gallery (Settings > Notation gallery) and by tests that compare VexFlow's accidental placement with our own table for all 30 keys on both clefs. Uses VexFlow's Bravura-only entry; the main bundle is ~1.0 MB (see PD-705).

### PD-202: Chords, intervals & accidentals

**Size:** M  
**Deps:** PD-201  
**Status:** Done

Correct chord layout including seconds clusters, ledger lines, accidentals not in key signature, and whole notes (no quarter notes in the MVP).

**Acceptance:**
- [x] Snapshot test gallery for tricky cases (adjacent seconds, 3 ledger lines, double accidentals).

**Notes:** verified in the Notation gallery's "Tricky cases" (seconds clusters, up to 3 ledger lines, double accidentals, naturals). Ledger lines use the theme color (VexFlow's default dark gray was invisible in dark mode). Whole notes only.

### PD-203: Grand staff renderer

**Size:** M  
**Deps:** PD-202  
**Status:** Done

Two-staff system with brace and aligned notes for two-hand targets; stable layout between reps (no layout jump).

**Acceptance:**
- [x] Two-hand targets from the generator render correctly across all keys.

**Notes:** grand staff with brace, one beat for both hands, fixed size. Verified by eye and by tests across all 30 keys. Always shown, even for one-hand targets (the unused staff stays empty).

### PD-204: Flash performance & timing hook

**Size:** M  
**Deps:** PD-201  
**Status:** Done

Pre-render next target off-screen; atomic swap; expose a `onPainted(timestamp)` callback using `requestAnimationFrame` for accurate t₀. Benchmark paint time.

**Acceptance:**
- [x] Swap completes within a single frame on desktop (phone check moved to PD-704); the t₀ callback fires once per flash.

**Notes:** `FlashController` in `src/notation/flash.ts` (prepare off-screen, one DOM swap, `onPainted` once per flash with `paintedAt` as t0). Desktop (MacBook, Chrome): swap median 0.10 ms, worst 0.30 ms, 0 of 50 over a 60 Hz frame; prerender median 1.5 ms; swap to painted median 3.5 ms; human reaction test 168 to 196 ms, so t0 is not early. Try it at Settings > Flash test.

### PD-205: Overlays — note names & keyboard diagram

**Size:** M  
**Deps:** PD-202  
**Status:** Done

Optional note-name labels on notes; piano keyboard component highlighting target keys (for reveal-on-miss and on-screen input). Support per-note highlight states (heard / missing) for the staff and keyboard, used by the drill screen's per-note feedback.

**Acceptance:**
- [x] Reveal view shows correct names/highlights for any target.

**Notes:** note names, three per-note states (heard = halo + check, almost = dashed ring, missing = none), a piano keyboard (now C2-C6) (marks by shape and color, names below the keys), click-to-cycle in the Generator preview. Names carry `stroke: none` because VexFlow's SVG root has a black stroke.

## Epic 3 — Input & Verification

Progress: 5/7 tickets done

> **Direction change (2026-11-12).** The mic spike did not reach the bar for the MVP: on a laptop mic with a digital piano through its speakers, the middle of the range was verified well, but low notes lost their fundamental (heard only as overtones) and the top note was too faint. The stand-in verifier accepted about 50% of 32 real clips (target: 90%), with every wrong, extra, silent and noisy clip correctly rejected; note starts were found in all of them within about 1 ms. Rather than gamble the MVP on the hardest problem, the MVP takes its notes from **a digital piano over MIDI** (PD-313, PD-314), on desktop Chromium. The mic tickets (PD-307–PD-312, PD-406) are Deferred, not cut: they moved to Epic 8 (Post-MVP) with their IDs unchanged, and the capture, analysis and corpus tools stay in the repo.

### PD-301: `NoteInput` interface & `ScriptedInput`

**Size:** S  
**Deps:** PD-001  
**Status:** Done

Define the interface from §6.1 and a scripted/fake implementation with controllable timestamps for tests.

**Acceptance:**
- [x] Session tests can drive notes deterministically.

### PD-302: On-screen keyboard input

**Size:** S  
**Deps:** PD-301, PD-205  
**Status:** Done

Tap/click keyboard implementing `NoteInput` (multi-touch for chords). Also acts as demo mode.

**Acceptance:**
- [x] Multi-touch chord produces the combined active note set.

**Notes:** `OnScreenKeyboardInput` (`src/audio/inputs/`) and the press/release props on `PianoKeyboard` (pointer events, one per finger; also Enter/Space). Used by the Play screen.

### PD-304: Mic capture pipeline

**Size:** L  
**Deps:** PD-301  
**Status:** Done

`getUserMedia` with processing disabled, `AudioWorklet` capture into a ring buffer, device selection, permission/error states, audio clock ↔ `performance.now()` mapping.

**Acceptance:**
- [x] Level meter works on desktop (mobile check moved to PD-704); clock mapping error measured and documented (docs/audio-clock.md).

### PD-305: Spectral analysis core

**Size:** L  
**Deps:** PD-304  
**Status:** Done

Multi-resolution FFT (or CQT) pipeline, windowing, parabolic interpolation, noise floor estimation, spectral flux onset detector. Runs off the main thread (worker/WASM as needed).

**Acceptance:**
- [x] On synthetic piano audio, onset times within ±30 ms; pipeline runs < 5 ms/frame on target device.

**Notes (limits found while verifying):**
- Onsets are rejected unless they leave clearly pitched peaks (tuned so finger taps, brushes and clicks on a laptop are ignored). The cost: the very softest notes are missed, and onsets are reported ~30 ms (bass up to ~140 ms) after they happen; the reported onset *time* is unaffected.
- On synthetic piano, onsets are found from A1 (55 Hz) up; C1 to F♯1 are missed (PD-310).
- Measured on a MacBook Pro, Chrome: analysis ~0.7 ms/frame avg, ~1.6 ms max (budget 5 ms). Synthetic onset error ~3 ms before the bias correction; ±30 ms in tests.

### PD-306: Test corpus & benchmark harness

**Size:** L  
**Deps:** PD-301  
**Status:** Done

Record and label a corpus (acoustic piano, various phones/positions/rooms, plus digital piano/speaker and synthetic renders): single notes, intervals, triads, two-hand chords across the full range, plus negative cases (wrong note, extra note, silence, room noise). Harness computes precision/recall, octave-error rate, onset error, latency; CI regression thresholds.

**Acceptance:**
- [x] One command produces a report; baseline numbers committed.

### PD-313: MIDI keyboard input (`MidiInput`) & test screen

**Size:** M  
**Deps:** PD-301  
**Status:** Todo

The MVP's real input: a digital piano connected to the laptop (USB or Bluetooth MIDI), read with the Web MIDI API as a `NoteInput`. Note-on (velocity above 0) is an onset, stamped on the drill clock (a MIDI message's timestamp is on the same `performance.now()` clock); note-off (or note-on with velocity 0) releases; the sustain pedal and other controllers are ignored. List the devices, choose one, remember the choice, and handle hot-plug and disconnects. Clear states for permission denied and for browsers without Web MIDI (Safari and iPhone/iPad; Firefox needs extra setup). Plus a test screen under Settings (the old mic test's replacement) that lists devices and shows the notes you play on the keyboard strip as they arrive.

**Acceptance:**
- [ ] Notes played on a real digital piano show with the right pitch and timing on the test screen.
- [ ] Tests with a fake MIDI access cover note-on/off, velocity 0 as note-off, pedal ignored, device hot-plug, permission denied and an unsupported browser.
- [ ] Supported browsers are documented (Chrome, Edge and Opera on desktop).

### PD-314: MIDI-driven Play and Key ID

**Size:** M  
**Deps:** PD-313, PD-402, PD-503  
**Status:** Todo

Use `MidiInput` in the drill loop. An input chooser on the Play screen (on-screen piano or MIDI piano), remembered; the on-screen piano stays as the fallback and demo. Key ID's Play view (answer by playing the tonic) uses the same input. If the piano is unplugged mid-session, pause with a clear message. Anything from the mic-era Play design that only made sense for a microphone (the "almost" state, the detected-notes strip, escalating hints) is dropped; wrong notes and the per-note halos already work.

**Acceptance:**
- [ ] Complete a 20-rep Play session on a real digital piano over MIDI.
- [ ] Key ID's Play view works with MIDI.
- [ ] Unplugging the piano mid-session pauses with a clear message, and plugging it back in lets you resume.

## Epic 4 — Drill Session (Play Mode)

Progress: 4/4 tickets done

### PD-401: Session state machine & timing core

**Size:** M  
**Deps:** PD-301, PD-204  
**Status:** Done

Implement states from §9.3 with a fake-clock-friendly design; start/pause/end; timeout; skip; wrong-note logging; "wait for silence" gating; t₀ capture. Track the set of expected notes heard so far; the attempt succeeds when all have been heard, in any order and not necessarily together.

**Acceptance:**
- [x] Deterministic tests cover success, wrong-then-right, timeout, skip, and pause paths.

**Notes:** `DrillSession` in `src/session/`: per-note cumulative verification (a note stays heard; wrong notes are logged but never undo), outcomes correct / correct with errors / timeout / skipped, quiet-wait before each flash (marks a rep that started in a noisy room), pause voids the rep on screen. Runs on an injectable clock (31 deterministic tests). Verified by playing reps on the Play screen. The get-ready wait is fixed (not a setting): 4 seconds at the start of a session and after a resume, 1 second between targets; "Get ready" must be readable for the 4 seconds.

### PD-402: Drill screen UI

**Size:** M  
**Deps:** PD-401, PD-203  
**Status:** Done

Main play screen: big staff, minimal chrome, optional timer visibility, success/miss feedback, reveal on miss (using PD-205), shortcuts, input source selector. **Per-note feedback (design §10):** three states per expected note (heard = green halo + check mark, almost = dashed outline, missing = none), a keyboard strip showing what the mic actually detected, escalating hints for a stuck note, and a "3 / 5 notes" counter. The timer stops on the last note. **A 4, 3, 2, 1 countdown** shows over the empty staff during the first get-ready of a session (and after a resume), not between targets. **The grand staff is always on screen** (empty, with both clefs, when idle, while getting ready and between targets); notes appear on it and clear back to it, so nothing pops in or shifts.

**Acceptance:**
- [x] Full rep loop works with on-screen keyboard input at levels 1–10.

**Notes:** `src/ui/PlayScreen.tsx`, laid out like the Key ID screen (centred column, settings in a drawer, fixed-height status/clock/notes lines so nothing shifts, 4 s countdown over the always-present empty grand staff, results modal at the end). A session is 20 targets. The drawer has the level plus the four options pulled forward from PD-404 (hands, notes per hand, sharps/flats, keys; shared `DifficultyFields` component, also used by the Generator preview). Picking a level fills them in; changing one makes it Custom, and it is remembered. Per-note green halos on the staff and keys, wrong notes marked ✕, "N / M notes" counter, reveal with note names on a timeout or skip. Not built: the "almost" state and the detected-notes strip, escalating hints for a stuck note and the input source selector (all need the microphone; moved to PD-406), and optional timer visibility and keyboard shortcuts (cut to keep the screen simple).

### PD-403: Session results & high scores

**Size:** M  
**Deps:** PD-402, PD-003  
**Status:** Done

Changed from the original "stats screen" (2026-11-12): you care about score and total time, not per-target numbers, so the results are an arcade high-score system. **Score:** each target you get right is worth 100, plus a speed bonus of up to 100 (full within the level's goal time, fading to nothing at twice the goal time), minus 25 per wrong note; a timeout or skip scores 0 (in Key ID, wrong guesses cost 25 each like wrong notes, since the question carries on); a perfect fast 20-target session is 4000. **End-of-session modal:** score, correct count, total time, and (for a finished session on a preset level that makes the top ten) a 3-letter initials box, like an old arcade game. **High scores screen** (`/scores`): top ten per level, always ten lines, separately for Play and Key ID; on a phone it shows # / initials / score / date and tapping the score opens the breakdown. Only high scores are kept: sessions themselves are not saved, and there is no History screen (cut). Custom setups and sessions ended early are not scored for a board. Applies to both Play and Key ID.

**Acceptance:**
- [x] Results are saved and viewable (per-level boards).
- [x] The score is correct for seeded results (unit tests), and boards keep only the top ten, with ties going to the earlier score.

**Notes:** `src/scoring/score.ts` (the rules), `src/ui/ScoreSummary.tsx` (modal, saving, initials), `src/ui/ScoresScreen.tsx`, and a `scores` table in the database (schema version 2; included in backups). The per-level "goal time" comes from the level data. Initials are remembered for next time. The comparison with the previous session and the median/mean/slowest-5 lists from the original ticket were dropped.

### PD-404: Level select & custom settings UI

**Size:** L  
**Deps:** PD-108, PD-002  
**Status:** Done

Scope cut down on 2026-11-12 to keep settings simple: no level locks, no saved custom setups, no live preview, and only a few options. **Level select** is the Level dropdown in each mode's settings (Play and Key ID), with "Custom" once you change something. **Play's custom options:** hands (checkboxes: left, right, both; several checked = random per target), notes per hand (1 note, 2 interval, 3 triad, 4 seventh chord), up to N sharps/flats and a time limit per target (none, 5, 10, 20 s). **Key ID's options:** up to N sharps/flats, keys (major, minor or both) and a time limit. The keys option is not offered in Play: a level keeps the keys it was made with.

**Acceptance:**
- [x] A valid custom configuration can be created and launched, and is remembered.
- [x] Key-ID levels are selectable too (moved from PD-505).

**Notes:** the Play settings are a centred modal (`src/ui/PlayScreen.tsx`, shared `DifficultyFields`); Key ID's are the same modal, narrower. Cut from the original ticket: the full level list with targets and locks (see PD-405, deferred), save/load/delete of presets (the storage for it exists but is unused), live preview of sample targets, the "free play" toggle, and the remaining dimensions of design §3 (clef, content type, inversions, chromatic notes, ledger lines, octave strictness).

## Epic 5 — Key Identification Mode

Progress: 5/5 tickets done

### PD-501: Key-ID question generator

**Size:** S  
**Deps:** PD-102  
**Status:** Done

Generate key-signature questions on a treble or bass staff (random for each question, one at a time; not a setting) respecting settings (accidental range, major/minor/both); anti-repeat. The question is always "name the key".

**Acceptance:**
- [x] Tests verify each generated question has an unambiguous correct answer under the selected answer format.

**Notes:** one question type, "name the key". The format follows from the keys asked: one mode (major only or minor only) shows the signature alone ("which major/minor key?"); only when major and minor are mixed is a whole note on the tonic added so the answer is unique. The clef is treble or bass, random per question (not a setting). F♯ and G♭ major are always different answers (no enharmonic setting). Each question is proven to have exactly one right answer; no repeated signature back to back. See `src/keyid/questions.ts`.

### PD-502: Answer UI (circle-of-fifths wheel / typing)

**Size:** M  
**Deps:** PD-002  
**Status:** Done

Touch-friendly answer input with proper enharmonic labelling; major/minor toggle where applicable; keyboard shortcuts. Three ways to answer: the circle-of-fifths **Wheel**, **Type** (a text box with no visual cue, since a wheel lets you count around it), and **Play** (the tonic on a piano; see PD-504). A button grid was tried and cut. Layout must not shift when an answer arrives.

**Acceptance:**
- [x] All 30 keys can be selected correctly on desktop, by wheel and typing (phone check moved to PD-704).

**Notes:** circle-of-fifths wheel (majors outside, relative minors inside, the three enharmonic positions split; kept compact), Type (no visual cue; works with a phone keyboard), and Play. All centred under the staff. Marks right and wrong by shape and color. The input marks right/wrong only; the screen around it says what the answer was. Verified on desktop in Settings > Key ID preview.

### PD-503: Key-ID session screen & scoring

**Size:** M  
**Deps:** PD-501, PD-502, PD-401  
**Status:** Done

Flash → answer → timed result; reuse the rep session machine (4 s first get-ready with countdown, 1 s between) and summary; record confusion data (answered vs. correct).

**Acceptance:**
- [x] Full session works; results stored with the same `RepResult` shape (mode flag).

**Notes:** a session is always 20 questions. The staff has a 4 s countdown at the start, then a per-question countdown clock when a time limit is set. A wrong guess is marked ✕ and the question carries on (you keep guessing, like Play); only a timeout or skip says what the right answer was, and a right answer shows only the green mark. Wrong guesses cost 25 points each and are listed as mix-ups at the end. Results appear only at the end, in a modal: correct count, total time and mix-ups (no per-question times). See `src/keyid/KeyIdSession.ts` and `src/ui/KeyIdScreen.tsx`.

### PD-504: Play-the-tonic answer option

**Size:** S  
**Deps:** PD-503, PD-308  
**Status:** Done

Alternative answer: a fourth view on the main screen (next to Wheel and Type) where you play the tonic of the key on the piano, verified via the mic. Not a setting in the drawer; switchable at any time.

**Acceptance:**
- [x] The Play view toggles between tap and play; the first note struck decides, any octave (on-screen piano keys stand in for the piano).

**Notes:** working with the real microphone moved to PD-406's acceptance, since it needs PD-307/308.

### PD-505: Key-ID settings & levels

**Size:** S  
**Deps:** PD-503, PD-404  
**Status:** Done

Presets (≤2 accidentals → all major keys → major and minor → all 30 keys), custom options UI.

**Acceptance:**
- [x] Presets selectable, and options editable, in the Key ID screen's settings drawer (level, sharps/flats, keys, time limit).

**Notes:** selecting key-ID levels from the global level screen moved to PD-404's acceptance.

## Epic 7 — Polish, Quality & Release

Progress: 0/6 tickets done

### PD-701: Onboarding & first-run flow

**Size:** M  
**Deps:** PD-313, PD-404  
**Status:** Todo

Intro, how to connect the digital piano (and which browsers work), choice of input method, first level suggestion. (Calibration returns with the mic.)

**Acceptance:**
- [ ] New user can reach their first rep in < 3 minutes.

### PD-702: PWA setup (offline, installable)

**Size:** S  
**Deps:** PD-002  
**Status:** Todo

Service worker, manifest, icons, offline operation for everything except nothing-requires-network features.

**Acceptance:**
- [ ] Installs on iOS/Android/desktop; fully functional offline.

### PD-703: Settings screen

**Size:** S  
**Deps:** PD-003  
**Status:** Todo

Input device, timeout default, notation size, sound effects, data export/import/reset.

**Acceptance:**
- [ ] Settings persist and take effect without reload.

### PD-704: Cross-device/browser QA & fixes

**Size:** L  
**Deps:** PD-406, PD-503  
**Status:** Todo

Test matrix per §11; fix iOS Safari audio, permission, throttling, and layout bugs; document known limitations.

**Acceptance:**
- [ ] Checklist passes on the device matrix; issues triaged.
- [ ] Mic test screen level meter works on iOS Safari and Android Chrome (moved from PD-304); fill in the mobile rows in docs/audio-clock.md. (Deferred with the mic.)
- [ ] Flash test screen on a mid-range phone: swap within one frame, t0 callback once per flash (moved from PD-204); record the numbers.
- [ ] Key-ID answer wheel and Type mode work on a phone: every key tappable, soft keyboard works in Type mode (moved from PD-502).

### PD-705: Performance & battery pass

**Size:** M  
**Deps:** PD-406  
**Status:** Todo

Profile DSP on low-end devices, reduce CPU, pause analysis when idle, verify memory stability over a 30-minute session.

**Acceptance:**
- [ ] Meets §9.4 budget on the lowest-spec target device.

### PD-706: Documentation & help content

**Size:** S  
**Deps:** PD-701  
**Status:** Todo

In-app help (mic placement, pedal advice, troubleshooting) and developer README (architecture, running benchmarks, adding levels/voicings).

**Acceptance:**
- [ ] Docs reviewed; troubleshooting covers each calibration failure mode.

## Epic 8 — Post-MVP

Progress: 0/8 tickets done (all deferred until after the MVP)

Everything here is **deferred, not cut**: it moved out of the MVP on 2026-11-12 so the remaining epics show only what the MVP needs. Ticket IDs are unchanged, so references elsewhere (and the git history) still work. The mic tickets come back if microphone input returns after the MVP (see the direction-change note at the top of Epic 3); PD-405 (level unlocking) comes back when the app has more levels worth gating.

### PD-307: SPIKE — Target-aware note verifier

**Size:** XL  
**Deps:** PD-305, PD-306  
**Status:** Deferred (2026-11-12: the MVP takes notes from a digital piano over MIDI instead of listening through the mic; see PD-313. The mic work is shelved, not cut: the capture, analysis and benchmark corpus (PD-304 to PD-306) stay in the repo.)

Implement the verifier of §6.2: expected-note presence scoring with harmonic templates, explaining-away residual for unexpected notes, temporal consistency (K frames), octave disambiguation, inharmonicity tolerance. Compare against alternatives (chromagram, Basic Pitch) on the corpus; write up a decision. **Verification is per-note and cumulative (design §6.2):** each expected pitch is latched once heard (with an onset after t₀) and stays heard for the attempt; the target is satisfied when all are latched, not when all sound together. The "≥ 90% correct" criterion is measured at the attempt level on the corpus.

**Acceptance:**
- [ ] Meets the M0 exit criterion (≥ 90% correct verification on single notes + triads in a quiet room), < 100 ms detection latency, false-accept rate on wrong-note cases < 5%. Written findings and recommended thresholds.

### PD-308: Mic input implementation (`MicInput`)

**Size:** M  
**Deps:** PD-307  
**Status:** Deferred (2026-11-12: the MVP takes notes from a digital piano over MIDI instead of listening through the mic; see PD-313. The mic work is shelved, not cut: the capture, analysis and benchmark corpus (PD-304 to PD-306) stay in the repo.)

Wrap capture + verifier as a `NoteInput`; support "expected set" being supplied to the verifier; emit satisfied/unexpected-note events with onset timestamps; "wait for silence" signal. Emit per-note events (a note became heard; an unexpected note was detected), not only an all-satisfied event, so the UI can show which notes are still missing.

**Acceptance:**
- [ ] End-to-end: playing a target on a piano triggers success events with correct onset timing.

### PD-309: Onset-based timing & latency compensation

**Size:** M  
**Deps:** PD-308  
**Status:** Deferred (2026-11-12: the MVP takes notes from a digital piano over MIDI instead of listening through the mic; see PD-313. The mic work is shelved, not cut: the capture, analysis and benchmark corpus (PD-304 to PD-306) stay in the repo.)

Compute reaction and completion times from onset estimates (not verifier fire time); subtract calibrated device latency; handle rolled chords and re-struck notes. Completion time is the onset of the note that completed the set (the last expected note heard).

**Acceptance:**
- [ ] Timing error vs. ground truth (MIDI-synced recordings) within ±50 ms on corpus.

### PD-310: Low-register & octave robustness

**Size:** L  
**Deps:** PD-307  
**Status:** Deferred (2026-11-12: the MVP takes notes from a digital piano over MIDI instead of listening through the mic; see PD-313. The mic work is shelved, not cut: the capture, analysis and benchmark corpus (PD-304 to PD-306) stay in the repo.)

Improvements for bass notes and octave confusion: low-band long windows, octave-ambiguity checks, per-note confidence, configurable range cap and strict/relaxed octave modes. **MVP supported range is G2–F5** (about 98–698 Hz); notes outside it are out of scope.

**Acceptance:**
- [ ] Octave-error rate on corpus < 3%; bass-clef notes down to the supported range pass benchmark thresholds; documented supported range.

### PD-311: Calibration wizard

**Size:** M  
**Deps:** PD-308  
**Status:** Deferred (2026-11-12: the MVP takes notes from a digital piano over MIDI instead of listening through the mic; see PD-313. The mic work is shelved, not cut: the capture, analysis and benchmark corpus (PD-304 to PD-306) stay in the repo.)

Flow from §6.7: permission, level, noise floor, tuning offset, range check, optional latency test; per-device storage of results; "recalibrate" entry point.

**Acceptance:**
- [ ] A new user finishes calibration in < 90 s; results measurably reduce false rejects on a detuned test piano.

### PD-312: Per-note tuning profile (out-of-tune piano)

**Size:** L  
**Deps:** PD-311, PD-307  
**Status:** Deferred (2026-11-12: the MVP takes notes from a digital piano over MIDI instead of listening through the mic; see PD-313. The mic work is shelved, not cut: the capture, analysis and benchmark corpus (PD-304 to PD-306) stay in the repo.)

A calibration mode so the app works with an acoustic piano that is not perfectly in tune. Beyond the single global offset in PD-311, the user plays a guided set of notes across the range and the app measures each note's actual pitch deviation from equal temperament (including stretch in the extremes), building a per-note tuning profile. The verifier uses the profile to shift its expected fundamental and harmonic bins. Notes between sampled ones are interpolated; the user can re-run calibration for part of the range, and a quick "global offset only" mode remains available.

**Acceptance:**
- [ ] Tuning profile is saved per device/piano and applied automatically by the verifier.
- [ ] On a test piano detuned by ≥ 30 cents on some notes, the false-reject rate is measurably lower than with the global offset alone.
- [ ] A full-range calibration completes in a reasonable time (target to be set after the PD-307 spike).

### PD-405: Level progression & unlocking

**Size:** S  
**Deps:** PD-403, PD-404  
**Status:** Deferred (2026-11-12: post-MVP. Every level is open from the start. The idea: when a session meets a level's goal in its data (accuracy and median time), unlock the next level, with a "free play" switch to open everything.)

Evaluate level targets from §3.2 after each session; unlock next level; surface progress.

**Acceptance:**
- [ ] Seeded session data unlocks as expected; free-play bypass works.

### PD-406: Mic-driven play end-to-end integration

**Size:** M  
**Deps:** PD-308, PD-309, PD-402  
**Status:** Deferred (2026-11-12: the MVP takes notes from a digital piano over MIDI instead of listening through the mic; see PD-313. The mic work is shelved, not cut: the capture, analysis and benchmark corpus (PD-304 to PD-306) stay in the repo.)

Wire `MicInput` into drill loop; handle permission-denied, mic loss, noisy environment warnings, input switching mid-session.

**Acceptance:**
- [ ] Complete a 20-rep session on a real piano using only the mic.
- [ ] The Play screen shows the "almost" state and a detected-notes strip, gives escalating hints for a stuck note, and has an input source selector (moved from PD-402).
- [ ] Key ID's Play view (answer by playing the tonic) works with the mic (moved from PD-504).
