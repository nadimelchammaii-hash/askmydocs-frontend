import type * as DocumentsModule from '@/api/documents'
import type { Document, Paginated } from '@/types/api'
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accessibleText, mountPage } from '@/__tests__/mountPage'
import { documentsApi } from '@/api/documents'
import { ApiError } from '@/api/errors'
import { filtersFromQuery } from '@/composables/useDocumentLibrary'
import { canRetry } from '@/utils/documentStatus'
import { formatBytes } from '@/utils/format'

vi.mock('@/api/documents', async importOriginal => ({
  ...await importOriginal<typeof DocumentsModule>(),
  documentsApi: {
    list: vi.fn(),
    get: vi.fn(),
    upload: vi.fn(),
    rename: vi.fn(),
    retry: vi.fn(),
    remove: vi.fn(),
    file: vi.fn(),
  },
}))

function makeDocument (overrides: Partial<Document> = {}): Document {
  return {
    id: '01jdoc0000000000000000000a',
    title: 'Employee Handbook',
    original_filename: 'employee-handbook.pdf',
    size_bytes: 4.2 * 1024 * 1024,
    page_count: 48,
    status: 'ready',
    is_finished: true,
    error_code: null,
    error_message: null,
    created_at: '2026-10-12T09:00:00+00:00',
    processed_at: '2026-10-12T09:01:00+00:00',
    conversations_count: 0,
    ...overrides,
  }
}

function pageOf (documents: Document[], meta: Partial<Paginated<Document>['meta']> = {}): Paginated<Document> {
  return {
    data: documents,
    links: { first: '', last: '', prev: null, next: null },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 20,
      total: documents.length,
      from: documents.length > 0 ? 1 : null,
      to: documents.length > 0 ? documents.length : null,
      ...meta,
    },
  }
}

const ready = makeDocument()
const processing = makeDocument({ id: '01jdoc0000000000000000000b', title: 'Research Paper', status: 'extracting', is_finished: false, page_count: null, processed_at: null })
const timedOut = makeDocument({
  id: '01jdoc0000000000000000000c',
  title: 'Annual Report',
  status: 'failed',
  error_code: 'extraction_timeout',
  error_message: 'Processing took too long. Try again later.',
})
const encrypted = makeDocument({
  id: '01jdoc0000000000000000000d',
  title: 'Tax Return',
  status: 'failed',
  error_code: 'encrypted_pdf',
  error_message: 'This PDF is password-protected.',
})

let current: VueWrapper | undefined

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  current?.unmount()
  current = undefined
  document.body.innerHTML = ''
})

async function open (path: string) {
  const mounted = await mountPage(path)
  current = mounted.wrapper
  return mounted
}

function row (wrapper: VueWrapper, document: Document) {
  return wrapper.get(`[data-document-id="${document.id}"]`)
}

/** Buttons and links anywhere in the page, including dialogs and menus (rendered in <body>). */
function control (label: string, root: ParentNode = document.body): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('button, a, .v-list-item')]
    .find(element => element.getAttribute('aria-label') === label || accessibleText(element) === label)
}

async function click (label: string, root?: ParentNode) {
  const element = control(label, root)
  expect(element, `control "${label}"`).toBeDefined()
  element!.click()
  await flushPromises()
}

function chooseFile (file: File) {
  const input = document.body.querySelector<HTMLInputElement>('#upload-file')!
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change'))
  return flushPromises()
}

describe('DocumentLibraryView', () => {
  it('lists documents with their status and the actions that fit it', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([ready, processing, timedOut, encrypted]))
    vi.mocked(documentsApi.get).mockResolvedValue(processing)
    const { wrapper } = await open('/documents')

    expect(documentsApi.list).toHaveBeenCalledWith({ page: 1, status: undefined, search: undefined })
    expect(wrapper.text()).toContain('4 DOCUMENTS')

    const readyRow = row(wrapper, ready)
    expect(readyRow.text()).toContain('4.2 MB')
    expect(readyRow.text()).toContain('48 pages')
    expect(readyRow.text()).toContain('Ready')
    const chat = readyRow.findAll('a').find(link => accessibleText(link.element) === 'Start chat')
    expect(chat?.attributes('href')).toBe(`/documents/${ready.id}/chat`)

    const processingRow = row(wrapper, processing)
    expect(processingRow.text()).toContain('Reading text')
    expect(processingRow.find('button[disabled]').text()).toContain('Start chat')

    expect(row(wrapper, timedOut).text()).toContain('Processing took too long. Try again later.')
    expect(row(wrapper, timedOut).text()).toContain('Retry')

    // Retrying cannot fix a password-protected file.
    expect(row(wrapper, encrypted).text()).toContain('Failed: Password protected')
    expect(row(wrapper, encrypted).text()).not.toContain('Retry')
  })

  it('takes the filters from the URL and writes changes back to it', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([timedOut], { current_page: 2, last_page: 2, total: 21, from: 21, to: 21 }))
    const { wrapper, router } = await open('/documents?search=report&status=failed&page=2')

    expect(documentsApi.list).toHaveBeenCalledWith({ page: 2, status: 'failed', search: 'report' })
    expect((wrapper.get('input[aria-label="Filter documents by title"]').element as HTMLInputElement).value).toBe('report')
    expect(control('Failed')?.getAttribute('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('Showing 21–21 of 21 documents')

    await click('All documents')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ search: 'report' }))
    expect(documentsApi.list).toHaveBeenLastCalledWith({ page: 1, status: undefined, search: 'report' })

    await wrapper.get('input[aria-label="Filter documents by title"]').setValue('  annual ')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ search: 'annual' }))
    expect(documentsApi.list).toHaveBeenLastCalledWith({ page: 1, status: undefined, search: 'annual' })
  })

  it('invites to upload when the library is empty', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([]))
    const { wrapper } = await open('/documents')

    expect(wrapper.text()).toContain('No documents yet')
    expect(control('Upload your first PDF')).toBeDefined()
  })

  it('offers to clear filters when nothing matches', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([]))
    const { wrapper, router } = await open('/documents?search=nothing')

    expect(wrapper.text()).toContain('No documents match')
    await click('Clear filters')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({}))
  })

  it('follows documents that are still being processed until they are ready', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([processing]))
    vi.mocked(documentsApi.get).mockResolvedValue({ ...processing, status: 'ready', is_finished: true, page_count: 12 })
    const { wrapper } = await open('/documents')

    await vi.waitFor(() => expect(row(wrapper, processing).text()).toContain('Ready'))
    expect(documentsApi.get).toHaveBeenCalledWith(processing.id, expect.any(AbortSignal))
    expect(row(wrapper, processing).text()).toContain('12 pages')
  })

  it('shows a load error and loads again on request', async () => {
    vi.mocked(documentsApi.list)
      .mockRejectedValueOnce(new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'network_error'))
      .mockResolvedValueOnce(pageOf([ready]))
    const { wrapper } = await open('/documents')

    expect(wrapper.get('[role="alert"]').text()).toContain('Cannot reach the server.')
    await click('Try again')
    expect(row(wrapper, ready).text()).toContain('Employee Handbook')
  })

  it('switches to cards on small screens', async () => {
    const width = window.innerWidth
    window.innerWidth = 400
    window.dispatchEvent(new Event('resize'))
    try {
      vi.mocked(documentsApi.list).mockResolvedValue(pageOf([ready]))
      const { wrapper } = await open('/documents')

      expect(wrapper.find('table').exists()).toBe(false)
      expect(row(wrapper, ready).element.tagName).toBe('LI')
      expect(row(wrapper, ready).text()).toContain('Chat')
    } finally {
      window.innerWidth = width
      window.dispatchEvent(new Event('resize'))
    }
  })
})

describe('Uploading', () => {
  it('opens from ?upload=1, shows progress and adds the document to the list', async () => {
    const uploaded = makeDocument({ id: '01jdoc0000000000000000000e', title: 'Contract', status: 'queued', is_finished: false, page_count: null })
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([ready]))
    vi.mocked(documentsApi.get).mockResolvedValue(uploaded)
    let finish: (document: Document) => void = () => {}
    vi.mocked(documentsApi.upload).mockImplementation((_file, options) => new Promise(resolve => {
      options?.onProgress?.(40)
      finish = resolve
    }))
    const { wrapper, router } = await open('/documents?upload=1')

    // The parameter only opens the dialog: it is removed so a reload does not reopen it.
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({}))
    expect(document.body.textContent).toContain('Upload a PDF')

    const file = new File(['%PDF-1.7'], 'contract.pdf', { type: 'application/pdf' })
    await chooseFile(file)
    expect(document.body.textContent).toContain('contract.pdf')

    await click('Upload')
    expect(documentsApi.upload).toHaveBeenCalledWith(file, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(document.body.textContent).toContain('40%')

    finish(uploaded)
    await flushPromises()

    expect(row(wrapper, uploaded).text()).toContain('Queued')
    expect(wrapper.text()).toContain('2 DOCUMENTS')
    expect(documentsApi.get).toHaveBeenCalledWith(uploaded.id, expect.any(AbortSignal))
    await vi.waitFor(() => expect(document.body.textContent).toContain('“Contract” uploaded. Processing has started.'))
  })

  it('checks the file type and size before uploading', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([]))
    await open('/documents?upload=1')

    await chooseFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Choose a PDF file.')

    const large = new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' })
    Object.defineProperty(large, 'size', { value: 25 * 1024 * 1024 })
    await chooseFile(large)
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('This file is 25 MB; the maximum is 20 MB.')

    expect(control('Upload')?.hasAttribute('disabled')).toBe(true)
    expect(documentsApi.upload).not.toHaveBeenCalled()
  })

  it('shows why the API rejected the file', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([]))
    vi.mocked(documentsApi.upload).mockRejectedValue(new ApiError('The given data was invalid.', 422, 'validation_failed', {
      file: ['This PDF has 412 pages; the maximum is 300.'],
    }))
    await open('/documents?upload=1')

    await chooseFile(new File(['%PDF'], 'book.pdf', { type: 'application/pdf' }))
    await click('Upload')

    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('This PDF has 412 pages; the maximum is 300.')
  })
})

describe('Document actions', () => {
  it('renames a document', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([ready]))
    vi.mocked(documentsApi.rename).mockResolvedValue({ ...ready, title: 'Handbook 2026' })
    const { wrapper } = await open('/documents')

    await click('More actions for Employee Handbook')
    await click('Rename')
    const input = document.body.querySelector<HTMLInputElement>('#rename-input')!
    expect(input.value).toBe('Employee Handbook')
    input.value = '  Handbook 2026 '
    input.dispatchEvent(new Event('input'))
    await click('Save')

    expect(documentsApi.rename).toHaveBeenCalledWith(ready.id, 'Handbook 2026')
    expect(row(wrapper, ready).text()).toContain('Handbook 2026')
  })

  it('deletes a document after confirmation and reloads the list', async () => {
    vi.mocked(documentsApi.list)
      .mockResolvedValueOnce(pageOf([{ ...ready, conversations_count: 2 }]))
      .mockResolvedValueOnce(pageOf([]))
    vi.mocked(documentsApi.remove).mockResolvedValue()
    const { wrapper } = await open('/documents')

    await click('More actions for Employee Handbook')
    await click('Delete')
    expect(document.body.textContent).toContain('and 2 conversations about it')
    expect(documentsApi.remove).not.toHaveBeenCalled()

    // The dialog's button (the closing menu still has an item with the same name).
    await click('Delete', document.body.querySelector('#delete-title')!.closest('.v-overlay__content')!)
    expect(documentsApi.remove).toHaveBeenCalledWith(ready.id)
    expect(documentsApi.list).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('No documents yet')
  })

  it('retries a failed document and follows it again', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue(pageOf([timedOut]))
    vi.mocked(documentsApi.retry).mockResolvedValue({ ...timedOut, status: 'queued', is_finished: false, error_code: null, error_message: null })
    vi.mocked(documentsApi.get).mockResolvedValue({ ...timedOut, status: 'ready', is_finished: true, error_code: null, error_message: null })
    const { wrapper } = await open('/documents')

    await click('Retry')

    expect(documentsApi.retry).toHaveBeenCalledWith(timedOut.id)
    await vi.waitFor(() => expect(row(wrapper, timedOut).text()).toContain('Ready'))
  })
})

describe('filtersFromQuery', () => {
  it.each([
    [{}, { page: 1, status: undefined, search: undefined }],
    [{ page: '3', status: 'ready', search: ' report ' }, { page: 3, status: 'ready', search: 'report' }],
    // Hand-edited URLs: invalid values are ignored instead of causing API errors.
    [{ page: '-1', status: 'deleted', search: ' '.repeat(3) }, { page: 1, status: undefined, search: undefined }],
    [{ page: '1.5', search: 'x'.repeat(150) }, { page: 1, status: undefined, search: 'x'.repeat(100) }],
  ])('reads %j', (query, expected) => {
    expect(filtersFromQuery(query)).toEqual(expected)
  })
})

describe('helpers', () => {
  it('formats sizes', () => {
    expect([formatBytes(500), formatBytes(300 * 1024), formatBytes(4.2 * 1024 * 1024), formatBytes(20 * 1024 * 1024)])
      .toEqual(['1 KB', '300 KB', '4.2 MB', '20 MB'])
  })

  it('only offers retry for failures that may succeed later', () => {
    expect(canRetry(timedOut)).toBe(true)
    expect(canRetry(makeDocument({ status: 'failed', error_code: 'embedding_failed' }))).toBe(true)
    expect(canRetry(encrypted)).toBe(false)
    expect(canRetry(ready)).toBe(false)
  })
})
