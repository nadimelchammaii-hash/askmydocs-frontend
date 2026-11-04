import type { Conversation, Document, Message } from '@/types/api'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { conversationsApi } from '@/api/conversations'
import { documentsApi } from '@/api/documents'
import { type ApiError, toApiError } from '@/api/errors'
import { usePolling } from './usePolling'

function param (value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * State of the chat page. Two routes use it:
 * - /documents/:documentId/chat — a new conversation about a document;
 * - /conversations/:conversationId — an existing conversation.
 * The first question creates the conversation and moves to the second URL.
 */
export function useConversation () {
  const route = useRoute()
  const router = useRouter()

  const document = shallowRef<Document | null>(null)
  const conversation = shallowRef<Conversation | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(true)
  const loadError = shallowRef<ApiError | null>(null)
  const sending = ref(false)
  const sendError = ref<string | null>(null)

  const pendingAnswer = computed(() => messages.value.find(message => message.role === 'assistant' && !message.is_finished) ?? null)
  const canAsk = computed(() => document.value?.status === 'ready' && pendingAnswer.value === null && !sending.value)

  function replaceMessage (updated: Message) {
    const index = messages.value.findIndex(message => message.id === updated.id)
    if (index !== -1) {
      messages.value[index] = updated
    }
  }

  // --- Following a pending answer (one at a time: the API allows one per conversation).
  let followedId: string | null = null
  const answerPolling = usePolling(
    signal => conversationsApi.message(conversation.value!.id, followedId!, signal),
    { immediate: false, interval: 1000, maxInterval: 5000, until: message => message.is_finished },
  )
  watch(answerPolling.data, message => {
    if (message) {
      replaceMessage(message)
    }
  })

  function follow (answer: Message | null) {
    if (answer && !answer.is_finished) {
      followedId = answer.id
      answerPolling.start()
    }
  }

  // --- Following a document that is still being processed.
  const documentPolling = usePolling(
    signal => documentsApi.get(document.value!.id, signal),
    { immediate: false, until: current => current.is_finished },
  )
  watch(documentPolling.data, current => {
    if (current) {
      document.value = current
    }
  })

  // --- Loading -----------------------------------------------------------------
  let latestLoad = 0

  async function load () {
    const conversationId = param(route.params.conversationId)
    const documentId = param(route.params.documentId)
    // Moving from the new-chat URL to the conversation it just created: already loaded.
    if (conversationId && conversationId === conversation.value?.id) {
      return
    }

    const run = ++latestLoad
    answerPolling.stop()
    documentPolling.stop()
    loading.value = true
    loadError.value = null
    sendError.value = null
    try {
      let loadedConversation: Conversation | null = null
      let loadedDocument: Document
      if (conversationId) {
        loadedConversation = await conversationsApi.get(conversationId)
        loadedDocument = await documentsApi.get(loadedConversation.document_id)
      } else if (documentId) {
        loadedDocument = await documentsApi.get(documentId)
      } else {
        return
      }
      if (run !== latestLoad) {
        return
      }
      conversation.value = loadedConversation
      messages.value = loadedConversation?.messages ?? []
      document.value = loadedDocument
      follow(pendingAnswer.value)
      if (!loadedDocument.is_finished) {
        documentPolling.start()
      }
    } catch (error) {
      if (run === latestLoad) {
        loadError.value = toApiError(error)
      }
    } finally {
      if (run === latestLoad) {
        loading.value = false
      }
    }
  }

  watch(() => [route.params.conversationId, route.params.documentId], load, { immediate: true })

  // --- Asking --------------------------------------------------------------------
  /** Resolves true when the question was accepted (the composer can then be cleared). */
  async function ask (question: string): Promise<boolean> {
    if (!document.value || sending.value) {
      return false
    }
    sending.value = true
    sendError.value = null
    try {
      if (conversation.value) {
        const { question: asked, answer } = await conversationsApi.ask(conversation.value.id, question)
        messages.value.push(asked, answer)
        follow(answer)
      } else {
        const created = await conversationsApi.start(document.value.id, question)
        conversation.value = created
        messages.value = created.messages ?? []
        follow(pendingAnswer.value)
        await router.replace({ name: 'conversation', params: { conversationId: created.id } })
      }
      return true
    } catch (error) {
      const apiError = toApiError(error)
      sendError.value = apiError.errors.question?.[0] ?? apiError.message
      if (apiError.code === 'document_not_ready') {
        document.value = await documentsApi.get(document.value.id).catch(() => document.value)
      }
      return false
    } finally {
      sending.value = false
    }
  }

  async function retry (answer: Message) {
    if (!conversation.value || sending.value) {
      return
    }
    sending.value = true
    sendError.value = null
    try {
      const pending = await conversationsApi.retryAnswer(conversation.value.id, answer.id)
      replaceMessage(pending)
      follow(pending)
    } catch (error) {
      sendError.value = toApiError(error).message
    } finally {
      sending.value = false
    }
  }

  return {
    document,
    conversation,
    messages,
    loading,
    loadError,
    sending,
    sendError,
    pendingAnswer,
    canAsk,
    load,
    ask,
    retry,
  }
}
