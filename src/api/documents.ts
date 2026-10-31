import type { Document, DocumentPage, DocumentStatus, Paginated, Resource } from '@/types/api'
import { http } from './http'
import { withoutEmpty } from './params'

export interface DocumentListParams {
  page?: number
  status?: DocumentStatus
  /** Case-insensitive search in titles. */
  search?: string
}

export interface UploadOptions {
  /** Defaults to the filename without `.pdf` (decided by the API). */
  title?: string
  /** Upload progress from 0 to 100. Processing happens afterwards; poll the document for that. */
  onProgress?: (percent: number) => void
  /** Lets the caller cancel the upload (e.g. the user closes the dialog). */
  signal?: AbortSignal
}

/** Mirrors the API limits (docs/api.md); the server validates again, these only give early feedback. */
export const DOCUMENT_LIMITS = {
  maxSizeBytes: 20 * 1024 * 1024,
  maxPages: 300,
} as const

const base = '/api/v1/documents'
const path = (id: string) => `${base}/${encodeURIComponent(id)}`

/** Endpoints from docs/api.md (documents). */
export const documentsApi = {
  /** The user's documents, newest first, 20 per page, optionally filtered. */
  async list (params: DocumentListParams = {}): Promise<Paginated<Document>> {
    const { data } = await http.get<Paginated<Document>>(base, { params: withoutEmpty(params) })
    return data
  },

  async rename (id: string, title: string): Promise<Document> {
    const { data } = await http.patch<Resource<Document>>(path(id), { title })
    return data.data
  },

  /**
   * Uploads a PDF. Resolves with the document in status `queued` (HTTP 202);
   * text extraction continues on the server.
   */
  async upload (file: File, options: UploadOptions = {}): Promise<Document> {
    const form = new FormData()
    form.append('file', file)
    if (options.title !== undefined) {
      form.append('title', options.title)
    }

    // No Content-Type header: the browser sets multipart/form-data with the right boundary.
    const { data } = await http.post<Resource<Document>>(base, form, {
      signal: options.signal,
      onUploadProgress: event => {
        if (options.onProgress && event.total) {
          options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
        }
      },
    })
    return data.data
  },

  async get (id: string, signal?: AbortSignal): Promise<Document> {
    const { data } = await http.get<Resource<Document>>(path(id), { signal })
    return data.data
  },

  /** The original PDF. Show it with URL.createObjectURL(blob) and revoke the URL when done. */
  async file (id: string, signal?: AbortSignal): Promise<Blob> {
    const { data } = await http.get<Blob>(`${path(id)}/file`, { responseType: 'blob', signal })
    return data
  },

  /** Extracted text of one page (1-based); 404 until the document is ready. */
  async page (id: string, pageNumber: number): Promise<DocumentPage> {
    const { data } = await http.get<Resource<DocumentPage>>(`${path(id)}/pages/${pageNumber}`)
    return data.data
  },

  /** Re-queues a failed document. Rejects with code `conflict` (409) if it has not failed. */
  async retry (id: string): Promise<Document> {
    const { data } = await http.post<Resource<Document>>(`${path(id)}/retry`)
    return data.data
  },

  /** Permanently deletes the document, its file and its text. */
  async remove (id: string): Promise<void> {
    await http.delete(path(id))
  },
}
