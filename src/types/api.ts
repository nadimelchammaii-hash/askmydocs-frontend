/**
 * Types mirroring the backend API contract (askmydocs-backend/docs/api.md).
 * Keep in sync when the contract changes.
 */

/** Single resources are wrapped in `data`. */
export interface Resource<T> {
  data: T
}

/** JSON body of every API error response. */
export interface ApiErrorBody {
  message: string
  code: string
  errors?: Record<string, string[]>
}

export interface MessageResponse {
  message: string
}

export interface User {
  id: number
  name: string
  email: string
  /** ISO 8601 */
  created_at: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface LoginPayload {
  email: string
  password: string
  remember?: boolean
}

export interface ResetPasswordPayload {
  token: string
  email: string
  password: string
  password_confirmation: string
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
}

export interface UpdatePasswordPayload {
  current_password: string
  password: string
  password_confirmation: string
}
