<script setup lang="ts">
/**
 * Stitch: "Dashboard — AskMyDocs (Desktop)" and "Dashboard" (mobile).
 * Left out because the API does not have them: workspaces, team, quotas, OCR,
 * citation confidence, the cross-document question box, audit logs and the API card.
 */
  import type { Conversation, Document, Stats } from '@/types/api'
  import { computed, ref } from 'vue'
  import { useDisplay } from 'vuetify'
  import { conversationsApi } from '@/api/conversations'
  import { documentsApi } from '@/api/documents'
  import { statsApi } from '@/api/stats'
  import DocumentStatusChip from '@/components/documents/DocumentStatusChip.vue'
  import UploadDialog from '@/components/documents/UploadDialog.vue'
  import { usePolling } from '@/composables/usePolling'
  import { useAuthStore } from '@/stores/auth'
  import { formatBytes, formatRelative, plural } from '@/utils/format'

  interface DashboardData {
    stats: Stats
    documents: Document[]
    conversations: Conversation[]
  }

  const RECENT_DOCUMENTS = 5
  const RECENT_CONVERSATIONS = 4

  const auth = useAuthStore()
  const { mdAndUp } = useDisplay()

  const firstName = computed(() => auth.user?.name.trim().split(/\s+/, 1)[0] ?? '')

  // Loads everything at once; while documents are processing, reloads (with back-off)
  // until they are finished, so their status and the counters stay current.
  const dashboard = usePolling<DashboardData>(async signal => {
    const [stats, documents, conversations] = await Promise.all([
      statsApi.get(signal),
      documentsApi.list(),
      conversationsApi.list(),
    ])
    return {
      stats,
      documents: documents.data.slice(0, RECENT_DOCUMENTS),
      conversations: conversations.data.slice(0, RECENT_CONVERSATIONS),
    }
  }, { until: data => data.stats.documents.processing === 0 })

  const data = dashboard.data
  const stats = computed(() => data.value?.stats)

  const questionsUsedPercent = computed(() => {
    const questions = stats.value?.questions_today
    return questions && questions.limit > 0 ? Math.min(100, (questions.used / questions.limit) * 100) : 0
  })

  const resetTime = computed(() => {
    const resetsAt = stats.value?.questions_today.resets_at
    return resetsAt ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(resetsAt)) : ''
  })

  const uploadOpen = ref(false)
  const notice = ref<string | null>(null)

  function onUploaded (document: Document) {
    notice.value = `“${document.title}” uploaded. Processing has started.`
    dashboard.start()
  }

  function questionCount (conversation: Conversation): number {
    // Every question has an answer message (pending, completed or failed).
    return Math.ceil((conversation.messages_count ?? 0) / 2)
  }
</script>

<template>
  <div class="dashboard d-flex flex-column ga-6">
    <!-- Greeting -->
    <div class="d-flex flex-column ga-1">
      <h1 class="text-on-surface" :class="mdAndUp ? 'text-headline-xl' : 'text-headline-xl-mobile'">
        Welcome back<template v-if="firstName">, {{ firstName }}</template>
      </h1>

      <p class="text-body-md text-on-surface-variant">Upload a PDF or continue where you left off.</p>
    </div>

    <v-alert
      v-if="!data && dashboard.error.value"
      color="error"
      icon="error"
      role="alert"
      rounded="lg"
      title="The dashboard could not be loaded"
      variant="tonal"
    >
      {{ dashboard.error.value.message }}
      <template #append>
        <v-btn color="error" variant="text" @click="dashboard.start()">Try again</v-btn>
      </template>
    </v-alert>

    <v-skeleton-loader v-else-if="!data" aria-label="Loading dashboard" class="bg-transparent" type="card, list-item-two-line@3" />

    <template v-else-if="stats">
      <!-- Stats -->
      <ul aria-label="Overview" class="stats">
        <li class="stat bg-surface-container-lowest rounded-lg pa-4 shadow-sm">
          <div class="d-flex align-start justify-space-between">
            <div class="d-flex flex-column">
              <span class="stat__label text-label-md text-on-surface-variant">Documents</span>
              <span class="stat__value text-on-surface">{{ stats.documents.total }}</span>
            </div>

            <span class="stat__icon bg-surface-container-high text-primary"><v-icon icon="library_books" size="20" /></span>
          </div>

          <div class="d-flex flex-wrap ga-1">
            <span class="pill text-label-code bg-surface-container-high text-secondary">{{ stats.documents.ready }} ready</span>
            <span v-if="stats.documents.processing > 0" class="pill text-label-code bg-surface-container-high text-primary">{{ stats.documents.processing }} processing</span>
            <span v-if="stats.documents.failed > 0" class="pill text-label-code bg-error-container text-on-error-container">{{ stats.documents.failed }} failed</span>
          </div>
        </li>

        <li class="stat bg-surface-container-lowest rounded-lg pa-4 shadow-sm">
          <div class="d-flex align-start justify-space-between">
            <div class="d-flex flex-column">
              <span class="stat__label text-label-md text-on-surface-variant">Conversations</span>
              <span class="stat__value text-on-surface">{{ stats.conversations }}</span>
            </div>

            <span class="stat__icon bg-surface-container-high text-primary"><v-icon icon="forum" size="20" /></span>
          </div>

          <span class="text-body-sm text-on-surface-variant">Answers cite the pages they rely on</span>
        </li>

        <li class="stat bg-surface-container-lowest rounded-lg pa-4 shadow-sm">
          <div class="d-flex align-start justify-space-between">
            <div class="d-flex flex-column">
              <span class="stat__label text-label-md text-on-surface-variant">Pages indexed</span>
              <span class="stat__value text-on-surface">{{ stats.pages_indexed.toLocaleString() }}</span>
            </div>

            <span class="stat__icon bg-surface-container-low text-secondary"><v-icon icon="layers" size="20" /></span>
          </div>

          <span class="text-body-sm text-on-surface-variant">In {{ plural(stats.documents.ready, 'ready document') }}</span>
        </li>

        <li class="stat bg-surface-container-lowest rounded-lg pa-4 shadow-sm">
          <div class="d-flex align-start justify-space-between">
            <div class="d-flex flex-column">
              <span class="stat__label text-label-md text-on-surface-variant">Questions today</span>

              <span class="d-flex align-baseline ga-1">
                <span class="stat__value text-on-surface">{{ stats.questions_today.used }}</span>
                <span class="text-body-md text-on-surface-variant">/ {{ stats.questions_today.limit }}</span>
              </span>
            </div>

            <span class="stat__icon bg-surface-container-high text-primary"><v-icon icon="help" size="20" /></span>
          </div>

          <div class="d-flex flex-column ga-1">
            <v-progress-linear
              :aria-label="`${stats.questions_today.used} of ${stats.questions_today.limit} questions used today`"
              bg-color="surface-container-highest"
              :color="stats.questions_today.remaining === 0 ? 'error' : 'secondary-container'"
              :model-value="questionsUsedPercent"
              rounded
            />

            <span class="text-citation-pill text-on-surface-variant">
              {{ stats.questions_today.remaining }} left · resets at {{ resetTime }}
            </span>
          </div>
        </li>
      </ul>

      <!-- Upload -->
      <div class="upload bg-surface-container-low rounded-lg pa-6 shadow-sm d-flex flex-column flex-md-row align-center justify-space-between ga-4">
        <div class="d-flex flex-column flex-md-row align-center ga-4 text-center text-md-start">
          <span class="upload__icon bg-surface-container-lowest text-primary shadow-sm"><v-icon icon="cloud_upload" size="32" /></span>

          <div class="d-flex flex-column">
            <h2 class="text-headline-md text-on-surface">Upload a PDF</h2>
            <p class="text-body-sm text-on-surface-variant">PDF with selectable text · up to 20 MB · up to 300 pages</p>
          </div>
        </div>

        <v-btn color="primary-container" prepend-icon="folder_open" @click="uploadOpen = true">Browse files</v-btn>
      </div>

      <v-row>
        <!-- Recent documents -->
        <v-col cols="12" lg="7">
          <section aria-labelledby="recent-documents" class="d-flex flex-column ga-3">
            <div class="d-flex align-center justify-space-between">
              <h2 id="recent-documents" class="text-headline-md text-on-surface">Recent documents</h2>

              <router-link v-if="stats.documents.total > 0" class="see-all text-label-md text-primary" :to="{ name: 'documents' }">
                View all {{ stats.documents.total }}
                <v-icon icon="arrow_forward" size="16" />
              </router-link>
            </div>

            <div v-if="data.documents.length === 0" class="bg-surface-container-lowest rounded-lg pa-6 shadow-sm text-center d-flex flex-column align-center ga-2">
              <v-icon class="text-outline" icon="folder_open" size="32" />
              <p class="text-body-md text-on-surface-variant">No documents yet. Upload a PDF to start asking questions about it.</p>
            </div>

            <ul v-else class="list d-flex flex-column ga-2">
              <li
                v-for="document in data.documents"
                :key="document.id"
                class="bg-surface-container-lowest rounded-lg pa-3 shadow-sm d-flex flex-column flex-sm-row align-sm-center justify-space-between ga-3"
                :data-document-id="document.id"
              >
                <div class="d-flex align-start ga-3 min-w-0">
                  <span class="item-icon" :class="document.status === 'failed' ? 'bg-error-container text-error' : 'bg-surface-container-low text-primary'">
                    <v-icon :icon="document.status === 'failed' ? 'warning' : 'picture_as_pdf'" size="20" />
                  </span>

                  <div class="d-flex flex-column min-w-0">
                    <span class="text-body-lg font-weight-medium text-on-surface text-truncate">{{ document.title }}</span>
                    <span v-if="document.status === 'failed' && document.error_message" class="text-body-sm text-error">{{ document.error_message }}</span>

                    <span v-else class="text-label-code text-on-surface-variant">
                      <template v-if="document.page_count !== null">{{ plural(document.page_count, 'page') }} · </template>{{ formatBytes(document.size_bytes) }} · {{ formatRelative(document.created_at) }}
                    </span>
                  </div>
                </div>

                <div class="d-flex align-center justify-space-between justify-sm-end ga-2 flex-shrink-0">
                  <DocumentStatusChip :document="document" />

                  <v-btn
                    v-if="document.status === 'ready'"
                    color="primary-container"
                    prepend-icon="forum"
                    size="small"
                    :to="{ name: 'document-chat', params: { documentId: document.id } }"
                  >
                    Chat
                  </v-btn>
                </div>
              </li>
            </ul>
          </section>
        </v-col>

        <!-- Recent conversations -->
        <v-col cols="12" lg="5">
          <section aria-labelledby="recent-conversations" class="d-flex flex-column ga-3">
            <div class="d-flex align-center justify-space-between">
              <h2 id="recent-conversations" class="text-headline-md text-on-surface">Recent conversations</h2>

              <router-link v-if="stats.conversations > 0" class="see-all text-label-md text-primary" :to="{ name: 'conversations' }">
                View all
                <v-icon icon="arrow_forward" size="16" />
              </router-link>
            </div>

            <div v-if="data.conversations.length === 0" class="bg-surface-container-lowest rounded-lg pa-6 shadow-sm text-center d-flex flex-column align-center ga-2">
              <v-icon class="text-outline" icon="forum" size="32" />
              <p class="text-body-md text-on-surface-variant">No conversations yet. Open a ready document and ask a question.</p>
            </div>

            <ul v-else class="list d-flex flex-column ga-2">
              <li
                v-for="conversation in data.conversations"
                :key="conversation.id"
                class="bg-surface-container-lowest rounded-lg pa-4 shadow-sm d-flex flex-column ga-3"
                :data-conversation-id="conversation.id"
              >
                <div class="d-flex align-start justify-space-between ga-2">
                  <div class="d-flex flex-column min-w-0">
                    <h3 class="text-headline-md text-on-surface text-truncate">{{ conversation.title }}</h3>
                    <span v-if="conversation.document" class="text-body-sm text-on-surface-variant text-truncate">{{ conversation.document.title }}</span>
                  </div>

                  <span class="text-label-code text-on-surface-variant flex-shrink-0">{{ formatRelative(conversation.updated_at) }}</span>
                </div>

                <div class="d-flex align-center justify-space-between">
                  <span class="text-label-code text-on-surface-variant">{{ plural(questionCount(conversation), 'question') }}</span>

                  <v-btn
                    append-icon="arrow_forward"
                    class="bg-surface-container text-primary"
                    size="small"
                    :to="{ name: 'conversation', params: { conversationId: conversation.id } }"
                  >
                    Resume
                  </v-btn>
                </div>
              </li>
            </ul>
          </section>
        </v-col>
      </v-row>
    </template>

    <UploadDialog v-model="uploadOpen" @uploaded="onUploaded" />

    <v-snackbar
      :model-value="notice !== null"
      role="status"
      :timeout="4000"
      @update:model-value="open => { if (!open) notice = null }"
    >
      {{ notice }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin-inline: auto;
  width: 100%;
}

.stats {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (min-width: 1280px) {
  .stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.stat {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
}

.stat__label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat__value {
  font-size: 32px;
  line-height: 40px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.stat__icon,
.item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.pill {
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
}

.upload__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 8px;
}

.list {
  list-style: none;
}

.see-all {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  text-decoration: none;
}

.see-all:hover {
  text-decoration: underline;
}

.min-w-0 {
  min-width: 0;
}
</style>
