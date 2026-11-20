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
// not working
40012 ms  stop()  {"ports":[]}
41045 ms  start()  {"status":"idle","selected":null}
41046 ms  requestMIDIAccess…
44852 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
44852 ms  rescan  {"selected":null,"listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
44853 ms  select()  {"id":"-1144519317"}
44853 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
44853 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
44853 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}

//worked after un/replugging USB from computer (nothing), then turning off/on (nothing) then un/replugging USB from keyboard, THEN it worked

40012 ms  stop()  {"ports":[]}
41045 ms  start()  {"status":"idle","selected":null}
41046 ms  requestMIDIAccess…
44852 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
44852 ms  rescan  {"selected":null,"listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
44853 ms  select()  {"id":"-1144519317"}
44853 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
44853 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
44853 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
171342 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
171863 ms  start()  {"status":"idle","selected":"-1144519317"}
171863 ms  requestMIDIAccess…
171880 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
171881 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
171881 ms  select()  {"id":"-1144519317"}
171881 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
171881 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
171881 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
179254 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"disconnected","connection":"pending"}
179254 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
179270 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"disconnected","connection":"closed"}
179270 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
180805 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
180805 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
180806 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"connected","connection":"closed"}
180806 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
191287 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"disconnected","connection":"pending"}
191287 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
191304 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"disconnected","connection":"closed"}
191304 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
198214 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
198214 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
198214 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"connected","connection":"closed"}
198215 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
205111 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"disconnected","connection":"pending"}
205112 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
205129 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"disconnected","connection":"closed"}
205129 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
206663 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
206664 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
206664 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"connected","connection":"closed"}
206664 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
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
// It did not work after hitting connect/disconnect/connect many times
2645 ms  stop()  {"ports":[]}
36767 ms  start()  {"status":"idle","selected":null}
36767 ms  requestMIDIAccess…
40550 ms  access granted; ports at that moment  []
40550 ms  rescan  {"selected":null,"listening":[],"ports":[]}
40550 ms  select()  {"id":"-1144519317"}
40550 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
42546 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"closed"}
42546 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
42546 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
42546 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
42564 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"connected","connection":"closed"}
42564 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
67112 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
67651 ms  start()  {"status":"idle","selected":"-1144519317"}
67652 ms  requestMIDIAccess…
67670 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
67670 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
67670 ms  select()  {"id":"-1144519317"}
67670 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
67670 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
67670 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
70507 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
71082 ms  start()  {"status":"idle","selected":"-1144519317"}
71082 ms  requestMIDIAccess…
71097 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
71097 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
71097 ms  select()  {"id":"-1144519317"}
71097 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
71097 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
71098 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
75143 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
76153 ms  start()  {"status":"idle","selected":"-1144519317"}
76153 ms  requestMIDIAccess…
76170 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
76170 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
76170 ms  select()  {"id":"-1144519317"}
76170 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
76170 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
76170 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
80862 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
81486 ms  start()  {"status":"idle","selected":"-1144519317"}
81487 ms  requestMIDIAccess…
81501 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
81501 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
81501 ms  select()  {"id":"-1144519317"}
81501 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
81501 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
81502 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}

//un/replugged the USB three times
2645 ms  stop()  {"ports":[]}
36767 ms  start()  {"status":"idle","selected":null}
36767 ms  requestMIDIAccess…
40550 ms  access granted; ports at that moment  []
40550 ms  rescan  {"selected":null,"listening":[],"ports":[]}
40550 ms  select()  {"id":"-1144519317"}
40550 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
42546 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"closed"}
42546 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
42546 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
42546 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
42564 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"connected","connection":"closed"}
42564 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
67112 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
67651 ms  start()  {"status":"idle","selected":"-1144519317"}
67652 ms  requestMIDIAccess…
67670 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
67670 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
67670 ms  select()  {"id":"-1144519317"}
67670 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
67670 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
67670 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
70507 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
71082 ms  start()  {"status":"idle","selected":"-1144519317"}
71082 ms  requestMIDIAccess…
71097 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
71097 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
71097 ms  select()  {"id":"-1144519317"}
71097 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
71097 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
71098 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
75143 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
76153 ms  start()  {"status":"idle","selected":"-1144519317"}
76153 ms  requestMIDIAccess…
76170 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
76170 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
76170 ms  select()  {"id":"-1144519317"}
76170 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
76170 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
76170 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
80862 ms  stop()  {"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
81486 ms  start()  {"status":"idle","selected":"-1144519317"}
81487 ms  requestMIDIAccess…
81501 ms  access granted; ports at that moment  [{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]
81501 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
81501 ms  select()  {"id":"-1144519317"}
81501 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"closed"}]}
81501 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
81502 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
132131 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"disconnected","connection":"pending"}
132131 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
132147 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"disconnected","connection":"closed"}
132147 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
133425 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
133426 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
133426 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"connected","connection":"closed"}
133426 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
138788 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"disconnected","connection":"pending"}
138788 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
138803 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"disconnected","connection":"closed"}
138803 ms  rescan  {"selected":"-1144519317","listening":[],"ports":[]}
140087 ms  statechange  {"id":"-1144519317","name":"MM8 Port1","type":"input","state":"connected","connection":"open"}
140087 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
140087 ms  statechange  {"id":"-1418849052","name":"MM8 Port1","type":"output","state":"connected","connection":"closed"}
140087 ms  rescan  {"selected":"-1144519317","listening":["-1144519317"],"ports":[{"id":"-1144519317","name":"MM8 Port1","state":"connected","connection":"open"}]}
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
