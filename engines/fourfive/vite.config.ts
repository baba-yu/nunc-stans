import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Mounted at /fourfive/ on the single origin (the gate). Standalone dev
// serves under the same base; its proxy rewrites the mount prefix away so
// the browser path stays identical in both worlds (no CORS either way).
export default defineConfig({
  plugins: [vue()],
  base: '/fourfive/',
  server: {
    port: 5173,
    proxy: {
      '/fourfive/api': {
        target: `http://localhost:${process.env.PORT ?? 8787}`,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/fourfive/, ''),
      },
    },
  },
})
