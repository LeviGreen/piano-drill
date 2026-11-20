# IM-404: MIDI connection spike — conclusion

**Question:** why is connecting the piano (a Yamaha MM8 on a Mac, in Chrome) not reliable, and can the app make it better?

**Answer:** the unreliable part is **below the app**, in the piano's USB session with macOS (its driver) or Chrome's own MIDI service. The app's port handling is not the cause, and closing and reopening a port from the app does not help. The app can make failures clearer but cannot remove them. The raw logs are in [midi-logs.md](midi-logs.md).

## What was seen

- **Cold start:** after a USB unplug, switching the piano off, or quitting Chrome, the first connection is flaky. The app sees a piano that is `connected`, with the port `open` and the app listening, but no notes arrive. The MIDI Test keyboard never lights up.
- **What clears it:** only a physical re-enumeration, in practice replugging the USB at the keyboard end, and even then not always on the first try. Both logged runs worked after the third replug (a rule about the count was not confirmed, and the second run's log showed only two reconnects).
- **Warm:** once it works, it stays working through reloads, navigating the app, and Disconnect/Connect on the MIDI Test page, which then responds at once.
- **Chrome's first request after starting Chrome is slow:** about 3.8 s from `requestMIDIAccess` to access granted, against 15 to 20 ms afterwards in the same page.

## What was ruled out

- **A saved piano id that no longer matches.** The port id stayed `-1144519317` through every replug and power-cycle.
- **Reconnect loops.** Each browser state change led to exactly one rescan.
- **A port that only needs closing and reopening.** An experimental button that closed every input port and opened it again, run while the piano was silent, did not help (and did nothing to a working connection). So the app's own opening of the port is not what is wrong.
- **Many MIDI requests leaving ports half-open.** Repeated Connect/Disconnect in the same page (run B) did not break a working connection, and did not fix a silent one.

## What was not tested

- Whether another program (a MIDI monitor app, a different web MIDI page) fails the same way in the cold state. This would settle piano or driver against Chrome.
- Whether the drill's one-shot "is a piano there?" check on Start fails when the piano appears late (run G was not done). This is a real gap in the app, but it is not what makes the cold start flaky.
- Whether a newer or reinstalled Yamaha driver, a direct cable, or a different USB port changes anything.

## Outside evidence

A web search found no report matching this exact symptom for the MM8 or for Chrome on macOS. Related reports point the same way: Yamaha's older Mac driver needing the right version, with reinstalling or replugging as the usual workaround, and vendors advising a direct cable with no hub. Sources: [Yamaha forum](https://yamahasynth.com/community/modx-series-synthesizers/modx-not-sending-midi-over-usb-to-macbook-air), [Apple Discussions](https://discussions.apple.com/thread/255417926), [Novation](https://support.novationmusic.com/hc/en-gb/articles/206862119), and, for browsers, [Mozilla bug 1802149](https://bugzilla.mozilla.org/show_bug.cgi?id=1802149) (Firefox: the device list not refreshing without a full restart).

## What the app can do

Not a fix, but better words and less giving up:

- Say what to try when a piano is listed but silent (for example, "unplug the USB at the piano end and plug it back in").
- Wait a short time for the piano on Start before saying none was found, and keep listening.
- Point to the driver and cable advice in [midi.md](midi.md).

These are not ticketed. The connection strip planned in IM-402 is the natural place for the messages if they are wanted.

## What the owner can do

- Check Audio MIDI Setup → MIDI Studio while it is failing, to see whether macOS lists the piano.
- Install or reinstall Yamaha's USB-MIDI driver for the macOS version in use.
- Connect directly (no hub), with a data-capable cable.

## Cleanup

The temporary logging, the message counters and the "Reset port" experiment were removed from the code. Nothing of the spike remains in `src/`.
