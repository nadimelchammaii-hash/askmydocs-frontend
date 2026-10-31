import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { HOME_ROUTE, LOGIN_ROUTE } from '../guards'
import { routes } from '../index'

const router = createRouter({ history: createMemoryHistory(), routes })

const appPages = ['dashboard', 'documents', 'conversations', 'settings']
const guestPages = ['login', 'register', 'forgot-password', 'reset-password']

describe('routes', () => {
  it('defines the routes the guard redirects to', () => {
    expect(router.hasRoute(HOME_ROUTE)).toBe(true)
    expect(router.hasRoute(LOGIN_ROUTE)).toBe(true)
    expect(router.resolve('/').name).toBe(HOME_ROUTE)
  })

  it.each(appPages)('requires login for %s', name => {
    const { meta } = router.resolve({ name })

    expect(meta.requiresAuth).toBe(true)
    expect(meta.guestOnly).toBeUndefined()
    expect(meta.title).toBeTruthy()
  })

  it('requires login for chat pages', () => {
    expect(router.resolve('/documents/doc1/chat').meta.requiresAuth).toBe(true)
    expect(router.resolve('/conversations/conv1').meta.requiresAuth).toBe(true)
  })

  it.each(guestPages)('is guest-only: %s', name => {
    const { meta } = router.resolve({ name })

    expect(meta.guestOnly).toBe(true)
    expect(meta.requiresAuth).toBeUndefined()
  })

  it('shows the not-found page for unknown URLs, without requiring login', () => {
    const resolved = router.resolve('/no/such/page')

    expect(resolved.name).toBe('not-found')
    expect(resolved.meta.requiresAuth).toBeUndefined()
  })
})
