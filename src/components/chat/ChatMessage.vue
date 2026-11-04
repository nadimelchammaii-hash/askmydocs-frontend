<script setup lang="ts">
/**
 * One message of a conversation (Stitch: user bubble and grounded answer card).
 * Answer text comes from the model and may quote the PDF: it is only ever shown
 * as text (interpolation), never as HTML.
 */
  import type { Message } from '@/types/api'
  import type { CitationGroup } from '@/utils/citations'
  import { computed } from 'vue'
  import { groupCitations, pagesLabel, splitAnswer } from '@/utils/citations'

  const props = defineProps<{
    message: Message
    /** Disables retry while another request is running. */
    busy?: boolean
  }>()

  const emit = defineEmits<{
    'open-citation': [group: CitationGroup, page: number]
    'retry': []
  }>()

  const groups = computed(() => groupCitations(props.message.citations))
  const parts = computed(() => splitAnswer(props.message.content ?? '', groups.value))
  const time = computed(() => {
    const date = new Date(props.message.created_at)
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date)
  })

  /** Retrying helps when generating failed; a refused question should be rephrased instead. */
  const canRetry = computed(() => props.message.status === 'failed' && props.message.error_code !== 'answer_refused' && props.message.error_code !== 'document_not_ready')
</script>

<template>
  <!-- Question -->
  <div v-if="message.role === 'user'" class="d-flex flex-column align-end ps-8">
    <div class="question bg-surface-container-high text-on-surface px-4 py-2 rounded-lg shadow-sm">
      <p class="text-body-md text">{{ message.content }}</p>
    </div>

    <span class="text-label-code text-outline mt-1 me-1">{{ time }}</span>
  </div>

  <!-- Answer -->
  <article
    v-else
    :aria-busy="!message.is_finished"
    aria-label="Answer"
    class="d-flex align-start ga-3 pe-md-8"
  >
    <span class="avatar bg-surface-container-low text-primary shadow-sm"><v-icon icon="auto_awesome" size="18" /></span>

    <div class="answer flex-grow-1 min-w-0 bg-surface-container-lowest rounded-lg pa-4 shadow-sm d-flex flex-column ga-3">
      <!-- Pending -->
      <div v-if="message.status === 'pending'" class="d-flex align-center ga-3" role="status">
        <v-progress-circular color="primary" indeterminate size="18" width="2" />

        <div class="d-flex flex-column">
          <span class="text-body-md text-on-surface font-weight-medium">Reading the document…</span>
          <span class="text-body-sm text-on-surface-variant">Finding the passages that answer your question.</span>
        </div>
      </div>

      <!-- Failed -->
      <div v-else-if="message.status === 'failed'" class="d-flex flex-column ga-2" role="alert">
        <div class="d-flex align-center ga-2 text-error">
          <v-icon icon="error" size="18" />
          <span class="text-body-md font-weight-medium">No answer</span>
        </div>

        <p class="text-body-md text-on-surface">{{ message.error_message ?? 'The answer could not be generated.' }}</p>

        <div v-if="canRetry">
          <v-btn
            color="primary"
            :disabled="busy"
            prepend-icon="refresh"
            size="small"
            variant="tonal"
            @click="emit('retry')"
          >
            Try again
          </v-btn>
        </div>
      </div>

      <!-- Completed -->
      <template v-else>
        <div v-if="message.answer_found === false" class="d-flex align-center ga-2 text-on-surface-variant">
          <v-icon icon="search_off" size="18" />
          <span class="text-label-md">Not found in this document</span>
        </div>

        <p class="text-body-md text-on-surface text">
          <template v-for="(part, index) in parts" :key="index">
            <template v-if="part.type === 'text'">{{ part.text }}</template>

            <button
              v-else
              :aria-label="`Source ${part.group.number}, ${pagesLabel(part.group.pages)}`"
              class="pill text-citation-pill bg-surface-container-high text-primary"
              type="button"
              @click="emit('open-citation', part.group, part.group.pages[0]!)"
            >
              <v-icon icon="bookmark" size="12" />{{ pagesLabel(part.group.pages) }}
            </button>
          </template>
        </p>

        <!-- Sources -->
        <section v-if="groups.length > 0" aria-label="Sources" class="sources bg-surface-container-low rounded-lg pa-3 d-flex flex-column ga-2">
          <span class="text-label-code text-uppercase text-on-surface-variant d-flex align-center ga-1">
            <v-icon class="text-secondary" icon="fact_check" size="14" />
            Sources ({{ groups.length }})
          </span>

          <ul class="d-flex flex-column ga-2">
            <template v-for="group in groups" :key="group.number">
              <li v-for="(citation, index) in group.quotes" :key="`${group.number}-${index}`">
                <button
                  class="source w-100 text-start bg-surface-container-lowest rounded-lg pa-2 d-flex align-start ga-2"
                  type="button"
                  @click="emit('open-citation', group, citation.page)"
                >
                  <span class="source__number text-label-code bg-primary-container text-on-primary">{{ group.number }}</span>

                  <span class="d-flex flex-column min-w-0 flex-grow-1">
                    <span class="text-label-code text-primary">Page {{ citation.page }}</span>
                    <q class="text-body-sm text-on-surface-variant source__quote">{{ citation.quote }}</q>
                  </span>

                  <v-icon class="text-primary align-self-center" icon="arrow_forward" size="16" />
                </button>
              </li>
            </template>
          </ul>
        </section>
      </template>

      <span class="text-label-code text-outline">{{ time }}</span>
    </div>
  </article>
</template>

<style scoped>
.question {
  max-width: 640px;
  border-top-right-radius: 0 !important;
}

.text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.answer {
  max-width: 760px;
  border-top-left-radius: 0 !important;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-inline: 2px;
  padding: 1px 6px;
  border-radius: 6px;
  vertical-align: baseline;
  transition: background-color 0.15s, color 0.15s;
}

.pill:hover,
.pill:focus-visible {
  background: rgb(var(--v-theme-primary-container)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
}

.sources ul {
  list-style: none;
}

.source {
  transition: background-color 0.15s;
}

.source:hover,
.source:focus-visible {
  background: rgb(var(--v-theme-surface-container-high)) !important;
}

.source__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-weight: 700;
}

.source__quote {
  font-style: italic;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.min-w-0 {
  min-width: 0;
}
</style>
