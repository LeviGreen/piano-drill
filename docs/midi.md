# MIDI input (PD-313)

The MVP takes its notes from a **digital piano connected to the computer**, read with the browser's Web MIDI API.
Unlike the microphone, nothing has to be listened for: a key going down is a message with the exact note, so the
notes and their timing are exact.

## What works where

| Browser | Works? |
|---|---|
| Chrome, Edge, Opera (computer) | Yes |
| Firefox (computer) | Not by default; it needs an add-on to allow MIDI |
| Safari (Mac, iPhone, iPad) | No: Safari does not support Web MIDI |
| Any browser on an iPhone or iPad | No (they all use Safari's engine) |
| Chrome on Android | Yes, with a USB or Bluetooth keyboard |

The page must be on `localhost` or HTTPS, which it is when running the dev server or from GitHub Pages. The browser asks
once for permission to use MIDI devices; if you say no, you can allow it in the site settings.

## Connecting a piano

1. Plug the piano into the computer with USB (most digital pianos have a USB "to host" port), or pair it by Bluetooth
   MIDI.
2. Open Settings → MIDI test and press **Connect**. Allow MIDI access if the browser asks.
3. The piano appears under "Piano". "All devices" listens to every MIDI device; choosing one listens only to that one,
   and the choice is remembered.
4. Play. The keys light up on the on-screen keyboard and each note appears in the table.

## What the app does with the messages

- A note-on with a velocity above 0 is a note played; it carries a timestamp on the same clock as `performance.now()`,
  which is the clock the drill timer uses, so a reaction time is exact.
- A note-off, or a note-on with velocity 0, releases the note.
- The sustain pedal and every other control (volume, pitch bend, and so on) is ignored. A key released while the
  pedal is down still counts as released.
- The two "all notes off" messages release everything, to clear a stuck note.
- Any MIDI channel works.
- Plugging a piano in or out while the app is open is handled: the list follows, and keys held on a piano that goes
  away are released.

## Troubleshooting

- *"Can't read MIDI"*: use Chrome, Edge or Opera on a computer.
- *"MIDI access was blocked"*: click the lock icon next to the address, allow MIDI devices, then press Connect again.
- *"No MIDI device was found"*: check the cable and that the piano is switched on. Some pianos need "USB MIDI" turned
  on in their settings. Another program that has the piano open (some music software) can stop the browser from using it.
- *Notes show on the MIDI test page but not in a drill*: open the Play or Key ID settings and set **Input** to "MIDI piano" (the on-screen piano is the default). The piano is connected when you press Start; if it says no piano was found, plug it in and press Start again.
- *The drill paused by itself*: the piano was disconnected (a loose cable, or it went to sleep). Plug it back in and press Resume.

## A piano that needs a driver

Most digital pianos are "class compliant": plug in, and the computer sees a MIDI device with nothing to install. Some older Yamaha instruments are not. The Yamaha MM8 was seen by macOS as a USB device but never appeared as a MIDI device (not in Audio MIDI Setup's MIDI Studio, so the browser's list was empty) until Yamaha's **USB-MIDI Driver** for Mac was installed. If a piano shows in System Information → USB but not in MIDI Studio, look for the maker's USB-MIDI driver for it.
