import type { Conversation, Document, Message } from '@/types/api'
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { accessibleText, mountPage } from '@/__tests__/mountPage'
import { conversationsApi } from '@/api/conversations'
import { documentsApi } from '@/api/documents'
import { ApiError } from '@/api/errors'

vi.mock('@/api/documents', async importOriginal => ({
  ...await importOriginal<object>(),
  documentsApi: { get: vi.fn(), file: vi.fn() },
}))
vi.mock('@/api/conversations', async importOriginal => ({
  ...await importOriginal<object>(),
  conversationsApi: { get: vi.fn(), start: vi.fn(), ask: vi.fn(), message: vi.fn(), retryAnswer: vi.fn() },
}))
// pdf.js needs a real browser (canvas, workers): the viewer is replaced by a stub that shows its input.
vi.mock('@/components/chat/PdfViewer.vue', () => ({
  // Lets Vue's lazy loading (defineAsyncComponent) use `default`.
  __esModule: true,
  default: defineComponent({
    props: { documentId: String, target: Object },
    setup: props => () => h('div', { 'data-testid': 'pdf', 'data-document': props.documentId, 'data-target': JSON.stringify(props.target ?? null) }),
  }),
}))

const document_: Document = {
  id: '01jdoc0000000000000000000a',
  title: 'Store Handbook',
  original_filename: 'handbook.pdf',
  size_bytes: 1024 * 1024,
  page_count: 12,
  status: 'ready',
  is_finished: true,
  error_code: null,
  error_message: null,
  is_sample: false,
  created_at: '2026-11-01T10:00:00Z',
  processed_at: '2026-11-01T10:01:00Z',
}

const conversationId = '01jconv000000000000000000a'

function message (overrides: Partial<Message>): Message {
  return {
    id: '01jmsg00000000000000000000',
    conversation_id: conversationId,
    role: 'assistant',
    status: 'completed',
    is_finished: true,
    content: null,
    answer_found: true,
    error_code: null,
    error_message: null,
    citations: [],
    created_at: '2026-11-03T10:00:00Z',
    ...overrides,
  }
}

const question = message({ id: 'q1', role: 'user', content: 'What is the refund policy?', answer_found: null })
const pending = message({ id: 'a1', status: 'pending', is_finished: false, answer_found: null })
const answered = message({
  id: 'a1',
  content: 'Refunds are possible within 30 days [1]. A receipt is needed [2].',
  citations: [
    { number: 1, page_number: 4, quote: 'Refunds within 30 days.' },
    { number: 2, page_number: 9, quote: 'Receipts are required.' },
  ],
})

function conversationWith (messages: Message[]): Conversation {
  return { id: conversationId, document_id: document_.id, title: 'What is the refund policy?', messages, created_at: '', updated_at: '' }
}

let current: VueWrapper | undefined

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(documentsApi.get).mockResolvedValue(document_)
})

afterEach(() => {
  current?.unmount()
  current = undefined
  document.body.innerHTML = ''
})

async function open (path: string) {
  const mounted = await mountPage(path)
  current = mounted.wrapper
  await flushPromises()
  return mounted
}

function button (wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find(element => element.attributes('aria-label') === label || accessibleText(element.element) === label)
  expect(found, `button "${label}"`).toBeDefined()
  return found!
}

async function type (wrapper: VueWrapper, text: string) {
  await wrapper.get('textarea[aria-label="Your question"]').setValue(text)
}

describe('ChatView: new conversation', () => {
  it('starts a conversation with the first question and follows the answer', async () => {
    vi.mocked(conversationsApi.start).mockResolvedValue(conversationWith([question, pending]))
    vi.mocked(conversationsApi.message).mockResolvedValue(answered)
    const { wrapper, router } = await open(`/documents/${document_.id}/chat`)

    expect(wrapper.get('h1').text()).toBe('Store Handbook')
    expect(wrapper.text()).toContain('Ask a question about this PDF')

    // A suggestion fills the question box.
    await button(wrapper, 'What is this document about?').trigger('click')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('What is this document about?')

    await type(wrapper, '  What is the refund policy?  ')
    await wrapper.get('form.composer').trigger('submit')
    await flushPromises()

    expect(conversationsApi.start).toHaveBeenCalledWith(document_.id, 'What is the refund policy?')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('conversation'))
    expect(router.currentRoute.value.params.conversationId).toBe(conversationId)
    // The conversation is already shown: no second load.
    expect(conversationsApi.get).not.toHaveBeenCalled()

    await vi.waitFor(() => expect(wrapper.text()).toContain('Refunds are possible within 30 days'))
    expect(conversationsApi.message).toHaveBeenCalledWith(conversationId, 'a1', expect.any(AbortSignal))
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('explains why questions are not possible yet', async () => {
    const processing = { ...document_, status: 'embedding' as const, is_finished: false }
    // Loaded, then checked again right away (still processing), then ready.
    vi.mocked(documentsApi.get)
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(processing)
      .mockResolvedValue(document_)
    const { wrapper } = await open(`/documents/${document_.id}/chat`)

    expect(wrapper.text()).toContain('The document is still being processed.')
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('The document is still being processed…')

    // The document is followed until it is ready.
    await vi.waitFor(() => expect(wrapper.get('textarea').attributes('placeholder')).toBe('Ask a question about this PDF…'), { timeout: 4000 })
  })
})

describe('ChatView: existing conversation', () => {
  beforeEach(() => {
    vi.mocked(conversationsApi.get).mockResolvedValue(conversationWith([question, answered]))
  })

  it('shows the answer with citations as pills and a list of sources', async () => {
    const { wrapper } = await open(`/conversations/${conversationId}`)

    expect(conversationsApi.get).toHaveBeenCalledWith(conversationId)
    expect(documentsApi.get).toHaveBeenCalledWith(document_.id)

    const answer = wrapper.get('article[aria-label="Answer"]')
    expect(answer.findAll('button[aria-label^="Source"]').map(pill => pill.attributes('aria-label'))).toEqual(['Source 1, p. 4', 'Source 2, p. 9'])
    expect(answer.get('[aria-label="Sources"]').text()).toContain('Refunds within 30 days.')
    expect(wrapper.text()).toContain('New chat')
  })

  it('opens a citation in the PDF viewer with its page and quote', async () => {
    const { wrapper } = await open(`/conversations/${conversationId}`)
    expect(wrapper.find('[data-testid="pdf"]').exists()).toBe(false)

    await button(wrapper, 'Source 2, p. 9').trigger('click')
    await flushPromises()

    const pdf = wrapper.get('[data-testid="pdf"]')
    expect(pdf.attributes('data-document')).toBe(document_.id)
    expect(JSON.parse(pdf.attributes('data-target')!)).toEqual({ page: 9, number: 2, quotes: ['Receipts are required.'] })
  })

  it('asks a follow-up with Enter', async () => {
    const followUp = message({ id: 'q2', role: 'user', content: 'And for sale items?' })
    vi.mocked(conversationsApi.ask).mockResolvedValue({ question: followUp, answer: { ...pending, id: 'a2' } })
    vi.mocked(conversationsApi.message).mockResolvedValue({ ...answered, id: 'a2', content: 'Sale items get store credit [1].' })
    const { wrapper } = await open(`/conversations/${conversationId}`)

    await type(wrapper, 'And for sale items?')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(conversationsApi.ask).toHaveBeenCalledWith(conversationId, 'And for sale items?')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Sale items get store credit'))
  })

  it('keeps the question and shows the reason when it is refused', async () => {
    vi.mocked(conversationsApi.ask).mockRejectedValue(new ApiError('You have reached today\'s question limit. Please try again tomorrow.', 429, 'daily_limit_reached'))
    const { wrapper } = await open(`/conversations/${conversationId}`)

    await type(wrapper, 'One more?')
    await wrapper.get('form.composer').trigger('submit')
    await flushPromises()

    expect(wrapper.get('form.composer [role="alert"]').text()).toContain('today\'s question limit')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('One more?')
  })

  it('shows answer text as text, never as HTML', async () => {
    vi.mocked(conversationsApi.get).mockResolvedValue(conversationWith([
      question,
      message({ id: 'a1', content: '<img src=x onerror=alert(1)> <b>bold</b> [1]', citations: [{ number: 1, page_number: 2, quote: '<script>' }] }),
    ]))
    const { wrapper } = await open(`/conversations/${conversationId}`)

    const answer = wrapper.get('article[aria-label="Answer"]')
    expect(answer.find('img').exists()).toBe(false)
    expect(answer.find('b').exists()).toBe(false)
    expect(answer.text()).toContain('<img src=x onerror=alert(1)> <b>bold</b>')
  })
})

describe('ChatView: failed and missing answers', () => {
  it('retries a failed answer', async () => {
    const failed = message({ id: 'a1', status: 'failed', error_code: 'answer_failed', error_message: 'The answer could not be generated. Please try again.' })
    vi.mocked(conversationsApi.get).mockResolvedValue(conversationWith([question, failed]))
    vi.mocked(conversationsApi.retryAnswer).mockResolvedValue(pending)
    vi.mocked(conversationsApi.message).mockResolvedValue(answered)
    const { wrapper } = await open(`/conversations/${conversationId}`)

    expect(wrapper.text()).toContain('The answer could not be generated.')
    await button(wrapper, 'Try again').trigger('click')
    await flushPromises()

    expect(conversationsApi.retryAnswer).toHaveBeenCalledWith(conversationId, 'a1')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Refunds are possible within 30 days'))
  })

  it('does not offer retry for a refused question', async () => {
    const refused = message({ id: 'a1', status: 'failed', error_code: 'answer_refused', error_message: 'Please rephrase your question.' })
    vi.mocked(conversationsApi.get).mockResolvedValue(conversationWith([question, refused]))
    const { wrapper } = await open(`/conversations/${conversationId}`)

    expect(wrapper.text()).toContain('Please rephrase your question.')
    expect(wrapper.findAll('button').some(element => accessibleText(element.element) === 'Try again')).toBe(false)
  })

  it('marks answers that are not in the document', async () => {
    vi.mocked(conversationsApi.get).mockResolvedValue(conversationWith([
      question,
      message({ id: 'a1', answer_found: false, content: 'The document does not mention refunds.' }),
    ]))
    const { wrapper } = await open(`/conversations/${conversationId}`)

    expect(wrapper.text()).toContain('Not found in this document')
    expect(wrapper.find('[aria-label="Sources"]').exists()).toBe(false)
  })

  it('explains an unknown conversation', async () => {
    vi.mocked(conversationsApi.get).mockRejectedValue(new ApiError('Not found.', 404, 'not_found'))
    const { wrapper } = await open(`/conversations/${conversationId}`)

    expect(wrapper.text()).toContain('This conversation or document does not exist')
  })
})
