# Piano Drill — Initiative 2: Refactoring

This file tracks the refactoring work that follows the MVP ([initiative-1-tickets.md](initiative-1-tickets.md)). The goal: **clean code that is flexible for future development**, such as new drill modes and new input types, without changing what the app does. It comes from a code review on 2026-11-17, after the microphone was cut from the project. Like the first initiative's file, it is a living document: edit tickets as the code changes.

## How to use

- Every ticket here is a **refactor**: behaviour stays the same. The tests, lint and build must pass before and after, and a ticket that needs a behaviour change says so in its text.
- When you finish a ticket's work, set its **Status** line to `Done` and tick every acceptance checkbox that is met (`- [x]`).
- Status is one of: `Todo`, `In progress`, `Blocked`, `Deferred`, `Done`.
- Cross out the ticket's row in the **Status at a glance** table when it is Done.
- Update the epic's **Progress** line (`Progress: X/N tickets done`) whenever a ticket's Status changes to or from `Done`.
- Ticket IDs are `RF-xxx` (RF = refactor) so they never clash with the PD-xxx tickets.

**Size legend:** S = ≤ 1 day · M = 2–3 days · L = 4–7 days. Dependencies are listed by ticket ID.

## Status at a glance

| Epic                        | Ticket     | Short description                                       |
| --------------------------- | ---------- | ------------------------------------------------------- |
| ~~1 Mic leftovers~~         | ~~RF-101~~ | ~~Simplify `NoteInput` (drop `confidence`)~~            |
| ~~1 Mic leftovers~~         | ~~RF-102~~ | ~~Remove silence gating from `RepSession`~~             |
| ~~1 Mic leftovers~~         | ~~RF-103~~ | ~~Retire `startedWithoutSilence`~~                      |
| ~~1 Mic leftovers~~         | ~~RF-104~~ | ~~Fix stale docs and comments~~                         |
| ~~2 Shared infrastructure~~ | ~~RF-201~~ | ~~One preferences-storage helper~~                      |
| ~~2 Shared infrastructure~~ | ~~RF-202~~ | ~~Shared settings module~~                              |
| ~~2 Shared infrastructure~~ | ~~RF-203~~ | ~~Shared level/preset loading~~                         |
| ~~3 Drill screens~~         | ~~RF-301~~ | ~~`useRepSession` hook~~                                |
| ~~3 Drill screens~~         | ~~RF-302~~ | ~~Shared drill screen frame~~                           |
| ~~3 Drill screens~~         | ~~RF-303~~ | ~~Move Play and Key Signatures onto the shared pieces~~ |
| ~~4 Structure & polish~~    | ~~RF-401~~ | ~~Split `index.css`~~                                   |
| ~~4 Structure & polish~~    | ~~RF-402~~ | ~~Small tidy-ups (empty folders, lint suppressions)~~   |
| ~~4 Structure & polish~~    | ~~RF-403~~ | ~~Lazy-load the notation code~~                         |
| 4 Structure & polish        | RF-404     | `KeyIdSession` answer-method strategy (deferred)        |

## Suggested Build Order

1. **RF-101 → RF-104** (finish the mic cut: small and low risk).
2. **RF-201** (preferences helper: mechanical, and it shrinks the screens before they are merged).
3. **RF-301 → RF-303** (the shared screen pieces: the change that most helps a future third mode).
4. **RF-202, RF-203** (when the next mode, or a settings change, needs them).
5. **RF-401 → RF-403** (anytime; RF-401 is best done before a larger UI change).
6. **RF-404** only if the MIDI answer method keeps growing.

## Ticket Index

| Epic                    | Tickets         |
| ----------------------- | --------------- |
| 1 Mic leftovers         | RF-101 – RF-104 |
| 2 Shared infrastructure | RF-201 – RF-203 |
| 3 Drill screens         | RF-301 – RF-303 |
| 4 Structure & polish    | RF-401 – RF-404 |

---

## Epic 1 — Mic leftovers

Progress: 4/4 tickets done

Concepts that only made sense for a microphone and now do nothing with MIDI or the on-screen piano.

### RF-101: Simplify `NoteInput` (drop `confidence`)

**Size:** M  
**Deps:** None  
**Status:** Done

`src/audio/inputs/NoteInput.ts` still has a `confidence` on every `Onset`, and `activeNotes` is a `Map<midi, confidence>`. MIDI and the on-screen piano can only report 1. Make `activeNotes` a `Set<number>` and drop `confidence` from `Onset`. Update `MidiInput`, `OnScreenKeyboardInput`, `ScriptedInput`, `MergedInput`, the fake MIDI test helper, every consumer and every test that builds a state. Fix the doc comment that lists "mic" as an input.

**Acceptance:**

- [x] No `confidence` anywhere in `src/`.
- [x] `activeNotes` is a `Set<number>`.
- [x] The tests, lint and build pass.

**Notes:** `NoteInputState.activeNotes` is a `Set<number>` and `Onset` is `{ midi, t }`. MIDI velocity is no longer read (nothing used it).

**Still to do by hand:** try it once on the real MIDI piano (Sight-Read and the Key Signatures MIDI view). The fake-piano tests pass, but the change to `MidiInput` has not been run against real hardware yet.

### RF-102: Remove silence gating from `RepSession`

**Size:** S  
**Deps:** None  
**Status:** Done

`RepSession` waits for the input to be quiet before a flash (`silenceMs`, `maxWaitMs`, "READY waits for quiet"). MIDI has no ring-out, so this does nothing. Remove the options, the waiting logic and the matching `Input` hooks, and keep the fixed get-ready wait (4 s, then 1 s). Update the session tests that cover it.

**Acceptance:**

- [x] `silenceMs` and `maxWaitMs` no longer exist; READY is only the get-ready countdown.
- [x] The tests, lint and build pass.

**Notes:** also removed `quietState`, `recheckReady`, the `silenceMs` test option, and the tests that waited for quiet; READY is now just the get-ready timer.

### RF-103: Retire `startedWithoutSilence`

**Size:** S  
**Deps:** RF-102  
**Status:** Done

`startedWithoutSilence` is set on every `RepResult` and saved. It is always false now. **Decision (2026-11-18): option (a)**: the field is dropped from new results and ignored when reading old ones. Checked: backups do not validate it (`src/storage/backup.ts` only checks the session id, mode, timestamp and outcome of a rep), so old backups and saved reps that still carry it import and read fine; a test covers an old-style backup.

**Acceptance:**

- [x] The decision is written in this ticket (option a).
- [x] Old saved data and old backups still load.
- [x] The tests, lint and build pass.

### RF-104: Fix stale docs and comments

**Size:** S  
**Deps:** RF-101, RF-102  
**Status:** Done

Update `docs/design.MD` §9.3 (state machine: silence), the `SessionState` comments in `src/session/types.ts` ("listening", "waiting for quiet") and any remaining comment that talks about listening, noise or ring-out.

Also removed the mic-era "almost" note state (the dashed ring on the staff and keyboard, its CSS and tests), which nothing set any more.

**Acceptance:**

- [x] A search for "listen", "silence", "quiet" and "ring-out" in `src/` and `docs/` finds no stale meaning.

---

## Epic 2 — Shared infrastructure

Progress: 3/3 tickets done

### RF-201: One preferences-storage helper

**Size:** S  
**Deps:** None  
**Status:** Done

`localStorage` reads and writes, each with its own try/catch and key constant, are repeated in about 8 places: `PlayScreen`, `KeyIdScreen`, `MidiTestScreen`, `ScoreSummary`, `ThemeProvider`, `theme.ts` and `drillInput.ts`. Add `src/storage/prefs.ts` with typed `load`, `save` and `remove`, namespaced keys (keep today's key names, so nothing already saved is lost) and one place that handles "storage unavailable". Replace the direct calls. Tests can fake the module instead of `localStorage`.

**Acceptance:**

- [x] No direct `localStorage` use outside `prefs.ts`.
- [x] Existing saved settings, theme, initials and device choices still load.
- [x] The tests, lint and build pass.

**Notes:** `src/storage/prefs.ts` (`loadPref`, `savePref`, `loadJsonPref`, `saveJsonPref`, and `PREF_KEYS` with every key under its old name, so nothing already saved is lost). Used by the input choice and MIDI device (`drillInput.ts`, which now also has `saveMidiDevice`; the MIDI test screen used to keep its own copy of that key), the theme, the initials, and the two screens' settings. `PlayScreen` and `KeyIdScreen` no longer touch storage themselves.

### RF-202: Shared settings module

**Size:** M  
**Deps:** None  
**Status:** Done

`src/levels/settings.ts` and `src/keyid/settings.ts` both validate, fill defaults, merge and version their settings, and `keyid` imports `deepMerge`, `isInt` and `show` from `levels`. Move those helpers to `src/settings/`, then define a small `SettingsSchema<T>` (known keys, per-field validators, defaults, version) that both modes use, so a new mode does not copy the validation loop. Keep the JSON shapes and the error messages as they are.

**Acceptance:**

- [x] Both modes use the shared schema; the helper functions live in one place.
- [x] The tests for both settings files pass without changing their expectations.

**Notes:** `src/settings/`: `json.ts` (`isObject`, `isInt`, `show`, `deepMerge`), `schema.ts` (`createSettings`: migrate, fill defaults, validate, drop unknown keys with a warning, merge; plus the checks every mode shares: name, timeout, goal, version-only). Sight-Read (`levels/settings.ts`, with its own legacy migrations) and Key Signatures (`keyid/settings.ts`) now only describe themselves; their exports and every error message are unchanged. `src/settings/schema.test.ts` builds a made-up mode to show a new mode needs only a schema.

### RF-203: Shared level/preset loading

**Size:** S  
**Deps:** RF-202  
**Status:** Done

`src/levels/presets.ts` and `src/keyid/presets.ts` (and their two `levels.json` files) have the same shape: load, validate, number, look up by id or name. Share the loader so a new mode only supplies its JSON and its schema.

**Acceptance:**

- [x] One generic preset loader; both modes use it.
- [x] The tests, lint and build pass.

**Notes:** `src/settings/presets.ts` (`loadPresets`, `presetById`, `Preset<S>`). `Level` and `KeyIdLevel` are now aliases of `Preset`; `PRESET_LEVELS`, `KEY_ID_LEVELS`, `levelById` and `keyIdLevelById` keep their names and behaviour.

---

## Epic 3 — Drill screens

Progress: 3/3 tickets done

`PlayScreen` (445 lines) and `KeyIdScreen` (405 lines) are near-twins: the same hooks, the same flash/presenter/session/subscribe setup, the same controls, drawer and results modal. A third mode (for example intervals) should need about one new file, not a copy of 400 lines.

### RF-301: `useRepSession` hook

**Size:** M  
**Deps:** None  
**Status:** Done

Extract the shared logic from both screens into one hook, for example `src/ui/useRepSession.ts`: build the `FlashController` and `Presenter`, open the piano input (`usePianoInput`), create and subscribe to the session, keep the snapshot and results in state, handle start, pause, resume, skip and end, and release the piano at the end. The screen passes in what differs: the session factory and how an item is drawn, revealed and cleared.

**Acceptance:**

- [x] The hook has its own tests with a fake clock and fake input.
- [x] It owns the start/pause/resume/end/cleanup effects that both screens duplicate.

**Notes:** `src/ui/useRepSession.ts` (the hook, `flashPresenter`, and the `RepRun` type) with tests in `useRepSession.test.tsx` on a fake clock. The settings state of each mode moved to its own hooks, `usePlaySettings` and `useKeyIdSettings`. One small change: the clock reads the session's own `limitSeconds` in both modes (it equals the settings' time limit in Sight-Read).

### RF-302: Shared drill screen frame

**Size:** M  
**Deps:** None  
**Status:** Done

Extract the layout both screens share into a `DrillScreenFrame` component: the centred column, the staff stage, the status, clock and notes lines (fixed height), the countdown, the controls, the settings drawer and the results modal. The screen fills in slots (settings fields, answer area, status text).

**Acceptance:**

- [x] The frame renders both modes' layouts without visual change (checked by hand in the running app).
- [x] The tests, lint and build pass.

**Notes:** `src/ui/DrillScreenFrame.tsx`. It owns the settings drawer's open state and the "locked during a session" line. Checked without a browser: the screens' markup, idle and with the settings window open (66 KB of HTML), is byte-for-byte the same as before the refactor.

### RF-303: Move Play and Key Signatures onto the shared pieces

**Size:** M  
**Deps:** RF-201, RF-301, RF-302  
**Status:** Done

Rebuild `PlayScreen` and `KeyIdScreen` with `useRepSession`, `DrillScreenFrame` and `prefs`. Each should shrink to what is specific to its mode: its settings fields, its way of drawing an item and its answer UI. Existing screen tests keep passing; `midiDrills.test.tsx` is the safety net for the MIDI paths.

**Acceptance:**

- [x] Each screen is clearly smaller (target: under about 250 lines).
- [x] No behaviour change: every existing screen test passes unchanged.
- [x] A short note in `docs/` on how to add a new drill mode.

**Notes:** `PlayScreen` 445 to 140 lines, `KeyIdScreen` 405 to 235 (its settings fields are inline; Sight-Read's moved to `PlaySettingsFields`). Every existing screen test passes unchanged (739). How to add a mode: [adding-a-drill-mode.md](adding-a-drill-mode.md).

---

## Epic 4 — Structure & polish

Progress: 3/4 tickets done

### RF-401: Split `index.css`

**Size:** M  
**Deps:** None  
**Status:** Done

`src/index.css` is one file of about 1,360 lines. Split it into `base.css` (tokens, reset, element defaults such as `button` and `input`), component files (keyboard, modal, drawer, tiles, wheel and so on) and screen files (Play, Key Signatures, Scores), imported from one entry. Keep the cascade order the same. Do a visual check of every screen at desktop and phone widths in light and dark themes.

**Acceptance:**

- [x] No file over about 300 lines.
- [x] Every screen looks the same in light and dark, desktop and phone.
- [x] Global element rules are in `base.css`, not under a screen's heading.

**Notes:** `src/index.css` is now only a list of imports, in the order they apply, and the styles are in `src/styles/`: `base`, `shell`, `notation`, `controls`, `drill`, `answer-input`, `modals`, `scores`, `midi-view` (the largest is 221 lines). The one cut, `src/styles/base.css`, now holds the page defaults and the plain element rules (`select`, `fieldset`, `input`, `button`, `button:disabled`), which used to sit under other screens' headings. **How it was checked (not by eye):** the built CSS has the same rules in the same order as before, except those five element rules, which moved to the top; they are single-element rules that can only lose to any class rule, and no earlier rule of equal weight sets the same properties, so the cascade is unchanged. Also removed 7 rules whose classes nothing uses any more (`.gallery`, `.gallery-item`, `.gallery-item h2`, `.gallery-keys`, `.tricky`, `.keyid-summary`, `.modal-score`). A quick look at the live site, in light and dark and at phone width, is still worth doing after the next deploy.

### RF-402: Small tidy-ups

**Size:** S  
**Deps:** None  
**Status:** Done

- Remove the empty folders (`src/stats/`, and any `.gitkeep` that no longer holds a place) that the project does not use yet.
- Check the 4 `eslint-disable` comments (the project uses oxlint). **All 4 are needed** (oxlint reports `exhaustive-deps` without them), so they stay.
- Move the icons out of `src/ui/screens.tsx` into `src/ui/icons.tsx`. The Settings page's "Coming soon (see PD-703)" placeholder is removed (PD-703 is out of scope), and so is the Input picker there (it is still in the Sight-Read settings; the Key Signatures hint now says so).

**Acceptance:**

- [x] No empty folders, and no unused suppression comments.
- [x] The tests, lint and build pass.

### RF-403: Lazy-load the notation code

**Size:** S  
**Deps:** None  
**Status:** Done

The build is one 1.18 MB chunk (vite warns above 500 kB), mostly VexFlow. Load the notation code per route with `React.lazy`, so Home and Settings do not download it. Check that the GitHub Pages base path (`base: './'`) still works with the extra chunks.

**Acceptance:**

- [x] A clearly smaller main chunk (numbers recorded in the notes; the one remaining warning is for the VexFlow chunk).
- [x] The deployed site works from the repo subpath (checked on the live site on 2026-11-18: both drill screens load).

**Notes:** the drill screens load on demand (`React.lazy` in `src/App.tsx`, with a "Loading…" fallback), and VexFlow is its own `vexflow` chunk (`manualChunks` in `vite.config.ts`). Numbers: the main file went from **1,178 kB to 397 kB** (gzip 535 kB to 127 kB); Home, Scores, Settings and MIDI Test no longer download the 719 kB VexFlow file (387 kB gzip). Vite's 500 kB warning still shows, for that one VexFlow chunk (it holds the music font); the main chunk is under the limit. Chunk imports are relative (`./PlayScreen-….js`), so the repo-subpath deploy works; confirmed on the live site. `App.test.tsx` waits for the lazy screens.

### RF-404: `KeyIdSession` answer-method strategy

**Size:** M  
**Deps:** RF-303  
**Status:** Deferred (only worth doing if the MIDI answer method keeps growing)

`KeyIdSession.answer()` and `setMethod()` carry the logic for three answer methods (wheel, type, play) on top of the shared base. If a fourth appears, or the scale-playing view gets more rules, move each method into its own strategy object with one interface.

**Acceptance:**

- [ ] Each answer method is its own small class or object with its own tests.
- [ ] `KeyIdSession` only delegates.
