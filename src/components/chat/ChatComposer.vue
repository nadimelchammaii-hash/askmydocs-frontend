<script setup lang="ts">
/** Question input (Stitch: chat input dock). Enter sends, Shift+Enter adds a line. */
  import { computed } from 'vue'
  import { QUESTION_MAX_CHARS } from '@/api/conversations'

  const props = defineProps<{
    /** Why asking is not possible right now (shown as placeholder); null when it is. */
    blockedReason: string | null
    sending: boolean
    error: string | null
    documentTitle: string
  }>()
  const emit = defineEmits<{ submit: [question: string] }>()
  const question = defineModel<string>({ default: '' })

  const trimmed = computed(() => question.value.trim())
  const tooLong = computed(() => question.value.length > QUESTION_MAX_CHARS)
  const canSend = computed(() => props.blockedReason === null && !props.sending && trimmed.value !== '' && !tooLong.value)

  function send () {
    if (canSend.value) {
      emit('submit', trimmed.value)
    }
  }
</script>

<template>
  <form class="composer d-flex flex-column ga-2" @submit.prevent="send">
    <v-alert
      v-if="error"
      color="error"
      density="compact"
      icon="error"
      role="alert"
      rounded="lg"
      :text="error"
      variant="tonal"
    />

    <div class="box bg-surface-container-low rounded-lg pa-2 d-flex align-end ga-2 shadow-sm">
      <v-textarea
        v-model="question"
        aria-label="Your question"
        auto-grow
        bg-color="transparent"
        class="flex-grow-1"
        density="compact"
        :disabled="blockedReason !== null"
        hide-details
        max-rows="6"
        :placeholder="blockedReason ?? 'Ask a question about this PDF…'"
        rows="1"
        variant="solo"
        @keydown.enter.exact.prevent="send"
      />

      <v-btn
        aria-label="Send question"
        color="primary-container"
        :disabled="!canSend"
        icon="arrow_upward"
        :loading="sending"
        size="small"
        type="submit"
      />
    </div>

    <div class="d-flex align-center justify-space-between ga-2 px-1">
      <span class="text-label-code text-outline text-truncate d-flex align-center ga-1">
        <v-icon class="text-secondary" icon="verified_user" size="13" />
        Answers come only from <strong class="text-on-surface text-truncate">{{ documentTitle }}</strong>
      </span>

      <span v-if="question.length > QUESTION_MAX_CHARS * 0.8" class="text-label-code flex-shrink-0" :class="tooLong ? 'text-error' : 'text-outline'">
        {{ question.length }} / {{ QUESTION_MAX_CHARS }}
      </span>

      <span v-else class="text-label-code text-outline d-none d-md-inline flex-shrink-0">Enter to send · Shift+Enter for a new line</span>
    </div>
  </form>
</template>

<style scoped>
.box :deep(.v-field) {
  box-shadow: none !important;
}
</style>
