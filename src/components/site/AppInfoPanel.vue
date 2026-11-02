<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Github } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { extractIntro } from '@/lib/readme'
import { appHref } from '@/lib/url'
import type { AppItem } from '@/types'

/**
 * 轮播卡片下方的信息区：应用名 / 两个动作按钮 / 最多三行简介，整体居中。
 * 只显示**当前居中那张卡**对应的应用，所以这里永远是单条数据。
 */
const props = defineProps<{ item: AppItem }>()

/** 卡片点击去哪，这个按钮就去哪：优先 url，没填就退回仓库地址 */
const href = computed(() => appHref(props.item))

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

    <!-- 左边看源码，右边直接用；「访问应用」跟卡片点击同一个目标 -->
    <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
      <Button v-if="props.item.git_url" variant="github" size="sm" class="gap-1.5" as-child>
        <a
          :href="props.item.git_url"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="打开 GitHub 仓库"
          title="打开 GitHub 仓库"
        >
          <Github class="size-4" />
          GitHub
        </a>
      </Button>

      <Button size="sm" class="gap-1.5" as-child>
        <a
          :href="href"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="访问应用"
          title="访问应用"
        >
          <ArrowRight class="size-4" />
          访问应用
        </a>
      </Button>
    </div>

    <!-- 固定三行高度：切换应用时简介长短不一会让下方内容上下跳 -->
    <p class="mt-3 line-clamp-3 min-h-[3.75rem] text-xs leading-relaxed text-muted-foreground">
      {{ description || '暂无简介' }}
    </p>
  </div>
</template>
