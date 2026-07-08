import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The generic UI shell (contract §6): ONE build serves every generated app —
// the page is served at /apps/<slug>/ and reads its manifest at runtime, so
// base is relative and nothing app-specific is baked in.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [vue()],
  build: { outDir: 'dist', emptyOutDir: true },
})
