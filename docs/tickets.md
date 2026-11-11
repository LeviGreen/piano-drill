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
| 0 Project Foundations | PD-003 | Local storage layer (deferred) |
| 1 Music Theory Engine | PD-101 | Core pitch & spelling primitives |
| 1 Music Theory Engine | PD-102 | Keys & key signatures |
| 1 Music Theory Engine | PD-103 | Diatonic chord & interval library |
| 1 Music Theory Engine | PD-104 | Register, playability & readability constraints |
| 1 Music Theory Engine | PD-105 | Target generator — single-hand content |
| 1 Music Theory Engine | PD-106 | Two-hand voicing templates & generator |
| 1 Music Theory Engine | PD-107 | "Either hand, one at a time" & cross-clef options |
| 1 Music Theory Engine | PD-108 | Level & preset schema |
| 2 Notation Rendering | PD-201 | Single staff renderer (treble/bass) with key signature |
| 2 Notation Rendering | PD-202 | Chords, intervals & accidentals |
| 2 Notation Rendering | PD-203 | Grand staff renderer |
| 2 Notation Rendering | PD-204 | Flash performance & timing hook |
| 2 Notation Rendering | PD-205 | Overlays — note names & keyboard diagram |
| 2 Notation Rendering | PD-206 | Large-print & accessibility options |
| 3 Input & Verification | PD-301 | `NoteInput` interface & `ScriptedInput` |
| 3 Input & Verification | PD-302 | On-screen keyboard input |
| 3 Input & Verification | PD-303 | Web MIDI input |
| 3 Input & Verification | PD-304 | Mic capture pipeline |
| 3 Input & Verification | PD-305 | Spectral analysis core |
| 3 Input & Verification | PD-306 | Test corpus & benchmark harness |
| 3 Input & Verification | PD-307 | SPIKE — Target-aware note verifier |
| 3 Input & Verification | PD-308 | Mic input implementation (`MicInput`) |
| 3 Input & Verification | PD-309 | Onset-based timing & latency compensation |
| 3 Input & Verification | PD-310 | Low-register & octave robustness |
| 3 Input & Verification | PD-311 | Calibration wizard |
| 4 Drill Session (Play Mode) | PD-401 | Session state machine & timing core |
| 4 Drill Session (Play Mode) | PD-402 | Drill screen UI |
| 4 Drill Session (Play Mode) | PD-403 | Session summary screen |
| 4 Drill Session (Play Mode) | PD-404 | Level select & custom settings UI |
| 4 Drill Session (Play Mode) | PD-405 | Level progression & unlocking |
| 4 Drill Session (Play Mode) | PD-406 | Mic-driven play end-to-end integration |
| 5 Key Identification Mode | PD-501 | Key-ID question generator |
| 5 Key Identification Mode | PD-502 | Answer UI (circle-of-fifths / button grid) |
| 5 Key Identification Mode | PD-503 | Key-ID session screen & scoring |
| 5 Key Identification Mode | PD-504 | Play-the-tonic answer option |
| 5 Key Identification Mode | PD-505 | Key-ID settings & levels |
| 7 Polish, Quality & Release | PD-701 | Onboarding & first-run flow |
| 7 Polish, Quality & Release | PD-702 | PWA setup (offline, installable) |
| 7 Polish, Quality & Release | PD-703 | Settings screen |
| 7 Polish, Quality & Release | PD-704 | Cross-device/browser QA & fixes |
| 7 Polish, Quality & Release | PD-705 | Performance & battery pass |
| 7 Polish, Quality & Release | PD-706 | Documentation & help content |

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

---

## Epic 0 — Project Foundations

Progress: 2/3 tickets done (1 deferred)

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
**Status:** Deferred (post-MVP; MVP keeps settings in localStorage. PD-403, PD-405 and PD-703 list this as a dependency, so revisit them when this returns.)

IndexedDB wrapper (Dexie or similar) with repositories for settings, custom presets, sessions, and rep results; schema versioning/migrations; JSON export/import.

**Acceptance:**
- [ ] CRUD tests pass; export → wipe → import restores data.

## Epic 1 — Music Theory Engine

Progress: 0/8 tickets done

### PD-101: Core pitch & spelling primitives

**Size:** M  
**Deps:** PD-001  
**Status:** Todo

Types and utilities: letter/accidental/octave pitch spelling, MIDI conversion, transposition by interval, enharmonic handling, pitch-class sets, comparison/sorting.

**Acceptance:**
- [ ] Unit tests for spelling round-trips (including double sharps/flats), interval arithmetic, MIDI ↔ spelling.

### PD-102: Keys & key signatures

**Size:** M  
**Deps:** PD-101  
**Status:** Todo

All 15 major and 15 minor key signatures (including enharmonic pairs), accidentals-per-staff-position tables for treble & bass (correct sharp/flat order and octave placement), scale generation, relative major/minor mapping, circle-of-fifths ordering.

**Acceptance:**
- [ ] Tests verify all keys' scale spellings and signature accidental placement per clef.

### PD-103: Diatonic chord & interval library

**Size:** M  
**Deps:** PD-102  
**Status:** Todo

Interval qualities/sizes; triads and seventh chords built diatonically per key (major, natural/harmonic minor); inversions; chord naming (for labels/debug); partial-chord subset logic (§4.2).

**Acceptance:**
- [ ] Given a key + degree + quality + inversion, produces correct spelled pitches; test table covering all degrees in several keys.

### PD-104: Register, playability & readability constraints

**Size:** M  
**Deps:** PD-101  
**Status:** Todo

Clef staff ranges, ledger-line counting, hand-span check, max-notes-per-hand, low-interval-limit rule, LH/RH crossing check, comfortable range defaults.

**Acceptance:**
- [ ] Validation functions with unit tests; given a candidate target returns pass/fail + reasons.

### PD-105: Target generator — single-hand content

**Size:** L  
**Deps:** PD-103, PD-104  
**Status:** Todo

Generates single notes, intervals, triads, sevenths with inversions for one hand, respecting difficulty settings (clef, key set, mode, ledger lines, accidentals). Includes anti-repeat logic.

**Acceptance:**
- [ ] Property tests: 10k generated targets per config all satisfy constraints; distribution sanity checks (keys/degrees roughly uniform).

### PD-106: Two-hand voicing templates & generator

**Size:** L  
**Deps:** PD-105  
**Status:** Todo

Data-driven voicing templates (bass + upper structure, shell, split, octave doubling); generator that picks one chord and splits it between hands per §4.3; no hand crossing; low-interval-limit rule; unique pitch class coverage check.

**Acceptance:**
- [ ] Every generated two-hand target is identifiable as a single diatonic chord; property tests pass; at least 4 templates implemented and selectable by level.

### PD-107: "Either hand, one at a time" & cross-clef options

**Size:** S  
**Deps:** PD-105  
**Status:** Todo

Per-rep random hand selection; optional cross-clef (e.g. RH in bass clef) setting.

**Acceptance:**
- [ ] Settings produce expected hand/clef distribution in tests.

### PD-108: Level & preset schema

**Size:** M  
**Deps:** PD-105, PD-106  
**Status:** Todo

JSON schema + validator for difficulty settings (§3); the 10 preset levels from §3.1; custom preset merge/override; defaults; migration-safe versioning.

**Acceptance:**
- [ ] All presets validate; invalid configs produce readable errors; generator can consume any valid config.

## Epic 2 — Notation Rendering

Progress: 0/6 tickets done

### PD-201: Single staff renderer (treble/bass) with key signature

**Size:** M  
**Deps:** PD-102  
**Status:** Todo

VexFlow (or chosen lib) wrapper rendering a staff with clef, key signature, and notes. Responsive scaling, high-DPI.

**Acceptance:**
- [ ] Renders all 30 key signatures in both clefs correctly (visual snapshot tests).

### PD-202: Chords, intervals & accidentals

**Size:** M  
**Deps:** PD-201  
**Status:** Todo

Correct chord layout including seconds clusters, ledger lines, accidentals not in key signature, and whole-note default with quarter-note option.

**Acceptance:**
- [ ] Snapshot test gallery for tricky cases (adjacent seconds, 3 ledger lines, double accidentals).

### PD-203: Grand staff renderer

**Size:** M  
**Deps:** PD-202  
**Status:** Todo

Two-staff system with brace and aligned notes for two-hand targets; stable layout between reps (no layout jump).

**Acceptance:**
- [ ] Two-hand targets from the generator render correctly across all keys.

### PD-204: Flash performance & timing hook

**Size:** M  
**Deps:** PD-201  
**Status:** Todo

Pre-render next target off-screen; atomic swap; expose a `onPainted(timestamp)` callback using `requestAnimationFrame` for accurate t₀. Benchmark paint time.

**Acceptance:**
- [ ] Swap completes within a single frame on a mid-range phone; the t₀ callback fires once per flash.

### PD-205: Overlays — note names & keyboard diagram

**Size:** M  
**Deps:** PD-202  
**Status:** Todo

Optional note-name labels on notes; piano keyboard component highlighting target keys (for reveal-on-miss and on-screen input).

**Acceptance:**
- [ ] Reveal view shows correct names/highlights for any target.

### PD-206: Large-print & accessibility options

**Size:** S  
**Deps:** PD-203  
**Status:** Todo

Staff size setting, high-contrast mode, non-color-only feedback styles.

**Acceptance:**
- [ ] Staff size scales without clipping; passes automated contrast checks.

## Epic 3 — Input & Verification

Progress: 0/11 tickets done

> **Risk-first epic.** PD-301–PD-304 should start early; PD-307 is the make-or-break spike.

### PD-301: `NoteInput` interface & `ScriptedInput`

**Size:** S  
**Deps:** PD-001  
**Status:** Todo

Define the interface from §6.1 and a scripted/fake implementation with controllable timestamps for tests.

**Acceptance:**
- [ ] Session tests can drive notes deterministically.

### PD-302: On-screen keyboard input

**Size:** S  
**Deps:** PD-301, PD-205  
**Status:** Todo

Tap/click keyboard implementing `NoteInput` (multi-touch for chords). Also acts as demo mode.

**Acceptance:**
- [ ] Multi-touch chord produces the combined active note set.

### PD-303: Web MIDI input

**Size:** M  
**Deps:** PD-301  
**Status:** Todo

Device selection, note on/off tracking with timestamps, graceful degrade when unsupported, hot-plug handling.

**Acceptance:**
- [ ] Works with a USB/BT MIDI keyboard in Chrome; unsupported browsers show a clear message.

### PD-304: Mic capture pipeline

**Size:** L  
**Deps:** PD-301  
**Status:** Todo

`getUserMedia` with processing disabled, `AudioWorklet` capture into a ring buffer, device selection, permission/error states, audio clock ↔ `performance.now()` mapping.

**Acceptance:**
- [ ] Level meter works on desktop and mobile; clock mapping error measured and documented.

### PD-305: Spectral analysis core

**Size:** L  
**Deps:** PD-304  
**Status:** Todo

Multi-resolution FFT (or CQT) pipeline, windowing, parabolic interpolation, noise floor estimation, spectral flux onset detector. Runs off the main thread (worker/WASM as needed).

**Acceptance:**
- [ ] On synthetic piano audio, onset times within ±30 ms; pipeline runs < 5 ms/frame on target device.

### PD-306: Test corpus & benchmark harness

**Size:** L  
**Deps:** PD-301  
**Status:** Todo

Record and label a corpus (acoustic piano, various phones/positions/rooms, plus digital piano/speaker and synthetic renders): single notes, intervals, triads, two-hand chords across the full range, plus negative cases (wrong note, extra note, silence, room noise). Harness computes precision/recall, octave-error rate, onset error, latency; CI regression thresholds.

**Acceptance:**
- [ ] One command produces a report; baseline numbers committed.

### PD-307: SPIKE — Target-aware note verifier

**Size:** XL  
**Deps:** PD-305, PD-306  
**Status:** Todo

Implement the verifier of §6.2: expected-note presence scoring with harmonic templates, explaining-away residual for unexpected notes, temporal consistency (K frames), octave disambiguation, inharmonicity tolerance. Compare against alternatives (chromagram, Basic Pitch) on the corpus; write up a decision.

**Acceptance:**
- [ ] Meets the M0 exit criterion (≥ 90% correct verification on single notes + triads in a quiet room), < 100 ms detection latency, false-accept rate on wrong-note cases < 5%. Written findings and recommended thresholds.

### PD-308: Mic input implementation (`MicInput`)

**Size:** M  
**Deps:** PD-307  
**Status:** Todo

Wrap capture + verifier as a `NoteInput`; support "expected set" being supplied to the verifier; emit satisfied/unexpected-note events with onset timestamps; "wait for silence" signal.

**Acceptance:**
- [ ] End-to-end: playing a target on a piano triggers success events with correct onset timing.

### PD-309: Onset-based timing & latency compensation

**Size:** M  
**Deps:** PD-308  
**Status:** Todo

Compute reaction and completion times from onset estimates (not verifier fire time); subtract calibrated device latency; handle rolled chords and re-struck notes.

**Acceptance:**
- [ ] Timing error vs. ground truth (MIDI-synced recordings) within ±50 ms on corpus.

### PD-310: Low-register & octave robustness

**Size:** L  
**Deps:** PD-307  
**Status:** Todo

Improvements for bass notes and octave confusion: low-band long windows, octave-ambiguity checks, per-note confidence, configurable range cap and strict/relaxed octave modes.

**Acceptance:**
- [ ] Octave-error rate on corpus < 3%; bass-clef notes down to the supported range pass benchmark thresholds; documented supported range.

### PD-311: Calibration wizard

**Size:** M  
**Deps:** PD-308  
**Status:** Todo

Flow from §6.7: permission, level, noise floor, tuning offset, range check, optional latency test; per-device storage of results; "recalibrate" entry point.

**Acceptance:**
- [ ] A new user finishes calibration in < 90 s; results measurably reduce false rejects on a detuned test piano.

## Epic 4 — Drill Session (Play Mode)

Progress: 0/6 tickets done

### PD-401: Session state machine & timing core

**Size:** M  
**Deps:** PD-301, PD-204  
**Status:** Todo

Implement states from §9.3 with a fake-clock-friendly design; start/pause/end; timeout; skip; wrong-note logging; "wait for silence" gating; t₀ capture.

**Acceptance:**
- [ ] Deterministic tests cover success, wrong-then-right, timeout, skip, and pause paths.

### PD-402: Drill screen UI

**Size:** M  
**Deps:** PD-401, PD-203  
**Status:** Todo

Main play screen: big staff, minimal chrome, optional timer visibility, success/miss feedback, reveal on miss (using PD-205), shortcuts, input source selector.

**Acceptance:**
- [ ] Full rep loop works with on-screen keyboard input at levels 1–10.

### PD-403: Session summary screen

**Size:** M  
**Deps:** PD-402, PD-003  
**Status:** Todo

End-of-session stats: median/mean time, accuracy, slowest 5 targets, per-rep list, comparison to previous session at same level; save results.

**Acceptance:**
- [ ] Results persisted and viewable; comparison correct against seeded history.

### PD-404: Level select & custom settings UI

**Size:** L  
**Deps:** PD-108, PD-002  
**Status:** Todo

Level list with targets/locks, custom preset editor for all dimensions in §3, live preview of sample targets, save/load/delete presets, "free play" unlock toggle.

**Acceptance:**
- [ ] Any valid configuration can be created, previewed, saved, and launched.

### PD-405: Level progression & unlocking

**Size:** S  
**Deps:** PD-403, PD-404  
**Status:** Todo

Evaluate level targets from §3.2 after each session; unlock next level; surface progress.

**Acceptance:**
- [ ] Seeded session data unlocks as expected; free-play bypass works.

### PD-406: Mic-driven play end-to-end integration

**Size:** M  
**Deps:** PD-308, PD-309, PD-402  
**Status:** Todo

Wire `MicInput` into drill loop; handle permission-denied, mic loss, noisy environment warnings, input switching mid-session.

**Acceptance:**
- [ ] Complete a 20-rep session on a real piano using only the mic.

## Epic 5 — Key Identification Mode

Progress: 0/5 tickets done

### PD-501: Key-ID question generator

**Size:** S  
**Deps:** PD-102  
**Status:** Todo

Generate key-signature questions respecting settings (clef, accidental range, major/minor/both, tonic hint, enharmonic rules); anti-repeat.

**Acceptance:**
- [ ] Tests verify each generated question has an unambiguous correct answer under the selected answer format.

### PD-502: Answer UI (circle-of-fifths / button grid)

**Size:** M  
**Deps:** PD-002  
**Status:** Todo

Touch-friendly answer input with proper enharmonic labelling; major/minor toggle where applicable; keyboard shortcuts.

**Acceptance:**
- [ ] All 30 keys can be selected correctly on mobile and desktop.

### PD-503: Key-ID session screen & scoring

**Size:** M  
**Deps:** PD-501, PD-502, PD-401  
**Status:** Todo

Flash → answer → timed result; reuse session machine/summary; record confusion data (answered vs. correct).

**Acceptance:**
- [ ] Full session works; results stored with the same `RepResult` shape (mode flag).

### PD-504: Play-the-tonic answer option

**Size:** S  
**Deps:** PD-503, PD-308  
**Status:** Todo

Alternative answer method: play the tonic note on the piano and verify via mic/MIDI.

**Acceptance:**
- [ ] Works with at least mic and MIDI inputs; settings toggle between tap and play.

### PD-505: Key-ID settings & levels

**Size:** S  
**Deps:** PD-503, PD-404  
**Status:** Todo

Presets (e.g. ≤2 accidentals → all keys; major → minor), custom options UI.

**Acceptance:**
- [ ] Presets selectable from the level screen.

## Epic 7 — Polish, Quality & Release

Progress: 0/6 tickets done

### PD-701: Onboarding & first-run flow

**Size:** M  
**Deps:** PD-311, PD-404  
**Status:** Todo

Intro, how to place the device, calibration, choice of input method, first level suggestion.

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

Input device, timeout default, pre-flash delay, notation size, note head style, sound effects, data export/import/reset.

**Acceptance:**
- [ ] Settings persist and take effect without reload.

### PD-704: Cross-device/browser QA & fixes

**Size:** L  
**Deps:** PD-406, PD-503  
**Status:** Todo

Test matrix per §11; fix iOS Safari audio, permission, throttling, and layout bugs; document known limitations.

**Acceptance:**
- [ ] Checklist passes on the device matrix; issues triaged.

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
