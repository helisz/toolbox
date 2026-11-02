<script setup lang="ts">
import { THEME_COLORS, type ThemeColorKey } from '@/lib/palette'
import { cn } from '@/lib/utils'

const model = defineModel<ThemeColorKey>({ required: true })
</script>

<template>
  <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="主题色">
    <button
      v-for="token in THEME_COLORS"
      :key="token.key"
      type="button"
      role="radio"
      :aria-checked="model === token.key"
      :aria-label="token.label"
      :title="token.label"
      :class="
        cn(
          'flex size-8 items-center justify-center rounded-lg border transition-all',
          model === token.key
            ? 'border-foreground/40 ring-2 ring-foreground/15'
            : 'border-border hover:border-foreground/25',
        )
      "
      @click="model = token.key"
    >
      <span :class="cn('size-3.5 rounded-full', token.bar)" />
    </button>
  </div>
</template>
