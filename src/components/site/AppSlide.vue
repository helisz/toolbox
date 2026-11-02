<script setup lang="ts">
import { computed } from 'vue'
import { resolveIcon } from '@/lib/icons'
import { getColorToken } from '@/lib/palette'
import type { AppItem } from '@/types'

/**
 * 轮播里的一张卡：**只有图标**（点了直接跳）。
 * 名称 / 地址 / 跳转按钮 / 简介都在卡片外面，由 `AppInfoPanel` 统一显示。
 */
const props = withDefaults(defineProps<{ item: AppItem; active?: boolean }>(), { active: true })

const token = computed(() => getColorToken(props.item.theme_color))
const iconComponent = computed(() => resolveIcon(props.item.hero_icon_name))

/** 非居中卡片的链接不参与 Tab 顺序，避免键盘焦点跑到侧边卡上 */
const tabIndex = computed(() => (props.active ? 0 : -1))
</script>

<template>
  <article class="flex h-full w-full items-center justify-center bg-card">
    <a
      :href="props.item.git_url"
      target="_blank"
      rel="noopener noreferrer"
      :tabindex="tabIndex"
      :aria-label="`打开 ${props.item.name}`"
      :title="props.item.name"
      :class="[
        'flex size-[62%] items-center justify-center rounded-2xl transition-transform duration-200',
        props.active && 'hover:scale-105',
        token.tint,
      ]"
    >
      <component :is="iconComponent" :class="['size-1/2', token.text]" aria-hidden="true" />
    </a>
  </article>
</template>
