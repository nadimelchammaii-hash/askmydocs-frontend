<script setup lang="ts">
/**
 * Shell for logged-in pages (Stitch: "Dashboard — AskMyDocs (Desktop)" sidebar and
 * top bar; "Dashboard" mobile top bar and bottom navigation).
 */
  import type { RouteLocationRaw } from 'vue-router'
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { LOGIN_ROUTE } from '@/router/guards'
  import { useAuthStore } from '@/stores/auth'

  interface NavItem {
    title: string
    /** Shorter label for the mobile bottom bar. */
    short: string
    icon: string
    to: RouteLocationRaw
    /** Route names that highlight this item. */
    matches: string[]
  }

  const navItems: NavItem[] = [
    { title: 'Dashboard', short: 'Dashboard', icon: 'dashboard', to: { name: 'dashboard' }, matches: ['dashboard'] },
    { title: 'Document Library', short: 'Library', icon: 'folder_open', to: { name: 'documents' }, matches: ['documents'] },
    { title: 'Conversations', short: 'Chat', icon: 'forum', to: { name: 'conversations' }, matches: ['conversations', 'conversation', 'document-chat'] },
    { title: 'Settings', short: 'Settings', icon: 'tune', to: { name: 'settings' }, matches: ['settings'] },
  ]

  const uploadRoute: RouteLocationRaw = { name: 'documents', query: { upload: '1' } }

  const auth = useAuthStore()
  const route = useRoute()
  const router = useRouter()
  const { mdAndUp } = useDisplay()

  const search = ref('')
  const loggingOut = ref(false)

  const pageTitle = computed(() => route.meta.title ?? '')
  const username = computed(() => auth.user?.name ?? '')
  const userEmail = computed(() => auth.user?.email ?? '')
  const initial = computed(() => username.value.trim().charAt(0).toUpperCase())

  function isActive (item: NavItem): boolean {
    return item.matches.includes(String(route.name))
  }

  function searchDocuments () {
    const value = search.value.trim()
    void router.push({ name: 'documents', query: value ? { search: value } : {} })
  }

  async function logout () {
    loggingOut.value = true
    try {
      await auth.logout()
    } finally {
      loggingOut.value = false
      await router.push({ name: LOGIN_ROUTE })
    }
  }
</script>

<template>
  <!-- Desktop sidebar -->
  <v-navigation-drawer
    v-if="mdAndUp"
    :border="false"
    class="app-sidebar shadow-soft"
    color="surface-container-lowest"
    permanent
    :width="256"
  >
    <div class="d-flex flex-column h-100 pa-3">
      <router-link class="brand d-flex align-center ga-2 px-1 pb-3" :to="{ name: 'dashboard' }">
        <span class="brand-mark bg-primary"><v-icon icon="description" size="18" /></span>
        <span class="text-headline-md text-on-surface">AskMyDocs</span>
      </router-link>

      <v-btn
        block
        class="mt-1 mb-3"
        color="primary-container"
        prepend-icon="add"
        :to="uploadRoute"
      >
        <span class="text-label-md">Upload PDF</span>
      </v-btn>

      <nav aria-label="Main" class="d-flex flex-column ga-1">
        <router-link
          v-for="item in navItems"
          :key="item.title"
          :aria-current="isActive(item) ? 'page' : undefined"
          class="nav-link d-flex align-center ga-2 px-2 py-2 rounded-lg text-body-md"
          :class="isActive(item) ? 'nav-link--active bg-surface-container-high text-on-surface' : 'text-on-surface-variant'"
          :to="item.to"
        >
          <v-icon :icon="item.icon" size="18" />
          <span>{{ item.title }}</span>
        </router-link>
      </nav>

      <v-spacer />

      <div class="d-flex align-center justify-space-between pt-2">
        <div class="d-flex align-center ga-2 min-w-0">
          <v-avatar class="flex-shrink-0" color="primary" size="32">
            <span class="text-label-md">{{ initial }}</span>
          </v-avatar>

          <div class="d-flex flex-column min-w-0">
            <span class="text-label-md text-on-surface text-truncate">{{ username }}</span>
            <span class="text-citation-pill text-on-surface-variant text-truncate">{{ userEmail }}</span>
          </div>
        </div>

        <v-menu location="top end">
          <template #activator="{ props }">
            <v-btn
              aria-label="Account menu"
              color="on-surface-variant"
              icon="unfold_more"
              size="small"
              v-bind="props"
              variant="text"
            />
          </template>

          <v-list density="compact" rounded="lg">
            <v-list-item prepend-icon="tune" title="Settings" :to="{ name: 'settings' }" />
            <v-list-item :disabled="loggingOut" prepend-icon="logout" title="Log out" @click="logout" />
          </v-list>
        </v-menu>
      </div>
    </div>
  </v-navigation-drawer>

  <!-- Top bar -->
  <v-app-bar class="app-topbar shadow-soft" color="surface-container-lowest" flat :height="64">
    <div class="d-flex align-center w-100 ga-3 px-4">
      <template v-if="mdAndUp">
        <span class="text-label-md text-on-surface">{{ pageTitle }}</span>
        <v-spacer />

        <form class="topbar-search d-none d-lg-block" role="search" @submit.prevent="searchDocuments">
          <v-text-field
            v-model="search"
            aria-label="Search documents"
            density="compact"
            hide-details
            placeholder="Search documents by title…"
            prepend-inner-icon="search"
          />
        </form>

        <v-avatar color="primary" size="32">
          <span class="text-label-md">{{ initial }}</span>
        </v-avatar>
      </template>

      <template v-else>
        <router-link class="brand d-flex align-center ga-2 min-w-0" :to="{ name: 'dashboard' }">
          <span class="brand-mark bg-primary"><v-icon icon="description" size="18" /></span>

          <span class="d-flex flex-column min-w-0">
            <span class="text-headline-md text-on-surface">AskMyDocs</span>
            <span class="text-label-code text-outline text-truncate">{{ pageTitle }}</span>
          </span>
        </router-link>

        <v-spacer />

        <v-btn
          aria-label="Search documents"
          color="on-surface-variant"
          icon="search"
          :to="{ name: 'documents' }"
          variant="text"
        />

        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              aria-label="Account menu"
              icon
              size="small"
              v-bind="props"
              variant="text"
            >
              <v-avatar color="primary" size="32"><span class="text-label-md">{{ initial }}</span></v-avatar>
            </v-btn>
          </template>

          <v-list density="compact" rounded="lg">
            <v-list-item :subtitle="userEmail" :title="username" />
            <v-list-item :disabled="loggingOut" prepend-icon="logout" title="Log out" @click="logout" />
          </v-list>
        </v-menu>
      </template>
    </div>
  </v-app-bar>

  <v-main class="bg-surface">
    <router-view />
  </v-main>

  <!-- Mobile bottom navigation -->
  <v-bottom-navigation
    v-if="!mdAndUp"
    aria-label="Main"
    bg-color="surface-container-lowest"
    class="app-bottom-nav shadow-soft"
    grow
    :height="64"
  >
    <template v-for="(item, index) in navItems" :key="item.title">
      <v-btn
        v-if="index === 2"
        aria-label="Upload PDF"
        class="upload-fab"
        :to="uploadRoute"
      >
        <span class="upload-fab__circle bg-primary-container"><v-icon icon="add" size="26" /></span>
      </v-btn>

      <v-btn
        :aria-current="isActive(item) ? 'page' : undefined"
        :class="isActive(item) ? 'text-primary-container font-weight-bold' : 'text-on-surface-variant'"
        :to="item.to"
      >
        <v-icon :icon="item.icon" size="24" />
        <span class="text-label-md">{{ item.short }}</span>
      </v-btn>
    </template>
  </v-bottom-navigation>
</template>

<style scoped>
.brand {
  text-decoration: none;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
}

.nav-link {
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s;
}

.nav-link:not(.nav-link--active):hover {
  background: rgb(var(--v-theme-surface-container));
  color: rgb(var(--v-theme-on-surface)) !important;
}

.nav-link--active {
  font-weight: 600;
}

.app-topbar {
  backdrop-filter: blur(24px);
}

.topbar-search {
  width: 320px;
}

.upload-fab__circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  margin-top: -20px;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
}

.min-w-0 {
  min-width: 0;
}
</style>
