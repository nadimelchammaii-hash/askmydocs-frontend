import type { Document } from '@/types/api'

export interface StatusPresentation {
  label: string
  /** Theme color of the chip text and dot. */
  color: string
  /** Still being processed: show progress. */
  busy: boolean
}

/** Short reasons for failed documents, by `error_code` (the full `error_message` is shown as well). */
const FAILURE_LABELS: Record<string, string> = {
  invalid_pdf: 'Damaged file',
  encrypted_pdf: 'Password protected',
  extraction_not_permitted: 'Copying not allowed',
  no_text_layer: 'No selectable text',
  extraction_timeout: 'Took too long',
  extraction_failed: 'Processing failed',
  file_missing: 'File missing',
  embedding_failed: 'Indexing failed',
}

/**
 * Failures that may succeed on a second attempt (docs/api.md). The others are
 * problems with the file itself: retrying would fail again. Unknown codes are
 * treated as retryable.
 */
const PERMANENT_FAILURES = new Set(['invalid_pdf', 'encrypted_pdf', 'extraction_not_permitted', 'no_text_layer', 'file_missing'])

export function documentStatus (document: Document): StatusPresentation {
  switch (document.status) {
    case 'ready': {
      return { label: 'Ready', color: 'secondary', busy: false }
    }
    case 'failed': {
      const reason = document.error_code ? FAILURE_LABELS[document.error_code] : undefined
      return { label: reason ? `Failed: ${reason}` : 'Failed', color: 'error', busy: false }
    }
    case 'queued': {
      return { label: 'Queued', color: 'on-surface-variant', busy: true }
    }
    case 'extracting': {
      return { label: 'Reading text', color: 'primary', busy: true }
    }
    case 'embedding': {
      return { label: 'Indexing', color: 'primary', busy: true }
    }
    default: {
      // The API may add steps between queued and ready (docs/api.md).
      return document.is_finished
        ? { label: 'Unknown', color: 'on-surface-variant', busy: false }
        : { label: 'Processing', color: 'primary', busy: true }
    }
  }
}

export function canRetry (document: Document): boolean {
  return document.status === 'failed' && !PERMANENT_FAILURES.has(document.error_code ?? '')
}
