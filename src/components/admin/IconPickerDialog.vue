<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PRESET_ICONS } from '@/lib/icon-presets'
import { ICON_SLUGS, resolveIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

const props = defineProps<{ selected?: string }>()
const emit = defineEmits<{ select: [slug: string] }>()

const open = defineModel<boolean>('open', { required: true })

const keyword = ref('')

/**
 * 搜索命中后最多渲染这么多：每个命中图标都是独立 chunk，
 * 一次请求几百个会把弹窗卡住，滚动 + 继续输入足够用。
 */
const MAX_VISIBLE = 60

const matched = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) return []
  return ICON_SLUGS.filter((slug) => slug.includes(query))
})

const results = computed(() => matched.value.slice(0, MAX_VISIBLE))

watch(open, (value) => {
  if (value) keyword.value = ''
})

function pick(slug: string): void {
  emit('select', slug)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>选择图标</DialogTitle>
        <DialogDescription>
          内置 Lucide 图标，共 {{ ICON_SLUGS.length }} 个，支持按名称搜索
        </DialogDescription>
      </DialogHeader>

      <div class="relative">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input v-model="keyword" class="pl-8" placeholder="搜索图标名，如 rocket / code / cloud" />
      </div>

      <div class="max-h-[50vh] overflow-y-auto">
        <!-- 没搜索词就展示常用集合（静态打包，打开即有，不发请求） -->
        <div v-if="!keyword.trim()" class="grid grid-cols-8 gap-1.5">
          <button
            v-for="(icon, slug) in PRESET_ICONS"
            :key="slug"
            type="button"
            :title="slug"
            :class="
              cn(
                'flex aspect-square items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                props.selected === slug && 'border-foreground/30 bg-accent text-foreground',
              )
            "
            @click="pick(slug)"
          >
            <component :is="icon" class="size-5" />
          </button>
        </div>

        <div v-else-if="results.length" class="grid grid-cols-8 gap-1.5">
          <button
            v-for="slug in results"
            :key="slug"
            type="button"
            :title="slug"
            :class="
              cn(
                'flex aspect-square items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                props.selected === slug && 'border-foreground/30 bg-accent text-foreground',
              )
            "
            @click="pick(slug)"
          >
            <component :is="resolveIcon(slug)" class="size-5" />
          </button>
        </div>

        <p v-else class="py-10 text-center text-xs text-muted-foreground">没有匹配的图标</p>
      </div>

      <p class="text-[11px] text-muted-foreground">
        <template v-if="!keyword.trim()">
          显示常用 {{ Object.keys(PRESET_ICONS).length }} 个，搜索可查全部 {{ ICON_SLUGS.length }} 个
        </template>
        <template v-else-if="matched.length > MAX_VISIBLE">
          匹配 {{ matched.length }} 个，先显示前 {{ MAX_VISIBLE }} 个，继续输入可缩小范围
        </template>
        <template v-else>匹配 {{ matched.length }} 个</template>
        ；不支持上传自定义图标。
      </p>
    </DialogContent>
  </Dialog>
</template>
