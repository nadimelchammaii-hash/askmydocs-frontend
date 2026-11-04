<script setup lang="ts">
/**
 * Stitch: "Account Settings — AskMyDocs (Desktop)", reduced to what the API supports:
 * profile (name, email), password and signing out. Left out: avatar, organisation and
 * role, AI/OCR preferences, retention, 2FA, sessions, export and account deletion.
 */
  import { computed, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { authApi } from '@/api/auth'
  import AppTextField from '@/components/AppTextField.vue'
  import PasswordField from '@/components/PasswordField.vue'
  import PasswordRules from '@/components/PasswordRules.vue'
  import { useApiForm } from '@/composables/useApiForm'
  import { LOGIN_ROUTE } from '@/router/guards'
  import { useAuthStore } from '@/stores/auth'

  const auth = useAuthStore()
  const router = useRouter()
  const { mdAndUp } = useDisplay()

  // --- Profile -------------------------------------------------------------------
  const profile = useApiForm()
  const name = ref('')
  const email = ref('')
  const profileSaved = ref(false)

  watch(() => auth.user, user => {
    name.value = user?.name ?? ''
    email.value = user?.email ?? ''
  }, { immediate: true })

  const profileChanges = computed(() => {
    const changes: { name?: string, email?: string } = {}
    if (name.value.trim() !== auth.user?.name) {
      changes.name = name.value.trim()
    }
    if (email.value.trim().toLowerCase() !== auth.user?.email) {
      changes.email = email.value.trim()
    }
    return changes
  })
  const profileChanged = computed(() => Object.keys(profileChanges.value).length > 0)

  async function saveProfile () {
    profileSaved.value = false
    const done = await profile.submit(async () => {
      await auth.updateProfile(profileChanges.value)
      return true
    })
    profileSaved.value = done === true
  }

  // --- Password --------------------------------------------------------------------
  const passwordForm = useApiForm()
  const currentPassword = ref('')
  const newPassword = ref('')
  const newPasswordConfirmation = ref('')
  const passwordChanged = ref(false)

  async function changePassword () {
    passwordChanged.value = false
    const done = await passwordForm.submit(async () => {
      await authApi.updatePassword({
        current_password: currentPassword.value,
        password: newPassword.value,
        password_confirmation: newPasswordConfirmation.value,
      })
      return true
    })
    if (done) {
      currentPassword.value = ''
      newPassword.value = ''
      newPasswordConfirmation.value = ''
      passwordChanged.value = true
    }
  }

  // --- Sign out --------------------------------------------------------------------
  const signingOut = ref(false)

  async function signOut () {
    signingOut.value = true
    try {
      await auth.logout()
    } finally {
      signingOut.value = false
      await router.push({ name: LOGIN_ROUTE })
    }
  }
</script>

<template>
  <div class="settings d-flex flex-column ga-6">
    <div class="d-flex flex-column ga-1">
      <h1 class="text-on-surface" :class="mdAndUp ? 'text-headline-xl' : 'text-headline-xl-mobile'">Account settings</h1>
      <p class="text-body-md text-on-surface-variant">Manage your profile, password and session.</p>
    </div>

    <!-- Profile -->
    <section aria-labelledby="profile-title" class="card bg-surface-container-lowest rounded-lg shadow-sm d-flex flex-column ga-5">
      <div class="d-flex flex-column">
        <span class="eyebrow text-citation-pill text-primary">Identity</span>
        <h2 id="profile-title" class="text-headline-lg text-on-surface">Profile</h2>
      </div>

      <v-alert
        v-if="profile.formError.value"
        color="error"
        density="compact"
        icon="error"
        role="alert"
        rounded="lg"
        :text="profile.formError.value"
        variant="tonal"
      />

      <form class="d-flex flex-column ga-4" novalidate @submit.prevent="saveProfile">
        <div class="fields">
          <AppTextField
            id="profile-name"
            v-model="name"
            autocomplete="name"
            :error-messages="profile.fieldErrors.value.name"
            label="Full name"
            prepend-inner-icon="person"
            @update:model-value="profile.clearFieldError('name'); profileSaved = false"
          />

          <AppTextField
            id="profile-email"
            v-model="email"
            autocomplete="email"
            :error-messages="profile.fieldErrors.value.email"
            label="Email"
            prepend-inner-icon="mail"
            type="email"
            @update:model-value="profile.clearFieldError('email'); profileSaved = false"
          />
        </div>

        <div class="d-flex align-center justify-space-between flex-wrap ga-3">
          <span v-if="profileSaved" class="text-body-sm text-secondary d-flex align-center ga-1" role="status">
            <v-icon icon="check_circle" size="16" /> Profile saved.
          </span>

          <span v-else class="text-body-sm text-on-surface-variant">You sign in with this email address.</span>

          <v-btn
            color="primary-container"
            :disabled="!profileChanged"
            :loading="profile.submitting.value"
            prepend-icon="check"
            type="submit"
          >
            Save profile
          </v-btn>
        </div>
      </form>
    </section>

    <!-- Password -->
    <section aria-labelledby="password-title" class="card bg-surface-container-lowest rounded-lg shadow-sm d-flex flex-column ga-5">
      <div class="d-flex flex-column">
        <span class="eyebrow text-citation-pill text-primary">Security</span>
        <h2 id="password-title" class="text-headline-lg text-on-surface">Password</h2>
        <p class="text-body-sm text-on-surface-variant mt-1">After a change, your other devices are signed out.</p>
      </div>

      <v-alert
        v-if="passwordForm.formError.value"
        color="error"
        density="compact"
        icon="error"
        role="alert"
        rounded="lg"
        :text="passwordForm.formError.value"
        variant="tonal"
      />

      <form class="d-flex flex-column ga-4" novalidate @submit.prevent="changePassword">
        <!-- Lets password managers link the change to the account. -->
        <input
          autocomplete="username"
          class="d-none"
          readonly
          tabindex="-1"
          type="text"
          :value="auth.user?.email"
        >

        <PasswordField
          id="current-password"
          v-model="currentPassword"
          autocomplete="current-password"
          :error-messages="passwordForm.fieldErrors.value.current_password"
          label="Current password"
          @update:model-value="passwordForm.clearFieldError('current_password'); passwordChanged = false"
        />

        <div class="fields">
          <div class="d-flex flex-column ga-1">
            <PasswordField
              id="new-password"
              v-model="newPassword"
              autocomplete="new-password"
              :error-messages="passwordForm.fieldErrors.value.password"
              label="New password"
              @update:model-value="passwordForm.clearFieldError('password'); passwordChanged = false"
            />

            <PasswordRules :password="newPassword" />
          </div>

          <PasswordField
            id="new-password-confirmation"
            v-model="newPasswordConfirmation"
            autocomplete="new-password"
            label="Confirm new password"
            prepend-inner-icon="verified_user"
          />
        </div>

        <div class="d-flex align-center justify-space-between flex-wrap ga-3">
          <span v-if="passwordChanged" class="text-body-sm text-secondary d-flex align-center ga-1" role="status">
            <v-icon icon="check_circle" size="16" /> Password changed. Your other devices have been signed out.
          </span>

          <span v-else />

          <v-btn
            color="primary-container"
            :disabled="currentPassword === '' || newPassword === ''"
            :loading="passwordForm.submitting.value"
            prepend-icon="lock_reset"
            type="submit"
          >
            Change password
          </v-btn>
        </div>
      </form>
    </section>

    <!-- Session -->
    <section aria-labelledby="session-title" class="card bg-surface-container-lowest rounded-lg shadow-sm d-flex flex-column flex-sm-row align-sm-center justify-space-between ga-4">
      <div class="d-flex flex-column">
        <span class="eyebrow text-citation-pill text-primary">Session</span>
        <h2 id="session-title" class="text-headline-lg text-on-surface">Sign out</h2>

        <p class="text-body-sm text-on-surface-variant mt-1">
          Signed in as <strong class="text-on-surface">{{ auth.user?.email }}</strong>.
        </p>
      </div>

      <v-btn :loading="signingOut" prepend-icon="logout" variant="tonal" @click="signOut">Sign out</v-btn>
    </section>
  </div>
</template>

<style scoped>
.settings {
  max-width: 880px;
  margin-inline: auto;
  width: 100%;
}

.card {
  padding: 24px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 960px) {
  .fields {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}
</style>
