<script setup lang="ts">
  import type { Document } from '@/types/api'
  import { computed } from 'vue'
  import { documentStatus } from '@/utils/documentStatus'

  const props = defineProps<{ document: Document }>()

  const status = computed(() => documentStatus(props.document))
</script>

<template>
  <span
    class="status-chip text-label-md"
    :class="[document.status === 'failed' ? 'bg-error-container text-on-error-container' : `bg-surface-container-high text-${status.color}`]"
  >
    <v-icon v-if="document.status === 'failed'" icon="warning" size="14" />
    <span v-else class="status-chip__dot" :class="[`bg-${status.color}`, { 'status-chip__dot--busy': status.busy }]" />
    {{ status.label }}
  </span>
</template>

<style scoped>
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  white-space: nowrap;
}

.status-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-chip__dot--busy {
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-chip__dot--busy {
    animation: none;
  }
}
</style>
