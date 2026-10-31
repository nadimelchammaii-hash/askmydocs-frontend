<script setup lang="ts">
/** Unknown URL. */
</script>

<template>
  <v-main class="bg-surface">
    <div class="d-flex flex-column align-center justify-center text-center pa-6 ga-3" style="min-height: 60vh">
      <v-icon color="primary" icon="search_off" size="40" />
      <h1 class="text-headline-lg text-on-surface">Page not found</h1>
      <p class="text-body-md text-on-surface-variant">The page you are looking for does not exist or was moved.</p>
      <v-btn color="primary-container" :to="{ name: 'dashboard' }">Go to dashboard</v-btn>
    </div>
  </v-main>
</template>
