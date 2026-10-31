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

## Running with Docker (recommended)

The whole stack (database, API, workers and this SPA's dev server) is started from the backend repository, which must be next to this one:

```powershell
cd ..skmydocs-backend
docker compose up -d --build       # SPA at http://localhost:5173
docker compose exec frontend npm test
```

The SPA container ([`docker/Dockerfile.dev`](docker/Dockerfile.dev)) mounts this folder, so edits reload the page as usual. Its `node_modules` is a Docker volume with Linux packages, separate from the Windows `node_modules/` folder, and is installed automatically when `package-lock.json` changes. File changes are detected by polling (`VITE_DEV_POLLING`), because change events from Windows folders do not reach containers.

## Alternative: local development (Windows)

Runs natively with Node.js (v22+). The backend API must be running on `http://localhost:8000` (see the backend README).

```powershell
npm install
copy .env.example .env.local      # then adjust if needed
npm run dev                       # http://localhost:5173
```

### Port

The dev server uses port **5173** (Vite's default; `3000` fell inside a Windows-reserved port range) with `strictPort`: if 5173 is taken, Vite stops with an error instead of switching to another port. This is deliberate — the API only accepts requests from `http://localhost:5173` (CORS and Sanctum), so a different port would break login.

Check the port before starting:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue   # no output = free
```

To use another port, change `server.port` in `vite.config.mts` **and** `FRONTEND_URL` / `SANCTUM_STATEFUL_DOMAINS` in the backend `.env`.

Always open the app at `http://localhost:5173` (not `127.0.0.1`): the session cookie is only shared when the SPA and API use the same host name.

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
  router/       index.ts (routes, lazy-loaded pages), guards.ts — route protection (meta.requiresAuth / meta.guestOnly)
  layouts/      AppLayout (sidebar + top bar on desktop, top bar + bottom navigation on mobile), AuthLayout (login, register)
  views/        one component per page
  styles/       main.css — fonts, type scale and spacing tokens from the Stitch design
  plugins/      Vuetify (theme colors and Material Symbols icons from the Stitch design), Pinia, router registration
```

### Design

The UI follows the Google Stitch project "AskMyDocs AI PDF Assistant". Its tokens are implemented as a Vuetify theme (Material 3 color roles, e.g. `bg-surface-container-low`) plus CSS classes named like the Stitch tokens (`text-headline-md`, `text-label-code`, …). Fonts (Geist, JetBrains Mono) and icons (Material Symbols Outlined) are self-hosted npm packages, so the app makes no requests to font CDNs.

Mockup elements the API does not support (SSO, 2FA, workspaces, OCR, quotas, notifications, export, compliance badges) are intentionally left out, so the UI only shows features that exist.

### Authentication flow

The API uses Laravel Sanctum **session cookies** (HttpOnly; JavaScript never sees them). The client:

1. requests `GET /sanctum/csrf-cookie` before login/register,
2. sends every request with credentials and the `X-XSRF-TOKEN` header (configured in `src/api/http.ts`),
3. on `419` fetches a new CSRF cookie and retries once,
4. on `401` clears the local user (session expired) and, on a protected page, goes to the login page.

On startup, the route guard asks the API who is logged in (`GET /api/v1/user`) before entering protected routes.
