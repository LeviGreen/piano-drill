import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative asset paths, so the build works under the GitHub Pages repo subpath (PD-004).
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // VexFlow (with its music font) is most of the app's size; keep it in its own, cacheable file that only the
        // drill screens load.
        manualChunks: (id: string) => (id.includes('node_modules/vexflow') ? 'vexflow' : undefined),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-utils/setup.ts'],
  },
})
