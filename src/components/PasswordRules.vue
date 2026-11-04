<script setup lang="ts">
/** Live checklist of the API's password rules (Stitch registration "password quality indicators"). */
  import { computed } from 'vue'
  import { passwordRules } from '@/utils/password'

  const props = defineProps<{ password: string }>()

  const rules = computed(() => passwordRules(props.password))
</script>

<template>
  <ul aria-label="Password requirements" class="password-rules bg-surface-container-low rounded-lg pa-1">
    <li
      v-for="rule in rules"
      :key="rule.label"
      class="d-flex align-center ga-1 px-2 py-1 rounded text-label-md"
      :class="rule.passed ? 'bg-surface-container-lowest text-on-surface' : 'bg-surface-container text-on-surface-variant'"
    >
      <v-icon
        :class="rule.passed ? 'text-secondary icon-filled' : 'text-outline'"
        :icon="rule.passed ? 'check_circle' : 'radio_button_unchecked'"
        size="16"
      />

      <span>{{ rule.label }}</span>
      <span class="sr-only">{{ rule.passed ? ' (met)' : ' (not met)' }}</span>
    </li>
  </ul>
</template>

<style scoped>
.password-rules {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 4px;
}

.icon-filled {
  font-variation-settings: 'FILL' 1;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
