import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../errors'
import { CSRF_COOKIE_PATH, http, onUnauthenticated } from '../http'
import { fakeServer, requestedUrls } from './fakeServer'

const originalAdapter = http.defaults.adapter

afterEach(() => {
  http.defaults.adapter = originalAdapter
  onUnauthenticated(null)
})

describe('http client configuration', () => {
  it('targets the configured API and sends credentials with the XSRF header', () => {
    expect(http.defaults.baseURL).toBe('https://api.test')
    expect(http.defaults.withCredentials).toBe(true)
    expect(http.defaults.withXSRFToken).toBe(true)
    expect(http.defaults.headers.Accept).toBe('application/json')
  })
})

describe('error normalisation', () => {
  it('turns validation errors into an ApiError with field messages', async () => {
    fakeServer(() => ({
      status: 422,
      data: { message: 'The email field is required.', code: 'validation_failed', errors: { email: ['The email field is required.'] } },
    }))

    const error = await http.post('/api/v1/auth/login', {}).catch(error_ => error_)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'validation_failed', errors: { email: ['The email field is required.'] } })
  })

  it('reports an unreachable server as a network error', async () => {
    fakeServer(() => 'network-error')

    const error = await http.get('/api/v1/user').catch(error_ => error_)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, code: 'network_error' })
  })
})

describe('CSRF token refresh (419)', () => {
  it('fetches a fresh CSRF cookie and retries the request once', async () => {
    let loginAttempts = 0
    const adapter = fakeServer(config => {
      if (config.url === CSRF_COOKIE_PATH) {
        return { status: 204 }
      }
      loginAttempts++
      return loginAttempts === 1
        ? { status: 419, data: { message: 'CSRF token mismatch.', code: 'csrf_token_mismatch' } }
        : { status: 200, data: { data: { id: 1 } } }
    })

    const response = await http.post('/api/v1/auth/login', {})

    expect(response.data).toEqual({ data: { id: 1 } })
    expect(requestedUrls(adapter)).toEqual([
      'POST /api/v1/auth/login',
      `GET ${CSRF_COOKIE_PATH}`,
      'POST /api/v1/auth/login',
    ])
  })

  it('gives up after one retry instead of looping', async () => {
    const adapter = fakeServer(config => config.url === CSRF_COOKIE_PATH
      ? { status: 204 }
      : { status: 419, data: { message: 'CSRF token mismatch.', code: 'csrf_token_mismatch' } })

    const error = await http.post('/api/v1/auth/login', {}).catch(error_ => error_)

    expect(error).toMatchObject({ status: 419, code: 'csrf_token_mismatch' })
    expect(adapter).toHaveBeenCalledTimes(3)
  })
})

describe('unauthenticated handler', () => {
  it('is notified on 401 only', async () => {
    const handler = vi.fn()
    onUnauthenticated(handler)

    fakeServer(() => ({ status: 422, data: { message: 'Invalid.', code: 'validation_failed' } }))
    await http.get('/api/v1/user').catch(() => {})
    expect(handler).not.toHaveBeenCalled()

    fakeServer(() => ({ status: 401, data: { message: 'Unauthenticated.', code: 'unauthenticated' } }))
    await http.get('/api/v1/user').catch(() => {})
    expect(handler).toHaveBeenCalledOnce()
  })
})
