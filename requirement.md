你是资深前端工程师，基于下面需求开发一套导航站点，技术栈：Vue3 + Vite + TypeScript + TailwindCSS + shadcn-vue + Lucide，后端使用 Supabase 作为BaaS，不要自己写node后端。

## 整体结构
两个模块：【公开前台】【管理员后台 /admin】
- 前台：无需登录，所有人可访问
- 后台：访问 /admin 会跳登录页，只有管理员登录后才能进入，未登录拦截
- 路由：
  / 前台首页
  /admin/login 管理员登录页
  /admin 后台管理主页
- 状态管理：Pinia
- 样式风格参考 claude.com：柔和干净、低对比度配色，支持亮色 / 暗黑模式一键切换，所有组件兼容两套主题

## 数据模型（PocketBase Collections）
### collection: app_group 应用组
fields:
- name: text
- sort: number 排序权重，数字越小越靠前
- created, updated（pocketbase自带）
规则：支持单独页面UI拖拽排序，排序修改后实时保存到PocketBase

### collection: app_item 应用（归属应用组）
fields:
- group: relation -> app_group（必选）
- name: text 应用名称
- git_url: text git仓库地址
- readme_raw: text 拉取回来的README原始内容，最开头大标题下的直到第一个一级标题之间的短介绍，不超过300字。
- hero_icon_name: text 存储heroicon图标名称（如 "rocket"）
- theme_color: text tailwind颜色类，比如 slate-500 / blue-400，低对比度色系
- tags: select 多选，来源全局标签池
- sort: number 组内排序权重，同组内按sort升序展示
- created, updated（pocketbase自带）
规则：同组内应用独立拖拽排序，修改实时保存

### collection: tag_pool 全局标签池
fields:
- name: text，唯一值
作用：编辑应用标签时，下拉选择已有标签；输入新标签自动新增进tag_pool，标签不需要配色

## 前台功能（公开）
布局策略：
- PC：左侧侧边栏展示应用组列表，右侧是当前选中组的应用卡片网格
- 移动端：侧边栏收起，顶部下拉切换应用组，卡片流式网格
功能清单：
1. 数据缓存：前端Pinia做本地缓存，减少请求PocketBase，缓存失效策略简单处理
2. 搜索框：全局搜索，匹配【应用名称】、【标签】，搜索时忽略分组
3. 应用卡片：展示heroicon、主题色装饰、应用名、标签；hover柔和动效
4. 点击卡片：弹出详情弹窗
   - 弹窗内容：图标、名称、标签、git跳转按钮、原始README文本渲染（简单markdown渲染即可，不需要复杂样式）
5. 主题切换按钮：亮色/暗黑切换，状态本地持久化
6. 应用组、应用均按sort字段排序展示

## 后台管理功能（管理员登录后）
1. 登录页：简单账号密码表单，固定管理员账号密码写在环境变量，登录成功存jwt，路由守卫拦截未登录访问，支持记住登录、token过期跳转登录
2. 应用组管理页面
   - 新增、编辑、删除应用组
   - 独立拖拽排序UI，调整顺序后实时保存到PocketBase
3. 应用管理页面
   - 新增 / 编辑 / 删除应用
   - 表单字段：归属应用组下拉、应用名称、git地址、图标选择器、主题色选择、标签
   - 图标选择器：弹窗，检索 Lucide，支持关键词搜索，点击选择图标，只使用内置heroicon，不支持上传自定义图标
   - 主题色选择器：预设低对比度Tailwind色系面板，供选择
   - 标签输入：下拉选择已有标签，也可以输入新标签，新标签自动写入tag_pool
   - 【拉取README按钮】：输入git地址后，点击按钮，前端通过PocketBase的backend代理请求github raw README，拿到原文存入readme_raw；请求失败则readme_raw留空，**禁止调用LLM做摘要总结**
   - 同组应用拖拽排序，实时保存
4. 标签池可以简单预览，不需要单独标签管理页（只在应用编辑里维护标签池）

## UI & 代码规范
1. 组件全部使用 shadcn-vue，<script setup> + TypeScript，类型严格定义
2. 图标统一 Lucide（线性风格）
3. Tailwind配置扩展主题，配色风格对齐 claude.com，低饱和、柔和，暗黑模式不刺眼
4. 拖拽排序使用成熟轻量vue拖拽库，不要造轮子
5. README渲染使用轻量markdown解析，安全处理，防止XSS
6. 代码目录清晰，拆分页面、组件、composables、stores、types
7. 环境变量区分 PocketBase 后端地址
8. 表单校验、loading状态、错误提示、toast提示齐全

## 输出顺序要求
1. 先输出 PocketBase 的3个集合 schema 配置（可以直接在pocketbase后台新建）
2. 项目目录结构
3. 全部TS类型定义
4. Pinia stores（登录状态、应用&分组数据缓存store）
5. 路由配置 + 路由守卫鉴权逻辑
6. 通用 composables（pb请求封装、拉取readme、主题切换、拖拽排序封装）
7. 然后依次实现页面：登录页、后台分组管理、后台应用编辑、前台首页、详情弹窗、图标选择弹窗、颜色选择组件
8. 最后 .env 示例、依赖清单
优先保证基础流程跑通，不要过度增加额外功能。
