import { afterEach, describe, expect, it } from 'vitest'
import { authApi } from '../auth'
import { CSRF_COOKIE_PATH, http } from '../http'
import { fakeServer, requestedUrls } from './fakeServer'

const originalAdapter = http.defaults.adapter
const user = { id: 1, name: 'Ana', email: 'ana@example.com', created_at: '2026-10-26T09:51:46+00:00' }

afterEach(() => {
  http.defaults.adapter = originalAdapter
})

describe('authApi', () => {
  it('fetches the CSRF cookie before logging in and unwraps the user', async () => {
    const adapter = fakeServer(config => config.url === CSRF_COOKIE_PATH
      ? { status: 204 }
      : { status: 200, data: { data: user } })

    await expect(authApi.login({ email: 'ana@example.com', password: 'Secret123' })).resolves.toEqual(user)
    expect(requestedUrls(adapter)).toEqual([`GET ${CSRF_COOKIE_PATH}`, 'POST /api/v1/auth/login'])
  })

  it('sends the registration payload as JSON', async () => {
    const adapter = fakeServer(config => config.url === CSRF_COOKIE_PATH
      ? { status: 204 }
      : { status: 201, data: { data: user } })
    const payload = { name: 'Ana', email: 'ana@example.com', password: 'Secret123', password_confirmation: 'Secret123' }

    await authApi.register(payload)

    const [registerConfig] = adapter.mock.calls[1]!
    expect(registerConfig.url).toBe('/api/v1/auth/register')
    expect(JSON.parse(registerConfig.data)).toEqual(payload)
  })

  it('returns the current user from /api/v1/user', async () => {
    fakeServer(() => ({ status: 200, data: { data: user } }))

    await expect(authApi.fetchUser()).resolves.toEqual(user)
  })
})
