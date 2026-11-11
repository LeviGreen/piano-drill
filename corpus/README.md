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
