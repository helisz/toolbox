<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { extractIntro } from '@/lib/readme'
import type { AppItem } from '@/types'

/**
 * 轮播卡片下方的信息区：应用名 / 地址 / 跳转按钮 / 最多三行简介，整体居中。
 * 只显示**当前居中那张卡**对应的应用，所以这里永远是单条数据。
 */
const props = defineProps<{ item: AppItem }>()

/** 省掉协议和 .git，长地址由 truncate 兜住 */
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
</script>

<template>
  <div class="mx-auto w-full max-w-md text-center">
    <h2 class="truncate text-lg font-semibold tracking-tight text-foreground">
      {{ props.item.name }}
    </h2>

    <p class="mt-1 truncate font-mono text-[11px] text-muted-foreground">
      {{ displayUrl }}
    </p>

    <Button size="sm" class="mt-3 gap-1" as-child>
      <a :href="props.item.git_url" target="_blank" rel="noopener noreferrer">
        跳转
        <ExternalLink class="size-3.5" />
      </a>
    </Button>

    <p class="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
      {{ description || '暂无简介' }}
    </p>
  </div>
</template>
