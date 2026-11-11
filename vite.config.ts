import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // The corpus benchmark has its own command: `npm run bench`.
    exclude: [...configDefaults.exclude, 'src/bench/**/*.run.test.ts'],
  },
})
