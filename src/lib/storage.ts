import { supabase } from '@/lib/supabase'

/**
 * 封面图存储：Supabase Storage 的公开桶。
 *
 * 存的是**对象路径**（`2026-11/xxx.webp`），不是完整 URL ——
 * 换项目 / 换自定义域名时数据不用动，渲染时再拼公开地址。
 */
export const COVER_BUCKET = 'app-covers'

/** 上传前的本地限制：单张 10MB，超过直接拒绝（压缩后会更小） */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
/** 压缩时长边上限。卡片只有几百像素宽，1400 已经绰绰有余 */
const MAX_EDGE = 1400

export async function uploadCover(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('只能上传图片文件')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`图片太大（${(file.size / 1024 / 1024).toFixed(1)}MB），请压到 10MB 以内`)
  }

  const blob = await shrink(file)
  const ext = extensionOf(blob)
  // 按月分目录，避免单目录堆几千个对象；文件名用随机 UUID，天然不重名
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, blob, {
    cacheControl: '31536000',
    contentType: blob.type || file.type,
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

/**
 * 客户端先压一道：手机拍的照动辄 4~8MB，而卡片最多显示 180×270。
 * 长边超 1400 或体积超 600KB 才重编码成 WebP；
 * GIF / SVG / AVIF 原样上传（前者会丢动画，后两者浏览器支持不齐）。
 */
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file // 解不出来的图就别难为它，交给后端
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, MAX_EDGE / longest)
    if (scale === 1 && file.size < 600 * 1024) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.9),
    )
    // 压完反而更大就用原图（比如本来就是个小的 PNG）
    return blob && blob.size < file.size ? blob : file
  } finally {
    bitmap.close()
  }
}

function extensionOf(blob: Blob): string {
  if (blob.type === 'image/webp') return 'webp'
  if (blob.type === 'image/png') return 'png'
  if (blob.type === 'image/jpeg') return 'jpg'
  if (blob.type === 'image/gif') return 'gif'
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
