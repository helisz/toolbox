import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages 的项目站点部署在 /<repo>/ 子路径下，用 VITE_BASE_PATH 覆盖；
  // 本地开发与自定义域名都是 '/'。router 里的 createWebHistory 会自动跟随它。
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    watch: {
      // .tmp 里放的是临时脚本和（无头）Chrome 的 profile 目录，几千个 html 文件。
      // 不排除的话 watcher 会把它们全爬一遍：dev server 起得来但会卡死、狂发 page reload。
      ignored: ['**/.tmp/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        // supabase-js 体积大且首屏用不到，单独拆包避免阻塞
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
