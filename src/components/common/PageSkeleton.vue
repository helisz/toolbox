<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'

withDefaults(defineProps<{ rows?: number }>(), { rows: 8 })
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <Skeleton v-for="index in rows" :key="index" class="h-[78px] rounded-xl" />
  </div>
</template>
