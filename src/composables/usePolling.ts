import { getCurrentScope, onScopeDispose, readonly, ref, shallowRef } from 'vue'
import { type ApiError, toApiError } from '@/api/errors'

export interface PollingOptions<T> {
  /** First delay between requests, in ms. */
  interval?: number
  /** Upper bound for the delay, in ms. */
  maxInterval?: number
  /** The delay is multiplied by this after every request, up to maxInterval. */
  backoff?: number
  /** Polling stops once this returns true for a response (e.g. the document is finished). */
  until?: (value: T) => boolean
  /** Start right away (default) or wait for start(). */
  immediate?: boolean
}

/**
 * Errors worth retrying: the server could not be reached, was overloaded or
 * failed (0, 429, 5xx). Anything else (401, 403, 404, 409, 422) will not change
 * by asking again, so polling stops.
 */
function isRetryable (error: ApiError): boolean {
  return error.status === 0 || error.status === 429 || error.status >= 500
}

/**
 * Repeatedly calls `fetcher` until `until` is satisfied.
 *
 * - Never overlaps requests: the next one is scheduled only after the previous
 *   one has finished (setTimeout chain, not setInterval).
 * - Backs off: 2 s, 3 s, 4.5 s ... up to 10 s by default, so a long-running
 *   job does not cause a steady stream of requests.
 * - Pauses while the browser tab is hidden and polls at once when it is shown again.
 * - Stops automatically when the calling component (effect scope) is destroyed.
 */
export function usePolling<T> (fetcher: (signal: AbortSignal) => Promise<T>, options: PollingOptions<T> = {}) {
  const { interval = 2000, maxInterval = 10_000, backoff = 1.5, until, immediate = true } = options

  const data = shallowRef<T | null>(null)
  const error = shallowRef<ApiError | null>(null)
  const isPolling = ref(false)

  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let delay = interval
  let pausedWhileHidden = false
  /** Incremented by start/stop, so responses of an outdated run are ignored. */
  let run = 0

  async function tick () {
    timer = undefined
    if (typeof document !== 'undefined' && document.hidden) {
      pausedWhileHidden = true
      return
    }

    const currentRun = run
    controller = new AbortController()

    try {
      const value = await fetcher(controller.signal)
      if (currentRun !== run) {
        return
      }
      data.value = value
      error.value = null
      if (until?.(value)) {
        stop()
        return
      }
    } catch (error_) {
      if (currentRun !== run) {
        return
      }
      const apiError = toApiError(error_)
      error.value = apiError
      if (!isRetryable(apiError)) {
        stop()
        return
      }
    }

    timer = setTimeout(tick, delay)
    delay = Math.min(delay * backoff, maxInterval)
  }

  function onVisibilityChange () {
    if (!document.hidden && pausedWhileHidden && isPolling.value) {
      pausedWhileHidden = false
      void tick()
    }
  }

  function start () {
    stop()
    run++
    isPolling.value = true
    delay = interval
    error.value = null
    document.addEventListener('visibilitychange', onVisibilityChange)
    void tick()
  }

  function stop () {
    run++
    clearTimeout(timer)
    timer = undefined
    controller?.abort()
    controller = undefined
    pausedWhileHidden = false
    isPolling.value = false
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }

  if (getCurrentScope()) {
    onScopeDispose(stop)
  }

  if (immediate) {
    start()
  }

  return {
    data,
    error,
    isPolling: readonly(isPolling),
    start,
    stop,
  }
}
