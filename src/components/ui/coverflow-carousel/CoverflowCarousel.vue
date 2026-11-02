<script setup lang="ts">
/**
 * Coverflow 轮播（Vue 3 移植，源自 docs/carousel.md 的 React 实现）
 *
 * 核心算法完全沿用原版：
 * - 卡片绝对定位在 `left-1/2`，每帧只写 transform / opacity / z-index，**不碰 Vue 响应式数据**，
 *   否则 60fps 下每帧都会重渲染所有卡片；
 * - 循环靠「把距离折到环的短边」实现（`offset > count/2` 就减 count），不需要克隆节点；
 * - 拖动用指数缓动 settle，甩动最多带两张；
 * - 卡宽是唯一需要测量的量（pitch / 景深 / 透视都由它推导），用 ResizeObserver 监听容器。
 *
 * 与原版的差别：不渲染 `<img>`，改用默认插槽把卡片内容交给调用方，
 * 因此 `slides` 变成 `count`，图片相关字段（src/alt/meta）不再需要。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    /** 卡片数量（内容由插槽渲染） */
    count: number
    /** 第一张邻卡旋转角度 */
    rotate?: number
    /** 第一张邻卡后退量，卡片宽度的比例 */
    depth?: number
    /** 观察者距离，卡片宽度的倍数，越小镜头越广 */
    perspective?: number
    /** 距离的指数，小于 1 时远端衰减更缓 */
    falloff?: number
    /** 每远离一张卡片丢失的不透明度 */
    fade?: number
    /** 任意 CSS 长度；其余尺寸都由它推导，所以整体会等比缩放 */
    cardWidth?: string
    /** 卡片高度，默认与宽度相同 */
    cardHeight?: string
    /** 卡片间距，卡片宽度的比例 */
    gap?: number
    loop?: boolean
    showNavigation?: boolean
    showPagination?: boolean
    /** 无障碍名称 */
    label?: string
    class?: string
    cardClass?: string
  }>(),
  {
    rotate: 44,
    depth: 0.6,
    perspective: 3,
    falloff: 0.56,
    fade: 0.1,
    cardWidth: 'clamp(148px, 22vw, 260px)',
    cardHeight: 'var(--cf-card)',
    gap: 0.05,
    loop: true,
    showNavigation: false,
    showPagination: false,
    label: '应用轮播',
    class: '',
    cardClass: '',
  },
)

const emit = defineEmits<{ change: [index: number] }>()

const frameEl = ref<HTMLDivElement | null>(null)
const cards: (HTMLElement | null)[] = []

const selected = ref(0)

/** 居中位置的小数索引，唯一真源；不是响应式的，避免每帧触发渲染 */
let pos = 0
/** 本次 settle 的目标。从 `pos` 起步会吞掉飞行途中落下的按键 */
let target = 0
let cardWidthPx = 0
let raf: number | null = null
/** 本次按下后指针移动过的像素数，用来抑制「拖完顺带点了链接」 */
let movedPx = 0
/** 是否已经捕获指针（拖起来之后才捕获，见 onPointerMove） */
let captured = false

let drag: { id: number; x: number; pos: number; v: number; t: number } | null = null
let observer: ResizeObserver | null = null

const total = computed(() => Math.max(0, Math.floor(props.count)))

function setCardEl(el: unknown, index: number): void {
  cards[index] = el instanceof HTMLElement ? el : null
}

/** 最近的整卡下标，折回 0..count-1 */
function indexAt(value: number): number {
  const count = total.value
  if (count <= 0) return 0
  return ((Math.round(value) % count) + count) % count
}

/**
 * 直接写 DOM。React 版注释里那句「六十次状态更新一秒」在 Vue 里同样成立，
 * 所以这里刻意不经过 template 的响应式更新。
 */
function paint(): void {
  const count = total.value
  const width = cardWidthPx
  if (!width || count <= 0) return

  const pitch = width * (1 + props.gap)

  cards.forEach((card, index) => {
    if (!card) return

    // 把距离折到环的短边 —— 循环机制的全部，不需要克隆节点
    let offset = index - pos
    if (props.loop) {
      offset = ((offset % count) + count) % count
      if (offset > count / 2) offset -= count
    }

    const distance = Math.abs(offset)
    // 倾斜与后退都随距离放缓：距离翻倍只多约一半，线性会让第二张卡合拢
    const ramp = Math.pow(distance, props.falloff)
    // 限制在快侧对之前，最远的卡不会把背面转出来
    const tilt = Math.min(props.rotate * ramp, 82) * Math.sign(offset)

    card.style.transform =
      `translateX(calc(-50% + ${offset * pitch}px)) ` +
      `translateZ(${-props.depth * width * ramp}px) rotateY(${-tilt}deg)`

    // 卡片在半圈处会被瞬移，必须在那之前完全消失，否则跳跃可见。
    // 原版直接用 count/2 当半程：卡片只有 1~2 张时半程 < 1，会把唯一那张也压暗，
    // 所以这里只在环真的够长（半程 > 1）时才做边缘淡出。
    const half = count / 2
    const edge = props.loop && half > 1 ? Math.min(1, Math.max(0, half - distance)) : 1
    card.style.opacity = String(Math.max(0, 1 - props.fade * distance) * edge)
    card.style.zIndex = String(100 - Math.round(distance))
  })
}

function settle(to: number): void {
  if (raf !== null) cancelAnimationFrame(raf)
  target = to
  selected.value = indexAt(to)

  const step = (): void => {
    const remaining = to - pos
    if (Math.abs(remaining) < 0.0004) {
      pos = to
      paint()
      raf = null
      return
    }
    pos += remaining * 0.16
    paint()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function clampPos(value: number): number {
  if (props.loop) return value
  return Math.max(0, Math.min(total.value - 1, value))
}

function goTo(index: number): void {
  const count = total.value
  if (count <= 0) return
  // 走环上的短边，而不是绕回去
  const to = props.loop ? index + Math.round((target - index) / count) * count : index
  settle(clampPos(to))
  emit('change', indexAt(to))
}

function nudge(by: number): void {
  goTo(indexAt(Math.round(target) + by))
}

function measure(): void {
  const card = cards[0]
  if (!card) return
  cardWidthPx = card.offsetWidth
  paint()
}

function onPointerDown(event: PointerEvent): void {
  if (raf !== null) {
    cancelAnimationFrame(raf)
    raf = null
  }
  target = pos
  movedPx = 0
  captured = false
  drag = { id: event.pointerId, x: event.clientX, pos, v: 0, t: performance.now() }
}

function onPointerMove(event: PointerEvent): void {
  const current = drag
  if (!current || current.id !== event.pointerId) return

  const pitch = cardWidthPx * (1 + props.gap)
  if (!pitch) return

  const now = performance.now()
  const previous = pos
  pos = clampPos(current.pos - (event.clientX - current.x) / pitch)
  movedPx = Math.max(movedPx, Math.abs(event.clientX - current.x))

  // 只有真的拖起来了才捕获指针：单纯点一下不能让链接失去 click
  if (!captured && movedPx > 6) {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    captured = true
  }

  // 每秒卡片数，用于甩动
  current.v = ((pos - previous) / Math.max(now - current.t, 1)) * 1000
  current.t = now

  const index = indexAt(pos)
  if (index !== selected.value) {
    selected.value = index
    emit('change', index)
  }
  paint()
}

function onPointerUp(event: PointerEvent): void {
  const current = drag
  if (!current || current.id !== event.pointerId) return
  drag = null

  if (captured) {
    try {
      ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    } catch {
      /* 指针已经释放，忽略 */
    }
    captured = false
  }

  // 允许甩动带过去，但最多两张
  const carried = Math.max(-2, Math.min(2, current.v * 0.18))
  settle(clampPos(Math.round(pos + carried)))
}

/** 拖拽结束时指针的 click 会落在卡片里的链接上，这里拦掉 */
function onClickCapture(event: MouseEvent): void {
  if (movedPx > 6) {
    event.preventDefault()
    event.stopPropagation()
    movedPx = 0
  }
}

function onCardClick(index: number): void {
  if (movedPx > 6) return
  if (index !== selected.value) goTo(index)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    nudge(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    nudge(1)
  }
}

onMounted(() => {
  measure()
  if (frameEl.value) {
    observer = new ResizeObserver(measure)
    observer.observe(frameEl.value)
  }
})

onBeforeUnmount(() => {
  if (raf !== null) cancelAnimationFrame(raf)
  observer?.disconnect()
  observer = null
})

// 数量变了（切换分组 / 搜索结果变化）：回到第一张并重新测量
watch(total, async () => {
  pos = 0
  target = 0
  if (selected.value !== 0) {
    selected.value = 0
    emit('change', 0)
  }
  cards.length = 0
  await nextTick()
  measure()
})

// 影响几何的参数变了就重画一次
watch(
  () => [props.gap, props.rotate, props.depth, props.falloff, props.fade, props.loop] as const,
  () => paint(),
)
</script>

<template>
  <div
    :class="cn('w-full', props.class)"
    :style="{ '--cf-card': props.cardWidth }"
    role="region"
    aria-roledescription="carousel"
    :aria-label="props.label"
  >
    <div class="relative">
      <div
        ref="frameEl"
        tabindex="0"
        :style="{
          perspective: `calc(var(--cf-card) * ${props.perspective})`,
          // 水平拖动归我们，页面保留纵向滚动
          touchAction: 'pan-y',
        }"
        class="cursor-grab overflow-hidden py-8 outline-none ring-ring focus-visible:ring-2 active:cursor-grabbing"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @click.capture="onClickCapture"
        @keydown="onKeydown"
      >
        <div
          class="relative select-none"
          :style="{ height: props.cardHeight, transformStyle: 'preserve-3d' }"
        >
          <div
            v-for="(_, index) in total"
            :key="index"
            :ref="(el) => setCardEl(el, index)"
            role="group"
            aria-roledescription="slide"
            :aria-label="`${index + 1} / ${total}`"
            :class="
              cn(
                'absolute left-1/2 top-0 overflow-hidden rounded-2xl shadow-xl will-change-transform',
                props.cardClass,
              )
            "
            :style="{ width: 'var(--cf-card)', height: '100%' }"
            @click="onCardClick(index)"
          >
            <!-- 非居中卡片内的链接不接收点击，点击会先把它转到中间 -->
            <div :class="index === selected ? '' : 'pointer-events-none'" class="h-full">
              <slot :index="index" :active="index === selected" />
            </div>
          </div>
        </div>
      </div>

      <template v-if="props.showNavigation">
        <button
          type="button"
          aria-label="上一张"
          class="absolute left-1 top-1/2 z-[200] -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition hover:bg-background"
          @click="nudge(-1)"
        >
          <ChevronLeftIcon class="size-5" />
        </button>
        <button
          type="button"
          aria-label="下一张"
          class="absolute right-1 top-1/2 z-[200] -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition hover:bg-background"
          @click="nudge(1)"
        >
          <ChevronRightIcon class="size-5" />
        </button>
      </template>
    </div>

    <div v-if="props.showPagination" class="mt-4 flex items-center justify-center gap-2">
      <button
        v-for="(_, index) in total"
        :key="index"
        type="button"
        :aria-label="`跳到第 ${index + 1} 个`"
        :aria-current="index === selected"
        :class="
          cn(
            'size-2 rounded-full bg-foreground transition-opacity',
            index === selected ? 'opacity-100' : 'opacity-30',
          )
        "
        @click="goTo(index)"
      />
    </div>
  </div>
</template>
