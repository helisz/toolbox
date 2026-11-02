/**
 * 纯逻辑自检：不需要浏览器、不需要 Supabase 连接。
 *
 * 覆盖两处「类型检查抓不到、但最容易写错」的地方：
 * 1. README 摘录提取（一堆正则，边界条件多）
 * 2. 拖拽排序的中点计算（浮点间隙耗尽、首尾插入）
 *
 * 运行：npm run selfcheck
 */
import assert from 'node:assert/strict'
import { buildRawCandidates, extractIntro, parseGitUrl } from '../src/lib/readme.ts'
import { computeSortValue, nextSortValue, planMove, SORT_STEP } from '../src/lib/sort.ts'

let passed = 0
const failures = []

function check(name, fn) {
  try {
    fn()
    passed += 1
  } catch (error) {
    failures.push(`${name}\n    ${error.message}`)
  }
}

/* ------------------------------------------------------------ parseGitUrl */

check('github https + .git 后缀', () => {
  const repo = parseGitUrl('https://github.com/owner/repo.git')
  assert.equal(repo.platform, 'github')
  assert.equal(repo.owner, 'owner')
  assert.equal(repo.repo, 'repo')
  assert.equal(repo.webUrl, 'https://github.com/owner/repo')
  assert.equal(repo.ref, undefined)
})

check('github /tree/branch 解析出 ref', () => {
  const repo = parseGitUrl('https://github.com/owner/repo/tree/develop')
  assert.equal(repo.ref, 'develop')
  assert.equal(repo.repo, 'repo')
})

check('ssh 形式转 https', () => {
  const repo = parseGitUrl('git@github.com:owner/repo.git')
  assert.equal(repo.platform, 'github')
  assert.equal(repo.owner, 'owner')
  assert.equal(repo.repo, 'repo')
})

check('gitlab 多级 group', () => {
  const repo = parseGitUrl('https://gitlab.com/group/sub/repo')
  assert.equal(repo.platform, 'gitlab')
  assert.equal(repo.owner, 'group/sub')
  assert.equal(repo.repo, 'repo')
})

check('gitee 识别', () => {
  assert.equal(parseGitUrl('https://gitee.com/owner/repo').platform, 'gitee')
})

check('未知域名归为 unknown', () => {
  assert.equal(parseGitUrl('https://git.example.com/team/repo').platform, 'unknown')
})

check('非法输入返回 null', () => {
  assert.equal(parseGitUrl('not-a-url'), null)
  assert.equal(parseGitUrl('ftp://github.com/a/b'), null)
  assert.equal(parseGitUrl('https://github.com/onlyowner'), null)
  assert.equal(parseGitUrl('   '), null)
})

/* ---------------------------------------------------- buildRawCandidates */

check('github 候选顺序：README.md 优先、用 HEAD', () => {
  const urls = buildRawCandidates(parseGitUrl('https://github.com/owner/repo'))
  assert.equal(urls[0], 'https://raw.githubusercontent.com/owner/repo/HEAD/README.md')
  assert.ok(urls.includes('https://raw.githubusercontent.com/owner/repo/HEAD/docs/README.md'))
})

check('gitlab / gitee 各自的 raw 路径', () => {
  const gitlab = buildRawCandidates(parseGitUrl('https://gitlab.com/g/sub/repo'))
  assert.equal(gitlab[0], 'https://gitlab.com/g/sub/repo/-/raw/HEAD/README.md')

  const gitee = buildRawCandidates(parseGitUrl('https://gitee.com/owner/repo'))
  assert.equal(gitee[0], 'https://gitee.com/owner/repo/raw/HEAD/README.md')
})

check('显式 ref 会替换 HEAD', () => {
  const urls = buildRawCandidates(parseGitUrl('https://github.com/owner/repo/tree/dev'))
  assert.equal(urls[0], 'https://raw.githubusercontent.com/owner/repo/dev/README.md')
})

/* ------------------------------------------------------------ extractIntro */

const README = [
  '# 部署面板',
  '',
  '[![build](https://img.shields.io/badge/build-passing-green)](https://example.com)',
  '![logo](https://example.com/logo.png)',
  '<p align="center"><img src="x.png" /></p>',
  '',
  '一个用于**内部服务**部署的小工具，支持 `blue-green` 发布与回滚。',
  '',
  '## 安装',
  '',
  '这一段不应该出现在摘录里。',
].join('\n')

check('摘录：跳过徽章墙，只取 H1 与 H2 之间的正文', () => {
  const intro = extractIntro(README)
  assert.equal(intro, '一个用于内部服务部署的小工具，支持 发布与回滚。')
})

check('摘录：没有 H1 时从正文开头取', () => {
  const intro = extractIntro('这是项目简介。\n\n## 用法\n\n被截断的部分。')
  assert.equal(intro, '这是项目简介。')
})

check('摘录：没有后续标题时取到文末', () => {
  const intro = extractIntro('# 标题\n\n只有一段简介。')
  assert.equal(intro, '只有一段简介。')
})

check('摘录：超过 300 字截断并加省略号', () => {
  const long = `# 标题\n\n${'甲'.repeat(500)}`
  const intro = extractIntro(long)
  assert.equal([...intro].length, 301)
  assert.ok(intro.endsWith('…'))
})

check('摘录：空输入返回空串', () => {
  assert.equal(extractIntro(''), '')
  assert.equal(extractIntro(undefined), '')
})

check('摘录：链接保留文字、去掉代码块', () => {
  const intro = extractIntro('# T\n\n看 [文档](https://x.com) 即可。\n\n```js\nconst a = 1\n```\n\n## 下一节')
  assert.equal(intro, '看 文档 即可。')
})

check('摘录：可重复调用（正则 lastIndex 不会串味）', () => {
  // HEADING_RE 是 /g，若忘记重置 lastIndex，第二次调用会从中间开始匹配
  const first = extractIntro(README)
  const second = extractIntro(README)
  const third = extractIntro(README)
  assert.equal(first, second)
  assert.equal(second, third)
})

/* ------------------------------------------------------------------- sort */

check('sort：首尾与中间的中点', () => {
  assert.equal(computeSortValue(undefined, undefined), SORT_STEP)
  assert.equal(computeSortValue(undefined, 3000), 2000)
  assert.equal(computeSortValue(1000, 2000), 1500)
  assert.equal(computeSortValue(1000, undefined), 2000)
})

check('sort：间隙耗尽返回 null（触发整组重排）', () => {
  assert.equal(computeSortValue(1000, 1000 + 1e-9), null)
})

check('sort：nextSortValue 取最大值加步长', () => {
  assert.equal(nextSortValue([]), SORT_STEP)
  assert.equal(nextSortValue([{ id: 'a', sort: 1000 }, { id: 'b', sort: 2500 }]), 3500)
})

check('planMove：把最后一项拖到最前，只写这一项', () => {
  const list = [
    { id: 'a', sort: 1000 },
    { id: 'b', sort: 2000 },
    { id: 'c', sort: 3000 },
  ]
  const plan = planMove(list, 'c', 0)
  assert.equal(plan.targetId, 'c')
  assert.equal(plan.sort, 0)
  assert.deepEqual(plan.renumber, [])
})

check('planMove：中间位置取邻居中点', () => {
  const list = [
    { id: 'a', sort: 1000 },
    { id: 'b', sort: 2000 },
    { id: 'c', sort: 3000 },
  ]
  const plan = planMove(list, 'c', 1)
  // a 之后、b 之前 → (1000 + 2000) / 2
  assert.equal(plan.sort, 1500)
})

check('planMove：邻居 sort 相同则整组重排', () => {
  const list = [
    { id: 'a', sort: 1000 },
    { id: 'b', sort: 1000 },
    { id: 'c', sort: 1000 },
  ]
  const plan = planMove(list, 'c', 1)
  assert.equal(plan.sort, null)
  assert.equal(plan.renumber.length, 3)
  assert.deepEqual(
    plan.renumber.map((entry) => entry.sort),
    [SORT_STEP, SORT_STEP * 2, SORT_STEP * 3],
  )
})

check('planMove：目标下标越界会被夹紧', () => {
  const list = [
    { id: 'a', sort: 1000 },
    { id: 'b', sort: 2000 },
  ]
  assert.equal(planMove(list, 'a', 99).sort, 3000)
  assert.equal(planMove(list, 'b', -5).sort, 0)
})

/* ------------------------------------------------------------------ 汇总 */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} 项失败 / 共 ${passed + failures.length} 项\n`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}

console.log(`✓ ${passed} 项全部通过`)
