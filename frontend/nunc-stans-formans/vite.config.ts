import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Dev proxies point at the gate (:8720) — run `just up` in another terminal.
// The browser path is identical in dev and production: one origin for the
// engine routes, the fourfive mount, and the staged world dashboard.
const gatePort = process.env.NS_PORT ?? '8720'
const gate = { target: `http://localhost:${gatePort}`, changeOrigin: true }

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/self': gate,
      '/health': gate,
      '/fourfive': gate,
      '/world-graph': gate,
    },
  },
})
