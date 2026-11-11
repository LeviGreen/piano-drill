export type KeyGeom = { midi: number; black: boolean; x: number; width: number; height: number }

export const WHITE_W = 14
export const WHITE_H = 64
export const BLACK_W = 9
export const BLACK_H = 40

const BLACK_PCS = new Set([1, 3, 6, 8, 10])
export const isBlackKey = (midi: number): boolean => BLACK_PCS.has(((midi % 12) + 12) % 12)

/**
 * Geometry of a piano keyboard from `low` to `high` (MIDI numbers, both white keys). White keys come first
 * (left to right), then black keys, which straddle the boundary between their two neighbouring white keys.
 */
export function keyboardLayout(low: number, high: number): { keys: KeyGeom[]; width: number } {
  if (isBlackKey(low) || isBlackKey(high))
    throw new RangeError('keyboard range must start and end on white keys')
  if (high < low) throw new RangeError('keyboard range is empty')
  const whites: KeyGeom[] = []
  const blacks: KeyGeom[] = []
  let x = 0
  for (let midi = low; midi <= high; midi++) {
    if (!isBlackKey(midi)) {
      whites.push({ midi, black: false, x, width: WHITE_W, height: WHITE_H })
      x += WHITE_W
    } else {
      blacks.push({ midi, black: true, x: x - BLACK_W / 2, width: BLACK_W, height: BLACK_H })
    }
  }
  return { keys: [...whites, ...blacks], width: x }
}
