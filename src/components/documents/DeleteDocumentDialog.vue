<script setup lang="ts">
  import type { Document } from '@/types/api'
  import { computed } from 'vue'
  import { documentsApi } from '@/api/documents'
  import { useApiForm } from '@/composables/useApiForm'
  import { plural } from '@/utils/format'

  /** The document to delete; the dialog is open while it is set. */
  const document = defineModel<Document | null>({ required: true })
  const emit = defineEmits<{ deleted: [document: Document] }>()

  const { submitting, formError, submit } = useApiForm()

  const conversations = computed(() => document.value?.conversations_count ?? 0)

  async function remove () {
    const current = document.value
    if (!current) {
      return
    }
    const done = await submit(async () => {
      await documentsApi.remove(current.id)
      return true
    })
    if (done) {
      emit('deleted', current)
      document.value = null
    }
  }

  function close () {
    formError.value = null
    document.value = null
  }
</script>

<template>
  <v-dialog
    aria-labelledby="delete-title"
    max-width="480"
    :model-value="document !== null"
    @update:model-value="open => { if (!open) close() }"
  >
    <div v-if="document" class="bg-surface-container-lowest rounded-lg pa-6 d-flex flex-column ga-4 elevation-8">
      <div class="d-flex align-center ga-2">
        <v-icon class="text-error" icon="delete_forever" size="24" />
        <h2 id="delete-title" class="text-headline-md text-on-surface">Delete document?</h2>
      </div>

      <p class="text-body-md text-on-surface">
        <strong class="text-break">{{ document.title }}</strong> will be permanently deleted with its PDF and extracted text<template v-if="conversations > 0">, and {{ plural(conversations, 'conversation') }} about it</template>.
        This cannot be undone.
      </p>

      <v-alert
        v-if="formError"
        color="error"
        density="compact"
        icon="error"
        role="alert"
        rounded="lg"
        :text="formError"
        variant="tonal"
      />

      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="error" :loading="submitting" prepend-icon="delete" @click="remove">Delete</v-btn>
      </div>
    </div>
  </v-dialog>
</template>
