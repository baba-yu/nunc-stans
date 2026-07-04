import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The dev server proxies the engine's routes so the browser always talks to a
// single origin (the nuncstans-engine binds 127.0.0.1 and offers no CORS).
// Mirror of fourfive's /api proxy. In production the built dist/ is served by
// the engine itself, so no proxy is involved.
const enginePort = process.env.NS_PORT ?? '8720'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/self': { target: `http://localhost:${enginePort}`, changeOrigin: true },
      '/health': { target: `http://localhost:${enginePort}`, changeOrigin: true },
    },
  },
})
