# IM-404: MIDI connection spike

Working notes for [IM-404](initiative-3-tickets.md). The question: why is connecting the piano not reliable (it sometimes needs the piano power-cycled, a Disconnect/Connect in the app, or the USB replugged), and can it be made better?

**Status:** code read done; hypotheses below are **not yet checked against the hardware**. Temporary logging is in place for that (see "How to capture a log"). Remove it, and `src/audio/inputs/midiLog.ts`, when the spike is finished.

## How the connection works today

- Every Start in a mode creates a **new** `MidiInput` and asks the browser for MIDI access again (`createDrillInput` → `MidiInput.start` → `navigator.requestMIDIAccess`). The MIDI Test page has its own `MidiInput` and asks again on each Connect. When a session ends, `stop()` clears the handlers on that object's ports; nothing is shared between screens or sessions.
- Right after access is granted, `rescan()` reads `access.inputs` once and, for each port with `state === 'connected'` (and matching the remembered piano id, if any), sets `port.onmidimessage`. In Chrome, setting that handler is what opens the port. The app never calls `port.open()` and never reacts to `connection` being `closed` or `pending`.
- `connectMidi` (run on Start) checks `pianoConnected` **once, immediately** after access is granted. If no connected port matches, it calls `stop()` and reports "No MIDI piano was found". It does not wait for a `statechange`.
- `statechange` events call `rescan()`, which re-assigns the handlers. During a session `usePianoInput` watches `pianoConnected` and pauses when it turns false.
- The remembered piano (`piano-drill.midiDevice`) is an id. If it is set, `pianoConnected` and `rescan` accept only that id; any other port is ignored.

## Hypotheses, in the order I would check them

**A clue from the owner:** in a drill, Start only works if the piano was connected on the MIDI Test page first. The test page's `MidiInput` is stopped when you leave it, so the drill still makes its own, new request, and that one works. That points at the _first_ MIDI access after the page loads behaving differently from later ones (hypotheses 1 and 5 below), rather than at something the test page leaves behind. It also fits the Connect button being pressed by a person, who naturally waits and presses again, while Start checks once, at once.

Each says what the code does, why it could produce the symptom, and what in the log would confirm it.

1. **A one-shot check right after access is granted (no waiting).** Chrome can report an empty or not-yet-`connected` input list for a moment after `requestMIDIAccess` resolves (especially for a piano that was just switched on or plugged in), and the piano shows up in a `statechange` shortly after. `connectMidi` fails at once and calls `stop()`, which also removes the `statechange` handler, so the piano that appears 200 ms later is never seen. That would look like "it needs me to press Start/Connect again" and matches the Disconnect/Connect workaround. _Log:_ `connectMidi: piano connected? yes:false`, followed (after a `stop()`) by nothing, or a `statechange` with the piano connected within a second of `access granted`.
2. **A remembered piano id that no longer matches.** If the piano's port id changes (a different USB port or hub, another power-on, the OS renumbering it), the saved id matches nothing: the piano is listed but ignored, and `pianoConnected` is false. The MIDI Test page's "All devices" choice (or re-picking the piano) is what fixes it. _Log:_ `rescan` with `selected` set to an id that is not among the `ports`, while another port with the piano's name is `connected`.
3. **A port that is `connected` but not `open`.** After power-cycling or replugging, Chrome can show a port as `connected` with `connection: 'closed'` or `'pending'`. The app sets a handler (which should open it) but never calls `open()`, never re-checks `connection`, and counts the piano as present anyway; the keys would then do nothing. A port held by another program also stays `closed` (the code comment notes this), with no message about it in a drill. _Log:_ `connection` is not `open` on the piano's port after `rescan`, and does not become `open` in a later `statechange`.
4. **Re-opening loops or races.** `rescan` runs on every `statechange` (including connection changes) and re-assigns the handler on every call, which can itself cause another `statechange`. If a port will not open, this could repeat or flip states. _Log:_ a run of `statechange` + `rescan` lines in quick succession for the same port.
5. **Many MIDI accesses at once.** Each Start, and each Connect on the test page, makes a new `MIDIAccess`, and the old ones are only detached from their ports on `stop()`. A stale access may still hold a port open, and a piano that only allows one user (some drivers, other tabs, music software) may then be reported `closed` to the new one. _Log:_ the number of `requestMIDIAccess…` lines against `stop()` lines, and ports `closed` right after a `start()` that followed an earlier session in the same page.
6. **Outside the app** (the piano, cable or hub, the OS, Chrome's own device handling, another tab or program holding the piano). If the log shows the browser itself reporting the piano late, flapping, or `disconnected` while the app does nothing, the app cannot fix it, but it may be able to hide it (see below). The same test in a different tool (for example a web MIDI tester page) shows which side it is on.

## What the app could do about it (to be confirmed by the log)

These are ideas, not decisions; their size depends on what the log shows.

- Wait a short time for the piano before saying none was found (re-check on `statechange` for a second or two, and keep listening afterwards), for hypothesis 1.
- If the remembered piano is not there but exactly one other piano is, use it, and say so; or fall back to all devices (hypothesis 2).
- Call `port.open()` explicitly and show `connection` problems in words ("the piano is held by another program") (hypothesis 3).
- Re-assign handlers only when they are not set or the port is not open (hypothesis 4).
- Keep one `MIDIAccess` for the whole visit, shared by the mode screens and the Settings page (this is what IM-401 asks for anyway) (hypothesis 5).
- A single **Reconnect** button that does the whole reset (stop, new access, wait for the piano) in one press, for the cases the app cannot fix.

## How to capture a log

1. Run the app locally (`npm run dev`) and open it in Chrome. Open DevTools → Console.
2. Do the thing that fails: for example switch the piano on _after_ loading the page, press Start or Connect, and note whether it worked.
3. Whenever it fails, then whenever one of your workarounds fixes it, run `copy(__midiLog.join('\n'))` in the console and paste the result into a file or the chat, with a line saying what you did (piano on/off, USB in/out, which button you pressed, and what the screen said).
4. The runs to do are listed in [midi-logs.md](midi-logs.md). Useful variations:

- (a) piano on and plugged in before opening the page;
- (b) piano on after opening the page;
- (c) USB unplugged and replugged during a session;
- (d) piano switched off and on during a session;
- (e) Start, finish or End a session, then Start again;
- (f) with a saved piano chosen on the MIDI Test page, and again with "All devices".

Also write down: the piano model, the computer and OS, the Chrome version, and whether it is connected through a hub.

## Findings so far

From runs A and B (Yamaha MM8, in [midi-logs.md](midi-logs.md)). Both were only on the MIDI Test page; no Sight-Read Start was logged yet.

**Established**

- **The port id does not change.** The MM8's input is `-1144519317` before and after every replug and power-cycle (its output port is `-1418849052`). So hypothesis 2 (a saved id that no longer matches) is ruled out for this piano.
- **No loops.** Each `statechange` led to exactly one `rescan`, and settled. Hypothesis 4 is ruled out.
- **The app handled late arrival correctly on the test page.** In run B the piano was off at `access granted` (no ports) and appeared 2 s later; the test page picked it up from the `statechange`. (The drill's Start would not have: it checks once. This is still hypothesis 1 for Sight-Read, not yet logged.)
- **The first MIDI request after starting Chrome is slow:** 3.8 s in both runs (`requestMIDIAccess…` to `access granted`), against 15 to 20 ms for every later request in the same page.
- **In the failing cases the app believed everything was fine.** In run A's "not working" case and in run B's many failed connects, the log shows the piano `connected`, the port `open`, and the app `listening` to it. Nothing in the app's own view looked wrong.
- **What fixed it was a physical reset:** unplugging and replugging the USB **at the keyboard end**. Unplugging at the computer end and switching the piano off and on did nothing in run A. Each unplug shows the port going `disconnected`/`pending` and coming back `connected`/`open`.

**Reported by the owner**

- In the failing cases the MIDI Test keyboard **never lights up**, so no notes reach the app's handler.
- In run B it started working (the on-screen keyboard responded) **after the third replug** of the USB. Run A also logged three disconnect/reconnect pairs before it worked. The run B log shows only two pairs, so either the log was copied before the third, or one replug never reached Chrome. Worth checking in the next run: does it take a particular **number** of re-enumerations (three each time), or a particular **time** since Chrome started?

**Not known yet**

- Whether any messages were arriving while it "did not work". The logging did not record that. If the port is open but silent, the problem is below the app: the browser or macOS says the piano is open, and it is not sending. That would also explain why the app cannot see it. I added logging for this (see below).
- Whether the older, still-open ports from earlier connects (the app never closes a port; `stop()` only clears the handler) make things worse. Run B made five connects in a row. This is hypothesis 5, and it does not explain run A (the first connect after starting Chrome failed too).

**Next**

- The temporary logging now also records, for each port the app starts listening to: the first message that arrives, and a count of messages 3 s after listening starts. Redo run A and run B with it. A silent open port (0 messages with a piano that normally sends a heartbeat) would confirm the problem is below the app.
- Ask whether the MIDI Test keyboard lit up in the failing cases (it should if messages arrive).
- If the port is silent, try closing the port explicitly (`port.close()`) when we stop, then opening it again, to see whether that does what the replug does. If it does, that is the "Reconnect" fix.
