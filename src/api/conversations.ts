import type { Conversation, Message, Paginated, QuestionAndAnswer, Resource } from '@/types/api'
import { http } from './http'
import { withoutEmpty } from './params'

/** Mirrors the API limit (docs/api.md); the server validates again. */
export const QUESTION_MAX_CHARS = 1000

export interface ConversationListParams {
  page?: number
  /** Only conversations about this document. */
  documentId?: string
}

const path = (id: string) => `/api/v1/conversations/${encodeURIComponent(id)}`

/** Endpoints from docs/api.md (questions and answers). Answers arrive pending: poll them. */
export const conversationsApi = {
  /** The user's conversations, most recently active first, 20 per page (with document title and message count). */
  async list (params: ConversationListParams = {}): Promise<Paginated<Conversation>> {
    const { data } = await http.get<Paginated<Conversation>>('/api/v1/conversations', {
      params: withoutEmpty({ page: params.page, document_id: params.documentId }),
    })
    return data
  },

  /** A whole conversation: every message, oldest first, with citations. */
  async get (id: string): Promise<Conversation> {
    const { data } = await http.get<Resource<Conversation>>(path(id))
    return data.data
  },

  /**
   * Starts a conversation about a document. Resolves with the conversation and
   * its two messages: [question, pending answer].
   * Rejects with code `document_not_ready` (409) or `daily_limit_reached` (429).
   */
  async start (documentId: string, question: string): Promise<Conversation> {
    const { data } = await http.post<Resource<Conversation>>(
      `/api/v1/documents/${encodeURIComponent(documentId)}/conversations`,
      { question },
    )
    return data.data
  },

  /** Asks a follow-up. Rejects with code `answer_pending` (409) while an answer is still pending. */
  async ask (conversationId: string, question: string): Promise<QuestionAndAnswer> {
    const { data } = await http.post<Resource<QuestionAndAnswer>>(`${path(conversationId)}/questions`, { question })
    return data.data
  },

  /** One message, typically a pending answer being polled. */
  async message (conversationId: string, messageId: string, signal?: AbortSignal): Promise<Message> {
    const { data } = await http.get<Resource<Message>>(
      `${path(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      { signal },
    )
    return data.data
  },

  /**
   * Asks again for a failed answer. Resolves with the answer, pending again: poll it.
   * Rejects with `answer_not_failed`, `answer_pending` or `document_not_ready` (409).
   */
  async retryAnswer (conversationId: string, messageId: string): Promise<Message> {
    const { data } = await http.post<Resource<Message>>(
      `${path(conversationId)}/messages/${encodeURIComponent(messageId)}/retry`,
    )
    return data.data
  },

  async rename (id: string, title: string): Promise<Conversation> {
    const { data } = await http.patch<Resource<Conversation>>(path(id), { title })
    return data.data
  },

  /** Deletes the conversation with all its messages. */
  async remove (id: string): Promise<void> {
    await http.delete(path(id))
  },
}
