<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import type { TagOption } from '@/types'

const props = withDefaults(
  defineProps<{
    options: TagOption[]
    placeholder?: string
  }>(),
  { placeholder: '输入标签后回车新增，或从下拉里选择' },
)

const model = defineModel<string[]>({ required: true })

const draft = ref('')
const focused = ref(false)

const suggestions = computed(() => {
  const query = draft.value.trim().toLowerCase()
  const chosen = new Set(model.value.map((tag) => tag.toLowerCase()))
  return props.options
    .filter((option) => !chosen.has(option.name.toLowerCase()))
    .filter((option) => !query || option.name.toLowerCase().includes(query))
    .slice(0, 8)
})

const reachedLimit = computed(() => model.value.length >= 10)

function add(raw: string): void {
  const value = raw.trim()
  if (!value) return
  if (reachedLimit.value) return
  if (model.value.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
    draft.value = ''
    return
  }
  model.value = [...model.value, value.slice(0, 30)]
  draft.value = ''
}

function remove(name: string): void {
  model.value = model.value.filter((tag) => tag !== name)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    add(draft.value)
    return
  }
  // 输入框为空时按退格删掉最后一个标签
  if (event.key === 'Backspace' && !draft.value && model.value.length > 0) {
    model.value = model.value.slice(0, -1)
  }
}
</script>

<template>
  <div class="space-y-2">
    <div
      class="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5"
    >
      <span
        v-for="tag in model"
        :key="tag"
        class="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
      >
        {{ tag }}
        <button type="button" class="opacity-60 hover:opacity-100" @click="remove(tag)">
          <X class="size-3" />
          <span class="sr-only">移除 {{ tag }}</span>
        </button>
      </span>

      <Input
        v-model="draft"
        class="h-7 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        :placeholder="model.length ? '' : props.placeholder"
        :disabled="reachedLimit"
        @keydown="handleKeydown"
        @focus="focused = true"
        @blur="
          () => {
            focused = false
            add(draft)
          }
        "
      />
    </div>

    <div v-if="focused && suggestions.length" class="flex flex-wrap gap-1.5">
      <button
        v-for="option in suggestions"
        :key="option.name"
        type="button"
        class="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        @mousedown.prevent="add(option.name)"
      >
        {{ option.name }}
        <span class="ml-1 opacity-50">{{ option.count }}</span>
      </button>
    </div>

    <p class="text-[11px] text-muted-foreground">
      {{ model.length }}/10 · 新标签会自动加入全局标签池
    </p>
  </div>
</template>
