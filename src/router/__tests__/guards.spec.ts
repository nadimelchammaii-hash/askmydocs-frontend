import type { RouteLocationNormalized, RouteMeta } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { authGuard, HOME_ROUTE, LOGIN_ROUTE, safeRedirect } from '../guards'

function route (meta: RouteMeta, fullPath = '/documents/1'): RouteLocationNormalized {
  return { meta, fullPath } as unknown as RouteLocationNormalized
}

function authState (isAuthenticated: boolean, ensureLoaded = vi.fn().mockResolvedValue(undefined)) {
  return { isAuthenticated, ensureLoaded }
}

describe('authGuard', () => {
  it('lets public routes through without asking the server', async () => {
    const auth = authState(false)

    await expect(authGuard(route({}), auth)).resolves.toBe(true)
    expect(auth.ensureLoaded).not.toHaveBeenCalled()
  })

  it('sends guests from protected routes to login, remembering where they were going', async () => {
    await expect(authGuard(route({ requiresAuth: true }), authState(false)))
      .resolves
      .toEqual({ name: LOGIN_ROUTE, query: { redirect: '/documents/1' } })
  })

  it('lets logged-in users into protected routes', async () => {
    await expect(authGuard(route({ requiresAuth: true }), authState(true))).resolves.toBe(true)
  })

  it('sends logged-in users away from guest-only routes', async () => {
    await expect(authGuard(route({ guestOnly: true }), authState(true))).resolves.toEqual({ name: HOME_ROUTE })
  })

  it('lets guests into guest-only routes', async () => {
    await expect(authGuard(route({ guestOnly: true }), authState(false))).resolves.toBe(true)
  })

  it('handles an unreachable server: protected routes go to login, guest routes stay open', async () => {
    const failing = () => vi.fn().mockRejectedValue(new Error('network'))

    await expect(authGuard(route({ requiresAuth: true }), authState(false, failing())))
      .resolves
      .toEqual({ name: LOGIN_ROUTE })
    await expect(authGuard(route({ guestOnly: true }), authState(false, failing()))).resolves.toBe(true)
  })
})

describe('safeRedirect', () => {
  it('accepts paths inside the app', () => {
    expect(safeRedirect('/documents/1?tab=chat')).toBe('/documents/1?tab=chat')
  })

  it.each([
    ['absolute URL', 'https://evil.example'],
    ['protocol-relative URL', '//evil.example'],
    ['backslash trick', String.raw`/\evil.example`],
    ['missing value', undefined],
    ['non-string value', ['/documents']],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirect(value)).toEqual({ name: HOME_ROUTE })
  })
})
