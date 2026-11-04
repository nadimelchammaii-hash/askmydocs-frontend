import type {
  LoginPayload,
  MessageResponse,
  RegisterPayload,
  ResetPasswordPayload,
  Resource,
  UpdatePasswordPayload,
  UpdateProfilePayload,
  User,
} from '@/types/api'
import { CSRF_COOKIE_PATH, http } from './http'

/** Endpoints from docs/api.md (authentication and profile). */
export const authApi = {
  /** Sets the XSRF-TOKEN cookie. Called before login/register (cheap, and avoids a 419 round-trip). */
  async csrfCookie (): Promise<void> {
    await http.get(CSRF_COOKIE_PATH)
  },

  async register (payload: RegisterPayload): Promise<User> {
    await authApi.csrfCookie()
    const { data } = await http.post<Resource<User>>('/api/v1/auth/register', payload)
    return data.data
  },

  async login (payload: LoginPayload): Promise<User> {
    await authApi.csrfCookie()
    const { data } = await http.post<Resource<User>>('/api/v1/auth/login', payload)
    return data.data
  },

  async logout (): Promise<void> {
    await http.post('/api/v1/auth/logout')
  },

  async forgotPassword (email: string): Promise<string> {
    await authApi.csrfCookie()
    const { data } = await http.post<MessageResponse>('/api/v1/auth/forgot-password', { email })
    return data.message
  },

  async resetPassword (payload: ResetPasswordPayload): Promise<string> {
    await authApi.csrfCookie()
    const { data } = await http.post<MessageResponse>('/api/v1/auth/reset-password', payload)
    return data.message
  },

  async fetchUser (): Promise<User> {
    const { data } = await http.get<Resource<User>>('/api/v1/user')
    return data.data
  },

  async updateProfile (payload: UpdateProfilePayload): Promise<User> {
    const { data } = await http.patch<Resource<User>>('/api/v1/user', payload)
    return data.data
  },

  async updatePassword (payload: UpdatePasswordPayload): Promise<void> {
    await http.put('/api/v1/user/password', payload)
  },
}
