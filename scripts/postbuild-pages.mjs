/**
 * GitHub Pages 的产物补齐（在 vite build 之后跑）：
 *
 * 1. `404.html` —— Pages 不支持 rewrite / _redirects，深链接（如 /toolbox/admin 直接刷新）
 *    会 404。GitHub Pages 对未知路径回落到 404.html，把 index.html 复制一份过去，
 *    SPA 就能正常接管路由。状态码仍是 404，但页面能用。
 * 2. `.nojekyll` —— 否则 Pages 会走 Jekyll 处理，`assets/` 这类下划线以外没问题，
 *    但禁止 Jekyll 能避免它对文件做多余处理，也更快。
 */
import { copyFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const index = join(dist, 'index.html')

if (!existsSync(index)) {
  console.error('✗ dist/index.html 不存在，先跑 vite build')
  process.exit(1)
}

copyFileSync(index, join(dist, '404.html'))
writeFileSync(join(dist, '.nojekyll'), '')

console.log('✓ 已生成 dist/404.html（SPA 深链接回退）与 dist/.nojekyll')
