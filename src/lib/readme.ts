/**
 * README 抓取与摘录提取。
 *
 * 通道：浏览器直连 raw 域名（无代理、无 Cloud Functions）。
 * - GitHub 的 raw.githubusercontent.com 允许跨域，公开仓库可用；
 * - 私有库、GitLab/Gitee/自建 Git 基本拿不到（限流也会失败）。
 * 全部失败返回 null，调用方把 readme_raw 留空并提示 —— 明确不做任何 LLM 摘要。
 */

export type GitPlatform = 'github' | 'gitlab' | 'gitee' | 'unknown'

export interface ParsedRepo {
  platform: GitPlatform
  host: string
  /** GitHub 的 owner，或 GitLab 的 group/subgroup 链 */
  owner: string
  repo: string
  /** https://host/owner/repo，用作 README 相对链接基准 */
  webUrl: string
  /** 显式分支/tag；没写就用 HEAD */
  ref?: string
}

export interface ReadmeResult {
  raw: string
  intro: string
  /** 实际命中的文件地址，便于排查 */
  sourceUrl: string
}

/** 单次请求超时：README 抓不到不该把整个表单卡住 */
const FETCH_TIMEOUT_MS = 10_000

/** 文档上限留 1MB 的余量；README 超过这个长度基本是脏数据 */
export const MAX_README_CHARS = 200_000

/** 摘录长度，需求原文「不超过 300 字」 */
export const MAX_INTRO_CHARS = 300

const README_FILES = ['README.md', 'readme.md', 'README.MD', 'README.markdown', 'docs/README.md']

/**
 * 解析常见的 git 地址形式：
 * - https://github.com/owner/repo(.git)
 * - https://github.com/owner/repo/tree/branch
 * - git@github.com:owner/repo.git
 * - https://gitlab.com/group/sub/repo
 */
export function parseGitUrl(input: string): ParsedRepo | null {
  let raw = input.trim()
  if (!raw) return null

  if (/^git@[^:]+:/.test(raw)) raw = raw.replace(/^git@([^:]+):/, 'https://$1/')
  if (/^ssh:\/\//i.test(raw)) raw = raw.replace(/^ssh:\/\//i, 'https://')

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!/^https?:$/i.test(url.protocol)) return null

  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null

  const platform: GitPlatform = host.endsWith('github.com')
    ? 'github'
    : host.endsWith('gitlab.com')
      ? 'gitlab'
      : host.endsWith('gitee.com')
        ? 'gitee'
        : 'unknown'

  // GitLab 支持多级 group，取最后一段为仓库名
  const repoIndex = platform === 'github' ? 1 : segments.length - 1
  const repo = segments[repoIndex]?.replace(/\.git$/i, '') ?? ''
  if (!repo) return null

  const owner = segments.slice(0, repoIndex).join('/')
  if (!owner) return null

  const webUrl = `https://${host}/${owner}/${repo}`

  // /tree/branch 或 /-/tree/branch
  const tail = segments.slice(repoIndex + 1)
  const treeAt = tail.findIndex((seg) => seg === 'tree')
  const ref = treeAt >= 0 ? tail[treeAt + 1] : undefined

  return ref ? { platform, host, owner, repo, webUrl, ref } : { platform, host, owner, repo, webUrl }
}

/** 按平台拼 raw 候选地址，按「最可能命中」的顺序排列 */
export function buildRawCandidates(repo: ParsedRepo): string[] {
  const ref = repo.ref ?? 'HEAD'
  const urls: string[] = []

  for (const file of README_FILES) {
    if (repo.platform === 'github') {
      urls.push(`https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${ref}/${file}`)
    } else if (repo.platform === 'gitlab') {
      urls.push(`https://gitlab.com/${repo.owner}/${repo.repo}/-/raw/${ref}/${file}`)
    } else if (repo.platform === 'gitee') {
      urls.push(`https://gitee.com/${repo.owner}/${repo.repo}/raw/${ref}/${file}`)
    } else {
      urls.push(`${repo.webUrl}/raw/${ref}/${file}`)
      urls.push(`${repo.webUrl}/-/raw/${ref}/${file}`)
    }
  }

  return urls
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // 只带 Accept：这是 CORS 安全列表内的头，不会触发预检
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/plain, */*' },
      redirect: 'follow',
    })
    if (!response.ok) return null
    const text = await response.text()
    return text.trim() ? text : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 依次尝试候选地址，返回第一个非空内容 */
export async function fetchReadme(
  gitUrl: string,
  options: { timeoutMs?: number } = {},
): Promise<ReadmeResult | null> {
  const repo = parseGitUrl(gitUrl)
  if (!repo) return null

  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS
  for (const url of buildRawCandidates(repo)) {
    const text = await fetchText(url, timeoutMs)
    if (text) {
      const raw = text.slice(0, MAX_README_CHARS)
      return { raw, intro: extractIntro(raw, MAX_INTRO_CHARS), sourceUrl: url }
    }
  }
  return null
}

const HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*$/gm

/**
 * 需求 L27 的描述有歧义（「最开头大标题之下，直到第一个一级标题之间」），这里固定成可测的算法：
 * 1. 去掉 front-matter、HTML 注释、badge/图片行；
 * 2. 从第一个 H1 之后开始（没有 H1 则从正文开始）；
 * 3. 截断到「下一个 H1」或「第一个 H2」，先到者为准（避免把目录/章节混进简介）；
 * 4. 剥掉 markdown 语法，压缩空白；
 * 5. 超过 300 字截断加省略号。
 */
export function extractIntro(raw: string, maxChars: number = MAX_INTRO_CHARS): string {
  if (!raw) return ''

  let text = raw.replace(/^\uFEFF/, '')
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  text = text.replace(/<!--[\s\S]*?-->/g, '')

  // 开头常见的是徽章墙和 logo，先按行剔除，否则摘录会变成一堆图片链接
  const lines = text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return true
    if (/^\[!\[/.test(trimmed)) return false
    if (/^!\[/.test(trimmed)) return false
    if (/^<img\b/i.test(trimmed)) return false
    if (/^<p\b[^>]*align=/i.test(trimmed)) return false
    if (/^<\/?(?:div|p|br|picture|source)\s*\/?>/i.test(trimmed)) return false
    return true
  })
  const body = lines.join('\n')

  HEADING_RE.lastIndex = 0
  let introStart = -1
  let introEnd = body.length
  let firstHeadingIndex = -1
  let match: RegExpExecArray | null

  while ((match = HEADING_RE.exec(body)) !== null) {
    const level = match[1]?.length ?? 0
    if (firstHeadingIndex === -1) firstHeadingIndex = match.index

    if (introStart === -1) {
      if (level === 1) introStart = match.index + match[0].length
      continue
    }
    if (level <= 2) {
      introEnd = match.index
      break
    }
  }

  if (introStart === -1) {
    // 没有 H1：取第一个标题之前的正文。
    // 否则整篇（含各章节）都会被当成简介，300 字截断后基本是目录碎片。
    introStart = 0
    if (firstHeadingIndex > 0) introEnd = firstHeadingIndex
  }

  const section = body.slice(introStart, Math.max(introStart, introEnd))
  const plain = stripMarkdown(section).replace(/\s+/g, ' ').trim()

  if (plain.length <= maxChars) return plain
  // 按码点截断，避免把 emoji / 罕见汉字切成半个
  return `${[...plain].slice(0, maxChars).join('')}…`
}

function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, ' ')
    .replace(/^\s{0,3}>\s?/gm, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/^\s*[-=]{3,}\s*$/gm, ' ')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\|/g, ' ')
    .trim()
}
