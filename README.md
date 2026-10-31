# AskMyDocs — Frontend

Vue single-page application for AskMyDocs: upload PDF documents and ask questions about them, with answers cited by page.

The API is a separate application in its own repository: **askmydocs-backend** (Laravel). Its contract is documented in `askmydocs-backend/docs/api.md`.

> Status: Phase 1 — non-visual foundation (API client, auth store, route guards). Screens are implemented from the approved Google Stitch design in Phase 6.

## Stack

| Concern | Choice |
|---|---|
| Framework | Vue 3 + TypeScript + Vite |
| UI | Vuetify 4 |
| State | Pinia |
| Routing | Vue Router |
| HTTP | axios |
| Tests | Vitest, @vue/test-utils, jsdom |
| Lint | ESLint (`eslint-config-vuetify`) |

## Local development (Windows)

Runs natively with Node.js (v22+). The backend API must be running on `http://localhost:8000` (see the backend README).

```powershell
npm install
copy .env.example .env.local      # then adjust if needed
npm run dev                       # http://localhost:3000
```

### Port

The dev server uses port **3000** with `strictPort`: if 3000 is taken, Vite stops with an error instead of switching to another port. This is deliberate — the API only accepts requests from `http://localhost:3000` (CORS and Sanctum), so a different port would break login.

Check the port before starting:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue   # no output = free
```

To use another port, change `server.port` in `vite.config.mts` **and** `FRONTEND_URL` / `SANCTUM_STATEFUL_DOMAINS` in the backend `.env`.

Always open the app at `http://localhost:3000` (not `127.0.0.1`): the session cookie is only shared when the SPA and API use the same host name.

### Environment

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL |

`.env.local` is not committed. Everything prefixed with `VITE_` is bundled into the public JavaScript, so never put secrets in these files.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Run unit tests once (`npm run test:watch` to watch) |
| `npm run type-check` | TypeScript check (app, tests, config) |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run build` | Type-check and production build to `dist/` |

## Structure

```
src/
  api/          http.ts (axios instance, CSRF retry, error normalisation), auth.ts, documents.ts and conversations.ts (endpoints), errors.ts (ApiError)
  composables/  usePolling (non-overlapping polling with backoff), useDocumentProcessing (polls a document until ready/failed), useAnswer (polls an answer until completed/failed)
  types/        api.ts — types mirroring the backend API contract
  stores/       auth.ts — current user (Pinia)
  router/       index.ts, guards.ts — route protection (meta.requiresAuth / meta.guestOnly)
  plugins/      Vuetify, Pinia, router registration
```

### Authentication flow

The API uses Laravel Sanctum **session cookies** (HttpOnly; JavaScript never sees them). The client:

1. requests `GET /sanctum/csrf-cookie` before login/register,
2. sends every request with credentials and the `X-XSRF-TOKEN` header (configured in `src/api/http.ts`),
3. on `419` fetches a new CSRF cookie and retries once,
4. on `401` clears the local user (session expired).

On startup, the route guard asks the API who is logged in (`GET /api/v1/user`) before entering protected routes.
