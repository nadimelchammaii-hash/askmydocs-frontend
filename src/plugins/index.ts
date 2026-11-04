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
import { LOGIN_ROUTE } from '@/router/guards'
import { useAuthStore } from '@/stores/auth'
import vuetify from './vuetify'

export function registerPlugins (app: App) {
  app.use(vuetify)
  // Pinia before the router: navigation guards use the auth store.
  app.use(createPinia())
  app.use(router)

  // Session expired or logged out elsewhere: forget the user and, on a protected page, go to login.
  onUnauthenticated(() => {
    useAuthStore().clear()
    const current = router.currentRoute.value
    if (current.meta.requiresAuth) {
      void router.push({ name: LOGIN_ROUTE, query: { redirect: current.fullPath } })
    }
  })
}
