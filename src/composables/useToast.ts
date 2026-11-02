import { toast } from 'vue-sonner'

/**
 * 统一 toast 出口：错误一定要带上可行动的信息，不要只弹「操作失败」。
 *
 * 成功提示跟随 <Toaster> 的全局 2 秒；错误多留一会儿（4 秒），
 * 因为里面通常带着「哪一步没写进去」这种需要读的字。
 */
const ERROR_DURATION = 4000

export function useToast() {
  return {
    success: (message: string, description?: string) => {
      toast.success(message, description ? { description } : undefined)
    },
    error: (message: string, description?: string) => {
      toast.error(message, { duration: ERROR_DURATION, ...(description ? { description } : {}) })
    },
    info: (message: string, description?: string) => {
      toast.info(message, description ? { description } : undefined)
    },
    /** 传给 promise 的兜底提示 */
    fromError: (err: unknown, fallback = '操作失败') => {
      const description = err instanceof Error ? err.message : String(err ?? '')
      toast.error(fallback, { duration: ERROR_DURATION, ...(description ? { description } : {}) })
    },
  }
}
