# Adding a drill mode

Sight-Read (`PlayScreen`) and Key Signatures (`KeyIdScreen`) are built from the same pieces, so a third mode (intervals, say) is about one session class, one settings file and one screen file.

1. **Items.** Decide what one rep shows (a `Target`, a `KeyIdQuestion`) and write a generator with `next()`.
2. **Session.** Extend `RepSession<Item, Snapshot>` (`src/session/RepSession.ts`). It owns the timing, the states, pause/resume/end and the results. You supply `beginRep`, `buildResult`, and call `finishRep(outcome)` when the player has finished a rep. See `DrillSession` (notes played) and `KeyIdSession` (an answer given).
3. **Settings and levels.** Describe the mode with `createSettings` (`src/settings/schema.ts`: known keys, defaults, migrate, validate) and load its levels with `loadPresets` (`src/settings/presets.ts`) from a `levels.json`. Remember them between visits with a small hook like `useKeyIdSettings` (uses `src/storage/prefs.ts`).
4. **Screen.** Call `useRepSession` (`src/ui/useRepSession.ts`) with `drawEmpty` and a `create` that builds your session, using `flashPresenter` to draw each item. Render `DrillScreenFrame` (`src/ui/DrillScreenFrame.tsx`) with the title, what an item is called, the settings fields, and whatever sits under the staff (a keyboard, an answer box).
5. **Route and scores.** Add the route in `src/App.tsx` (lazy-loaded like the others) and a nav entry in `src/ui/nav.ts`. Scores are kept per mode and level (`src/scoring/score.ts`, `ScoreSummary`); a new mode needs its scoring rules and a board.
6. **Tests.** Test the session on a `FakeClock` with a fake presenter and `ScriptedInput` (see `DrillSession.test.ts`), and the screen like `PlayScreen.test.tsx`.
