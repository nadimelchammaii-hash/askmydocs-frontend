import type { LoginPayload, RegisterPayload, UpdateProfilePayload, User } from '@/types/api'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'
import { isUnauthenticated } from '@/api/errors'

/**
 * Who is logged in. The session itself lives in an HttpOnly cookie that JavaScript
 * cannot read, so the only way to know is to ask the API (GET /api/v1/user).
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  /** True once the server has given a definitive answer (logged in or not). */
  const loaded = ref(false)
  let pendingLoad: Promise<void> | null = null

  const isAuthenticated = computed(() => user.value !== null)

  async function fetchUser (): Promise<void> {
    try {
      user.value = await authApi.fetchUser()
    } catch (error) {
      if (!isUnauthenticated(error)) {
        // e.g. server unreachable: no definitive answer, so allow a later retry.
        throw error
      }
      user.value = null
    }
    loaded.value = true
  }

  /** Loads the user once; concurrent callers (e.g. guards) share the same request. */
  async function ensureLoaded (): Promise<void> {
    if (loaded.value) {
      return
    }
    pendingLoad ??= fetchUser().finally(() => {
      pendingLoad = null
    })
    await pendingLoad
  }

  async function login (payload: LoginPayload): Promise<void> {
    setUser(await authApi.login(payload))
  }

  async function register (payload: RegisterPayload): Promise<void> {
    setUser(await authApi.register(payload))
  }

  async function logout (): Promise<void> {
    try {
      await authApi.logout()
    } finally {
      // Even if the request fails, the SPA must not keep showing a logged-in state.
      clear()
    }
  }

  async function updateProfile (payload: UpdateProfilePayload): Promise<void> {
    setUser(await authApi.updateProfile(payload))
  }

  function setUser (value: User) {
    user.value = value
    loaded.value = true
  }

  /** Forget the user locally (after logout, or when the API reports 401). */
  function clear () {
    user.value = null
    loaded.value = true
  }

  return { user, loaded, isAuthenticated, fetchUser, ensureLoaded, login, register, logout, updateProfile, clear }
})
