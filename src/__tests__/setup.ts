/**
 * Runs before every test file (vite.config.mts → test.setupFiles).
 * jsdom lacks a few browser APIs that Vuetify components use.
 */

// Vuetify's layout and fields measure elements.
globalThis.ResizeObserver ??= class {
  observe () {}
  unobserve () {}
  disconnect () {}
}

// Vuetify menus position themselves with visualViewport.
globalThis.visualViewport ??= Object.assign(new EventTarget(), {
  width: 1280,
  height: 800,
  offsetLeft: 0,
  offsetTop: 0,
  scale: 1,
}) as unknown as VisualViewport
