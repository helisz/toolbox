import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

/**
 * README 是外部不可信内容，要渲染进 DOM，所以做两层防护：
 * 1. markdown-it 关掉内联 HTML 解析（html: false）；
 * 2. DOMPurify 再洗一遍。单靠任一层都不够稳妥。
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
})

const ABSOLUTE_LINK = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * 把 README 里的相对链接改写成仓库网页地址：
 * 弹窗里是独立文档，相对路径在站内必然 404。
 */
function rewriteRelativeLinks(html: string, repoWebUrl: string): string {
  return html.replace(/href="([^"]*)"/g, (match, href: string) => {
    if (!href || href.startsWith('#')) return match
    if (ABSOLUTE_LINK.test(href)) return match
    const cleaned = href.replace(/^\.?\//, '')
    return `href="${repoWebUrl}/blob/HEAD/${cleaned}"`
  })
}

/**
 * 渲染 README 为安全 HTML。
 * 图片一律丢弃 —— 相对图片路径在弹窗里必然 404，宁可不显示也不破图。
 */
export function renderReadme(raw: string, repoWebUrl?: string): string {
  let html = md.render(raw)
  if (repoWebUrl) html = rewriteRelativeLinks(html, repoWebUrl)

  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'picture', 'source', 'style', 'iframe', 'form', 'input', 'button', 'script'],
    FORBID_ATTR: ['style', 'srcset', 'onerror', 'onload', 'onclick'],
  })

  // 外链新开窗口，并切断 window.opener
  return sanitized.replace(
    /<a\s+href="/g,
    '<a target="_blank" rel="noopener noreferrer nofollow" href="',
  )
}

/** 把 git 地址归一化成仓库网页地址，作为 README 相对链接的基准 */
export function resolveRepoWebUrl(gitUrl: string): string | undefined {
  const trimmed = gitUrl.trim()
  if (!trimmed) return undefined
  return trimmed
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
}
