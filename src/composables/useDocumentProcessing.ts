import type { Document } from '@/types/api'
import { documentsApi } from '@/api/documents'
import { type PollingOptions, usePolling } from './usePolling'

/**
 * Follows a document's processing until it is ready or failed.
 *
 *   const { data: document, error } = useDocumentProcessing(id)
 *
 * `data` holds the latest Document; `error` the last ApiError (polling stops
 * on 404, e.g. when the document was deleted meanwhile).
 */
export function useDocumentProcessing (id: string, options: Omit<PollingOptions<Document>, 'until'> = {}) {
  return usePolling(signal => documentsApi.get(id, signal), {
    ...options,
    until: document => document.is_finished,
  })
}
