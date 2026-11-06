<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Github } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { resolveIcon } from '@/lib/icons'
import { getColorToken } from '@/lib/palette'
import { extractIntro } from '@/lib/readme'
import { coverUrl } from '@/lib/storage'
import { appHref } from '@/lib/url'
import type { AppItem } from '@/types'

/**
 * 网格视图（默认视图）里的一张卡：**正方形封面**在上，名称 / 简介 / Git 地址 / 访问按钮在下。
 *
 * 封面统一 `object-cover` 铺满正方形：预设图和旧的上传图还是 2:3 的，
 * 这里会居中裁掉上下各一部分 —— 和后台「编辑应用」里看到的预览完全一致。
 */
const props = defineProps<{ item: AppItem }>()

const token = computed(() => getColorToken(props.item.theme_color))
const iconComponent = computed(() => resolveIcon(props.item.hero_icon_name))
const src = computed(() => coverUrl(props.item.image_path))

/** 点封面 = 打开应用：`url` 优先，没配退回仓库（和轮播视图保持一致） */
const href = computed(() => appHref(props.item))

/** 「访问应用」只认线上地址；没填就不出按钮 */
const appUrl = computed(() => props.item.url.trim())

const gitUrl = computed(() => props.item.git_url.trim())

/** 地址去掉协议头，卡片上短一点好放 */
const gitLabel = computed(() => gitUrl.value.replace(/^https?:\/\//, '').replace(/\/$/, ''))

/** 后台手写简介优先；没写就退回 README 摘录 */
const description = computed(
  () => props.item.intro.trim() || extractIntro(props.item.readme_raw),
)
</script>

<template>
  <article
    class="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
  >
    <a
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="`打开 ${props.item.name}`"
      :title="props.item.name"
      class="relative block aspect-square w-full overflow-hidden"
      :class="src ? 'bg-muted' : token.tint"
    >
      <img
        v-if="src"
        :src="src"
        :alt="props.item.name"
        class="size-full object-cover transition-transform duration-200 hover:scale-[1.03]"
        loading="lazy"
        decoding="async"
      />
      <span v-else class="flex size-full items-center justify-center">
        <component :is="iconComponent" :class="['size-1/3', token.text]" aria-hidden="true" />
      </span>
    </a>

    <div class="flex flex-1 flex-col gap-1.5 p-3">
      <h3 class="truncate text-sm font-semibold text-foreground">{{ props.item.name }}</h3>

      <p class="line-clamp-2 min-h-[2.2em] text-[11px] leading-relaxed text-muted-foreground">
        {{ description || '暂无简介' }}
      </p>

      <a
        v-if="gitUrl"
        :href="gitUrl"
        target="_blank"
        rel="noopener noreferrer"
        :title="gitUrl"
        class="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Github class="size-3.5 shrink-0" />
        <span class="truncate">{{ gitLabel }}</span>
      </a>

      <div v-if="appUrl" class="mt-auto pt-1.5">
        <Button size="sm" class="h-8 w-full gap-1.5" as-child>
          <a :href="appUrl" target="_blank" rel="noopener noreferrer" aria-label="访问应用">
            <ArrowRight class="size-3.5" />
            访问应用
          </a>
        </Button>
      </div>
    </div>
  </article>
</template>
