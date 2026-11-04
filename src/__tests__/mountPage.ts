import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { VApp } from 'vuetify/components'
import vuetify from '@/plugins/vuetify'
import { routes } from '@/router'

/**
 * Mounts the app's real routes, theme and a fresh Pinia store at `path`, inside
 * v-app (Vuetify layout components need it). The route guard is not installed:
 * page tests check the page, guards are tested in router/__tests__.
 */
export async function mountPage (path: string, setup?: () => void) {
  const pinia = createPinia()
  setActivePinia(pinia)
  setup?.()

  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)

  const root: Component = defineComponent({ render: () => h(VApp, () => h(RouterView)) })
  const wrapper = mount(root, { global: { plugins: [vuetify, router, pinia] }, attachTo: document.body })
  // Pages are lazy-loaded: wait until the routed component is rendered.
  await router.isReady()
  await flushPromises()
  return { wrapper, router }
}

/** Text a screen reader announces: icon ligatures are aria-hidden. */
export function accessibleText (element: Element): string {
  const copy = element.cloneNode(true) as Element
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove()
  }
  return copy.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}
