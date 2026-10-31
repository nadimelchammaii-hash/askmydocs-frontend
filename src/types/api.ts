/**
 * Types mirroring the backend API contract (askmydocs-backend/docs/api.md).
 * Keep in sync when the contract changes.
 */

/** Single resources are wrapped in `data`. */
export interface Resource<T> {
  data: T
}

/** JSON body of every API error response. */
export interface ApiErrorBody {
  message: string
  code: string
  errors?: Record<string, string[]>
}

export interface MessageResponse {
  message: string
}

export interface User {
  id: number
  name: string
  email: string
  /** ISO 8601 */
  created_at: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface LoginPayload {
  email: string
  password: string
  remember?: boolean
}

export interface ResetPasswordPayload {
  token: string
  email: string
  password: string
  password_confirmation: string
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
}

export interface UpdatePasswordPayload {
  current_password: string
  password: string
  password_confirmation: string
}

/** Paginated list (Laravel resource collection). */
export interface Paginated<T> {
  data: T[]
  links: { first: string, last: string, prev: string | null, next: string | null }
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number | null
    to: number | null
  }
}

/**
 * Processing lifecycle: queued -> extracting -> embedding -> ready, or -> failed.
 * Later phases may add steps; use `is_finished` to decide whether to keep polling.
 */
export type DocumentStatus = 'queued' | 'extracting' | 'embedding' | 'ready' | 'failed'

/** Known `error_code` values of failed documents (others may be added; treat unknown ones generically). */
export type DocumentErrorCode
  = | 'invalid_pdf'
    | 'encrypted_pdf'
    | 'extraction_not_permitted'
    | 'no_text_layer'
    | 'extraction_timeout'
    | 'extraction_failed'
    | 'file_missing'
    | 'embedding_failed'

export interface Document {
  /** ULID (lowercase) */
  id: string
  title: string
  original_filename: string
  size_bytes: number
  page_count: number | null
  status: DocumentStatus
  /** true when ready or failed: stop polling. */
  is_finished: boolean
  error_code: DocumentErrorCode | (string & {}) | null
  /** Safe to show to the user. */
  error_message: string | null
  /** ISO 8601 */
  created_at: string
  processed_at: string | null
  /** Present in lists. */
  conversations_count?: number
}

export interface DocumentPage {
  document_id: string
  /** 1-based */
  page_number: number
  text: string
  char_count: number
}

export type MessageRole = 'user' | 'assistant'

export type MessageStatus = 'pending' | 'completed' | 'failed'

/** Known `error_code` values of failed answers. */
export type AnswerErrorCode = 'answer_failed' | 'answer_refused' | 'document_not_ready'

export interface Citation {
  /** The [n] marker in the answer's content. Quotes from the same passage share a number. */
  number: number
  page_number: number
  /** Verified by the server to appear on that page. */
  quote: string
}

export interface Message {
  /** ULID */
  id: string
  conversation_id: string
  role: MessageRole
  status: MessageStatus
  /** true when completed or failed: stop polling. */
  is_finished: boolean
  /** Plain text (may quote the PDF): never render as HTML or Markdown. Null while pending. */
  content: string | null
  /** Assistant messages only. */
  answer_found: boolean | null
  error_code: AnswerErrorCode | (string & {}) | null
  /** Safe to show to the user. */
  error_message: string | null
  /** Empty for questions. */
  citations: Citation[]
  /** ISO 8601 */
  created_at: string
}

export interface Conversation {
  /** ULID */
  id: string
  document_id: string
  title: string
  /** Oldest first; present when returned by the API. */
  messages?: Message[]
  /** Present in lists and when reading a conversation. */
  document?: { id: string, title: string }
  /** Present in lists. */
  messages_count?: number
  created_at: string
  updated_at: string
}

export interface QuestionAndAnswer {
  question: Message
  /** Pending: poll it until is_finished. */
  answer: Message
}
