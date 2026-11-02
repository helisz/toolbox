<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { resolveIcon } from '@/lib/icons'
import { getColorToken } from '@/lib/palette'
import { extractIntro } from '@/lib/readme'
import type { AppItem } from '@/types'

const props = withDefaults(defineProps<{ item: AppItem; active?: boolean }>(), { active: true })

const token = computed(() => getColorToken(props.item.theme_color))
const iconComponent = computed(() => resolveIcon(props.item.hero_icon_name))

/** 卡片上省掉协议和 .git，长地址由 truncate 兜住 */
const displayUrl = computed(() =>
  props.item.git_url
    .replace(/^https?:\/\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/$/, ''),
)

/** 后台手写的简介优先；没写就退回 README 摘录 */
const description = computed(
  () => props.item.intro.trim() || extractIntro(props.item.readme_raw),
)

/** 非居中卡片的链接不参与 Tab 顺序，避免键盘焦点跑到侧边卡上 */
const tabIndex = computed(() => (props.active ? 0 : -1))
</script>

<template>
  <article
    :class="[
      'flex h-full flex-col items-center rounded-2xl border bg-card p-5 text-center',
      props.active ? 'border-foreground/15' : 'border-border',
    ]"
  >
    <!-- 点图标也能跳转 -->
    <a
      :href="props.item.git_url"
      target="_blank"
      rel="noopener noreferrer"
      :tabindex="tabIndex"
      :aria-label="`打开 ${props.item.name}`"
      :title="`打开 ${props.item.name}`"
      :class="[
        'mt-1 flex size-16 items-center justify-center rounded-2xl transition-transform duration-200 hover:scale-105',
        token.tint,
      ]"
    >
      <component :is="iconComponent" :class="['size-8', token.text]" aria-hidden="true" />
    </a>

    <h3 class="mt-4 w-full truncate text-sm font-semibold text-foreground">{{ props.item.name }}</h3>
    <p class="mt-0.5 w-full truncate font-mono text-[11px] text-muted-foreground">
      {{ displayUrl }}
    </p>

    <Button size="sm" class="mt-3 gap-1" as-child>
      <a :href="props.item.git_url" target="_blank" rel="noopener noreferrer" :tabindex="tabIndex">
        跳转
        <ExternalLink class="size-3.5" />
      </a>
    </Button>

    <p class="mt-3 line-clamp-3 w-full text-left text-xs leading-relaxed text-muted-foreground">
      {{ description || '暂无简介' }}
    </p>
  </article>
</template>
