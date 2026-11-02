import { ref } from 'vue'
import { fetchReadme, parseGitUrl, type ReadmeResult } from '@/lib/readme'

/**
 * 「拉取 README」按钮背后的逻辑。
 * 纯前端抓取：失败就把 readme_raw 留空并提示，绝不做任何摘要/改写（需求明确禁止）。
 */
export function useReadme() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function pull(gitUrl: string): Promise<ReadmeResult | null> {
    error.value = null

    if (!parseGitUrl(gitUrl)) {
      error.value = 'Git 地址格式不正确，无法推导 README 地址'
      return null
    }

    loading.value = true
    try {
      const result = await fetchReadme(gitUrl)
      if (!result) {
        error.value = '没抓到 README：私有仓库、非 GitHub 平台或网络受限都会导致失败，readme 将留空'
      }
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '抓取 README 失败'
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, pull }
}
