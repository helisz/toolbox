<script setup lang="ts" generic="T extends { id: string }">
import { VueDraggable } from 'vue-draggable-plus'

withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })

/**
 * 拖拽容器：把 vue-draggable-plus 的默认样式与行为收敛到一处。
 * 注意这个库的默认插槽传的是实例而不是 `{ element, index }`，
 * 所以条目由使用方在自己的模板里 v-for 渲染。
 */
const list = defineModel<T[]>({ required: true })
</script>

<template>
  <VueDraggable
    v-model="list"
    :disabled="disabled"
    :animation="150"
    handle=".drag-handle"
    ghost-class="opacity-40"
    class="space-y-2"
  >
    <slot />
  </VueDraggable>
</template>
