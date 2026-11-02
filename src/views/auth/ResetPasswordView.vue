<script setup lang="ts">
/**
 * Opened from the reset email: /reset-password?token=...&email=...
 * No Stitch screen: follows the "Registration — AskMyDocs" form style.
 */
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { authApi } from '@/api/auth'
  import AppTextField from '@/components/AppTextField.vue'
  import PasswordField from '@/components/PasswordField.vue'
  import PasswordRules from '@/components/PasswordRules.vue'
  import { useApiForm } from '@/composables/useApiForm'
  import { LOGIN_ROUTE } from '@/router/guards'

  const route = useRoute()
  const router = useRouter()
  const { submitting, fieldErrors, formError, submit, clearFieldError } = useApiForm()

  const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
  const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))
  const linkIsComplete = computed(() => token.value !== '' && email.value !== '')

  const password = ref('')
  const passwordConfirmation = ref('')

  async function resetPassword () {
    const message = await submit(() => authApi.resetPassword({
      token: token.value,
      email: email.value,
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    }))
    if (message !== undefined) {
      // The API does not log the user in: sign in with the new password.
      await router.replace({ name: LOGIN_ROUTE, query: { reset: '1', email: email.value } })
    }
  }
</script>

<template>
  <div class="d-flex flex-column">
    <div class="d-flex flex-column ga-1 mb-4">
      <h1 class="text-headline-xl-mobile text-on-surface">Choose a new password</h1>
      <p class="text-body-md text-on-surface-variant">Your other sessions will be signed out.</p>
    </div>

    <div v-if="!linkIsComplete" class="pa-4 rounded-lg bg-error-container text-on-error-container d-flex align-start ga-3" role="alert">
      <v-icon icon="link_off" size="24" />

      <div class="d-flex flex-column ga-1">
        <span class="text-label-md font-weight-bold">This reset link is incomplete</span>
        <p class="text-body-sm">Open the link from the email again, or request a new one.</p>
        <router-link class="text-label-md font-weight-bold" :to="{ name: 'forgot-password' }">Request a new link</router-link>
      </div>
    </div>

    <template v-else>
      <v-alert
        v-if="formError || fieldErrors.token || fieldErrors.email"
        class="mb-4"
        color="error"
        density="compact"
        icon="error"
        role="alert"
        rounded="lg"
        variant="tonal"
      >
        {{ formError ?? fieldErrors.token?.[0] ?? fieldErrors.email?.[0] }}
        <template v-if="fieldErrors.token || fieldErrors.email">
          <router-link class="font-weight-bold" :to="{ name: 'forgot-password', query: { email } }">Request a new link</router-link>
        </template>
      </v-alert>

      <div class="bg-surface-container-lowest rounded-lg pa-4 elevation-2">
        <form class="d-flex flex-column ga-3" novalidate @submit.prevent="resetPassword">
          <AppTextField
            id="email"
            autocomplete="username"
            label="Email"
            :model-value="email"
            prepend-inner-icon="mail"
            readonly
          />

          <div class="d-flex flex-column ga-1">
            <PasswordField
              id="password"
              v-model="password"
              autocomplete="new-password"
              :error-messages="fieldErrors.password"
              label="New password"
              @update:model-value="clearFieldError('password')"
            />

            <PasswordRules :password="password" />
          </div>

          <PasswordField
            id="password-confirmation"
            v-model="passwordConfirmation"
            autocomplete="new-password"
            label="Confirm new password"
            prepend-inner-icon="verified_user"
          />

          <v-btn
            append-icon="arrow_forward"
            block
            class="mt-2 text-headline-md"
            color="primary"
            :loading="submitting"
            size="x-large"
            type="submit"
          >
            Reset password
          </v-btn>
        </form>
      </div>
    </template>

    <p class="mt-6 text-center text-body-md text-on-surface-variant">
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
