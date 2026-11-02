import './assets/index.css'

/**
 * 为什么要动态 import：
 * supabase.ts 在模块求值阶段校验 VITE_SUPABASE_*，缺变量就 throw。
 * 静态 import 的报错发生在 import 图求值期，main.ts 的函数体根本不会执行，
 * 用户看到的是一片白屏。改成动态 import，就能把错误接住并渲染成可读的说明页。
 */
async function bootstrap(): Promise<void> {
  try {
    await import('./bootstrap')
  } catch (error) {
    renderSetupError(error)
  }
}

function renderSetupError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const root = document.querySelector('#app')
  if (!root) return

  const isConfigIssue = message.includes('VITE_SUPABASE_')

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;">
      <div style="max-width:560px;width:100%;border:1px solid #e5e0d8;border-radius:12px;padding:24px;background:#fdfcfa;color:#3c342c;">
        <h1 style="margin:0 0 8px;font-size:16px;font-weight:600;">启动失败</h1>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b6156;">
          ${isConfigIssue ? 'Supabase 配置不完整，应用无法初始化。' : '应用初始化时抛出异常。'}
        </p>
        <pre style="margin:0 0 16px;padding:12px;border-radius:8px;background:#f4f1ec;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</pre>
        ${
          isConfigIssue
            ? `<ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.9;color:#6b6156;">
                 <li>把仓库根目录的 <code>.env.example</code> 复制成 <code>.env.local</code></li>
                 <li>填入 <code>Project URL</code> 与 <code>anon public key</code>（Supabase → Settings → API）</li>
                 <li>重启 <code>npm run dev</code>（Vite 只在启动时读取环境变量）</li>
               </ol>`
            : ''
        }
      </div>
    </div>
  `
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

void bootstrap()
