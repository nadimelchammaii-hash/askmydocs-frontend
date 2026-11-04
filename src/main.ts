/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App
 */

// Composables
import { createApp } from 'vue'

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Styles (fonts, type scale, spacing tokens from the Stitch design)
import '@/styles/main.css'

const app = createApp(App)

registerPlugins(app)

app.mount('#app')
