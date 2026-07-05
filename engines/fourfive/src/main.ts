import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'nunc-ui' // design tokens (the shared visual language)
import App from './App.vue'
import './style.css'

createApp(App).use(createPinia()).mount('#app')
