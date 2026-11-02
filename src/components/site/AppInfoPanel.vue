<script setup lang="ts">
import { computed } from 'vue'
import { Github } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { extractIntro } from '@/lib/readme'
import { appHref, displayHref } from '@/lib/url'
import type { AppItem } from '@/types'

/**
 * 轮播卡片下方的信息区：应用名 / 地址 / GitHub 图标按钮 / 最多三行简介，整体居中。
 * 只显示**当前居中那张卡**对应的应用，所以这里永远是单条数据。
 */
const props = defineProps<{ item: AppItem }>()

/** 地址那行跟着「点图标会去哪」走，避免显示的地址和实际跳转不一致 */
const shownUrl = computed(() => displayHref(appHref(props.item)))

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
      {{ shownUrl }}
    </p>

    <!-- 图标卡片跳线上地址，这个按钮专门跳源码仓库 -->
    <Button size="icon-sm" variant="outline" class="mt-3" as-child>
      <a
        :href="props.item.git_url"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="打开 Git 仓库"
        title="打开 Git 仓库"
      >
        <Github class="size-4" />
      </a>
    </Button>

    <p class="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
      {{ description || '暂无简介' }}
    </p>
  </div>
</template>
