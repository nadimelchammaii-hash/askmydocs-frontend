/**
 * router/index.ts
 *
 * Screens from the Google Stitch design. Pages are loaded on demand, so each one
 * is its own small chunk. `meta.requiresAuth` / `meta.guestOnly` are enforced by
 * the guard in ./guards.ts.
 */

import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authGuard, HOME_ROUTE, LOGIN_ROUTE } from './guards'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: HOME_ROUTE, component: () => import('@/views/DashboardView.vue'), meta: { title: 'Dashboard' } },
      { path: 'documents', name: 'documents', component: () => import('@/views/DocumentLibraryView.vue'), meta: { title: 'Document Library' } },
      { path: 'documents/:documentId/chat', name: 'document-chat', component: () => import('@/views/ChatView.vue'), meta: { title: 'Document Chat' } },
      { path: 'conversations', name: 'conversations', component: () => import('@/views/ConversationsView.vue'), meta: { title: 'Conversations' } },
      { path: 'conversations/:conversationId', name: 'conversation', component: () => import('@/views/ChatView.vue'), meta: { title: 'Document Chat' } },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: 'Settings' } },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { guestOnly: true },
    children: [
      { path: 'login', name: LOGIN_ROUTE, component: () => import('@/views/auth/LoginView.vue'), meta: { title: 'Sign in' } },
      { path: 'register', name: 'register', component: () => import('@/views/auth/RegisterView.vue'), meta: { title: 'Create account' } },
      { path: 'forgot-password', name: 'forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { title: 'Forgot password' } },
      // Linked from the reset email: /reset-password?token=...&email=...
      { path: 'reset-password', name: 'reset-password', component: () => import('@/views/auth/ResetPasswordView.vue'), meta: { title: 'Reset password' } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { title: 'Page not found' } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(to => authGuard(to, useAuthStore()))

router.afterEach(to => {
  document.title = to.meta.title ? `${to.meta.title} · AskMyDocs` : 'AskMyDocs'
})

export default router
