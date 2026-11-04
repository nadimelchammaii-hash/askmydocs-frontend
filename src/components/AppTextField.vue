<script setup lang="ts">
/**
 * Text field with its label above the input (Stitch form style). Other attributes
 * (type, autocomplete, icons, error-messages, …) are passed to v-text-field.
 */
  defineOptions({ inheritAttrs: false })

  defineProps<{
    id: string
    label: string
  }>()

  const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="d-flex flex-column ga-1">
    <label class="text-label-md text-on-surface d-flex align-center justify-space-between" :for="id">
      <span>{{ label }}</span>
      <slot name="label-end" />
    </label>

    <v-text-field
      :id="id"
      v-model="model"
      density="comfortable"
      v-bind="$attrs"
    >
      <template v-if="$slots['append-inner']" #append-inner>
        <slot name="append-inner" />
      </template>
    </v-text-field>
  </div>
</template>
