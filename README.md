# Raphael Liu 的第二大脑（个人网页）

平板手书风的个人知识站点：纸面质感 + 墨线 + 手写字体。纯静态、无构建、无后端，数据全部在本地。

## 页面

| 页面 | 文件 | 作用 |
|---|---|---|
| 首页 | `index.html` | 四个模块入口卡（计数 = 数据文件 + 本地新增） |
| 灵感库 | `inspiration.html` | 各平台高互动内容的叙事手法拆解 |
| 项目库 | `projects.html` | 四阶段看板 + 工作流步骤 + 门径 + 产出物 |
| 知识库 | `knowledge.html` | 实操知识卡片（条件/做法/后果/证据）+ 思维记录 |
| Skills | `skills.html` | 从书籍蒸馏的方法论，按书分组 |

## 本地使用

任选其一：

- 直接双击 `index.html`（数据走 JS 全局变量，`file://` 可用）
- 或在站点目录起个静态服务：`python -m http.server 8765`，访问 `http://127.0.0.1:8765/`

全站可离线运行：字体已自托管在 `assets/fonts/`（Caveat / Long Cang / Ma Shan Zheng / LXGW WenKai，woff2 分片按需加载），无任何 CDN 依赖。

## 数据工作流（重要）

数据分两层：

1. **数据文件**：`data/*.js`，页面加载时渲染的正式内容
2. **本地新增**：页面上手动录入的内容先存浏览器 localStorage，卡片带「本地」徽章

写回正式数据的流程：

1. 在对应页面点「导出」（灵感 / 知识 / Skills / 项目均有导出按钮），得到一个 JSON 文件
2. 把 JSON 发给 AI，让它整理并写回对应的 `data/*.js`
3. 写回后清掉 localStorage 里已写回的条目，避免重复计数

localStorage 键一览：

| 键 | 内容 |
|---|---|
| `rl_insp_local_v1` | 灵感库本地新增 |
| `rl_projects_local_v1` / `rl_proj_files_v1` / `rl_proj_analysis_v1` | 项目库本地新增 / 文件 / 分析 |
| `qianwen_kb_cards_v1` / `qianwen_kb_reviews_v1` | 知识库本地卡片 / 思维记录 |
| `rl_skills_local_v1` | Skills 本地新增 |
| `site_lang` / `site_theme` | 语言（zh/en）/ 主题（auto/light/dark） |

## 功能说明

- **中英双语**：导航右上角 `EN/中文` 按钮，无刷新切换，选择记忆在本地
- **昼夜主题**：`◐ 自动`（按北京时间 19:00–06:00 切黑夜）/ `☀ 白天` / `☾ 黑夜` 循环
- **可访问性**：全站键盘可达（Tab + Enter/Space），`:focus-visible` 红笔圈，尊重 `prefers-reduced-motion`
- **表单**：必填项缺失时红笔虚线圈出并滚动聚焦；删除类操作先执行、toast 内 6 秒可撤销

## 技术栈

- 原生 HTML/CSS/JS，无框架无构建
- `assets/app.js`：公共 i18n 字典、`t()`/`L()`、主题、时钟、弹窗、渲染工具
- `assets/style.css`：全站样式（手书风设计令牌 + 各页样式）
- `assets/favicon.svg`：手绘风站点图标
