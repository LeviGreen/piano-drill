import { it } from 'vitest'
import {
  enharmonicKey,
  keyName,
  keySignature as k,
  relativeMinor,
  scale,
  signaturePlacement,
} from './keys'
import { validateTarget } from './constraints'
import { formatPitch as f, parsePitch } from './pitch'
import type { Hand, Target } from './target'

const SPOT = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  .SPOT

// Hand spot-check, skipped in normal runs. Run with: SPOT=1 npx vitest run src/theory/spotcheck.test.ts
it.skipIf(!SPOT)('prints key examples for eyeballing', () => {
  const lines = [
    scale(k(-3, 'major')).map(f).join(' '),
    scale(k(6, 'major')).map(f).join(' '),
    scale(k(5, 'minor'), 4, 'harmonic').map(f).join(' '),
    signaturePlacement(k(-4, 'major'), 'treble').map(f).join(' '),
    signaturePlacement(k(3, 'major'), 'bass').map(f).join(' '),
    `${keyName(relativeMinor(k(-3, 'major')))} | ${keyName(enharmonicKey(k(5, 'major'))!)}`,
  ]
  console.log('\nSPOT\n' + lines.join('\n') + '\nENDSPOT')
})

const part = (hand: Hand, clef: 'treble' | 'bass', ...names: string[]) => ({
  hand,
  clef,
  pitches: names.map(parsePitch),
})
const check = (label: string, ...parts: ReturnType<typeof part>[]) => {
  const target: Target = { id: 'x', key: k(0, 'major'), parts, content: { type: 'triad' } }
  const r = validateTarget(target)
  return `${label}: ${r.ok ? 'PASS' : 'FAIL ' + r.reasons.map((x) => x.code).join(', ')}`
}

it.skipIf(!SPOT)('prints constraint examples for eyeballing', () => {
  const lines = [
    check('C major triad, RH treble', part('RH', 'treble', 'C4', 'E4', 'G4')),
    check('C4 up to E5 (a 10th), RH', part('RH', 'treble', 'C4', 'E5')),
    check('F3 in treble clef (3 ledger lines)', part('RH', 'treble', 'F3')),
    check('C2 + E2, LH bass (low third)', part('LH', 'bass', 'C2', 'E2')),
    check('LH C3, RH E4 G4 C5', part('LH', 'bass', 'C3'), part('RH', 'treble', 'E4', 'G4', 'C5')),
    check(
      'LH C4, RH B3 D4 (hands cross)',
      part('LH', 'bass', 'C4'),
      part('RH', 'treble', 'B3', 'D4'),
    ),
    check('6 notes in one hand', part('RH', 'treble', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4')),
  ]
  console.log('\nSPOT2\n' + lines.join('\n') + '\nENDSPOT2')
})
