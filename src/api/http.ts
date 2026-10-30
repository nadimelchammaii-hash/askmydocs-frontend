import axios, { type InternalAxiosRequestConfig } from 'axios'
import { toApiError } from './errors'

/**
 * Axios instance for the AskMyDocs API (Laravel Sanctum, SPA cookie mode).
 *
 * - withCredentials: send the session cookie to the API (a different origin: :8000 vs :3000).
 * - withXSRFToken: copy the XSRF-TOKEN cookie into the X-XSRF-TOKEN header. Axios only does
 *   this automatically for same-origin requests, so it must be forced here.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

export const CSRF_COOKIE_PATH = '/sanctum/csrf-cookie'

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

let unauthenticatedHandler: (() => void) | null = null

/** Called when any request returns 401 (e.g. the session expired). */
export function onUnauthenticated (handler: (() => void) | null) {
  unauthenticatedHandler = handler
}

/**
 * Requests made with responseType 'blob' (e.g. the PDF file) also receive their
 * error body as a Blob. Decode JSON error bodies so they carry the usual `code`.
 */
async function decodeBlobErrorBody (error: { response?: { data?: unknown } } | undefined) {
  const data = error?.response?.data
  if (!(data instanceof Blob) || !data.type.includes('json')) {
    return
  }
  try {
    error!.response!.data = JSON.parse(await data.text())
  } catch {
    // Not valid JSON: keep the Blob; toApiError falls back to a generic error.
  }
}

http.interceptors.response.use(
  response => response,
  async error => {
    const config = (error?.config ?? undefined) as RetriableConfig | undefined
    const status: number | undefined = error?.response?.status

    // 419: the CSRF token expired or was missing. Fetch a fresh one and retry once.
    if (status === 419 && config && !config._csrfRetried && config.url !== CSRF_COOKIE_PATH) {
      config._csrfRetried = true
      await http.get(CSRF_COOKIE_PATH)
      return http.request(config)
    }

    await decodeBlobErrorBody(error)
    const apiError = toApiError(error)

    if (apiError.status === 401) {
      unauthenticatedHandler?.()
    }

    throw apiError
  },
)
