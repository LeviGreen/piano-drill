# Piano Drill — Initiative 3: Improvements and bug fixes

This file tracks small improvements and bug fixes found while using the app, after the MVP ([initiative-1-tickets.md](initiative-1-tickets.md)) and the refactoring ([initiative-2-tickets.md](initiative-2-tickets.md)). It stays open: add a ticket whenever something small turns up. Like the other files, it is a living document: edit tickets as the code and the plans change.

## How to use

- When you finish a ticket's work, set its **Status** line to `Done` and tick every acceptance checkbox that is met (`- [x]`).
- Status is one of: `Todo`, `In progress`, `Blocked`, `Deferred`, `Done`. Update it as work starts or stalls, not just at the end.
- Cross out the ticket's row in the **Status at a glance** table when it is Done.
- Update the epic's **Progress** line (`Progress: X/N tickets done`) whenever a ticket's Status changes to or from `Done`.
- Ticket IDs are `IM-xxx` (IM = improvement), numbered by epic, so they never clash with the PD-xxx and RF-xxx tickets. Add new tickets to the epic they belong to, or start a new epic.
- A bug fix says how to reproduce the bug, and its acceptance includes a test that would have caught it where that is practical.

**Size legend:** S = ≤ 1 day · M = 2–3 days · L = 4–7 days. Dependencies are listed by ticket ID.

## Status at a glance

| Epic                       | Ticket     | Short description                                             |
| -------------------------- | ---------- | ------------------------------------------------------------- |
| ~~1 Navigation & scores~~  | ~~IM-101~~ | ~~Phone: make every tab the same size~~                       |
| ~~1 Navigation & scores~~  | ~~IM-102~~ | ~~High-scores link opens the mode and level just played~~     |
| ~~2 Key Signatures~~       | ~~IM-201~~ | ~~Scale up/down: the turning notes need not be struck twice~~ |
| ~~3 Settings~~             | ~~IM-301~~ | ~~Settings windows get Save and Close~~                       |
| 4 MIDI on the mode screens | IM-401     | Reusable MIDI connection components                           |
| 4 MIDI on the mode screens | IM-402     | A compact piano connection strip on each mode screen          |
| 4 MIDI on the mode screens | IM-403     | The on-screen piano always responds                           |
| 4 MIDI on the mode screens | IM-404     | Spike: why the MIDI connection is not reliable                |

## Suggested Build Order

1. **IM-102, IM-201** (small, independent bug fixes).
2. **IM-301** (touches both modes' settings windows).
3. **IM-401 → IM-403** (one feature, in three steps; IM-402 and IM-403 can share a branch).
4. **IM-404** (a spike) can run at any time, and is best done before IM-402: what it finds may change how the connection strip should work.
5. **IM-101** once the screenshot is in.

## Ticket Index

| Epic                       | Tickets         |
| -------------------------- | --------------- |
| 1 Navigation & scores      | IM-101 – IM-102 |
| 2 Key Signatures           | IM-201          |
| 3 Settings                 | IM-301          |
| 4 MIDI on the mode screens | IM-401 – IM-404 |

---

## Epic 1 — Navigation & scores

Progress: 2/2 tickets done

### IM-101: Phone: make every tab the same size

**Size:** S  
**Deps:** None  
**Status:** Done

The screenshots show the phone's bottom bar: Key Signatures wraps to two lines, so its tab came out taller than the other three. Every tab now fills the bar's height and shares its width equally, with the label centred, so they all look the same.

**Acceptance:**

- [x] On a phone, the four tabs are the same size, whether the label takes one line or two.
- [ ] The result is checked in the light, dark and high-contrast themes (to be checked on a phone).

### IM-102: High-scores link opens the mode and level just played

**Size:** S  
**Deps:** None  
**Status:** Done

**The bug:** the "High scores" link in the results window always opens the Scores screen on Sight-Read, Level 1, whatever you just played. It should open on the mode and level of the session you just finished.

**To reproduce:** finish a Key Signatures session on level 3, press "High scores": the board shown is Sight-Read level 1.

**The fix:** the link carries the mode and the level (for example `/scores?mode=keyid&level=3`, which works with the app's hash router) and the Scores screen starts on them. A custom setup, which has no board of its own, falls back to what the screen shows today. Opening Scores from the menu is unchanged.

**Acceptance:**

- [x] After a Sight-Read session, the link opens Sight-Read on the level just played; after a Key Signatures session, Key Signatures on its level.
- [x] A link with an unknown or missing mode or level falls back to the default board without an error.
- [x] Changing the mode or level on the Scores screen still works, and a test covers the link.

---

## Epic 2 — Key Signatures

Progress: 1/1 tickets done

### IM-201: Scale up/down: the turning notes need not be struck twice

**Size:** M  
**Deps:** None  
**Status:** Done

In the MIDI view's checklist, "Scale up" ends on the top note (the octave) and "Scale down" starts on that same note, so today the top note has to be struck twice when playing up and straight back down. The same goes for the bottom note (the tonic) where the two scales meet. Make both ways work: playing the turning note **once** counts for both rows, and playing it **twice** (as today) is also fine. That way it feels natural whichever way the player thinks of it.

**Details to settle while working** (written from reading `src/keyid/checklist.ts`; check them against the code):

- A single strike of the top note after the seventh note completes "Scale up" and also counts as the first note of "Scale down". Striking it again must not reset anything.
- The bottom note works the same way where "Scale down" ends and a new "Scale up" begins, since the rows can be done in any order.
- The hand and register rules, the slip handling (a slip resets only the row it was in) and the flat 250-point score do not change.

**Acceptance:**

- [x] Up then down with the top note struck once ticks both rows; struck twice also ticks both rows.
- [x] Down then up with the bottom note struck once, or twice, ticks both rows.
- [x] A wrong note still resets only the row in progress, and the existing checklist tests pass, with new tests for the one-strike and two-strike cases in both directions, in treble and bass and in major and minor.

---

## Epic 3 — Settings

Progress: 1/1 tickets done

### IM-301: Settings windows get Save and Close

**Size:** M  
**Deps:** None  
**Status:** Done

Today the Sight-Read and Key Signatures settings windows apply every change at once and have a single Close button. Give both a **Save** button and a **Close** button:

- **Save** keeps the new settings (and remembers them for next time).
- **Close**, a click outside the window, or Escape leaves the previous settings as they were; nothing changed in the window is kept.

The windows work on a draft copy of the settings while they are open, and the screen uses the saved ones. Both modes use the same drawer component, so this is built once, in `SettingsDrawer`, with each mode supplying its draft and what Save does.

**Details to settle while working:**

- Settings stay locked during a session, so Save and the fields are disabled then, as the fields are today.
- Decided: Save closes the window, and the Save button is always enabled (not only after a change).
- The Input choice (on-screen or MIDI piano) is a setting too, so it follows the same rule.

**Acceptance:**

- [x] In both modes, changing an option and pressing Save keeps it, and it is still there after a reload.
- [x] Changing an option and pressing Close, clicking outside, or pressing Escape leaves the earlier settings, and reopening the window shows them.
- [x] The level picker, the "Custom" switch and the one-key-signature shortcut work on the draft the same way as they do today.
- [x] Tests cover Save, Close, clicking outside and Escape for both modes.

---

## Epic 4 — MIDI on the mode screens

Progress: 0/4 tickets done

Today the piano has to be connected on the Settings page (MIDI Test), and if it disconnects the player has to go back there. The connection controls should be right on each mode's screen, in a space-efficient way, built from the same components as the Settings page (which stays).

### IM-401: Reusable MIDI connection components

**Size:** M  
**Deps:** None  
**Status:** Todo

`src/ui/MidiTestScreen.tsx` holds everything for connecting a piano: the Connect button, the status message, the piano list, the table of device state and the keyboard that lights up held keys. Pull those into separate components (and a hook for the connection itself) that the Settings page and the mode screens both use. The Settings page looks and works exactly as it does now.

**Acceptance:**

- [ ] The MIDI Test page is built from the new components, with no visible change, and its tests pass unchanged.
- [ ] The components can be used on their own, without the test page around them (they take the connection as input, or use one hook).
- [ ] One place holds the connection state, so the mode screens and the Settings page agree on whether a piano is connected and which one is chosen.

### IM-402: A compact piano connection strip on each mode screen

**Size:** M  
**Deps:** IM-401  
**Status:** Todo

Put a small, space-efficient strip on the Sight-Read and Key Signatures screens (a single line or a collapsible bar) showing the piano's status, with the controls to connect, reconnect and, if more than one piano is found, choose one. If the piano disconnects mid-session, the player can reconnect right there, instead of going back to Settings. The strip uses the components from IM-401. On a phone it takes as little room as possible, and the on-screen piano users do not need it.

**Acceptance:**

- [ ] A player can connect a piano from the Sight-Read and Key Signatures screens without visiting Settings.
- [ ] After an unplug, pressing Reconnect on the strip brings the piano back, and the existing "Piano disconnected, press Resume" flow still works.
- [ ] The strip is compact (one line when connected, more only when there is a problem or a choice to make) and works on a phone.
- [ ] Tests (with the fake piano) cover connecting, reconnecting after an unplug and choosing between pianos from a mode screen.

### IM-403: The on-screen piano always responds

**Size:** S  
**Deps:** IM-402  
**Status:** Todo

The on-screen piano on a mode screen only reacts once a session is running (it is only clickable while a target is on screen, and it lights up held keys only inside a session). Make it respond all the time, even before Start and between sessions: when a MIDI piano is connected, the keys you press light up at once, so the player can see the connection works without starting anything.

**Decided:** "responsive" means the keys light up from a MIDI piano at any time. Clicking the on-screen keys outside a target is not part of this ticket; the keys are clickable only while a target is on screen, as today.

**Acceptance:**

- [ ] With a MIDI piano connected, the on-screen piano lights the keys held, before Start, while getting ready, and between sessions, in both modes.
- [ ] Those lit keys never count as answers outside a running target (a session is only affected by notes while a target is on screen, as today).
- [ ] A test covers that clicking the on-screen keys outside a running target does nothing, as today.

### IM-404: Spike: why the MIDI connection is not reliable

**Size:** M  
**Deps:** None  
**Status:** In progress (code read and logging added; waiting for a log from the owner's piano; notes in [midi-connection-spike.md](midi-connection-spike.md))

**The problem:** connecting the piano is not smooth. It always ends up working, but not consistently. Some of the time it takes one or more of these before the app sees the piano:

- turning the piano off and on;
- disconnecting and reconnecting in the app (the MIDI Test page's controls);
- unplugging and replugging the USB cable.

This is an investigation, not a fix. The result is a written answer to two questions: **why does it happen**, and **can we make it better**.

**Where to look** (written from the code, not yet checked): `src/audio/inputs/MidiInput.ts` (how the browser's MIDI access is requested and the ports are opened), `src/audio/inputs/drillInput.ts` (`connectMidi`, `pianoConnected`) and `src/ui/usePianoInput.ts` (opening before a session, and watching for unplugging); `src/ui/MidiTestScreen.tsx` (the Connect button and the port list).

**Ideas to test, none of them confirmed:**

- Whether the app keeps one MIDI access for the whole visit, or asks again on each screen and each Start, and whether ports opened by an earlier request are left half-open.
- Whether input ports are opened explicitly (`port.open()`) and their `state` / `connection` values are checked (`connected`, `disconnected`, `open`, `closed`, `pending`) before the app decides there is no piano.
- Whether a `statechange` event from the browser is missed or arrives while no listener is attached (for example between screens, or between the access request and the first port list).
- Whether the piano is chosen by an id that changes when it is replugged, or by a name that matches the wrong port (a piano can show up as more than one port).
- Whether another program or browser tab holds the piano (it may only allow one user at a time), and what the app shows in that case.
- Whether the problem is only in one place: the piano, its USB cable or hub, the OS, or the browser (Chrome is the one that supports MIDI). Compare with a known working MIDI tool (for example a web MIDI tester) to see whether the piano behaves the same there.

**Work:**

1. Reproduce it, and write down exactly what was done and what the app showed each time: which piano, which browser, whether the piano was on before the page loaded, and whether it was plugged in before or after. The owner has the hardware, so this needs their help.
2. Add temporary logging of the browser's MIDI events (access granted, each port's state changes, ports opened and closed) and of what the app decided at each point, to see where a working connection is lost or never seen.
3. Find the cause (or the most likely causes) and rank them.
4. Propose fixes with their size, and say what can be done in IM-401 and IM-402 (for example a "Reconnect" that does the full reset in one press) and what cannot (a problem in the piano or the OS).

**Output:** a short write-up under this ticket (or a new file in `docs/`) with the findings and the proposed fixes, and new tickets in this epic for the fixes worth doing. No change to how the connection works is part of this ticket, and temporary logging is removed before it is finished.

**Acceptance:**

- [ ] The problem is reproduced and the steps and the setups tried are written down.
- [ ] The cause (or the likely causes, ranked) is written down, with the evidence for each.
- [ ] The write-up says what can be made better and what cannot, and how much work each fix is.
- [ ] Follow-up tickets are added for the fixes worth doing, and IM-401 and IM-402 are updated if the findings change them.
