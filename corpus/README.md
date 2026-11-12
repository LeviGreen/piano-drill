# Recorded corpus

Real recordings for the benchmark (`npm run bench`, PD-306). Audio files are **not** committed (they are
large; `corpus/recorded/*.wav` is gitignored), but the `.json` label files are.

## Adding clips

1. Run the app (`npm run dev`), open **Settings > Corpus recorder**.
2. Fill in what you will play, start the mic, press **Record**, play, press **Stop**.
3. Press **Save take**. This downloads `<id>.wav` and `<id>.json`.
4. Move both files into `corpus/recorded/`.
5. `npm run bench` now includes them in the "Recorded corpus" section of `bench/report.md`.

Each `.json` is one entry:

```json
{
  "id": "triad-C4E4G4-1",
  "file": "triad-C4E4G4-1.wav",
  "source": "acoustic",
  "category": "triad",
  "played": ["C4", "E4", "G4"],
  "expected": ["C4", "E4", "G4"],
  "room": "living room",
  "device": "MacBook Pro mic",
  "position": "on the music stand"
}
```

- `played`: what you actually played (empty for silence / noise).
- `expected`: what the app was told to expect. For negative cases (wrong note, extra note) these differ.
- `category`: `single`, `interval`, `triad`, `two-hand`, `wrong-note`, `extra-note`, `silence`, `room-noise`, `transient`.
- `source`: `acoustic` or `digital-speaker`.
- Optional `onsetSec` if you know the true onset time.

Play the note about one second after pressing Record, and leave about a second of room tone before and after.

## Recording a whole range in one take (sequences)

To save time, play several single notes one after another in one take, with a rest of **at least 3 seconds**
(4 to 5 is comfortable) between notes. In the recorder set Category to `single` and list the notes in the order
you will play them, separated by spaces: `G2 B2 D3 F#3`. For intervals, triads and chords, join the notes of each step with `+` (`C4+E4 D3+A3`) and set Category to what they are (`interval`, `triad`, `two-hand`). Add a remark after `@` to a step, e.g. `C4@soft` or
`C4@loud` (it goes into that clip's `position`). Save the take and move the files into `corpus/recorded/` as usual.

Then run `npm run corpus:split`. It finds where each note starts, cuts one clip per note (`<id>-<n>-<note>.wav` and
`.json`, with the true onset time filled in), and moves the original into `corpus/recorded/sequences/` so the
benchmark doesn't count it twice. If it finds a different number of notes than the label lists, or two notes too
close together, it changes nothing and says where it found notes.
