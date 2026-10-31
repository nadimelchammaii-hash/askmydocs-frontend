import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import { authApi } from '@/api/auth'
import vuetify from '@/plugins/vuetify'
import { routes } from '@/router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '../AppLayout.vue'

vi.mock('@/api/auth', () => ({ authApi: { logout: vi.fn() } }))

beforeAll(() => {
  // Vuetify's layout measures elements; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe () {}
    unobserve () {}
    disconnect () {}
  }
  // Vuetify menus position themselves with visualViewport; jsdom has none.
  globalThis.visualViewport ??= Object.assign(new EventTarget(), { width: 1280, height: 800, offsetLeft: 0, offsetTop: 0, scale: 1 }) as unknown as VisualViewport
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

/** Text a screen reader announces: icon ligatures are aria-hidden. */
function accessibleText (element: Element): string {
  const copy = element.cloneNode(true) as Element
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove()
  }
  return copy.textContent?.trim() ?? ''
}

async function mountLayout (path = '/') {
  const auth = useAuthStore()
  auth.user = { id: 1, name: 'Ana Silva', email: 'ana@example.com', created_at: '' }
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
