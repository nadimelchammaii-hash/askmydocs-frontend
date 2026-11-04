<script setup lang="ts">
/** Dialog with one title field. `save` performs the request; API errors are shown in the dialog. */
  import { ref, watch } from 'vue'
  import AppTextField from '@/components/AppTextField.vue'
  import { useApiForm } from '@/composables/useApiForm'

  const props = defineProps<{
    heading: string
    /** Current title, used as the starting value. */
    value: string
    maxLength: number
    save: (title: string) => Promise<unknown>
  }>()
  const open = defineModel<boolean>({ required: true })

  const { submitting, fieldErrors, formError, submit, clearFieldError } = useApiForm()
  const title = ref('')

  watch(open, isOpen => {
    if (isOpen) {
      title.value = props.value
      fieldErrors.value = {}
      formError.value = null
    }
  }, { immediate: true })

  async function rename () {
    const value = title.value.trim()
    if (value === '') {
      fieldErrors.value = { title: ['Enter a title.'] }
      return
    }
    const done = await submit(async () => {
      await props.save(value)
      return true
    })
    if (done) {
      open.value = false
    }
  }
</script>

<template>
  <v-dialog v-model="open" aria-labelledby="rename-dialog-title" max-width="480">
    <form class="bg-surface-container-lowest rounded-lg pa-6 d-flex flex-column ga-4 elevation-8" novalidate @submit.prevent="rename">
      <h2 id="rename-dialog-title" class="text-headline-md text-on-surface">{{ heading }}</h2>

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
        id="rename-dialog-input"
        v-model="title"
        autofocus
        counter
        :error-messages="fieldErrors.title"
        label="Title"
        :maxlength="maxLength"
        @update:model-value="clearFieldError('title')"
      />

      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="submitting" type="submit">Save</v-btn>
      </div>
    </form>
  </v-dialog>
</template>
