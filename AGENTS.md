# Project Rules

## General
- Follow the existing code style and patterns (ESLint: `eslint-config-vuetify`).
- Use npm for running project commands.
- Keep code in TypeScript.

## Stack
- Framework: Vue 3 + Vite
- UI Library: Vuetify 4 (full component library, auto-imported by `vite-plugin-vuetify`)
- State: Pinia
- HTTP: axios (single instance in `src/api/http.ts`)
- Routing: Vue Router
- Tests: Vitest (+ @vue/test-utils, jsdom)

## Architecture
- This SPA talks to the separate **askmydocs-backend** repository. The API contract is `askmydocs-backend/docs/api.md`; `src/types/api.ts` mirrors it.
- Authentication: Laravel Sanctum SPA cookie mode. Never store tokens or user data in `localStorage`.
- All requests go through `src/api/http.ts`; errors reach the app as `ApiError` (branch on `code`).

## UI restriction
- The visual design comes from approved Google Stitch designs. Do not create screens, layouts, themes,
  colors, typography or placeholder pages until a design is provided and approved.
