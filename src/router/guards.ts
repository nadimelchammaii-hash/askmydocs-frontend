import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Only for logged-in users (e.g. documents, chat). */
    requiresAuth?: boolean
    /** Only for guests (e.g. login, register). */
    guestOnly?: boolean
    /** Shown in the browser tab and the top bar. */
    title?: string
  }
}

/** Route names the guard redirects to (defined in router/index.ts). */
export const LOGIN_ROUTE = 'login'
export const HOME_ROUTE = 'dashboard'

interface AuthState {
  readonly isAuthenticated: boolean
  ensureLoaded: () => Promise<void>
}

/**
 * Decides whether a navigation may proceed. Pure function of the route and the
 * auth state, so it can be unit-tested without a router or a server.
 */
export async function authGuard (to: RouteLocationNormalized, auth: AuthState): Promise<true | RouteLocationRaw> {
  if (!to.meta.requiresAuth && !to.meta.guestOnly) {
    return true
  }

  try {
    await auth.ensureLoaded()
  } catch {
    // Server unreachable: protected pages cannot be shown; guest pages still can.
    return to.meta.requiresAuth ? { name: LOGIN_ROUTE } : true
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: LOGIN_ROUTE, query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: HOME_ROUTE }
  }

  return true
}

/**
 * Where to go after login. Only same-app paths are accepted, so a crafted link like
 * /login?redirect=https://evil.example cannot send the user to another site (open redirect).
 */
export function safeRedirect (value: unknown, fallback?: RouteLocationRaw): RouteLocationRaw {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
    return value
  }
  return fallback ?? { name: HOME_ROUTE }
}
