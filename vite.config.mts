/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

/**
 * The API trusts only http://localhost:5173 (CORS, Sanctum) and the session cookie is
 * shared only between same-host pages, so a page opened on 127.0.0.1 cannot log in.
 * In development, send 127.0.0.1 visitors to the same page on localhost.
 */
function redirectLoopbackIpToLocalhost (): Plugin {
  return {
    name: 'askmydocs:redirect-127-to-localhost',
    apply: 'serve',
    configureServer (server) {
      server.middlewares.use((req, res, next) => {
        const host = req.headers.host ?? ''
        if (!host.startsWith('127.0.0.1')) {
          return next()
        }
        res.statusCode = 307
        res.setHeader('Location', `http://${host.replace('127.0.0.1', 'localhost')}${req.url ?? '/'}`)
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    redirectLoopbackIpToLocalhost(),
    Vue({
      template: { transformAssetUrls },
    }),
    // Imports only the Vuetify components that are actually used (smaller bundle).
    Vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
  },
  server: {
    port: 5173,
    // Fail instead of silently moving to 5174: the API only accepts this origin
    // (CORS + Sanctum stateful domain), so another port would break authentication.
    strictPort: true,
    // In Docker on Windows, file-change events from the mounted source folder do not
    // reach the container, so the dev server polls instead (set in compose.yaml).
    watch: process.env.VITE_DEV_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: 'jsdom',
    // Fixed values so tests never depend on a developer's local .env files.
    env: {
      VITE_API_BASE_URL: 'https://api.test',
    },
    // Vuetify components import their own CSS; let Vite process it in component tests.
    server: { deps: { inline: ['vuetify'] } },
    setupFiles: ['src/__tests__/setup.ts'],
    // Page tests load many Vuetify components the first time; in Docker on Windows
    // (polled file system, parallel workers) that can take longer than the 5 s default.
    testTimeout: 15_000,
  },
})
