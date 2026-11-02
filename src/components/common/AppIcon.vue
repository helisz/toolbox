<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import { getColorToken } from '@/lib/palette'
import { resolveIcon } from '@/lib/heroicons'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    icon?: string | null
    color?: string | null
    /** 图标容器尺寸 */
    size?: 'sm' | 'md' | 'lg'
    class?: string
  }>(),
  {
    icon: '',
    color: 'slate-500',
    size: 'md',
    class: '',
  },
)

const token = computed(() => getColorToken(props.color ?? 'slate-500'))
const iconComponent = computed<Component>(() => resolveIcon(props.icon))

const boxSize = computed(() => {
  if (props.size === 'sm') return 'size-8 rounded-lg'
  if (props.size === 'lg') return 'size-12 rounded-xl'
  return 'size-10 rounded-lg'
})

const iconSize = computed(() => {
  if (props.size === 'sm') return 'size-4'
  if (props.size === 'lg') return 'size-6'
  return 'size-5'
})
</script>

<template>
  <span :class="cn('flex shrink-0 items-center justify-center', boxSize, token.tint, props.class)">
    <component :is="iconComponent" :class="cn(iconSize, token.text)" aria-hidden="true" />
  </span>
</template>
