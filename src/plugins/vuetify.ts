/**
 * plugins/vuetify.ts
 *
 * Theme from the Google Stitch design "AskMyDocs AI PDF Assistant" (Material 3
 * color roles). Vuetify generates `bg-*` / `text-*` classes and `--v-theme-*`
 * variables for every color below, e.g. `bg-surface-container-low`.
 */

import type { IconSet } from 'vuetify'
import { h } from 'vue'
import { createVuetify } from 'vuetify'
import { aliases } from 'vuetify/iconsets/md'
import 'vuetify/styles'

/** Material Symbols Outlined (self-hosted font). Icons are written by name, e.g. `icon="picture_as_pdf"`. */
const materialSymbols: IconSet = {
  // The font turns the icon name (a ligature) into the glyph; aria-hidden as the icons are decorative.
  component: props => h(props.tag, { 'class': 'material-symbols-outlined', 'aria-hidden': 'true' }, String(props.icon)),
}

export const askMyDocsColors = {
  'background': '#faf8ff',
  'on-background': '#131b2e',
  'surface': '#faf8ff',
  'on-surface': '#131b2e',
  'surface-bright': '#faf8ff',
  'surface-dim': '#d2d9f4',
  'surface-variant': '#dae2fd',
  'on-surface-variant': '#464555',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f2f3ff',
  'surface-container': '#eaedff',
  'surface-container-high': '#e2e7ff',
  'surface-container-highest': '#dae2fd',
  'inverse-surface': '#283044',
  'inverse-on-surface': '#eef0ff',
  'outline': '#777587',
  'outline-variant': '#c7c4d8',

  'primary': '#3525cd',
  'on-primary': '#ffffff',
  'primary-container': '#4f46e5',
  'on-primary-container': '#dad7ff',
  'primary-fixed': '#e2dfff',
  'on-primary-fixed': '#0f0069',
  'inverse-primary': '#c3c0ff',

  'secondary': '#006591',
  'on-secondary': '#ffffff',
  'secondary-container': '#39b8fd',
  'on-secondary-container': '#004666',
  'secondary-fixed': '#c9e6ff',
  'on-secondary-fixed-variant': '#004c6e',

  'tertiary': '#3130c0',
  'on-tertiary': '#ffffff',
  'tertiary-fixed': '#e1e0ff',
  'on-tertiary-fixed-variant': '#2f2ebe',

  'error': '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',

  // Vuetify's semantic colors, mapped onto the palette
  'info': '#006591',
  'success': '#006591',
  'warning': '#93000a',
}

export default createVuetify({
  theme: {
    defaultTheme: 'askmydocs',
    themes: {
      askmydocs: { dark: false, colors: askMyDocsColors },
    },
  },
  icons: {
    defaultSet: 'ms',
    aliases,
    sets: { ms: materialSymbols },
  },
  // Stitch: flat surfaces with soft shadows, 8px corners, no borders.
  defaults: {
    VBtn: { rounded: 'lg', flat: true, class: 'text-none' },
    VCard: { rounded: 'lg', flat: true },
    VTextField: { variant: 'solo-filled', flat: true, rounded: 'lg', bgColor: 'surface-container-low' },
    VTextarea: { variant: 'solo-filled', flat: true, rounded: 'lg', bgColor: 'surface-container-low' },
    VSelect: { variant: 'solo-filled', flat: true, rounded: 'lg', bgColor: 'surface-container-low' },
    VChip: { rounded: 'lg' },
    VDialog: { maxWidth: 520 },
  },
})
