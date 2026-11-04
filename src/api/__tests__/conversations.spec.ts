import type { Message } from '@/types/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAnswer } from '@/composables/useAnswer'
import { conversationsApi } from '../conversations'
import { http } from '../http'
import { fakeServer, requestedUrls } from './fakeServer'

const originalAdapter = http.defaults.adapter

function message (overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg2',
    conversation_id: 'conv1',
    role: 'assistant',
    status: 'pending',
    is_finished: false,
    content: null,
    answer_found: null,
    error_code: null,
    error_message: null,
    citations: [],
    created_at: '2026-11-01T10:00:00+00:00',
    ...overrides,
  }
}

afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.useRealTimers()
})

describe('conversationsApi', () => {
  it('starts a conversation with the first question', async () => {
    const conversation = { id: 'conv1', document_id: 'doc1', title: 'Refunds?', messages: [message({ role: 'user', status: 'completed' }), message()], created_at: '', updated_at: '' }
    const adapter = fakeServer(() => ({ status: 202, data: { data: conversation } }))

    await expect(conversationsApi.start('doc1', 'Refunds?')).resolves.toEqual(conversation)

    const [config] = adapter.mock.calls[0]!
    expect(`${config.method?.toUpperCase()} ${config.url}`).toBe('POST /api/v1/documents/doc1/conversations')
    expect(JSON.parse(config.data)).toEqual({ question: 'Refunds?' })
  })

  it('asks follow-ups and polls messages on the documented endpoints', async () => {
    const adapter = fakeServer(config => config.method === 'post'
      ? { status: 202, data: { data: { question: message({ role: 'user' }), answer: message() } } }
      : { status: 200, data: { data: message() } })

    const { answer } = await conversationsApi.ask('conv1', 'And a receipt?')
    await conversationsApi.message('conv1', answer.id)

    expect(requestedUrls(adapter)).toEqual([
      'POST /api/v1/conversations/conv1/questions',
      'GET /api/v1/conversations/conv1/messages/msg2',
    ])
  })

  it('surfaces the specific conflict and limit codes', async () => {
    fakeServer(config => config.url?.includes('/documents/')
      ? { status: 429, data: { message: 'You have reached today\'s question limit.', code: 'daily_limit_reached' } }
      : { status: 409, data: { message: 'Wait for the current answer.', code: 'answer_pending' } })

    await expect(conversationsApi.start('doc1', 'Q?')).rejects.toMatchObject({ status: 429, code: 'daily_limit_reached' })
    await expect(conversationsApi.ask('conv1', 'Q?')).rejects.toMatchObject({ status: 409, code: 'answer_pending' })
  })

  it('encodes ids in the URL', async () => {
    const adapter = fakeServer(() => ({ status: 200, data: { data: message() } }))

    await conversationsApi.message('../x', '../y')

    expect(adapter.mock.calls[0]![0].url).toBe('/api/v1/conversations/..%2Fx/messages/..%2Fy')
  })
})

describe('useAnswer', () => {
  it('polls the answer until it is finished, starting at 1 second', async () => {
    vi.useFakeTimers()
    const replies = [
      message(),
      message({ status: 'completed', is_finished: true, content: 'Within 30 days [1].', answer_found: true, citations: [{ number: 1, page_number: 2, quote: 'within 30 days' }] }),
    ]
    const adapter = fakeServer(() => ({ status: 200, data: { data: replies.shift() } }))

    const { data, isPolling } = useAnswer('conv1', 'msg2')
    await vi.advanceTimersByTimeAsync(0)
    expect(adapter).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(data.value?.citations[0]?.page_number).toBe(2)
    expect(isPolling.value).toBe(false)
  })
})

describe('conversationsApi management', () => {
  it('lists conversations, optionally for one document', async () => {
    const adapter = fakeServer(() => ({ status: 200, data: { data: [], links: {}, meta: {} } }))

    await conversationsApi.list()
    await conversationsApi.list({ documentId: 'doc1', page: 2 })

    expect(adapter.mock.calls[0]![0].params).toEqual({})
    expect(adapter.mock.calls[1]![0].params).toEqual({ page: 2, document_id: 'doc1' })
  })

  it('reads, renames, deletes and retries on the documented endpoints', async () => {
    const adapter = fakeServer(config => {
      if (config.method === 'delete') {
        return { status: 204 }
      }
      if (config.url?.endsWith('/retry')) {
        return { status: 202, data: { data: message() } }
      }
      return { status: 200, data: { data: { id: 'conv1', document_id: 'doc1', title: 'T', created_at: '', updated_at: '' } } }
    })

    await conversationsApi.get('conv1')
    await conversationsApi.rename('conv1', 'Refunds')
    const retried = await conversationsApi.retryAnswer('conv1', 'msg2')
    await conversationsApi.remove('conv1')

    expect(retried.status).toBe('pending')
    expect(JSON.parse(adapter.mock.calls[1]![0].data)).toEqual({ title: 'Refunds' })
    expect(requestedUrls(adapter)).toEqual([
      'GET /api/v1/conversations/conv1',
      'PATCH /api/v1/conversations/conv1',
      'POST /api/v1/conversations/conv1/messages/msg2/retry',
      'DELETE /api/v1/conversations/conv1',
    ])
  })

  it('surfaces the answer retry conflicts', async () => {
    fakeServer(() => ({ status: 409, data: { message: 'Only failed answers can be retried.', code: 'answer_not_failed' } }))

    await expect(conversationsApi.retryAnswer('conv1', 'msg2')).rejects.toMatchObject({ status: 409, code: 'answer_not_failed' })
  })
})
