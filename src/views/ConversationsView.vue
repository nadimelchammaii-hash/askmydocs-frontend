<script setup lang="ts">
  import type { Conversation, Paginated } from '@/types/api'
  /**
 * All conversations, most recently active first. No Stitch screen of its own: it uses
 * the card style of the Dashboard's "Recent conversations" and the Library's layout.
 * ?document=<id> shows only the conversations about one document; ?page=<n> pages.
 */
  import type { LocationQuery } from 'vue-router'
  import { computed, ref, shallowRef, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { conversationsApi } from '@/api/conversations'
  import { type ApiError, toApiError } from '@/api/errors'
  import ConfirmDialog from '@/components/ConfirmDialog.vue'
  import RenameDialog from '@/components/RenameDialog.vue'
  import { formatRelative, plural } from '@/utils/format'

  /** The API limit for conversation titles. */
  const TITLE_MAX_LENGTH = 200

  const route = useRoute()
  const router = useRouter()
  const { mdAndUp } = useDisplay()

  const page = computed(() => {
    const value = Number(route.query.page)
    return Number.isInteger(value) && value > 0 ? value : 1
  })
  const documentId = computed(() => (typeof route.query.document === 'string' && route.query.document !== '' ? route.query.document : undefined))

  const result = shallowRef<Paginated<Conversation> | null>(null)
  const loading = ref(false)
  const error = shallowRef<ApiError | null>(null)
  const notice = ref<string | null>(null)

  /** Title of the document the list is filtered by (from the first conversation). */
  const filteredDocument = computed(() => documentId.value ? result.value?.data[0]?.document : undefined)

  let latest = 0
  async function load () {
    const run = ++latest
    loading.value = true
    error.value = null
    try {
      const response = await conversationsApi.list({ page: page.value, documentId: documentId.value })
      if (run !== latest) {
        return
      }
      // Past the last page (e.g. after deleting its only item): go to the last page.
      if (response.data.length === 0 && response.meta.current_page > response.meta.last_page && response.meta.last_page >= 1) {
        await setQuery({ page: response.meta.last_page })
        return
      }
      result.value = response
    } catch (error_) {
      if (run === latest) {
        error.value = toApiError(error_)
      }
    } finally {
      if (run === latest) {
        loading.value = false
      }
    }
  }

  watch(() => [page.value, documentId.value], load, { immediate: true })

  function setQuery (changes: { page?: number, document?: string | undefined }) {
    const query: LocationQuery = { ...route.query }
    if ('document' in changes) {
      delete query.document
      if (changes.document) {
        query.document = changes.document
      }
    }
    delete query.page
    const nextPage = changes.page ?? 1
    if (nextPage > 1) {
      query.page = String(nextPage)
    }
    return router.replace({ query })
  }

  function questionCount (conversation: Conversation): number {
    // Each question has an answer message (pending, completed or failed).
    return Math.ceil((conversation.messages_count ?? 0) / 2)
  }

  // --- Rename and delete ------------------------------------------------------
  const renaming = ref<Conversation | null>(null)
  const deleting = ref<Conversation | null>(null)
  const renameOpen = computed({
    get: () => renaming.value !== null,
    set: open => {
      if (!open) {
        renaming.value = null
      }
    },
  })
  const deleteOpen = computed({
    get: () => deleting.value !== null,
    set: open => {
      if (!open) {
        deleting.value = null
      }
    },
  })

  async function rename (title: string) {
    const target = renaming.value!
    const updated = await conversationsApi.rename(target.id, title)
    if (result.value) {
      result.value = {
        ...result.value,
        // The response has no counts: keep the ones from the list.
        data: result.value.data.map(item => item.id === updated.id ? { ...item, title: updated.title } : item),
      }
    }
    notice.value = 'Conversation renamed.'
  }

  async function remove () {
    const target = deleting.value!
    await conversationsApi.remove(target.id)
    notice.value = `“${target.title}” deleted.`
    await load()
  }
</script>

<template>
  <div class="conversations d-flex flex-column ga-6">
    <div class="d-flex flex-column ga-1">
      <h1 class="text-on-surface" :class="mdAndUp ? 'text-headline-xl' : 'text-headline-xl-mobile'">Conversations</h1>
      <p class="text-body-md text-on-surface-variant">Your questions and cited answers, most recent first.</p>
    </div>

    <div v-if="documentId" class="filter d-flex align-center ga-2 bg-surface-container-lowest rounded-lg px-4 py-2 shadow-sm">
      <v-icon class="text-primary" icon="filter_alt" size="18" />

      <span class="text-body-md text-on-surface flex-grow-1 text-truncate">
        About <strong>{{ filteredDocument?.title ?? 'one document' }}</strong>
      </span>

      <v-btn size="small" variant="text" @click="setQuery({ document: undefined })">Show all</v-btn>
    </div>

    <div :aria-busy="loading" class="position-relative">
      <v-progress-linear
        v-if="loading && result"
        absolute
        aria-label="Loading conversations"
        color="primary"
        indeterminate
      />

      <v-alert
        v-if="error"
        color="error"
        icon="error"
        role="alert"
        rounded="lg"
        title="The conversations could not be loaded"
        variant="tonal"
      >
        {{ error.message }}
        <template #append>
          <v-btn color="error" variant="text" @click="load()">Try again</v-btn>
        </template>
      </v-alert>

      <v-skeleton-loader v-else-if="!result" aria-label="Loading conversations" class="bg-transparent" type="list-item-two-line@4" />

      <div v-else-if="result.data.length === 0" class="empty bg-surface-container-lowest rounded-lg pa-10 shadow-sm d-flex flex-column align-center text-center ga-3">
        <span class="empty__icon bg-surface-container-high text-primary"><v-icon icon="forum" size="32" /></span>
        <h2 class="text-headline-md text-on-surface">No conversations yet</h2>
        <p class="text-body-md text-on-surface-variant">Open a ready document in the library and ask a question about it.</p>
        <v-btn color="primary-container" prepend-icon="folder_open" :to="{ name: 'documents' }">Document Library</v-btn>
      </div>

      <template v-else>
        <ul class="list d-flex flex-column ga-3">
          <li
            v-for="conversation in result.data"
            :key="conversation.id"
            class="bg-surface-container-lowest rounded-lg pa-4 shadow-sm d-flex flex-column flex-sm-row align-sm-center justify-space-between ga-3"
            :data-conversation-id="conversation.id"
          >
            <div class="d-flex align-start ga-3 min-w-0">
              <span class="item-icon bg-surface-container-low text-primary"><v-icon icon="forum" size="20" /></span>

              <div class="d-flex flex-column min-w-0">
                <router-link
                  class="title text-headline-md text-on-surface text-truncate"
                  :to="{ name: 'conversation', params: { conversationId: conversation.id } }"
                >
                  {{ conversation.title }}
                </router-link>

                <span class="text-body-sm text-on-surface-variant text-truncate">
                  <template v-if="conversation.document">{{ conversation.document.title }} · </template>{{ plural(questionCount(conversation), 'question') }} · {{ formatRelative(conversation.updated_at) }}
                </span>
              </div>
            </div>

            <div class="d-flex align-center justify-end ga-1 flex-shrink-0">
              <v-btn
                append-icon="arrow_forward"
                class="bg-surface-container text-primary"
                size="small"
                :to="{ name: 'conversation', params: { conversationId: conversation.id } }"
              >
                Open
              </v-btn>

              <v-menu location="bottom end">
                <template #activator="{ props: activator }">
                  <v-btn
                    v-bind="activator"
                    :aria-label="`More actions for ${conversation.title}`"
                    icon="more_vert"
                    size="small"
                    variant="text"
                  />
                </template>

                <v-list class="bg-surface-container-lowest" density="comfortable" min-width="200" rounded="lg">
                  <v-list-item prepend-icon="drive_file_rename_outline" title="Rename" @click="renaming = conversation" />

                  <v-list-item
                    v-if="conversation.document && !documentId"
                    prepend-icon="filter_alt"
                    title="Same document only"
                    @click="setQuery({ document: conversation.document.id })"
                  />

                  <v-divider class="my-1" />
                  <v-list-item base-color="error" prepend-icon="delete" title="Delete" @click="deleting = conversation" />
                </v-list>
              </v-menu>
            </div>
          </li>
        </ul>

        <div class="d-flex flex-column flex-sm-row align-center justify-space-between ga-2 mt-4">
          <span class="text-body-sm text-on-surface-variant">
            Showing <strong>{{ result.meta.from }}</strong>–<strong>{{ result.meta.to }}</strong> of <strong>{{ result.meta.total }}</strong> conversations
          </span>

          <v-pagination
            v-if="result.meta.last_page > 1"
            density="compact"
            :length="result.meta.last_page"
            :model-value="result.meta.current_page"
            rounded="lg"
            :total-visible="5"
            @update:model-value="value => setQuery({ page: value })"
          />
        </div>
      </template>
    </div>

    <RenameDialog
      v-model="renameOpen"
      heading="Rename conversation"
      :max-length="TITLE_MAX_LENGTH"
      :save="rename"
      :value="renaming?.title ?? ''"
    />

    <ConfirmDialog v-model="deleteOpen" :action="remove" confirm-label="Delete" heading="Delete conversation?">
      <strong class="text-break">{{ deleting?.title }}</strong> and all its questions and answers will be permanently deleted. The document stays in your library.
    </ConfirmDialog>

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
.conversations {
  max-width: 1000px;
  margin-inline: auto;
  width: 100%;
}

.list {
  list-style: none;
}

.item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.title {
  text-decoration: none;
}

.title:hover {
  color: rgb(var(--v-theme-primary)) !important;
  text-decoration: underline;
}

.empty p {
  max-width: 420px;
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
