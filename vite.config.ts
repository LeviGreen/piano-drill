import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative asset paths, so the build works under the GitHub Pages repo subpath (PD-004).
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-utils/setup.ts'],
    // The corpus benchmark has its own command: `npm run bench`.
    exclude: [...configDefaults.exclude, 'src/bench/**/*.run.test.ts'],
  },
})
