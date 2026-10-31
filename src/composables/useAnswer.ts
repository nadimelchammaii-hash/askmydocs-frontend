import type { Message } from '@/types/api'
import { conversationsApi } from '@/api/conversations'
import { type PollingOptions, usePolling } from './usePolling'

/**
 * Follows a pending answer until it is completed or failed.
 *
 *   const { data: answer, error } = useAnswer(conversationId, answerId)
 *
 * Answers usually take a few seconds, so polling starts faster than for
 * documents (1 s, backing off to 5 s).
 */
export function useAnswer (
  conversationId: string,
  messageId: string,
  options: Omit<PollingOptions<Message>, 'until'> = {},
) {
  return usePolling(signal => conversationsApi.message(conversationId, messageId, signal), {
    interval: 1000,
    maxInterval: 5000,
    ...options,
    until: message => message.is_finished,
  })
}
