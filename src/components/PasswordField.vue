<script setup lang="ts">
/** Password field with a show/hide button (Stitch login and registration). */
  import { ref } from 'vue'
  import AppTextField from './AppTextField.vue'

  defineOptions({ inheritAttrs: false })

  defineProps<{
    id: string
    label: string
  }>()

  const model = defineModel<string>({ default: '' })
  const visible = ref(false)
</script>

<template>
  <AppTextField
    :id="id"
    v-model="model"
    :label="label"
    prepend-inner-icon="lock"
    :type="visible ? 'text' : 'password'"
    v-bind="$attrs"
  >
    <template #append-inner>
      <v-btn
        :aria-label="visible ? 'Hide password' : 'Show password'"
        :aria-pressed="visible"
        color="on-surface-variant"
        density="comfortable"
        :icon="visible ? 'visibility_off' : 'visibility'"
        size="small"
        variant="text"
        @click="visible = !visible"
      />
    </template>
  </AppTextField>
</template>
