/**
 * 连通性自检：确认 .env.local 里的 Supabase 项目可用、schema 已生效、RLS 正确。
 *
 * 运行：npm run check:db
 *
 * 只做「匿名身份」能做的检查（用的就是前端那个 anon key）：
 *   - 三张业务表存在且匿名可读
 *   - 匿名写被 RLS 拒绝（这一步失败 = 你的库没有启用 RLS，属于严重问题）
 *   - admins 表匿名读不到（白名单不该外泄）
 * 写入是否真的可用，需要管理员账号登录后验证，不在本脚本范围内。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const text = readFileSync(join(root, '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('✗ .env.local 里缺 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}` }

let failed = 0
function report(name, ok, detail) {
  if (ok) {
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function get(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers })
  const text = await response.text()
  return { status: response.status, text }
}

console.log(`\n项目：${url}\n`)

// auth 服务
const health = await fetch(`${url}/auth/v1/health`, { headers })
report('Auth 服务可达', health.ok, `status ${health.status}`)

// 三张业务表：匿名可读
for (const table of ['app_group', 'app_item', 'tag_pool']) {
  const { status, text } = await get(`${table}?select=*`)
  if (status === 200) {
    let rows = []
    try {
      rows = JSON.parse(text)
    } catch {
      /* ignore */
    }
    report(`${table} 匿名可读`, true, `${rows.length} 行`)
  } else if (text.includes('PGRST205')) {
    report(`${table} 匿名可读`, false, '表不存在 → schema.sql 还没跑')
  } else {
    report(`${table} 匿名可读`, false, `status ${status}: ${text.slice(0, 120)}`)
  }
}

// 新增列是否已经补上（老库重跑 schema.sql 才会加）
const columns = await get('app_item?select=id,intro,enabled,url&limit=1')
if (columns.status === 200) {
  report('app_item 含 intro / enabled / url 列', true)
} else if (/column .* does not exist|42703/i.test(columns.text)) {
  report('app_item 含 intro / enabled / url 列', false, '缺列 → 重跑一遍 schema.sql 即可补齐')
} else {
  report(
    'app_item 含 intro / enabled / url 列',
    false,
    `status ${columns.status}: ${columns.text.slice(0, 120)}`,
  )
}

// 匿名写必须被拒
const writeProbe = await fetch(`${url}/rest/v1/app_group`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({ name: 'rls-probe', sort: 1 }),
})
const writeBody = await writeProbe.text()
const writeBlocked =
  writeProbe.status === 401 ||
  writeProbe.status === 403 ||
  /row-level security|permission denied/i.test(writeBody)
report('匿名写入被 RLS 拒绝', writeBlocked, `status ${writeProbe.status}`)

// admins 不该对外可见
const admins = await get('admins?select=uid')
const adminsHidden =
  admins.status === 401 ||
  admins.status === 403 ||
  admins.text.trim() === '[]' ||
  /permission denied|row-level security/i.test(admins.text)
report('admins 匿名不可读', adminsHidden, `status ${admins.status}`)

console.log('')
if (failed > 0) {
  console.error(`✗ ${failed} 项未通过，先按 README 的「建 Supabase 项目」跑完 schema.sql 再试\n`)
  process.exit(1)
}
console.log('✓ 全部通过：项目可达、schema 已生效、RLS 正确\n')
