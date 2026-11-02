<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HERO_ICONS, HERO_ICON_SLUGS } from '@/lib/heroicons'
import { cn } from '@/lib/utils'

const props = defineProps<{ selected?: string }>()
const emit = defineEmits<{ select: [slug: string] }>()

const open = defineModel<boolean>('open', { required: true })

const keyword = ref('')

/** 300 个图标全渲染会明显拖慢弹窗，限制可见数量，配合滚动足够用 */
const MAX_VISIBLE = 240

const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const slugs = query ? HERO_ICON_SLUGS.filter((slug) => slug.includes(query)) : HERO_ICON_SLUGS
  return slugs.slice(0, MAX_VISIBLE)
})

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
        <DialogDescription>内置 Heroicons（outline），支持按名称搜索</DialogDescription>
      </DialogHeader>

      <div class="relative">
        <MagnifyingGlassIcon
          class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input v-model="keyword" class="pl-8" placeholder="搜索图标名，如 rocket / code / cloud" />
      </div>

      <div class="max-h-[50vh] overflow-y-auto">
        <div v-if="filtered.length" class="grid grid-cols-8 gap-1.5">
          <button
            v-for="slug in filtered"
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
            <component :is="HERO_ICONS[slug]" class="size-5" />
          </button>
        </div>
        <p v-else class="py-10 text-center text-xs text-muted-foreground">
          没有匹配的图标
        </p>
      </div>

      <p class="text-[11px] text-muted-foreground">
        共 {{ filtered.length }} 个；不支持上传自定义图标。
      </p>
    </DialogContent>
  </Dialog>
</template>
