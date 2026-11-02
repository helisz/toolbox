<script setup lang="ts">
import type { Component } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: Component
    class?: string
  }>(),
  { description: '', icon: undefined, class: '' },
)
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 px-6 py-14 text-center',
        props.class,
      )
    "
  >
    <component :is="props.icon" v-if="props.icon" class="size-8 text-muted-foreground/60" />
    <p class="text-sm font-medium">{{ props.title }}</p>
    <p v-if="props.description" class="max-w-sm text-xs leading-6 text-muted-foreground">
      {{ props.description }}
    </p>
    <slot />
  </div>
</template>
