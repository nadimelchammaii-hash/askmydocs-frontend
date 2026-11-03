<script setup lang="ts">
  import type { Document } from '@/types/api'

  defineProps<{ document: Document }>()
  const emit = defineEmits<{ rename: [], download: [], delete: [] }>()
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: activator }">
      <v-btn
        v-bind="activator"
        :aria-label="`More actions for ${document.title}`"
        icon="more_vert"
        size="small"
        variant="text"
      />
    </template>

    <v-list class="bg-surface-container-lowest" density="comfortable" min-width="220" rounded="lg">
      <v-list-item prepend-icon="drive_file_rename_outline" title="Rename" @click="emit('rename')" />
      <v-list-item prepend-icon="download" title="Download PDF" @click="emit('download')" />
      <v-divider class="my-1" />
      <v-list-item base-color="error" prepend-icon="delete" title="Delete" @click="emit('delete')" />
    </v-list>
  </v-menu>
</template>
