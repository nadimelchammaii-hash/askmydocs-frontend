<script setup lang="ts">
/**
 * Stitch: "Upload Documents" dialog of the Document Library (without workspace tags,
 * which the API does not have). One PDF at a time, as the API accepts.
 */
  import type { Document } from '@/types/api'
  import { ref, useTemplateRef, watch } from 'vue'
  import { DOCUMENT_LIMITS, documentsApi } from '@/api/documents'
  import { toApiError } from '@/api/errors'
  import { formatBytes } from '@/utils/format'

  const open = defineModel<boolean>({ required: true })
  const emit = defineEmits<{ uploaded: [document: Document] }>()

  const input = useTemplateRef<HTMLInputElement>('input')
  const file = ref<File | null>(null)
  const error = ref<string | null>(null)
  const dragging = ref(false)
  const uploading = ref(false)
  const progress = ref(0)
  let controller: AbortController | undefined

  const maxSizeLabel = formatBytes(DOCUMENT_LIMITS.maxSizeBytes)

  /** Early feedback only: the API checks the content again (a renamed file is not a PDF). */
  function problemWith (candidate: File): string | null {
    const looksLikePdf = candidate.type === 'application/pdf' || candidate.name.toLowerCase().endsWith('.pdf')
    if (!looksLikePdf) {
      return 'Choose a PDF file.'
    }
    if (candidate.size === 0) {
      return 'This file is empty.'
    }
    if (candidate.size > DOCUMENT_LIMITS.maxSizeBytes) {
      return `This file is ${formatBytes(candidate.size)}; the maximum is ${maxSizeLabel}.`
    }
    return null
  }

  function choose (files: FileList | null | undefined) {
    if (uploading.value || !files || files.length === 0) {
      return
    }
    if (files.length > 1) {
      error.value = 'Upload one PDF at a time.'
      return
    }
    const candidate = files[0]!
    error.value = problemWith(candidate)
    file.value = error.value ? null : candidate
  }

  function onInputChange () {
    choose(input.value?.files)
    // Allows choosing the same file again after removing it.
    if (input.value) {
      input.value.value = ''
    }
  }

  function onDrop (event: DragEvent) {
    dragging.value = false
    choose(event.dataTransfer?.files)
  }

  async function upload () {
    if (!file.value || uploading.value) {
      return
    }
    controller = new AbortController()
    const { signal } = controller
    uploading.value = true
    progress.value = 0
    error.value = null
    try {
      const document = await documentsApi.upload(file.value, {
        signal,
        onProgress: percent => {
          progress.value = percent
        },
      })
      emit('uploaded', document)
      open.value = false
    } catch (error_) {
      if (!signal.aborted) {
        const apiError = toApiError(error_)
        error.value = apiError.errors.file?.[0] ?? apiError.message
      }
    } finally {
      uploading.value = false
      controller = undefined
    }
  }

  function close () {
    open.value = false
  }

  // Closing cancels a running upload; reopening starts clean.
  watch(open, isOpen => {
    if (!isOpen) {
      controller?.abort()
    }
    file.value = null
    error.value = null
    dragging.value = false
    progress.value = 0
  })
</script>

<template>
  <v-dialog v-model="open" aria-labelledby="upload-title" max-width="560">
    <div class="bg-surface-container-lowest rounded-lg pa-6 d-flex flex-column ga-4 elevation-8">
      <div class="d-flex align-center justify-space-between">
        <div class="d-flex align-center ga-2">
          <span class="tile bg-surface-container-high text-primary"><v-icon icon="upload" size="20" /></span>
          <h2 id="upload-title" class="text-headline-md text-on-surface">Upload a PDF</h2>
        </div>

        <v-btn
          aria-label="Close"
          icon="close"
          size="small"
          variant="text"
          @click="close"
        />
      </div>

      <div
        class="dropzone rounded-lg pa-6 d-flex flex-column align-center ga-3 text-center"
        :class="dragging ? 'bg-surface-container-high' : 'bg-surface-container-low'"
        @dragenter.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <span class="dropzone__icon bg-surface-container-lowest text-primary shadow-sm">
          <v-icon icon="cloud_upload" size="28" />
        </span>

        <div class="d-flex flex-column ga-1">
          <span class="text-body-lg text-on-surface font-weight-medium">Drag and drop your PDF here</span>

          <span class="text-body-sm text-on-surface-variant">
            PDF with selectable text, up to {{ maxSizeLabel }} and {{ DOCUMENT_LIMITS.maxPages }} pages
          </span>
        </div>

        <input
          id="upload-file"
          ref="input"
          accept="application/pdf,.pdf"
          aria-label="Choose a PDF file"
          class="d-sr-only"
          :disabled="uploading"
          type="file"
          @change="onInputChange"
        >

        <v-btn color="primary" :disabled="uploading" variant="tonal" @click="input?.click()">Browse files</v-btn>
      </div>

      <div v-if="file" class="d-flex align-center ga-3 pa-3 rounded-lg bg-surface-container-low">
        <v-icon class="text-primary" icon="picture_as_pdf" size="24" />

        <div class="d-flex flex-column flex-grow-1 min-w-0">
          <span class="text-body-md text-on-surface text-truncate">{{ file.name }}</span>
          <span class="text-label-code text-on-surface-variant">{{ formatBytes(file.size) }}</span>
        </div>

        <v-btn
          v-if="!uploading"
          aria-label="Remove file"
          icon="close"
          size="small"
          variant="text"
          @click="file = null"
        />
      </div>

      <div v-if="uploading" class="d-flex flex-column ga-1">
        <div class="d-flex justify-space-between text-label-md text-on-surface-variant">
          <span>{{ progress < 100 ? 'Uploading…' : 'Checking the file…' }}</span>
          <span class="text-primary">{{ progress }}%</span>
        </div>

        <v-progress-linear
          aria-label="Upload progress"
          color="primary"
          :indeterminate="progress === 100"
          :model-value="progress"
          rounded
        />
      </div>

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

      <p class="text-body-sm text-on-surface-variant">
        After the upload, the text is read and indexed. You can ask questions as soon as the document is ready.
      </p>

      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" @click="close">Cancel</v-btn>

        <v-btn
          color="primary"
          :disabled="!file"
          :loading="uploading"
          prepend-icon="upload_file"
          @click="upload"
        >
          Upload
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.dropzone {
  outline: 2px dashed rgb(var(--v-theme-outline-variant));
  outline-offset: -2px;
  transition: background-color 0.15s;
}

.dropzone__icon {
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
