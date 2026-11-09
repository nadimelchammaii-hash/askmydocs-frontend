import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import { accessibleText } from '@/__tests__/mountPage'
import { authApi } from '@/api/auth'
import vuetify from '@/plugins/vuetify'
import { routes } from '@/router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '../AppLayout.vue'

vi.mock('@/api/auth', () => ({ authApi: { logout: vi.fn() } }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

async function mountLayout (path = '/', demo = false) {
  const auth = useAuthStore()
  auth.user = demo
    ? { id: 2, name: 'Demo visitor', email: 'demo-1@demo.askmydocs.invalid', created_at: '', is_demo: true, demo_expires_at: '2026-11-07T10:00:00+00:00' }
    : { id: 1, name: 'Ana Silva', email: 'ana@example.com', created_at: '', is_demo: false, demo_expires_at: null }
  auth.loaded = true

  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)

  const wrapper = mount(defineComponent({ render: () => h(VApp, () => h(AppLayout)) }), {
    global: { plugins: [vuetify, router] },
  })
  await flushPromises()
  return { wrapper, router, auth }
}

describe('AppLayout', () => {
  it('shows the main navigation and the logged-in user', async () => {
    const { wrapper } = await mountLayout()
    const nav = wrapper.get('nav[aria-label="Main"]')

    expect(nav.findAll('a').map(link => accessibleText(link.element))).toEqual(['Dashboard', 'Document Library', 'Conversations', 'Settings'])
    expect(wrapper.text()).toContain('Ana Silva')
    expect(wrapper.text()).toContain('ana@example.com')
  })

  it('marks the current page in the navigation', async () => {
    const { wrapper } = await mountLayout('/conversations/conv1')
    const current = wrapper.get('nav[aria-label="Main"] a[aria-current="page"]')

    expect(accessibleText(current.element)).toBe('Conversations')
  })

  it('searches documents from the top bar', async () => {
    const { wrapper, router } = await mountLayout()

    await wrapper.get('input[aria-label="Search documents"]').setValue('  annual report ')
    await wrapper.get('form[role="search"]').trigger('submit')

    // Pages are lazy-loaded, so navigation takes a few ticks.
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('documents'))
    expect(router.currentRoute.value.query).toEqual({ search: 'annual report' })
  })

  it('logs out and goes to the login page', async () => {
    vi.mocked(authApi.logout).mockResolvedValue()
    const { wrapper, router, auth } = await mountLayout()

    await wrapper.get('button[aria-label="Account menu"]').trigger('click')
    await flushPromises()
    const items = document.body.querySelectorAll<HTMLElement>('.v-list-item')
    const item = [...items].find(element => element.textContent?.includes('Log out'))
    expect(item).toBeDefined()
    item!.click()

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(authApi.logout).toHaveBeenCalledOnce()
    expect(auth.user).toBeNull()
  })
})

describe('Demo banner', () => {
  it('is shown to demo accounts with the end of the demo', async () => {
    const { wrapper } = await mountLayout('/', true)

    expect(wrapper.text()).toContain('You are exploring the demo')
    expect(wrapper.text()).toContain('deleted after 24 hours (on')
    expect(wrapper.text()).toContain('Create your own account')
  })

  it('is not shown to real accounts', async () => {
    const { wrapper } = await mountLayout('/')

    expect(wrapper.text()).not.toContain('You are exploring the demo')
  })

  it('is not shown on the full-height chat page', async () => {
    const { wrapper } = await mountLayout('/conversations/conv1', true)

    expect(wrapper.text()).not.toContain('You are exploring the demo')
  })

  it('ends the demo and opens registration', async () => {
    vi.mocked(authApi.logout).mockResolvedValue()
    const { wrapper, router, auth } = await mountLayout('/', true)

    await wrapper.findAll('button').find(button => accessibleText(button.element) === 'Create your own account')!.trigger('click')
    await flushPromises()

    expect(authApi.logout).toHaveBeenCalledOnce()
    expect(auth.user).toBeNull()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('register'))
  })
})
