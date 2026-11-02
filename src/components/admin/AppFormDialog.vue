<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Image as ImageIcon, LoaderCircle, RefreshCw, Trash2, Upload } from 'lucide-vue-next'
import ColorPicker from '@/components/admin/ColorPicker.vue'
import TagInput from '@/components/admin/TagInput.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useReadme } from '@/composables/useReadme'
import { useToast } from '@/composables/useToast'
import { DEFAULT_ICON_SLUG } from '@/lib/icons'
import { DEFAULT_THEME_COLOR } from '@/lib/palette'
import { coverUrl, uploadCover } from '@/lib/storage'
import { useDataStore } from '@/stores/data'
import { itemFormSchema, type AppItem, type ItemForm } from '@/types'

const props = withDefaults(
  defineProps<{
    item: AppItem | null
    /** 新增应用时默认归属的分组（从某个分组区块点「添加」时传入） */
    defaultGroupId?: string
  }>(),
  { defaultGroupId: '' },
)
const open = defineModel<boolean>('open', { required: true })

const store = useDataStore()
const toast = useToast()
const { pull, loading: pulling, error: readmeError } = useReadme()

const form = reactive<ItemForm>({
  group: '',
  name: '',
  git_url: '',
  url: '',
  image_path: '',
  intro: '',
  hero_icon_name: DEFAULT_ICON_SLUG,
  theme_color: DEFAULT_THEME_COLOR,
  tags: [],
})

const readmeRaw = ref('')
/** 上一次「自动生成」的简介：用户手动改过就不再覆盖 */
const autoIntro = ref('')
const errorMessage = ref('')
const submitting = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const isEditing = computed(() => props.item !== null)
const readmeSize = computed(() => readmeRaw.value.length)
const introSize = computed(() => form.intro.length)

watch(open, (value) => {
  if (!value) return
  errorMessage.value = ''
  uploadError.value = ''

  if (props.item) {
    form.group = props.item.group_id
    form.name = props.item.name
    form.git_url = props.item.git_url
    form.url = props.item.url
    form.image_path = props.item.image_path
    form.intro = props.item.intro
    form.hero_icon_name = props.item.hero_icon_name
    form.theme_color = props.item.theme_color
    form.tags = [...props.item.tags]
    readmeRaw.value = props.item.readme_raw
    autoIntro.value = props.item.intro
    return
  }

  // 新增：优先落在这个分组里点「添加」时的那一组，否则第一个分组
  form.group = props.defaultGroupId || store.sortedGroups[0]?.id || ''
  form.name = ''
  form.git_url = ''
  form.url = ''
  form.image_path = ''
  form.intro = ''
  form.hero_icon_name = DEFAULT_ICON_SLUG
  form.theme_color = DEFAULT_THEME_COLOR
  form.tags = []
  readmeRaw.value = ''
  autoIntro.value = ''
}, { immediate: true })

/** 选完就上传：先把文件丢进存储桶拿到路径，保存时才写库 */
async function onPickFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 清掉，才能再次选中同一个文件
  if (!file) return

  uploading.value = true
  uploadError.value = ''
  try {
    form.image_path = await uploadCover(file)
    toast.success('封面已上传')
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '上传失败'
    toast.fromError(err, '上传失败')
  } finally {
    uploading.value = false
  }
}

async function pullReadme(): Promise<void> {
  if (!form.git_url.trim()) {
    toast.error('请先填写 Git 地址')
    return
  }
  const result = await pull(form.git_url)
  if (result) {
    readmeRaw.value = result.raw

    // 只在「没写过」或「还是上次自动生成的那份」时覆盖，别把用户手改的简介冲掉
    const untouched = !form.intro.trim() || form.intro === autoIntro.value
    if (untouched && result.intro) {
      form.intro = result.intro
      autoIntro.value = result.intro
    }

    toast.success(
      'README 已抓取',
      untouched && result.intro
        ? `共 ${result.raw.length} 字符，简介已自动填入（可修改）`
        : `共 ${result.raw.length} 字符，简介保留你手写的内容`,
    )
    return
  }
  // 抓不到就把原文留空，绝不编造内容
  readmeRaw.value = ''
  toast.error('没抓到 README', readmeError.value ?? undefined)
}

async function submit(): Promise<void> {
  errorMessage.value = ''

  if (!form.group) {
    errorMessage.value = '请先创建至少一个应用组'
    return
  }

  const parsed = itemFormSchema.safeParse({ ...form })
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? '请检查表单'
    return
  }

  submitting.value = true
  try {
    if (props.item) {
      await store.updateItem(props.item.id, parsed.data, readmeRaw.value)
      toast.success('应用已更新')
    } else {
      await store.createItem(parsed.data, readmeRaw.value)
      toast.success('应用已创建')
    }
    open.value = false
  } catch (err) {
    toast.fromError(err, '保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ isEditing ? '编辑应用' : '新增应用' }}</DialogTitle>
        <DialogDescription>归属分组与封面图决定卡片外观</DialogDescription>
      </DialogHeader>

      <div class="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="item-group">归属应用组</Label>
            <Select
              :model-value="form.group"
              @update:model-value="(value) => (form.group = String(value ?? ''))"
            >
              <SelectTrigger id="item-group">
                <SelectValue placeholder="选择应用组" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="group in store.sortedGroups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1.5">
            <Label for="item-name">应用名称</Label>
            <Input id="item-name" v-model="form.name" placeholder="如 部署面板" />
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="item-git">Git 地址</Label>
          <div class="flex gap-2">
            <Input id="item-git" v-model="form.git_url" placeholder="https://github.com/owner/repo" />
            <Button type="button" variant="outline" :disabled="pulling" @click="pullReadme">
              <RefreshCw :class="['size-4', pulling && 'animate-spin']" />
              {{ pulling ? '抓取中…' : '拉取 README' }}
            </Button>
          </div>
          <p class="text-[11px] text-muted-foreground">
            直接从 GitHub raw 抓取原文；失败就留空，不做任何摘要。
            <span v-if="readmeSize">当前 {{ readmeSize }} 字符</span>
            <button
              v-else-if="readmeRaw"
              type="button"
              class="underline"
              @click="readmeRaw = ''"
            >
              清空
            </button>
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="item-url">线上地址</Label>
          <Input
            id="item-url"
            v-model="form.url"
            placeholder="https://helisz.github.io/poke-survivor/（留空则用 Git 地址）"
          />
          <p class="text-[11px] text-muted-foreground">
            前台点图标卡片跳这里；下方的 Git 图标按钮永远跳 Git 地址。
          </p>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-baseline justify-between">
            <Label for="item-intro">卡片简介</Label>
            <span :class="['text-[11px]', introSize > 300 ? 'text-destructive' : 'text-muted-foreground']">
              {{ introSize }} / 300
            </span>
          </div>
          <Textarea
            id="item-intro"
            v-model="form.intro"
            :rows="3"
            placeholder="拉取 README 时自动生成，也可以自己写。前台卡片最多显示三行。"
          />
          <p class="text-[11px] text-muted-foreground">
            留空则卡片只显示名称和地址；已手写的内容不会被再次「拉取 README」覆盖。
          </p>
        </div>

        <div class="space-y-1.5">
          <Label>封面图</Label>
          <div class="flex items-start gap-3">
            <!-- 2:3 预览，和前台卡片同一比例，所见即所得 -->
            <div
              class="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg border bg-muted"
            >
              <img
                v-if="form.image_path"
                :src="coverUrl(form.image_path)"
                alt="封面预览"
                class="size-full object-cover"
              />
              <div v-else class="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon class="size-5" />
              </div>
              <div
                v-if="uploading"
                class="absolute inset-0 flex items-center justify-center bg-background/70"
              >
                <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
              </div>
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  :disabled="uploading"
                  @click="fileInput?.click()"
                >
                  <Upload class="size-3.5" />
                  {{ form.image_path ? '更换图片' : '选择图片' }}
                </Button>
                <Button
                  v-if="form.image_path"
                  type="button"
                  variant="ghost"
                  size="sm"
                  :disabled="uploading"
                  @click="form.image_path = ''"
                >
                  <Trash2 class="size-3.5" />
                  移除
                </Button>
              </div>
              <p class="text-[11px] text-muted-foreground">
                不论原图多大，都会<b class="font-medium text-foreground">居中裁成 2:3、压到 600×900 的 WebP</b>
                再上传（约 30~80KB）。比例不对也没关系，只会切掉两侧或上下的一部分。
              </p>
              <p v-if="uploadError" class="text-[11px] text-destructive">{{ uploadError }}</p>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPickFile" />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label>主题色</Label>
            <ColorPicker v-model="form.theme_color" />
          </div>

          <div class="space-y-1.5">
            <Label>标签</Label>
            <TagInput v-model="form.tags" :options="store.tagOptions" />
          </div>
        </div>

        <div class="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
          <div v-if="form.image_path" class="h-[72px] w-12 shrink-0 overflow-hidden rounded">
            <img :src="coverUrl(form.image_path)" alt="" class="size-full object-cover" />
          </div>
          <AppIcon v-else :icon="form.hero_icon_name" :color="form.theme_color" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ form.name || '应用名称预览' }}</p>
            <p
              v-if="form.url || form.git_url"
              class="truncate font-mono text-[11px] text-muted-foreground/70"
            >
              {{ (form.url || form.git_url).replace(/^https?:\/\//i, '').replace(/\.git$/i, '') }}
            </p>
            <p class="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
              {{ form.intro || '简介预览：前台卡片最多显示三行' }}
            </p>
            <p class="mt-1 truncate text-[11px] text-muted-foreground">
              {{ form.tags.length ? form.tags.join(' · ') : '暂无标签' }}
            </p>
          </div>
        </div>

        <p v-if="errorMessage" class="text-xs text-destructive">{{ errorMessage }}</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" @click="open = false">取消</Button>
        <Button type="button" :disabled="submitting" @click="submit">
          {{ submitting ? '保存中…' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
