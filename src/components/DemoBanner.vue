<script setup lang="ts">
/**
 * Shown at the top of the app's pages while signed in to a "Try the demo" account.
 * No Stitch screen exists for it: it reuses the tonal alert style of the other pages.
 */
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'

  const auth = useAuthStore()
  const router = useRouter()
  const leaving = ref(false)

  const endsAt = computed(() => {
    const iso = auth.user?.demo_expires_at
    return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null
  })

  /** Ends the demo (signs out: the demo account cannot be signed in to again) and opens registration. */
  async function createAccount () {
    leaving.value = true
    try {
      await auth.logout()
    } finally {
      leaving.value = false
    }
    await router.push({ name: 'register' })
  }
</script>

<template>
  <v-alert
    class="demo-banner"
    color="secondary"
    icon="play_circle"
    rounded="lg"
    variant="tonal"
  >
    <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-3">
      <div>
        <p class="text-label-md font-weight-bold">You are exploring the demo</p>

        <p class="text-body-sm">
          Everything here is private to you and deleted after 24 hours<span v-if="endsAt"> (on {{ endsAt }})</span>.
          The sample documents cannot be changed; you can upload one PDF of your own.
        </p>
      </div>

      <v-btn
        class="flex-shrink-0"
        color="secondary"
        :loading="leaving"
        variant="flat"
        @click="createAccount"
      >
        Create your own account
      </v-btn>
    </div>
  </v-alert>
</template>
