import { defineConfig } from 'vitest/config'

// `npm run bench`: the corpus benchmark (PD-306). Kept out of the normal `npm test`.
export default defineConfig({
  test: { include: ['src/bench/**/*.run.test.ts'], environment: 'node' },
})
