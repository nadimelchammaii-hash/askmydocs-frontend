<script setup lang="ts">
/** Stitch: "Registration — AskMyDocs". */
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import AppTextField from '@/components/AppTextField.vue'
  import PasswordField from '@/components/PasswordField.vue'
  import PasswordRules from '@/components/PasswordRules.vue'
  import { useApiForm } from '@/composables/useApiForm'
  import { HOME_ROUTE } from '@/router/guards'
  import { useAuthStore } from '@/stores/auth'

  const auth = useAuthStore()
  const router = useRouter()
  const { submitting, fieldErrors, formError, submit, clearFieldError } = useApiForm()

  const name = ref('')
  const email = ref('')
  const password = ref('')
  const passwordConfirmation = ref('')

  async function register () {
    const ok = await submit(async () => {
      await auth.register({
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      })
      return true
    })
    if (ok) {
      await router.replace({ name: HOME_ROUTE })
    }
  }
</script>

<template>
  <div class="d-flex flex-column">
    <div class="d-flex flex-column align-center text-center mb-4">

      <h1 class="text-headline-xl-mobile text-on-surface mb-1">Create your account</h1>
    </div>

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

    <div class="bg-surface-container-lowest rounded-lg pa-4 elevation-2 mb-4">
      <form class="d-flex flex-column ga-3" novalidate @submit.prevent="register">
        <AppTextField
          id="name"
          v-model="name"
          autocomplete="name"
          :error-messages="fieldErrors.name"
          label="Full name"
          placeholder="Ana Silva"
          prepend-inner-icon="person"
          @update:model-value="clearFieldError('name')"
        />

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

        <div class="d-flex flex-column ga-1">
          <PasswordField
            id="password"
            v-model="password"
            autocomplete="new-password"
            :error-messages="fieldErrors.password"
            label="Password"
            placeholder="Create a secure password"
            @update:model-value="clearFieldError('password')"
          />

          <PasswordRules :password="password" />
        </div>

        <PasswordField
          id="password-confirmation"
          v-model="passwordConfirmation"
          autocomplete="new-password"
          label="Confirm password"
          placeholder="Re-enter your password"
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
          Create account
        </v-btn>
      </form>
    </div>

    <p class="text-center text-body-md text-on-surface-variant">
      Already have an account?
      <router-link class="text-primary font-weight-bold link" :to="{ name: 'login' }">Log in</router-link>
    </p>
  </div>
</template>

<style scoped>
.intro {
  max-width: 340px;
}

.link {
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
</style>
