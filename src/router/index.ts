/**
 * router/index.ts
 *
 * Routes are added with the screens from the approved Google Stitch design (Phase 6).
 * Use `meta: { requiresAuth: true }` or `meta: { guestOnly: true }` to protect them.
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [],
})

router.beforeEach(to => authGuard(to, useAuthStore()))

export default router
