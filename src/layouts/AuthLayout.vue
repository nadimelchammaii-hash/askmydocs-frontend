<script setup lang="ts">
/** Shell for guest pages (Stitch: "Login — AskMyDocs", "Registration — AskMyDocs"). */
</script>

<template>
  <v-main class="bg-surface">
    <div class="auth-column mx-auto px-5 pb-6">
      <header class="d-flex align-center justify-center ga-2 pt-6 pb-4">
        <span class="brand-mark bg-primary-container shadow-soft"><v-icon icon="description" size="22" /></span>
        <span class="text-headline-lg text-on-surface">AskMyDocs</span>
      </header>

      <router-view />
    </div>
  </v-main>
</template>

<style scoped>
.auth-column {
  max-width: 440px;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
</style>
