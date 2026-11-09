<script setup lang="ts">
/**
 * Stitch: "Document Chat & Split PDF Viewer — AskMyDocs (Desktop)", "Document Chat"
 * and "PDF Citation Viewer" (mobile). Left out because the API does not have them:
 * accuracy/confidence badges, model names, export, attachments, voice input, and
 * PDF thumbnails/search.
 */
  import type { CitationGroup, PdfTarget } from '@/utils/citations'
  import { computed, defineAsyncComponent, nextTick, ref, useTemplateRef, watch } from 'vue'
  import { useDisplay } from 'vuetify'
  import ChatComposer from '@/components/chat/ChatComposer.vue'
  import ChatMessage from '@/components/chat/ChatMessage.vue'
  import DocumentStatusChip from '@/components/documents/DocumentStatusChip.vue'
  import { useConversation } from '@/composables/useConversation'
  import { formatBytes, plural } from '@/utils/format'

  // pdf.js is only downloaded when the PDF is shown.
  const PdfViewer = defineAsyncComponent(() => import('@/components/chat/PdfViewer.vue'))

  type ViewMode = 'split' | 'chat' | 'pdf'

  /** For any PDF; documents with their own suggestions (the demo samples) use those instead. */
  const GENERIC_SUGGESTIONS = [
    'What is this document about?',
    'Summarize the key points.',
    'What topics does it cover?',
  ]

  const chat = useConversation()
  const { document, conversation, messages, loading, loadError, sending, sendError, pendingAnswer } = chat
  const { lgAndUp } = useDisplay()

  const mode = ref<ViewMode>(lgAndUp.value ? 'split' : 'chat')
  const target = ref<PdfTarget | null>(null)
  const question = ref('')
  /** The viewer is mounted the first time the PDF is shown, then kept. */
  const pdfOpened = ref(mode.value !== 'chat')

  const modes = computed(() => lgAndUp.value
    ? [
      { value: 'split' as const, label: 'Split view', icon: 'view_column' },
      { value: 'chat' as const, label: 'Chat only', icon: 'chat' },
      { value: 'pdf' as const, label: 'PDF only', icon: 'chrome_reader_mode' },
    ]
    : [
      { value: 'chat' as const, label: 'Chat', icon: 'forum' },
      { value: 'pdf' as const, label: 'PDF', icon: 'description' },
    ])

  const suggestions = computed(() => document.value?.suggested_questions?.length
    ? document.value.suggested_questions
    : GENERIC_SUGGESTIONS)

  const showChat = computed(() => mode.value !== 'pdf')
  const showPdf = computed(() => mode.value !== 'chat')

  // No split view on small screens.
  watch(lgAndUp, large => {
    if (!large && mode.value === 'split') {
      mode.value = 'chat'
    }
  })

  watch(showPdf, shown => {
    if (shown) {
      pdfOpened.value = true
    }
  })

  const blockedReason = computed(() => {
    if (!document.value) {
      return 'Loading…'
    }
    if (document.value.status === 'failed') {
      return 'This document could not be processed.'
    }
    if (document.value.status !== 'ready') {
      return 'The document is still being processed…'
    }
    if (pendingAnswer.value) {
      return 'Waiting for the answer…'
    }
    return null
  })

  async function submit (text: string) {
    if (await chat.ask(text)) {
      question.value = ''
    }
  }

  function openCitation (group: CitationGroup, page: number) {
    target.value = {
      page,
      number: group.number,
      quotes: group.quotes.filter(quote => quote.page === page).map(quote => quote.quote),
    }
    if (mode.value === 'chat') {
      mode.value = lgAndUp.value ? 'split' : 'pdf'
    }
  }

  // Keep the newest message in view.
  const stream = useTemplateRef<HTMLElement>('stream')
  watch(() => [messages.value.length, messages.value.at(-1)?.status], async () => {
    await nextTick()
    stream.value?.scrollTo({ top: stream.value.scrollHeight, behavior: 'smooth' })
  })
</script>

<template>
  <div class="chat d-flex flex-column h-100">
    <!-- Loading / errors -->
    <div v-if="loading" class="d-flex align-center justify-center flex-grow-1">
      <v-progress-circular aria-label="Loading conversation" color="primary" indeterminate />
    </div>

    <div v-else-if="loadError || !document" class="pa-6 d-flex flex-column align-center text-center ga-3 mt-8">
      <v-icon class="text-outline" :icon="loadError?.status === 404 ? 'search_off' : 'error'" size="40" />

      <h1 class="text-headline-md text-on-surface">
        {{ loadError?.status === 404 ? 'This conversation or document does not exist' : 'The conversation could not be loaded' }}
      </h1>

      <p class="text-body-md text-on-surface-variant">{{ loadError?.status === 404 ? 'It may have been deleted.' : loadError?.message }}</p>

      <div class="d-flex ga-2">
        <v-btn v-if="loadError?.status !== 404" color="primary" variant="tonal" @click="chat.load()">Try again</v-btn>
        <v-btn color="primary-container" :to="{ name: 'documents' }">Document Library</v-btn>
      </div>
    </div>

    <template v-else>
      <!-- Document bar -->
      <header class="doc-bar bg-surface-container-lowest shadow-sm px-4 py-2 d-flex align-center justify-space-between flex-wrap ga-2">
        <div class="d-flex align-center ga-3 min-w-0">
          <span class="doc-icon bg-surface-container text-primary"><v-icon icon="picture_as_pdf" size="18" /></span>

          <div class="d-flex flex-column min-w-0">
            <h1 class="text-headline-md text-on-surface text-truncate">{{ document.title }}</h1>

            <div class="d-flex align-center flex-wrap ga-2 text-citation-pill text-on-surface-variant">
              <DocumentStatusChip :document="document" />
              <span v-if="document.page_count !== null">{{ plural(document.page_count, 'page') }}</span>
              <span>{{ formatBytes(document.size_bytes) }}</span>
              <span v-if="conversation" class="text-truncate conversation-title">· {{ conversation.title }}</span>
            </div>
          </div>
        </div>

        <div class="d-flex align-center ga-2 flex-shrink-0">
          <v-btn-toggle
            v-model="mode"
            aria-label="Layout"
            class="bg-surface-container-low"
            density="compact"
            mandatory
            rounded="lg"
          >
            <v-btn
              v-for="option in modes"
              :key="option.value"
              :aria-label="option.label"
              size="small"
              :value="option.value"
            >
              <v-icon :icon="option.icon" size="16" />
              <span v-if="lgAndUp" class="ms-1">{{ option.label }}</span>
            </v-btn>
          </v-btn-toggle>

          <v-btn
            v-if="conversation"
            prepend-icon="add_comment"
            size="small"
            :to="{ name: 'document-chat', params: { documentId: document.id } }"
            variant="tonal"
          >
            New chat
          </v-btn>
        </div>
      </header>

      <div class="panes d-flex flex-grow-1">
        <!-- Chat -->
        <section v-show="showChat" aria-label="Conversation" class="chat-pane d-flex flex-column bg-surface-container-lowest" :class="{ 'chat-pane--half': showPdf }">
          <div ref="stream" aria-live="polite" class="stream flex-grow-1 pa-4 d-flex flex-column ga-4">
            <!-- New conversation -->
            <div v-if="messages.length === 0" class="welcome ma-auto d-flex flex-column align-center text-center ga-3">
              <span class="welcome__icon bg-surface-container-high text-primary"><v-icon icon="forum" size="28" /></span>
              <h2 class="text-headline-md text-on-surface">Ask a question about this PDF</h2>

              <p class="text-body-md text-on-surface-variant">
                Answers only use this document and quote the passages they rely on, with page numbers. Select a source to see it in the PDF.
              </p>

              <div v-if="document.status === 'ready'" class="d-flex flex-wrap justify-center ga-2">
                <v-btn
                  v-for="suggestion in suggestions"
                  :key="suggestion"
                  class="bg-surface-container-low text-on-surface"
                  rounded="pill"
                  size="small"
                  @click="question = suggestion"
                >
                  {{ suggestion }}
                </v-btn>
              </div>

              <v-alert
                v-else
                :color="document.status === 'failed' ? 'error' : 'primary'"
                density="compact"
                :icon="document.status === 'failed' ? 'error' : 'hourglass_top'"
                rounded="lg"
                :text="document.status === 'failed'
                  ? (document.error_message ?? 'This document could not be processed.')
                  : 'The document is still being processed. You can ask questions as soon as it is ready.'"
                variant="tonal"
              />
            </div>

            <ChatMessage
              v-for="message in messages"
              :key="message.id"
              :busy="sending"
              :message="message"
              @open-citation="openCitation"
              @retry="chat.retry(message)"
            />
          </div>

          <div class="px-4 pb-3 pt-1">
            <ChatComposer
              v-model="question"
              :blocked-reason="blockedReason"
              :document-title="document.title"
              :error="sendError"
              :sending="sending"
              @submit="submit"
            />
          </div>
        </section>

        <!-- PDF -->
        <section v-if="pdfOpened" v-show="showPdf" aria-label="PDF" class="pdf-pane flex-grow-1">
          <PdfViewer :document-id="document.id" :target="target" @close-target="target = null" />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.panes {
  min-height: 0;
}

.chat-pane {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
}

.chat-pane--half {
  flex: 0 0 50%;
  box-shadow: var(--shadow-soft);
  z-index: 1;
}

.pdf-pane {
  min-width: 0;
  min-height: 0;
}

.stream {
  overflow-y: auto;
  min-height: 0;
}

.doc-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.conversation-title {
  max-width: 320px;
}

.welcome {
  max-width: 480px;
}

.welcome__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
}

.min-w-0 {
  min-width: 0;
}
</style>
