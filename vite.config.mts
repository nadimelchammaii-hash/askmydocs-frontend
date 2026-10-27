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
    port: 3000,
    // Fail instead of silently moving to 3001: the API only accepts this origin
    // (CORS + Sanctum stateful domain), so another port would break authentication.
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    // Fixed values so tests never depend on a developer's local .env files.
    env: {
      VITE_API_BASE_URL: 'https://api.test',
    },
  },
})
