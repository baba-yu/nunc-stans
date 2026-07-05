import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'nunc-ui' // design tokens land globally (side effect)
import App from './App.vue'
import { router } from './router'
import './style.css'

createApp(App).use(createPinia()).use(router).mount('#app')
