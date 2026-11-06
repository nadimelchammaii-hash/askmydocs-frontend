<script setup lang="ts">
/** Stitch: "Login — AskMyDocs". */
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { toApiError } from '@/api/errors'
  import AppTextField from '@/components/AppTextField.vue'
  import PasswordField from '@/components/PasswordField.vue'
  import { useApiForm } from '@/composables/useApiForm'
  import { HOME_ROUTE, safeRedirect } from '@/router/guards'
  import { useAuthStore } from '@/stores/auth'

  const auth = useAuthStore()
  const route = useRoute()
  const router = useRouter()
  const { submitting, fieldErrors, formError, submit, clearFieldError } = useApiForm()

  // --- Try the demo ------------------------------------------------------------------

  const startingDemo = ref(false)
  const demoError = ref<string | null>(null)

  async function tryDemo () {
    if (startingDemo.value) {
      return
    }
    startingDemo.value = true
    demoError.value = null
    try {
      await auth.startDemo()
      await router.replace({ name: HOME_ROUTE })
    } catch (error) {
      const apiError = toApiError(error)
      demoError.value = apiError.code === 'too_many_requests'
        ? 'Several demos were started from your network recently. Please try again in an hour.'
        : apiError.message
    } finally {
      startingDemo.value = false
    }
  }

  const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
  const password = ref('')
  const remember = ref(false)

  /** Set by the reset-password page after a successful reset. */
  const passwordWasReset = computed(() => route.query.reset === '1')

  async function signIn () {
    const ok = await submit(async () => {
      await auth.login({ email: email.value.trim(), password: password.value, remember: remember.value })
      return true
    })
    if (ok) {
      await router.replace(safeRedirect(route.query.redirect))
    }
  }
</script>

<template>
  <div class="d-flex flex-column">
    <div class="d-flex flex-column ga-1 mb-4">

      <h1 class="text-headline-xl-mobile text-on-surface">Welcome back</h1>
      <p class="text-body-md text-on-surface-variant">Sign in to ask questions about your PDFs and get answers with page citations.</p>
    </div>

    <v-alert
      v-if="passwordWasReset"
      class="mb-4"
      color="secondary"
      density="compact"
      icon="check_circle"
      rounded="lg"
      text="Your password has been reset. Sign in with your new password."
      variant="tonal"
    />

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

    <form class="d-flex flex-column ga-3" novalidate @submit.prevent="signIn">
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

      <PasswordField
        id="password"
        v-model="password"
        autocomplete="current-password"
        :error-messages="fieldErrors.password"
        label="Password"
        @update:model-value="clearFieldError('password')"
      />

      <div class="d-flex align-center justify-space-between">
        <v-checkbox
          v-model="remember"
          color="primary"
          density="compact"
          hide-details
          label="Remember this device"
        />

        <router-link class="text-label-md text-primary link" :to="{ name: 'forgot-password', query: email ? { email } : {} }">
          Forgot password?
        </router-link>
      </div>

      <v-btn
        append-icon="arrow_forward"
        block
        class="text-headline-md shadow-sm"
        color="primary-container"
        :loading="submitting"
        size="x-large"
        type="submit"
      >
        Sign in
      </v-btn>
    </form>

    <div class="d-flex align-center ga-3 my-6" role="presentation">
      <v-divider />
      <span class="text-label-md text-on-surface-variant">or</span>
      <v-divider />
    </div>

    <v-alert
      v-if="demoError"
      class="mb-4"
      color="error"
      density="compact"
      icon="error"
      role="alert"
      rounded="lg"
      :text="demoError"
      variant="tonal"
    />

    <v-btn
      block
      class="demo-button"
      color="primary"
      :loading="startingDemo"
      prepend-icon="play_circle"
      size="x-large"
      variant="outlined"
      @click="tryDemo"
    >
      Try the demo
    </v-btn>

    <p class="mt-2 text-center text-body-sm text-on-surface-variant">
      No sign-up needed: a private demo with sample PDFs, deleted after 24 hours.
    </p>

    <p class="mt-6 text-center text-body-md text-on-surface-variant">
      Don't have an account?
      <router-link class="text-primary font-weight-bold link" :to="{ name: 'register' }">Create account</router-link>
    </p>
  </div>
</template>

<style scoped>
.eyebrow {
  width: fit-content;
  padding-block: 2px;
}

.tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 4px;
}

.link {
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
</style>
