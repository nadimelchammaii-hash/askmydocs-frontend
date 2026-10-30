import type { Document } from '@/types/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { documentsApi } from '../documents'
import { ApiError } from '../errors'
import { http } from '../http'
import { fakeServer, requestedUrls } from './fakeServer'

const originalAdapter = http.defaults.adapter

const document: Document = {
  id: '01m661xjyep8kr1dxj5pascncn',
  title: 'Annual Report',
  original_filename: 'Annual Report.pdf',
  size_bytes: 1224,
  page_count: 3,
  status: 'queued',
  is_finished: false,
  error_code: null,
  error_message: null,
  created_at: '2026-10-30T09:10:35+00:00',
  processed_at: null,
}

function pdfFile (name = 'Annual Report.pdf') {
  return new File(['%PDF-1.4 test'], name, { type: 'application/pdf' })
}

afterEach(() => {
  http.defaults.adapter = originalAdapter
})

describe('documentsApi', () => {
  it('lists a page of documents', async () => {
    const page = { data: [document], links: {}, meta: { current_page: 2, last_page: 2, per_page: 20, total: 21, from: 21, to: 21 } }
    const adapter = fakeServer(() => ({ status: 200, data: page }))

    await expect(documentsApi.list(2)).resolves.toEqual(page)
    expect(adapter.mock.calls[0]![0].params).toEqual({ page: 2 })
  })

  it('uploads the file as multipart form data and reports progress', async () => {
    const progress: number[] = []
    const adapter = fakeServer(config => {
      config.onUploadProgress?.({ loaded: 512, total: 1024, bytes: 512, lengthComputable: true })
      config.onUploadProgress?.({ loaded: 1024, total: 1024, bytes: 512, lengthComputable: true })
      return { status: 202, data: { data: document } }
    })

    const result = await documentsApi.upload(pdfFile(), { title: 'Q4', onProgress: p => progress.push(p) })

    expect(result).toEqual(document)
    expect(progress).toEqual([50, 100])

    const [config] = adapter.mock.calls[0]!
    expect(`${config.method?.toUpperCase()} ${config.url}`).toBe('POST /api/v1/documents')
    const form = config.data as FormData
    expect(form).toBeInstanceOf(FormData)
    expect((form.get('file') as File).name).toBe('Annual Report.pdf')
    expect(form.get('title')).toBe('Q4')
  })

  it('omits the title when none is given, so the API derives it from the filename', async () => {
    const adapter = fakeServer(() => ({ status: 202, data: { data: document } }))

    await documentsApi.upload(pdfFile())

    expect((adapter.mock.calls[0]![0].data as FormData).has('title')).toBe(false)
  })

  it('passes the abort signal so an upload can be cancelled', async () => {
    const adapter = fakeServer(() => ({ status: 202, data: { data: document } }))
    const controller = new AbortController()

    await documentsApi.upload(pdfFile(), { signal: controller.signal })

    expect(adapter.mock.calls[0]![0].signal).toBe(controller.signal)
  })

  it('exposes validation errors for the file field', async () => {
    fakeServer(() => ({
      status: 422,
      data: { message: 'The file must be a PDF.', code: 'validation_failed', errors: { file: ['The file must be a PDF.'] } },
    }))

    const error = await documentsApi.upload(pdfFile('virus.pdf')).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'validation_failed', errors: { file: ['The file must be a PDF.'] } })
  })

  it('calls the documented endpoints', async () => {
    const adapter = fakeServer(config => {
      if (config.method === 'delete') {
        return { status: 204 }
      }
      if (config.url?.endsWith('/file')) {
        return { status: 200, data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) }
      }
      if (config.url?.includes('/pages/')) {
        return { status: 200, data: { data: { document_id: document.id, page_number: 2, text: 'Page two.', char_count: 9 } } }
      }
      return { status: 200, data: { data: document } }
    })

    await documentsApi.get(document.id)
    const blob = await documentsApi.file(document.id)
    const page = await documentsApi.page(document.id, 2)
    await documentsApi.retry(document.id)
    await documentsApi.remove(document.id)

    expect(blob).toBeInstanceOf(Blob)
    expect(page.text).toBe('Page two.')
    expect(adapter.mock.calls[1]![0].responseType).toBe('blob')
    expect(requestedUrls(adapter)).toEqual([
      `GET /api/v1/documents/${document.id}`,
      `GET /api/v1/documents/${document.id}/file`,
      `GET /api/v1/documents/${document.id}/pages/2`,
      `POST /api/v1/documents/${document.id}/retry`,
      `DELETE /api/v1/documents/${document.id}`,
    ])
  })

  it('encodes ids so they cannot change the request path', async () => {
    const adapter = fakeServer(() => ({ status: 200, data: { data: document } }))

    await documentsApi.get('../user')

    expect(adapter.mock.calls[0]![0].url).toBe('/api/v1/documents/..%2Fuser')
  })

  it('turns a JSON error body of a file download into a normal ApiError', async () => {
    fakeServer(() => ({
      status: 404,
      data: new Blob([JSON.stringify({ message: 'Resource not found.', code: 'not_found' })], { type: 'application/json' }),
    }))

    await expect(documentsApi.file(document.id)).rejects.toMatchObject({ status: 404, code: 'not_found', message: 'Resource not found.' })
  })

  it('rejects a retry of a document that has not failed with code conflict', async () => {
    fakeServer(() => ({ status: 409, data: { message: 'Only documents whose processing failed can be retried.', code: 'conflict' } }))

    await expect(documentsApi.retry(document.id)).rejects.toMatchObject({ status: 409, code: 'conflict' })
  })
})

describe('documentsApi upload progress', () => {
  it('ignores progress events without a known total', async () => {
    const onProgress = vi.fn()
    fakeServer(config => {
      config.onUploadProgress?.({ loaded: 100, total: undefined, bytes: 100, lengthComputable: false })
      return { status: 202, data: { data: document } }
    })

    await documentsApi.upload(pdfFile(), { onProgress })

    expect(onProgress).not.toHaveBeenCalled()
  })
})
