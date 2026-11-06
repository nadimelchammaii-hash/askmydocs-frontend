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
      <!-- Demo samples cannot be renamed or deleted (the API refuses it too). -->
      <v-list-item v-if="!document.is_sample" prepend-icon="drive_file_rename_outline" title="Rename" @click="emit('rename')" />
      <v-list-item prepend-icon="download" title="Download PDF" @click="emit('download')" />

      <v-list-item
        v-if="(document.conversations_count ?? 0) > 0"
        prepend-icon="forum"
        :title="`Conversations (${document.conversations_count})`"
        :to="{ name: 'conversations', query: { document: document.id } }"
      />

      <template v-if="!document.is_sample">
        <v-divider class="my-1" />
        <v-list-item base-color="error" prepend-icon="delete" title="Delete" @click="emit('delete')" />
      </template>
    </v-list>
  </v-menu>
</template>
