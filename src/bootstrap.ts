import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/index.css'

const app = createApp(App)

// pinia 必须先装：路由守卫里会用到 store
app.use(createPinia())
app.use(router)
app.mount('#app')
