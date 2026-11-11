/** Minimal WAV support for the test corpus: write 16-bit mono PCM, read 16/24-bit PCM and 32-bit float. */

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2
  const out = new Uint8Array(44 + dataBytes)
  const v = new DataView(out.buffer)
  const tag = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i)
  }
  tag(0, 'RIFF')
  v.setUint32(4, 36 + dataBytes, true)
  tag(8, 'WAVE')
  tag(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  tag(36, 'data')
  v.setUint32(40, dataBytes, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(44 + i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true)
  }
  return out
}

export function decodeWav(bytes: Uint8Array): { sampleRate: number; samples: Float32Array } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (o: number) =>
    String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new SyntaxError('Not a WAV file')
  let format = 0
  let channels = 1
  let sampleRate = 0
  let bits = 16
  let dataStart = -1
  let dataLength = 0
  for (let o = 12; o + 8 <= bytes.byteLength;) {
    const id = tag(o)
    const size = v.getUint32(o + 4, true)
    if (id === 'fmt ') {
      format = v.getUint16(o + 8, true)
      channels = v.getUint16(o + 10, true)
      sampleRate = v.getUint32(o + 12, true)
      bits = v.getUint16(o + 22, true)
    } else if (id === 'data') {
      dataStart = o + 8
      dataLength = Math.min(size, bytes.byteLength - dataStart)
      break
    }
    o += 8 + size + (size % 2)
  }
  if (dataStart < 0 || !sampleRate) throw new SyntaxError('WAV is missing its fmt or data chunk')
  const bytesPer = bits / 8
  const frames = Math.floor(dataLength / (bytesPer * channels))
  const out = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) {
      const p = dataStart + (i * channels + c) * bytesPer
      if (format === 3 && bits === 32) sum += v.getFloat32(p, true)
      else if (format === 1 && bits === 16) sum += v.getInt16(p, true) / 32768
      else if (format === 1 && bits === 24)
        sum += (v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) / 8388608
      else throw new SyntaxError(`Unsupported WAV format ${format}/${bits}-bit`)
    }
    out[i] = sum / channels // downmix to mono
  }
  return { sampleRate, samples: out }
}
