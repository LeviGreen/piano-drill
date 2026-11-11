/// <reference types="node" />
/**
 * Benchmark harness (PD-306). Run with `npm run bench`; it is excluded from `npm test`.
 *
 * Runs the audio analysis over the synthetic corpus (generated on the fly) plus any recorded clips in
 * corpus/recorded/, writes bench/report.md + bench/report.json, and fails if a synthetic-corpus metric
 * regresses past bench/baseline.json. `npm run bench:update` rewrites the baseline.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SpectralAnalyzer } from '../audio/dsp/SpectralAnalyzer'
import { decodeWav } from '../audio/wav'
import { parsePitch } from '../theory/pitch'
import { shouldAccept, syntheticCorpus, type Clip, type ManifestEntry } from './corpus'
import { byCategory, flatten, regressions, summarize, type ClipResult } from './metrics'
import { naiveDetectNotes } from './naiveVerifier'

const ROOT = process.cwd()
const toMidi = (n: string | number) => (typeof n === 'number' ? n : parsePitch(n).midi)

/** Every corpus/recorded/*.json is one ManifestEntry (written by the in-app recorder). */
function loadRecorded(): Clip[] {
  const dir = join(ROOT, 'corpus', 'recorded')
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ManifestEntry)
  return entries
    .filter((e) => existsSync(join(dir, e.file)))
    .map((e) => {
      const wav = decodeWav(new Uint8Array(readFileSync(join(dir, e.file))))
      return {
        id: e.id,
        category: e.category,
        source: e.source,
        sampleRate: wav.sampleRate,
        samples: wav.samples,
        played: e.played.map(toMidi),
        expected: e.expected.map(toMidi),
        onsetSec: e.onsetSec,
        condition: [e.room, e.device, e.position].filter(Boolean).join(' / '),
      }
    })
}

function runClip(clip: Clip): ClipResult {
  const analyzer = new SpectralAnalyzer({ sampleRate: clip.sampleRate, spectra: false })
  const onsets: { sample: number; timeSec: number; reportedAt: number }[] = []
  for (let i = 0; i < clip.samples.length; i += 512) {
    for (const f of analyzer.push(clip.samples.subarray(i, i + 512), i)) {
      for (const o of f.onsets)
        onsets.push({ sample: o.sample, timeSec: o.timeSec, reportedAt: f.endSample })
    }
  }
  const first = onsets[0]
  const detected = first ? naiveDetectNotes(clip.samples, clip.sampleRate, first.timeSec) : []
  const accepted =
    detected.length === clip.expected.length && detected.every((n) => clip.expected.includes(n))
  return {
    id: clip.id,
    category: clip.category,
    source: clip.source,
    played: clip.played,
    expected: clip.expected,
    detected,
    accepted,
    shouldAccept: shouldAccept(clip),
    onsetsFound: onsets.length,
    onsetErrorMs:
      first && clip.onsetSec !== undefined ? (first.timeSec - clip.onsetSec) * 1000 : undefined,
    detectionLatencyMs: first
      ? ((first.reportedAt - first.sample) / clip.sampleRate) * 1000
      : undefined,
  }
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const ms = (x: number) => `${x.toFixed(1)} ms`

function section(title: string, results: ClipResult[]): string {
  if (results.length === 0) return `## ${title}\n\nNo clips.\n`
  const s = summarize(results)
  const cats = byCategory(results)
  return `## ${title} (${s.clips} clips)

| Metric | Value |
|---|---|
| Correct-accept rate (target played, verifier accepts) | ${pct(s.verification.correctAcceptRate)} (${s.verification.positives} clips) |
| False-accept rate (wrong/extra/nothing played, verifier accepts) | ${pct(s.verification.falseAcceptRate)} (${s.verification.negatives} clips) |
| Note precision | ${pct(s.notes.precision)} |
| Note recall | ${pct(s.notes.recall)} |
| Octave-error rate (played notes heard only in another octave) | ${pct(s.notes.octaveErrorRate)} |
| Onset error, mean / 95th percentile (absolute) | ${ms(s.onsets.meanAbsErrorMs)} / ${ms(s.onsets.p95AbsErrorMs)} |
| Onset miss rate (note played, no onset) | ${pct(s.onsets.missRate)} |
| False onsets per silent/noise clip | ${s.onsets.falseOnsetsPerNoiseClip.toFixed(2)} |
| Detection latency, mean / 95th percentile | ${ms(s.latency.meanMs)} / ${ms(s.latency.p95Ms)} |

| Category | Clips | Accepted by verifier |
|---|---|---|
${Object.entries(cats)
  .map(([c, v]) => `| ${c} | ${v.clips} | ${v.accepted} |`)
  .join('\n')}
`
}

describe('benchmark', () => {
  it('runs the corpus, writes a report and checks for regressions', { timeout: 600_000 }, () => {
    const synthetic = syntheticCorpus().map(runClip)
    const recorded = loadRecorded().map(runClip)

    const summary = summarize(synthetic)
    const report = `# Benchmark report

Verifier: **naive baseline** (PD-306). PD-307 replaces it with the target-aware verifier.
Regression gate: synthetic corpus only (deterministic). Recorded clips are informational.

${section('Synthetic corpus', synthetic)}
${section('Recorded corpus', recorded)}
### Clips the baseline got wrong

${
  [...synthetic, ...recorded]
    .filter((r) => r.accepted !== r.shouldAccept)
    .map((r) => `- ${r.id}: played [${r.played}] expected [${r.expected}] heard [${r.detected}]`)
    .join('\n') || 'None.'
}
`
    mkdirSync(join(ROOT, 'bench'), { recursive: true })
    writeFileSync(join(ROOT, 'bench', 'report.md'), report)
    writeFileSync(
      join(ROOT, 'bench', 'report.json'),
      JSON.stringify(
        { synthetic: summary, recorded: summarize(recorded), results: [...synthetic, ...recorded] },
        null,
        2,
      ),
    )

    const baselinePath = join(ROOT, 'bench', 'baseline.json')
    if (process.env.BENCH_UPDATE || !existsSync(baselinePath)) {
      writeFileSync(baselinePath, JSON.stringify(flatten(summary), null, 2) + '\n')
      return
    }
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<string, number>
    expect(regressions(flatten(summary), baseline)).toEqual([])
  })
})
