<script setup lang="ts">
/** No Stitch screen: follows the "Login — AskMyDocs" layout. */
  import { ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { authApi } from '@/api/auth'
  import AppTextField from '@/components/AppTextField.vue'
  import { useApiForm } from '@/composables/useApiForm'

  const route = useRoute()
  const { submitting, fieldErrors, formError, submit, clearFieldError } = useApiForm()

  const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
  /** The API's answer. It is the same whether or not the account exists (no account enumeration). */
  const sentMessage = ref<string | null>(null)

  async function sendLink () {
    const message = await submit(() => authApi.forgotPassword(email.value.trim()))
    if (message !== undefined) {
      sentMessage.value = message
    }
  }
</script>

<template>
  <div class="d-flex flex-column">
    <div class="d-flex flex-column ga-1 mb-4">
      <h1 class="text-headline-xl-mobile text-on-surface">Forgot your password?</h1>
      <p class="text-body-md text-on-surface-variant">Enter your email address and we will send you a link to choose a new password.</p>
    </div>

    <div v-if="sentMessage" class="pa-4 rounded-lg bg-surface-container-low shadow-sm d-flex align-start ga-3" role="status">
      <v-icon class="text-secondary" icon="mark_email_read" size="24" />

      <div class="d-flex flex-column ga-1">
        <span class="text-label-md text-on-surface font-weight-bold">Check your inbox</span>
        <p class="text-body-sm text-on-surface-variant">{{ sentMessage }}</p>
      </div>
    </div>

    <template v-else>
      <v-alert
        v-if="formError"
        class="mb-4"
        color="error"
        density="compact"
        icon="error"
        role="alert"
        rounded="lg"
        :text="formError"
        variant="tonal"
      />

      <form class="d-flex flex-column ga-3" novalidate @submit.prevent="sendLink">
        <AppTextField
          id="email"
          v-model="email"
          autocomplete="email"
          :error-messages="fieldErrors.email"
          label="Email"
          placeholder="you@example.com"
          prepend-inner-icon="mail"
          type="email"
          @update:model-value="clearFieldError('email')"
        />

        <v-btn
          append-icon="arrow_forward"
          block
          class="text-headline-md shadow-sm"
          color="primary-container"
          :loading="submitting"
          size="x-large"
          type="submit"
        >
          Send reset link
        </v-btn>
      </form>
    </template>

    <p class="mt-6 text-center text-body-md text-on-surface-variant">
      Remembered it?
      <router-link class="text-primary font-weight-bold link" :to="{ name: 'login' }">Back to sign in</router-link>
    </p>
  </div>
</template>

<style scoped>
.link {
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
</style>
