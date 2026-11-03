<script setup lang="ts">
/**
 * Stitch: "Document Library — AskMyDocs (Desktop)" (table) and "Document Library" (mobile cards).
 * Left out because the API does not have them: tags, owners, batch actions, sorting,
 * grid view, quotas, latency/model stats and passphrase entry.
 */
  import type { Document } from '@/types/api'
  import { onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { documentsApi } from '@/api/documents'
  import { toApiError } from '@/api/errors'
  import DeleteDocumentDialog from '@/components/documents/DeleteDocumentDialog.vue'
  import DocumentMenu from '@/components/documents/DocumentMenu.vue'
  import DocumentStatusChip from '@/components/documents/DocumentStatusChip.vue'
  import RenameDocumentDialog from '@/components/documents/RenameDocumentDialog.vue'
  import UploadDialog from '@/components/documents/UploadDialog.vue'
  import { type LibraryStatusFilter, MAX_SEARCH_LENGTH, useDocumentLibrary } from '@/composables/useDocumentLibrary'
  import { canRetry, documentStatus } from '@/utils/documentStatus'
  import { saveBlob } from '@/utils/download'
  import { formatBytes, formatDate, plural } from '@/utils/format'

  const route = useRoute()
  const router = useRouter()
  const { mdAndUp } = useDisplay()
  const library = useDocumentLibrary()
  const { filters, hasFilters, documents, meta, loading, error } = library

  const statusTabs: { value: LibraryStatusFilter | undefined, label: string, dot?: string }[] = [
    { value: undefined, label: 'All documents' },
    { value: 'ready', label: 'Ready', dot: 'bg-secondary' },
    { value: 'failed', label: 'Failed', dot: 'bg-error' },
  ]

  // --- Search: typed text goes to the URL after a short pause --------------
  const searchInput = ref(filters.value.search ?? '')
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  watch(searchInput, value => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      const search = (value ?? '').trim() || undefined
      if (search !== filters.value.search) {
        void library.setFilters({ search, page: 1 })
      }
    }, 300)
  })

  // The top-bar search (or back/forward) changes the URL: show it in the field.
  watch(() => filters.value.search, search => {
    if ((searchInput.value ?? '').trim() !== (search ?? '')) {
      searchInput.value = search ?? ''
    }
  })

  onBeforeUnmount(() => clearTimeout(searchTimer))

  // --- Dialogs ---------------------------------------------------------------
  const uploadOpen = ref(false)
  const renaming = ref<Document | null>(null)
  const deleting = ref<Document | null>(null)

  // ?upload=1 (upload buttons in the navigation) opens the dialog once; the parameter is
  // then removed so that reloading or going back does not open it again.
  watch(() => route.query.upload, upload => {
    if (upload === '1') {
      uploadOpen.value = true
      const { upload: _removed, ...query } = route.query
      void router.replace({ query })
    }
  }, { immediate: true })

  // --- Feedback ---------------------------------------------------------------
  const notice = ref<string | null>(null)

  function notify (message: string) {
    notice.value = message
  }

  // --- Actions ----------------------------------------------------------------
  const retrying = ref(new Set<string>())

  async function onUploaded (document: Document) {
    notify(`“${document.title}” uploaded. Processing has started.`)
    await library.showUploaded(document)
  }

  function onRenamed (document: Document) {
    library.replace(document)
    notify('Document renamed.')
  }

  async function onDeleted (document: Document) {
    notify(`“${document.title}” deleted.`)
    await library.load()
  }

  async function retry (document: Document) {
    if (retrying.value.has(document.id)) {
      return
    }
    retrying.value.add(document.id)
    try {
      library.showRequeued(await documentsApi.retry(document.id))
    } catch (error_) {
      notify(toApiError(error_).message)
    } finally {
      retrying.value.delete(document.id)
    }
  }

  async function download (document: Document) {
    try {
      saveBlob(await documentsApi.file(document.id), document.original_filename)
    } catch (error_) {
      notify(toApiError(error_).message)
    }
  }

  function chatRoute (document: Document) {
    return { name: 'document-chat', params: { documentId: document.id } }
  }
</script>

<template>
  <div class="library d-flex flex-column ga-6">
    <!-- Header -->
    <div class="d-flex flex-column flex-md-row align-md-end justify-space-between ga-4">
      <div class="d-flex flex-column ga-1">
        <h1 class="text-on-surface" :class="mdAndUp ? 'text-headline-xl' : 'text-headline-xl-mobile'">Document Library</h1>

        <p class="text-body-md text-on-surface-variant">
          Upload PDFs, follow their processing, and start a chat as soon as they are ready.
        </p>
      </div>

      <div class="d-flex align-center ga-3 flex-shrink-0">
        <span v-if="meta && !hasFilters" class="count-pill text-citation-pill bg-surface-container-lowest text-on-surface shadow-sm">
          <span class="count-pill__dot bg-secondary" />
          {{ plural(meta.total, 'document').toUpperCase() }}
        </span>

        <v-btn color="primary-container" prepend-icon="upload_file" @click="uploadOpen = true">Upload PDF</v-btn>
      </div>
    </div>

    <!-- Search and status filter -->
    <div class="bg-surface-container-lowest rounded-lg pa-4 shadow-sm d-flex flex-column ga-3">
      <v-text-field
        v-model="searchInput"
        aria-label="Filter documents by title"
        clearable
        density="comfortable"
        hide-details
        :maxlength="MAX_SEARCH_LENGTH"
        placeholder="Filter by title…"
        prepend-inner-icon="search"
      />

      <div aria-label="Filter by status" class="d-flex flex-wrap ga-2" role="group">
        <v-btn
          v-for="tab in statusTabs"
          :key="tab.label"
          :aria-pressed="filters.status === tab.value"
          :class="filters.status === tab.value ? 'bg-surface-container-high text-on-surface shadow-sm' : 'text-on-surface-variant'"
          size="small"
          variant="text"
          @click="library.setFilters({ status: tab.value, page: 1 })"
        >
          <span v-if="tab.dot" class="tab-dot me-2" :class="tab.dot" />
          {{ tab.label }}
        </v-btn>
      </div>
    </div>

    <!-- Documents -->
    <div
      :aria-busy="loading"
      class="rounded-lg overflow-hidden position-relative"
      :class="{ 'bg-surface-container-lowest shadow-sm': mdAndUp || documents.length === 0 }"
    >
      <v-progress-linear
        v-if="loading && meta"
        absolute
        aria-label="Loading documents"
        color="primary"
        indeterminate
      />

      <div v-if="error" class="pa-6">
        <v-alert
          color="error"
          icon="error"
          role="alert"
          rounded="lg"
          title="The documents could not be loaded"
          variant="tonal"
        >
          {{ error.message }}
          <template #append>
            <v-btn color="error" variant="text" @click="library.load()">Try again</v-btn>
          </template>
        </v-alert>
      </div>

      <v-skeleton-loader v-else-if="!meta" aria-label="Loading documents" type="list-item-avatar-two-line@4" />

      <!-- No documents at all -->
      <div v-else-if="documents.length === 0 && !hasFilters" class="empty pa-10 d-flex flex-column align-center text-center ga-3">
        <span class="empty__icon bg-surface-container-high text-primary"><v-icon icon="folder_open" size="32" /></span>
        <h2 class="text-headline-md text-on-surface">No documents yet</h2>

        <p class="text-body-md text-on-surface-variant">
          Upload a PDF with selectable text. Once it is processed, you can ask questions about it and every answer cites its pages.
        </p>

        <v-btn color="primary-container" prepend-icon="upload_file" @click="uploadOpen = true">Upload your first PDF</v-btn>
      </div>

      <!-- Nothing matches the filters -->
      <div v-else-if="documents.length === 0" class="empty pa-10 d-flex flex-column align-center text-center ga-3">
        <span class="empty__icon bg-surface-container-high text-outline"><v-icon icon="manage_search" size="32" /></span>
        <h2 class="text-headline-md text-on-surface">No documents match</h2>
        <p class="text-body-md text-on-surface-variant">Try another title or clear the filters.</p>
        <v-btn color="primary-container" @click="library.clearFilters()">Clear filters</v-btn>
      </div>

      <!-- Desktop: table -->
      <v-table v-else-if="mdAndUp" class="documents-table bg-transparent">
        <thead>
          <tr class="bg-surface-container-low">
            <th class="text-label-md text-on-surface-variant" scope="col">Document</th>
            <th class="text-label-md text-on-surface-variant" scope="col">Size &amp; pages</th>
            <th class="text-label-md text-on-surface-variant" scope="col">Uploaded</th>
            <th class="text-label-md text-on-surface-variant" scope="col">Status</th>
            <th class="text-label-md text-on-surface-variant text-end" scope="col">Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="document in documents" :key="document.id" :data-document-id="document.id">
            <td class="py-3">
              <div class="d-flex align-center ga-3 min-w-0">
                <span class="doc-icon" :class="document.status === 'failed' ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-primary'">
                  <v-icon :icon="document.status === 'failed' ? 'error' : 'picture_as_pdf'" size="20" />
                </span>

                <div class="d-flex flex-column min-w-0">
                  <router-link
                    v-if="document.status === 'ready'"
                    class="doc-title text-body-lg font-weight-medium text-on-surface text-truncate"
                    :to="chatRoute(document)"
                  >
                    {{ document.title }}
                  </router-link>

                  <span v-else class="text-body-lg font-weight-medium text-on-surface text-truncate">{{ document.title }}</span>
                  <span v-if="document.status === 'failed' && document.error_message" class="text-body-sm text-error">{{ document.error_message }}</span>
                  <span v-else class="text-citation-pill text-outline text-truncate">{{ document.original_filename }}</span>
                </div>
              </div>
            </td>

            <td class="text-no-wrap">
              <div class="d-flex flex-column">
                <span class="text-body-sm text-on-surface font-weight-medium">{{ formatBytes(document.size_bytes) }}</span>
                <span class="text-label-code text-on-surface-variant">{{ document.page_count === null ? '—' : plural(document.page_count, 'page') }}</span>
              </div>
            </td>

            <td class="text-body-sm text-on-surface-variant text-no-wrap">{{ formatDate(document.created_at) }}</td>

            <td>
              <div class="d-flex flex-column ga-1 status-cell">
                <DocumentStatusChip :document="document" />

                <v-progress-linear
                  v-if="documentStatus(document).busy"
                  :aria-label="`${document.title}: ${documentStatus(document).label}`"
                  color="primary"
                  indeterminate
                  rounded
                />
              </div>
            </td>

            <td class="text-end text-no-wrap">
              <div class="d-flex align-center justify-end ga-1">
                <v-btn
                  v-if="canRetry(document)"
                  color="error"
                  :loading="retrying.has(document.id)"
                  prepend-icon="refresh"
                  size="small"
                  variant="tonal"
                  @click="retry(document)"
                >
                  Retry
                </v-btn>

                <v-btn
                  v-else-if="document.status !== 'failed'"
                  color="primary"
                  :disabled="document.status !== 'ready'"
                  prepend-icon="chat"
                  size="small"
                  :to="document.status === 'ready' ? chatRoute(document) : undefined"
                >
                  Start chat
                </v-btn>

                <DocumentMenu
                  :document="document"
                  @delete="deleting = document"
                  @download="download(document)"
                  @rename="renaming = document"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Mobile: cards -->
      <ul v-else class="cards d-flex flex-column ga-3">
        <li
          v-for="document in documents"
          :key="document.id"
          class="bg-surface-container-lowest rounded-lg pa-3 shadow-sm d-flex flex-column ga-3"
          :data-document-id="document.id"
        >
          <div class="d-flex align-start ga-3">
            <span class="doc-icon doc-icon--lg" :class="document.status === 'failed' ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-primary'">
              <v-icon :icon="document.status === 'failed' ? 'error' : 'description'" size="24" />
            </span>

            <div class="d-flex flex-column flex-grow-1 min-w-0 ga-1">
              <h3 class="text-headline-md text-on-surface text-truncate">{{ document.title }}</h3>

              <div class="d-flex align-center flex-wrap ga-2">
                <DocumentStatusChip :document="document" />
                <span v-if="document.page_count !== null" class="text-citation-pill text-outline">{{ plural(document.page_count, 'page') }}</span>
                <span class="text-citation-pill text-outline">{{ formatBytes(document.size_bytes) }}</span>
              </div>
            </div>

            <DocumentMenu
              :document="document"
              @delete="deleting = document"
              @download="download(document)"
              @rename="renaming = document"
            />
          </div>

          <p v-if="document.status === 'failed' && document.error_message" class="text-body-sm text-error">{{ document.error_message }}</p>

          <v-progress-linear
            v-if="documentStatus(document).busy"
            :aria-label="`${document.title}: ${documentStatus(document).label}`"
            color="primary"
            indeterminate
            rounded
          />

          <div class="d-flex align-center justify-space-between">
            <span class="text-body-sm text-outline d-flex align-center ga-1">
              <v-icon icon="calendar_today" size="14" />
              {{ formatDate(document.created_at) }}
            </span>

            <v-btn
              v-if="canRetry(document)"
              color="error"
              :loading="retrying.has(document.id)"
              prepend-icon="refresh"
              size="small"
              variant="tonal"
              @click="retry(document)"
            >
              Retry
            </v-btn>

            <v-btn
              v-else-if="document.status === 'ready'"
              color="primary-container"
              prepend-icon="chat_bubble"
              size="small"
              :to="chatRoute(document)"
            >
              Chat
            </v-btn>
          </div>
        </li>
      </ul>

      <!-- Pagination -->
      <div
        v-if="meta && meta.total > 0 && !error"
        class="d-flex flex-column flex-sm-row align-center justify-space-between ga-2 px-4 py-3 bg-surface-container-low"
        :class="{ 'mt-3 rounded-lg': !mdAndUp }"
      >
        <span class="text-body-sm text-on-surface-variant">
          Showing <strong>{{ meta.from }}</strong>–<strong>{{ meta.to }}</strong> of <strong>{{ meta.total }}</strong> documents
        </span>

        <v-pagination
          v-if="meta.last_page > 1"
          density="compact"
          :length="meta.last_page"
          :model-value="meta.current_page"
          rounded="lg"
          :total-visible="5"
          @update:model-value="page => library.setFilters({ page })"
        />
      </div>
    </div>

    <UploadDialog v-model="uploadOpen" @uploaded="onUploaded" />
    <RenameDocumentDialog v-model="renaming" @renamed="onRenamed" />
    <DeleteDocumentDialog v-model="deleting" @deleted="onDeleted" />

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
.library {
  max-width: 1400px;
  margin-inline: auto;
  width: 100%;
}

.count-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  white-space: nowrap;
}

.count-pill__dot,
.tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.doc-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.doc-icon--lg {
  width: 44px;
  height: 44px;
}

.doc-title {
  text-decoration: none;
}

.doc-title:hover {
  color: rgb(var(--v-theme-primary)) !important;
  text-decoration: underline;
}

.documents-table :deep(td) {
  border-bottom: none !important;
}

.documents-table :deep(tbody tr:hover) {
  background: rgb(var(--v-theme-surface-container-low));
}

.documents-table td:first-child {
  max-width: 420px;
}

.status-cell {
  width: fit-content;
  min-width: 120px;
}

.cards {
  list-style: none;
}

.empty p {
  max-width: 440px;
}

.empty__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
}

.min-w-0 {
  min-width: 0;
}
</style>
