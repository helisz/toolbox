<script setup lang="ts">
import { computed } from 'vue'
import { resolveIcon } from '@/lib/icons'
import { getColorToken } from '@/lib/palette'
import { coverUrl } from '@/lib/storage'
import { appHref } from '@/lib/url'
import type { AppItem } from '@/types'

/**
 * 轮播里的一张卡：**2:3 竖版封面图**，点它就是打开这个应用（`url`，没配就退回 Git 地址）。
 * 名称 / 地址 / 简介都在卡片外面的 `AppInfoPanel` 里。
 *
 * 没传封面图的老数据回退成「图标色块」，不至于开天窗。
 */
const props = withDefaults(defineProps<{ item: AppItem; active?: boolean }>(), { active: true })

const token = computed(() => getColorToken(props.item.theme_color))
const iconComponent = computed(() => resolveIcon(props.item.hero_icon_name))
const src = computed(() => coverUrl(props.item.image_path))
const href = computed(() => appHref(props.item))

/** 非居中卡片的链接不参与 Tab 顺序，避免键盘焦点跑到侧边卡上 */
const tabIndex = computed(() => (props.active ? 0 : -1))
</script>

<template>
  <article class="h-full w-full bg-card">
    <a
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      :tabindex="tabIndex"
      :aria-label="`打开 ${props.item.name}`"
      :title="props.item.name"
      :class="[
        'block size-full overflow-hidden rounded-2xl border shadow-sm',
        props.active && 'transition-transform duration-200 hover:scale-[1.02]',
        src ? 'bg-muted' : token.tint,
      ]"
    >
      <img
        v-if="src"
        :src="src"
        :alt="props.item.name"
        class="size-full object-cover"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <span v-else class="flex size-full items-center justify-center">
        <component :is="iconComponent" :class="['size-1/2', token.text]" aria-hidden="true" />
      </span>
    </a>
  </article>
</template>
