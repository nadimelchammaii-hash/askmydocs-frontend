/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Types
import type { App } from 'vue'

// Plugins
import { createPinia } from 'pinia'
import { onUnauthenticated } from '@/api/http'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import vuetify from './vuetify'

export function registerPlugins (app: App) {
  app.use(vuetify)
  // Pinia before the router: navigation guards use the auth store.
  app.use(createPinia())
  app.use(router)

  // Session expired or logged out elsewhere: forget the user. (Redirect to login is added with the routes in Phase 6.)
  onUnauthenticated(() => useAuthStore().clear())
}
