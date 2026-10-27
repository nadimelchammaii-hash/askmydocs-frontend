import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/errors'
import { useAuthStore } from '../auth'

vi.mock('@/api/auth', () => ({
  authApi: {
    fetchUser: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
  },
}))

const user = { id: 1, name: 'Ana', email: 'ana@example.com', created_at: '2026-10-26T09:51:46+00:00' }
const unauthenticated = new ApiError('Unauthenticated.', 401, 'unauthenticated')
const networkError = new ApiError('Cannot reach the server.', 0, 'network_error')

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('auth store', () => {
  it('loads the user once, even when asked concurrently', async () => {
    vi.mocked(authApi.fetchUser).mockResolvedValue(user)
    const auth = useAuthStore()

    await Promise.all([auth.ensureLoaded(), auth.ensureLoaded()])
    await auth.ensureLoaded()

    expect(authApi.fetchUser).toHaveBeenCalledOnce()
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user).toEqual(user)
  })

  it('treats a 401 as a definitive "not logged in"', async () => {
    vi.mocked(authApi.fetchUser).mockRejectedValue(unauthenticated)
    const auth = useAuthStore()

    await auth.ensureLoaded()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.loaded).toBe(true)
  })

  it('rethrows when the server is unreachable and retries on the next call', async () => {
    vi.mocked(authApi.fetchUser).mockRejectedValueOnce(networkError).mockResolvedValueOnce(user)
    const auth = useAuthStore()

    await expect(auth.ensureLoaded()).rejects.toBe(networkError)
    expect(auth.loaded).toBe(false)

    await auth.ensureLoaded()
    expect(auth.user).toEqual(user)
  })

  it('stores the user after login', async () => {
    vi.mocked(authApi.login).mockResolvedValue(user)
    const auth = useAuthStore()

    await auth.login({ email: 'ana@example.com', password: 'Secret123' })

    expect(auth.user).toEqual(user)
    expect(auth.loaded).toBe(true)
  })

  it('clears the user on logout even if the request fails', async () => {
    vi.mocked(authApi.login).mockResolvedValue(user)
    vi.mocked(authApi.logout).mockRejectedValue(networkError)
    const auth = useAuthStore()
    await auth.login({ email: 'ana@example.com', password: 'Secret123' })

    await expect(auth.logout()).rejects.toBe(networkError)

    expect(auth.isAuthenticated).toBe(false)
  })
})
