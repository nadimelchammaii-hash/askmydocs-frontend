import type { ApiErrorBody } from '@/types/api'
import { isAxiosError } from 'axios'

/**
 * The only error type the rest of the app has to handle. Components and stores
 * branch on `code` (stable, from the API contract), never on raw HTTP details.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached. */
  readonly status: number
  readonly code: string
  /** Validation messages per field (422). */
  readonly errors: Record<string, string[]>

  constructor (message: string, status: number, code: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

export function toApiError (error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (isAxiosError<Partial<ApiErrorBody>>(error)) {
    if (!error.response) {
      return new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'network_error')
    }

    const body = error.response.data
    return new ApiError(
      body?.message ?? 'Request failed.',
      error.response.status,
      body?.code ?? 'error',
      body?.errors ?? {},
    )
  }

  return new ApiError('Unexpected error.', 0, 'unknown_error')
}

export function isUnauthenticated (error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}
