import { supabase } from '@/lib/supabase'

/**
 * 封面图存储：Supabase Storage 的公开桶。
 *
 * 存的是**对象路径**（`2026-11/xxx.webp`），不是完整 URL ——
 * 换项目 / 换自定义域名时数据不用动，渲染时再拼公开地址。
 */
export const COVER_BUCKET = 'app-covers'

/**
 * 统一裁成 2:3 的 600×900 WebP。
 *
 * 卡片最大只有 168×252，600×900 已经是 3.5 倍超采样，够清晰了；
 * 定死尺寸的另一个好处是**存储和带宽可控**：一张封面永远 ≈30~80KB，
 * 不会因为谁传了张 8MB 的原图就让首页多下几 MB。
 */
export const COVER_WIDTH = 600
export const COVER_HEIGHT = 900
const COVER_QUALITY = 0.82

/** 上传前的本地限制：单张 10MB，超过直接拒绝（反正最后都会压成几百 KB） */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** 能被 canvas 解码的位图格式；SVG 这类矢量图不做栅格化，直接让用户导出成位图 */
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

export async function uploadCover(file: File): Promise<string> {
  assertUsable(file)

  const blob = await prepareCover(file)
  const ext = extensionOf(blob)
  // 按月分目录，避免单目录堆几千个对象；文件名用随机 UUID，天然不重名
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, blob, {
    cacheControl: '31536000',
    contentType: blob.type || 'image/webp',
    upsert: false,
  })
  if (error) throw new Error(storageErrorMessage(error.message))
  return path
}

/** 删图是「尽力而为」：图还在、数据已经指向新图时不能因为删失败就报错 */
export async function removeCover(path?: string | null): Promise<void> {
  if (!path) return
  await supabase.storage.from(COVER_BUCKET).remove([path])
}

/** 公开地址：桶是 public，直接拼，不需要签名 */
export function coverUrl(path?: string | null): string {
  if (!path) return ''
  return supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl
}

function assertUsable(file: File): void {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error(
      file.type === 'image/svg+xml'
        ? 'SVG 不能直接当封面，请先导出成 PNG / WebP'
        : '只支持 JPG / PNG / WebP / AVIF / GIF 图片',
    )
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`图片太大（${(file.size / 1024 / 1024).toFixed(1)}MB），请压到 10MB 以内`)
  }
}

/**
 * 裁剪 + 压缩，返回最终的 WebP。
 *
 * 按 `object-cover` 的语义**居中裁切**再缩放：先算「填满 2:3 需要多大一块源图」，
 * 从中心取这块，画到 600×900 的画布上 —— 比例不对的图不会被拉扁，
 * 只是左右（或上下）各切掉一些，和前台卡片看到的完全一致。
 */
export async function prepareCover(file: File): Promise<Blob> {
  assertUsable(file)

  let bitmap: ImageBitmap
  try {
    // createImageBitmap 默认按 EXIF 方向摆正，手机竖拍的图不会躺着进画布
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('这张图解码失败，换一张试试')
  }

  try {
    if (!bitmap.width || !bitmap.height) throw new Error('这张图没有有效尺寸')

    const coverScale = Math.max(COVER_WIDTH / bitmap.width, COVER_HEIGHT / bitmap.height)
    const sourceWidth = COVER_WIDTH / coverScale
    const sourceHeight = COVER_HEIGHT / coverScale
    const sourceX = (bitmap.width - sourceWidth) / 2
    const sourceY = (bitmap.height - sourceHeight) / 2

    const canvas = document.createElement('canvas')
    canvas.width = COVER_WIDTH
    canvas.height = COVER_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前浏览器不支持图片处理')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      COVER_WIDTH,
      COVER_HEIGHT,
    )

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', COVER_QUALITY),
    )
    if (!blob) throw new Error('图片处理失败，换一张试试')
    return blob
  } finally {
    bitmap.close()
  }
}

function extensionOf(blob: Blob): string {
  if (blob.type === 'image/webp') return 'webp'
  if (blob.type === 'image/png') return 'png'
  if (blob.type === 'image/jpeg') return 'jpg'
  return 'bin'
}

function storageErrorMessage(message: string): string {
  if (/bucket not found/i.test(message)) {
    return '存储桶 app-covers 不存在：请先在 Supabase SQL Editor 里重跑 supabase/schema.sql'
  }
  if (/row-level security|permission denied|unauthorized/i.test(message)) {
    return '没有上传权限：请确认当前账号的 uid 已写入 admins 表'
  }
  if (/exceeded the maximum allowed size/i.test(message)) {
    return '超过存储桶的体积上限，请换一张小一点的图'
  }
  return message
}
