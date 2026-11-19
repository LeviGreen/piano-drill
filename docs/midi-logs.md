# IM-404: MIDI logs

Paste the log of each run into its empty block, and answer the questions under it.

## How to capture a log

1. Open DevTools → Console in Chrome (the app running with `npm run dev`).
2. After the run, type `copy(__midiLog.join('\n'))` and press Enter. The log is now on your clipboard.
3. Paste it into the block for that run. Do this **before** reloading, because a reload clears the log.
4. Reset before the next run:
   - **Runs A, B and G:** quit Chrome completely (Cmd+Q) and reopen it. Close any other tab that could be using MIDI first.
   - **Runs C, D and E:** reload the page (Cmd+R).
   - **Run F:** the reloads are in its steps.

## Terms

- **Connect first:** go to Settings → MIDI Test (click through the app, don't reload there), press Connect, wait until your piano is listed, and play a key to see it light up. Then click to Sight-Read, without reloading.
- **Setup for every run:** in Sight-Read settings, Input is "MIDI piano". On the MIDI Test page, the piano list is on "All devices" (except in run F).

## Computer

- Mac and macOS version:
- Chrome version:
- Piano model:
- USB direct, or through a hub:

## A: Piano on and plugged in before the page loads

1. Switch the piano on and plug in the USB. Wait 10 seconds.
2. Load the app and do **Connect first** (see above).
3. Press Start in Sight-Read, play a few notes, then press End.

- What the screen said:
- Did it work? Did Start work the first time?
- If not, what fixed it (piano off/on, Disconnect then Connect, USB out/in, other)?

```

```

## B: Piano switched on after the page loads

1. Plug in the USB, but leave the piano switched **off**.
2. Load the app and go to Settings → MIDI Test.
3. Switch the piano on, then press Connect right away.
4. If the piano is not listed, wait 5 seconds and press Connect again. Count how many presses it took.
5. Go to Sight-Read and press Start.

- What the screen said:
- Did it work? How many Connect presses? Did Start work?
- If not, what fixed it (piano off/on, Disconnect then Connect, USB out/in, other)?

```

```

## C: USB unplugged and replugged during a session

1. Do **Connect first**, then press Start and answer one target.
2. Unplug the USB. Note what the screen says.
3. Wait 5 seconds, then plug it back in.
4. Note whether Resume becomes available by itself. Press Resume and play.

- What the screen said:
- Did it work? Did Resume work without anything else?
- If not, what fixed it (piano off/on, Disconnect then Connect, USB out/in, other)?

```

```

## D: Piano switched off and on during a session

1. Do **Connect first**, then press Start and answer one target.
2. Switch the piano off (leave the USB in). Note what the screen says.
3. Wait 5 seconds, then switch it back on.
4. Note whether Resume becomes available by itself. Press Resume and play.

- What the screen said:
- Did it work? Did Resume work without anything else?
- If not, what fixed it (piano off/on, Disconnect then Connect, USB out/in, other)?

```

```

## E: Three sessions in a row

1. Do **Connect first**, then press Start, play a few notes, press End.
2. Press Start again, play, End. Do it a third time. Do not reload or visit MIDI Test in between.
3. Go to Settings → MIDI Test and press Connect.
4. Go back to Sight-Read and press Start.

- What the screen said:
- Did it work? Which session or step failed, if any?
- If not, what fixed it (piano off/on, Disconnect then Connect, USB out/in, other)?

```

```

## F: Saved piano

1. On Settings → MIDI Test press Connect, choose the piano by name (not "All devices"), then reload the page.
2. Do **Connect first**, then press Start.
3. Plug the USB into a different port (or the other side of the hub), reload, do **Connect first**, press Start.
4. Switch the piano off and on, reload, do **Connect first**, press Start.

- What the screen said:
- Did it work? Which step failed, if any?
- If not, what fixed it (piano off/on, Disconnect then Connect, USB out/in, other)?

```

```

## G: Start with no MIDI Test first (the known failure)

1. Piano on and plugged in. Load the app, go to Sight-Read and press Start.
2. Note what the screen says. Press Start again 2 or 3 times, a few seconds apart.
3. Go to Settings → MIDI Test, press Connect, go back to Sight-Read and press Start.

- What the screen said:
- Did it work? Which attempt, if any, worked?
- If not, what fixed it (piano off/on, Disconnect then Connect, USB out/in, other)?

```

```

## Extra runs

Copy any block above and change the steps.
