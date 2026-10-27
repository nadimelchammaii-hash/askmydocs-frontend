import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import { http } from '../http'

export interface FakeReply {
  status: number
  data?: unknown
}

/**
 * Replaces the HTTP transport of the shared axios instance, so interceptors and
 * API functions run for real without any network access. Returns the mock to
 * inspect which requests were made.
 */
export function fakeServer (handler: (config: InternalAxiosRequestConfig) => FakeReply | 'network-error') {
  const adapter = vi.fn<AxiosAdapter>(async config => {
    const reply = handler(config)

    if (reply === 'network-error') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
    }

    const response: AxiosResponse = { data: reply.data, status: reply.status, statusText: String(reply.status), headers: {}, config }
    if (reply.status >= 200 && reply.status < 300) {
      return response
    }
    throw new AxiosError(`Request failed with status code ${reply.status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response)
  })

  http.defaults.adapter = adapter
  return adapter
}

export function requestedUrls (adapter: ReturnType<typeof fakeServer>): string[] {
  return adapter.mock.calls.map(([config]) => `${config.method?.toUpperCase()} ${config.url}`)
}
