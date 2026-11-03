import type { Conversation, Document, Paginated, Stats } from '@/types/api'
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accessibleText, mountPage } from '@/__tests__/mountPage'
import { conversationsApi } from '@/api/conversations'
import { documentsApi } from '@/api/documents'
import { ApiError } from '@/api/errors'
import { statsApi } from '@/api/stats'
import { useAuthStore } from '@/stores/auth'
import { formatRelative } from '@/utils/format'

vi.mock('@/api/stats', () => ({ statsApi: { get: vi.fn() } }))
vi.mock('@/api/documents', async importOriginal => ({
  ...await importOriginal<object>(),
  documentsApi: { list: vi.fn(), upload: vi.fn() },
}))
vi.mock('@/api/conversations', () => ({ conversationsApi: { list: vi.fn() } }))

function makeStats (overrides: Partial<Stats> = {}): Stats {
  return {
    documents: { total: 3, ready: 2, processing: 0, failed: 1 },
    pages_indexed: 1250,
    conversations: 4,
    questions_today: { used: 12, limit: 100, remaining: 88, resets_at: '2026-11-04T00:00:00+00:00' },
    ...overrides,
  }
}

const readyDocument: Document = {
  id: '01jdoc0000000000000000000a',
  title: 'Employee Handbook',
  original_filename: 'handbook.pdf',
  size_bytes: 4.2 * 1024 * 1024,
  page_count: 48,
  status: 'ready',
  is_finished: true,
  error_code: null,
  error_message: null,
  created_at: new Date().toISOString(),
  processed_at: null,
}

const conversation: Conversation = {
  id: '01jconv000000000000000000a',
  document_id: readyDocument.id,
  title: 'What is the refund policy?',
  document: { id: readyDocument.id, title: 'Employee Handbook' },
  messages_count: 6,
  created_at: '',
  updated_at: new Date().toISOString(),
}

function pageOf<T> (items: T[]): Paginated<T> {
  return {
    data: items,
    links: { first: '', last: '', prev: null, next: null },
    meta: { current_page: 1, last_page: 1, per_page: 20, total: items.length, from: 1, to: items.length },
  }
}

let current: VueWrapper | undefined

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  current?.unmount()
  current = undefined
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function open () {
  const mounted = await mountPage('/', () => {
    useAuthStore().user = { id: 1, name: 'Ana Silva', email: 'ana@example.com', created_at: '' }
  })
  current = mounted.wrapper
  return mounted
}

function link (wrapper: VueWrapper, text: string) {
  return wrapper.findAll('a').find(element => accessibleText(element.element) === text)
}

describe('DashboardView', () => {
  it('greets the user and shows their numbers, recent documents and conversations', async () => {
    vi.mocked(statsApi.get).mockResolvedValue(makeStats())
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([readyDocument]))
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([conversation]))
    const { wrapper } = await open()

    expect(wrapper.get('h1').text()).toBe('Welcome back, Ana')

    const cards = wrapper.get('[aria-label="Overview"]').findAll('li')
    const card = (index: number) => ({
      label: cards[index]!.get('.stat__label').text(),
      value: cards[index]!.get('.stat__value').text(),
      text: cards[index]!.text(),
    })
    expect(card(0)).toMatchObject({ label: 'Documents', value: '3' })
    expect(cards[0]!.findAll('.pill').map(pill => pill.text())).toEqual(['2 ready', '1 failed'])
    expect(card(1)).toMatchObject({ label: 'Conversations', value: '4' })
    expect(card(2)).toMatchObject({ label: 'Pages indexed', value: (1250).toLocaleString() })
    expect(card(2).text).toContain('In 2 ready documents')
    expect(card(3)).toMatchObject({ label: 'Questions today', value: '12' })
    expect(card(3).text).toContain('/ 100')
    expect(card(3).text).toContain('88 left')

    const documentItem = wrapper.get(`[data-document-id="${readyDocument.id}"]`)
    expect(documentItem.text()).toContain('48 pages · 4.2 MB · just now')
    expect(link(wrapper, 'Chat')?.attributes('href')).toBe(`/documents/${readyDocument.id}/chat`)
    expect(link(wrapper, 'View all 3')?.attributes('href')).toBe('/documents')

    const conversationItem = wrapper.get(`[data-conversation-id="${conversation.id}"]`)
    expect(conversationItem.text()).toContain('Employee Handbook')
    expect(conversationItem.text()).toContain('3 questions')
    expect(link(wrapper, 'Resume')?.attributes('href')).toBe(`/conversations/${conversation.id}`)
  })

  it('guides a new user', async () => {
    vi.mocked(statsApi.get).mockResolvedValue(makeStats({
      documents: { total: 0, ready: 0, processing: 0, failed: 0 },
      pages_indexed: 0,
      conversations: 0,
    }))
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([]))
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([]))
    const { wrapper } = await open()

    expect(wrapper.text()).toContain('No documents yet.')
    expect(wrapper.text()).toContain('No conversations yet.')
    expect(link(wrapper, 'View all')).toBeUndefined()
  })

  it('shows a load error and tries again', async () => {
    vi.mocked(statsApi.get)
      .mockRejectedValueOnce(new ApiError('Request failed.', 403, 'forbidden'))
      .mockResolvedValue(makeStats())
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([]))
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([]))
    const { wrapper } = await open()

    expect(wrapper.get('[role="alert"]').text()).toContain('The dashboard could not be loaded')
    await wrapper.findAll('button').find(button => button.text() === 'Try again')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Questions today')
  })

  it('refreshes while documents are processing, then stops', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.mocked(statsApi.get)
      .mockResolvedValueOnce(makeStats({ documents: { total: 3, ready: 1, processing: 1, failed: 1 } }))
      .mockResolvedValue(makeStats())
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([]))
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([]))
    const { wrapper } = await open()

    expect(wrapper.text()).toContain('1 processing')
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()
    expect(wrapper.text()).not.toContain('processing')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(statsApi.get).toHaveBeenCalledTimes(2)
  })

  it('reloads after an upload from the dashboard', async () => {
    vi.mocked(statsApi.get).mockResolvedValue(makeStats())
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([]))
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([]))
    vi.mocked(documentsApi.upload).mockResolvedValue({ ...readyDocument, status: 'queued', is_finished: false })
    const { wrapper } = await open()

    await wrapper.findAll('button').find(button => accessibleText(button.element) === 'Browse files')!.trigger('click')
    await flushPromises()
    const input = document.body.querySelector<HTMLInputElement>('#upload-file')!
    Object.defineProperty(input, 'files', { value: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] })
    input.dispatchEvent(new Event('change'))
    await flushPromises()
    const upload = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(button => accessibleText(button) === 'Upload')!
    upload.click()
    await flushPromises()

    expect(documentsApi.upload).toHaveBeenCalledOnce()
    expect(statsApi.get).toHaveBeenCalledTimes(2)
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-11-03T12:00:00Z')

  it.each([
    ['2026-11-03T11:59:30Z', 'just now'],
    ['2026-11-03T11:55:00Z', '5 minutes ago'],
    ['2026-11-03T09:00:00Z', '3 hours ago'],
    ['2026-11-02T12:00:00Z', 'yesterday'],
    ['2026-10-20T12:00:00Z', '2 weeks ago'],
  ])('formats %s', (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected)
  })

  it('shows the date for older items', () => {
    expect(formatRelative('2026-08-01T12:00:00Z', now)).not.toContain('ago')
  })
})
