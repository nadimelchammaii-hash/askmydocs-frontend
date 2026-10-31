/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineConfig({
  plugins: [
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
  },
})
