<script setup lang="ts">
/** Asks for confirmation of a destructive action; `action` performs the request. */
  import { watch } from 'vue'
  import { useApiForm } from '@/composables/useApiForm'

  const props = defineProps<{
    heading: string
    confirmLabel: string
    action: () => Promise<unknown>
  }>()
  const open = defineModel<boolean>({ required: true })

  const { submitting, formError, submit } = useApiForm()

  watch(open, () => {
    formError.value = null
  })

  async function confirm () {
    const done = await submit(async () => {
      await props.action()
      return true
    })
    if (done) {
      open.value = false
    }
  }
</script>

<template>
  <v-dialog v-model="open" aria-labelledby="confirm-dialog-title" max-width="480">
    <div class="bg-surface-container-lowest rounded-lg pa-6 d-flex flex-column ga-4 elevation-8">
      <div class="d-flex align-center ga-2">
        <v-icon class="text-error" icon="delete_forever" size="24" />
        <h2 id="confirm-dialog-title" class="text-headline-md text-on-surface">{{ heading }}</h2>
      </div>

      <div class="text-body-md text-on-surface"><slot /></div>

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
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="error" :loading="submitting" prepend-icon="delete" @click="confirm">{{ confirmLabel }}</v-btn>
      </div>
    </div>
  </v-dialog>
</template>
