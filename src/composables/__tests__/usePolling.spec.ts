import type { Document } from '@/types/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ApiError } from '@/api/errors'
import { http } from '@/api/http'
import { fakeServer } from '../../api/__tests__/fakeServer'
import { useDocumentProcessing } from '../useDocumentProcessing'
import { usePolling } from '../usePolling'

/** Lets pending promises (the fetcher) settle without advancing timers. */
async function flush () {
  await vi.advanceTimersByTimeAsync(0)
}

function setHidden (hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  setHidden(false)
})

describe('usePolling', () => {
  it('polls with growing delays until the condition is met', async () => {
    const values = [1, 2, 3]
    const fetcher = vi.fn(async () => values.shift()!)
    const { data, isPolling } = usePolling(fetcher, { interval: 1000, backoff: 2, until: value => value === 3 })

    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(data.value).toBe(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetcher).toHaveBeenCalledTimes(2) // after 1 s

    await vi.advanceTimersByTimeAsync(1999)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetcher).toHaveBeenCalledTimes(3) // then after 2 s
    expect(data.value).toBe(3)
    expect(isPolling.value).toBe(false)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('caps the delay at maxInterval', async () => {
    const fetcher = vi.fn(async () => 0)
    usePolling(fetcher, { interval: 1000, backoff: 10, maxInterval: 3000 })
    await flush()

    await vi.advanceTimersByTimeAsync(1000) // 2nd call
    await vi.advanceTimersByTimeAsync(3000) // 3rd call: 10 s capped to 3 s
    await vi.advanceTimersByTimeAsync(3000) // 4th call

    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('never starts a request while the previous one is still running', async () => {
    let resolve!: (value: number) => void
    const fetcher = vi.fn(() => new Promise<number>(r => {
      resolve = r
    }))
    usePolling(fetcher, { interval: 100 })

    await vi.advanceTimersByTimeAsync(10_000) // the first request hangs
    expect(fetcher).toHaveBeenCalledTimes(1)

    resolve(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('keeps polling through temporary errors', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new ApiError('Cannot reach the server.', 0, 'network_error'))
      .mockRejectedValueOnce(new ApiError('Server error.', 503, 'server_error'))
      .mockResolvedValue('done')
    const { data, error } = usePolling(fetcher, { interval: 100, backoff: 1, until: value => value === 'done' })

    await flush()
    expect(error.value?.code).toBe('network_error')

    await vi.advanceTimersByTimeAsync(200)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(data.value).toBe('done')
    expect(error.value).toBeNull()
  })

  it('stops on errors that asking again cannot fix', async () => {
    const fetcher = vi.fn().mockRejectedValue(new ApiError('Resource not found.', 404, 'not_found'))
    const { error, isPolling } = usePolling(fetcher, { interval: 100 })

    await vi.advanceTimersByTimeAsync(1000)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(error.value?.code).toBe('not_found')
    expect(isPolling.value).toBe(false)
  })

  it('stops and aborts the running request on stop()', async () => {
    let signal!: AbortSignal
    const fetcher = vi.fn((s: AbortSignal) => {
      signal = s
      return new Promise<number>(() => {})
    })
    const { stop, isPolling } = usePolling(fetcher)

    stop()

    expect(signal.aborted).toBe(true)
    expect(isPolling.value).toBe(false)
  })

  it('ignores a response that arrives after stop()', async () => {
    let resolve!: (value: number) => void
    const { data, stop } = usePolling(() => new Promise<number>(r => {
      resolve = r
    }))

    stop()
    resolve(42)
    await flush()

    expect(data.value).toBeNull()
  })

  it('stops when the owning component is unmounted', async () => {
    const fetcher = vi.fn(async () => 0)
    const scope = effectScope()
    scope.run(() => usePolling(fetcher, { interval: 100 }))
    await flush()

    scope.stop()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('pauses while the tab is hidden and resumes at once when shown', async () => {
    const fetcher = vi.fn(async () => 0)
    usePolling(fetcher, { interval: 1000 })
    await flush()

    setHidden(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetcher).toHaveBeenCalledTimes(1) // the timer fired, but no request was made

    setHidden(false)
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('waits for start() when immediate is false', async () => {
    const fetcher = vi.fn(async () => 0)
    const { start } = usePolling(fetcher, { immediate: false })
    await flush()
    expect(fetcher).not.toHaveBeenCalled()

    start()
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

describe('useDocumentProcessing', () => {
  const originalAdapter = http.defaults.adapter

  afterEach(() => {
    http.defaults.adapter = originalAdapter
  })

  it('polls the document until it is finished', async () => {
    const states: Array<Partial<Document>> = [
      { status: 'queued', is_finished: false },
      { status: 'extracting', is_finished: false },
      { status: 'ready', is_finished: true },
    ]
    const adapter = fakeServer(() => ({ status: 200, data: { data: { id: 'doc1', ...states.shift() } } }))

    const { data, isPolling } = useDocumentProcessing('doc1', { interval: 100, backoff: 1 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(adapter).toHaveBeenCalledTimes(3)
    expect(adapter.mock.calls[0]![0].url).toBe('/api/v1/documents/doc1')
    expect(data.value?.status).toBe('ready')
    expect(isPolling.value).toBe(false)
  })
})
