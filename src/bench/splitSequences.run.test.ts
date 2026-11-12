/// <reference types="node" />
/**
 * `npm run corpus:split`: cuts every recorded "sequence" take in corpus/recorded/ into one clip per note.
 *
 * A sequence take lists several steps in the order played, with rests of at least 3 s: a `single` take with several
 * notes, or any take whose steps join notes with `+` (an interval take is `C4+E4 D3+A3 ...`). Each note becomes its own clip (`<id>-<n>-<note>.wav/.json`) and the original goes to
 * corpus/recorded/sequences/, out of the benchmark. If the notes found don't match the label nothing is changed.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeWav, encodeWav } from '../audio/wav'
import type { ManifestEntry } from './corpus'
import { isSequence, onsetTimes, parseSequenceToken, planSegments } from './splitSequence'

const DIR = join(process.cwd(), 'corpus', 'recorded')

describe('split recorded sequences', () => {
  it('cuts each sequence take into one clip per note', () => {
    if (!existsSync(DIR)) return
    const problems: string[] = []
    const done: string[] = []
    for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
      const entry = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as ManifestEntry
      if (!isSequence(entry.category, entry.played)) continue
      const tokens = entry.played.map((p) => parseSequenceToken(String(p)))
      const wav = decodeWav(new Uint8Array(readFileSync(join(DIR, entry.file))))
      const plan = planSegments(
        onsetTimes(wav.samples, wav.sampleRate),
        tokens.length,
        wav.samples.length / wav.sampleRate,
      )
      if (!plan.ok) {
        problems.push(`${entry.id}: ${plan.error}`)
        continue
      }
      if (plan.ignored.length > 0)
        console.log(
          `${entry.id}: ignored ${plan.ignored.length} extra sound(s) after the last note, at ${plan.ignored.map((t) => `${t.toFixed(1)} s`).join(', ')}`,
        )
      plan.segments.forEach((seg, i) => {
        const note = tokens[i]
        const id = `${entry.id}-${i + 1}-${note.names.join('').replaceAll('#', 's')}`
        const part = wav.samples.slice(
          Math.round(seg.startSec * wav.sampleRate),
          Math.round(seg.endSec * wav.sampleRate),
        )
        writeFileSync(join(DIR, `${id}.wav`), encodeWav(part, wav.sampleRate))
        const clip: ManifestEntry = {
          ...entry,
          id,
          file: `${id}.wav`,
          category: entry.category,
          played: note.names,
          expected: note.names,
          onsetSec: seg.onsetSec - seg.startSec,
          position: [entry.position, note.remark].filter(Boolean).join('; ') || undefined,
        }
        writeFileSync(join(DIR, `${id}.json`), JSON.stringify(clip, null, 2) + '\n')
      })
      mkdirSync(join(DIR, 'sequences'), { recursive: true })
      renameSync(join(DIR, entry.file), join(DIR, 'sequences', entry.file))
      renameSync(join(DIR, file), join(DIR, 'sequences', file))
      done.push(`${entry.id}: ${tokens.length} clips`)
    }
    console.log(done.length ? `Split:\n  ${done.join('\n  ')}` : 'No sequence takes to split.')
    expect(problems, problems.join('\n')).toEqual([])
  })
})
