<script setup lang="ts">
import { computed } from 'vue'
import { ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline'
import AppIcon from '@/components/common/AppIcon.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { renderReadme, resolveRepoWebUrl } from '@/lib/markdown'
import { extractIntro } from '@/lib/readme'
import type { AppItem } from '@/types'

const props = defineProps<{ item: AppItem | null }>()
const open = defineModel<boolean>('open', { required: true })

const html = computed(() => {
  if (!props.item?.readme_raw) return ''
  return renderReadme(props.item.readme_raw, resolveRepoWebUrl(props.item.git_url))
})

/**
 * 优先用后台手工维护的「卡片简介」；没写时才退回从 readme_raw 运行时提取的摘录。
 * 这样后台改过的文案能立刻生效，老数据也不会突然变成空白。
 */
const intro = computed(() => {
  if (!props.item) return ''
  return props.item.intro.trim() || extractIntro(props.item.readme_raw)
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <template v-if="props.item">
        <DialogHeader>
          <div class="flex items-start gap-3">
            <AppIcon :icon="props.item.hero_icon_name" :color="props.item.theme_color" size="lg" />
            <div class="min-w-0 flex-1">
              <DialogTitle class="truncate text-left">{{ props.item.name }}</DialogTitle>
              <DialogDescription class="mt-1 truncate text-left font-mono text-xs">
                {{ props.item.git_url }}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div v-if="props.item.tags.length" class="flex flex-wrap gap-1.5">
          <Badge v-for="tag in props.item.tags" :key="tag" variant="secondary">{{ tag }}</Badge>
        </div>

        <!-- 300 字摘录：README 大标题下的正文，来自 lib/readme.ts -->
        <p v-if="intro" class="border-l-2 border-primary/30 pl-3 text-sm leading-relaxed text-muted-foreground">
          {{ intro }}
        </p>

        <div>
          <Button as-child size="sm" class="gap-1.5">
            <a :href="props.item.git_url" target="_blank" rel="noopener noreferrer">
              <ArrowTopRightOnSquareIcon class="size-4" />
              打开仓库
            </a>
          </Button>
        </div>

        <div class="max-h-[45vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
          <!-- 渲染前已过 markdown-it(html:false) + DOMPurify，见 lib/markdown.ts -->
          <div v-if="html" class="markdown-body" v-html="html" />
          <p v-else class="text-xs text-muted-foreground">
            这个应用还没有抓取到 README，可以到后台点「拉取 README」补上。
          </p>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
