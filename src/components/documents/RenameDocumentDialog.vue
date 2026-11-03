<script setup lang="ts">
  import type { Document } from '@/types/api'
  import { ref, watch } from 'vue'
  import { documentsApi } from '@/api/documents'
  import AppTextField from '@/components/AppTextField.vue'
  import { useApiForm } from '@/composables/useApiForm'

  /** The document to rename; the dialog is open while it is set. */
  const document = defineModel<Document | null>({ required: true })
  const emit = defineEmits<{ renamed: [document: Document] }>()

  const MAX_LENGTH = 255
  const { submitting, fieldErrors, formError, submit, clearFieldError } = useApiForm()
  const title = ref('')

  watch(document, current => {
    title.value = current?.title ?? ''
    fieldErrors.value = {}
    formError.value = null
  }, { immediate: true })

  async function rename () {
    const current = document.value
    const value = title.value.trim()
    if (!current) {
      return
    }
    if (value === '') {
      fieldErrors.value = { title: ['Enter a title.'] }
      return
    }
    const renamed = await submit(() => documentsApi.rename(current.id, value))
    if (renamed) {
      emit('renamed', renamed)
      document.value = null
    }
  }
</script>

<template>
  <v-dialog
    aria-labelledby="rename-title"
    max-width="480"
    :model-value="document !== null"
    @update:model-value="open => { if (!open) document = null }"
  >
    <form class="bg-surface-container-lowest rounded-lg pa-6 d-flex flex-column ga-4 elevation-8" novalidate @submit.prevent="rename">
      <h2 id="rename-title" class="text-headline-md text-on-surface">Rename document</h2>

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

      <AppTextField
        id="rename-input"
        v-model="title"
        autofocus
        counter
        :error-messages="fieldErrors.title"
        label="Title"
        :maxlength="MAX_LENGTH"
        @update:model-value="clearFieldError('title')"
      />

      <p v-if="document" class="text-body-sm text-on-surface-variant">
        Original file: <span class="text-label-code">{{ document.original_filename }}</span>
      </p>

      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" @click="document = null">Cancel</v-btn>
        <v-btn color="primary" :loading="submitting" type="submit">Save</v-btn>
      </div>
    </form>
  </v-dialog>
</template>
