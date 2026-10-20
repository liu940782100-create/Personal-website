/* =========================================================
 * 个人网页 · 公共工具函数
 * （数据读取 / i18n 中英切换 / 北京时间时钟 / 白天黑夜主题）
 * 说明：
 *  - 语言、主题选择保存在 localStorage，全站生效
 *  - 主题有三种模式：自动（按北京时间 18:00–06:00 为黑夜）/ 白天 / 黑夜
 *  - 字典只翻译 UI 文案，数据内容（data/*.js）保持原文
 * ========================================================= */

/* ---------- i18n 字典 ---------- */
var I18N = {
  zh: {
    /* 导航与公共 */
    'nav.home': '首页', 'nav.inspiration': '灵感库', 'nav.projects': '项目库',
    'nav.knowledge': '知识库', 'nav.skills': 'Skills',
    'footer.text': '由 AI 自动编程构建 · 数据存于本地 · 持续迭代中',
    'clock.label': '北京时间',
    'theme.auto': '◐ 自动', 'theme.light': '☀ 白天', 'theme.dark': '☾ 黑夜',
    'theme.title.auto': '主题：自动（按北京时间 19:00–06:00 切换黑夜）',
    'theme.title.light': '主题：白天', 'theme.title.dark': '主题：黑夜',
    'title.index': 'Raphael Liu · 首页',
    'title.inspiration': '灵感库 · Raphael Liu',
    'title.projects': '项目库 · Raphael Liu',
    'title.knowledge': '个人知识库 · Raphael Liu',
    'title.skills': 'Skills 方法论 · Raphael Liu',
    'common.empty': '空',
    /* 首页 */
    'index.subtitle': '灵感在这里沉淀，项目在这里推进，知识在这里生长',
    'index.tagline': 'AI 辅助 · 本地存储 · 持续迭代',
    'mod.inspiration.title': '灵感库', 'mod.inspiration.unit': '条灵感',
    'mod.inspiration.desc': '汇集各平台高互动内容，拆解博主的叙事手法，沉淀可迁移的创作技巧。',
    'mod.projects.title': '项目库', 'mod.projects.unit': '个项目',
    'mod.projects.desc': '用 Agent 工作流推进项目：目标澄清 → 调研 → 方案 → 风险 → 执行。',
    'mod.knowledge.title': '个人知识库', 'mod.knowledge.unit': '条知识',
    'mod.knowledge.desc': '记录真正理解的实操知识：条件、做法、后果，让 AI 照出思维盲区。',
    'mod.skills.title': 'Skills', 'mod.skills.unit': '个方法论',
    'mod.skills.desc': '蒸馏书籍中的方法论，变成随取随用的行动指南。',
    'mod.foot': '翻开这一页 →',
    'mod.empty.inspiration': '还没有灵感，把领域发给 AI 即可开始采集',
    'mod.empty.projects': '还没有项目，去项目库用向导立第一个',
    'mod.empty.knowledge': '还没有知识卡片，去知识库录入第一条',
    'mod.empty.skills': '还没有方法论，把书名发给 AI 即可蒸馏',
    /* 灵感库 */
    'insp.head': '灵感库',
    'insp.sub': '汇集财经 / 科技 / 政治 / 军事 / 储能五赛道热点，拆解叙事手法，沉淀可迁移创作技巧',
    'insp.allDomain': '全部赛道',
    'insp.sort.likes': '高互动优先（点赞↓）', 'insp.sort.latest': '最新发布优先',
    'insp.search.ph': '搜索：标题 / 博主 / 内容总结 / 叙事技巧…',
    'insp.count.unit': ' 条',
    'insp.author': '博主：', 'insp.unknown': '未知',
    'insp.likes': '赞', 'insp.comments': '评',
    'insp.published': '发布于 ', 'insp.noSummary': '（暂无内容总结）',
    'insp.expand': '展开叙事手法拆解 ↓', 'insp.collapse': '收起叙事手法拆解 ↑',
    'insp.label.hook': '开头钩子', 'insp.label.structure': '叙事结构',
    'insp.label.emotion': '情绪曲线', 'insp.label.transfer': '可迁移技巧',
    'insp.pending': '（待拆解）', 'insp.otherPlatform': '其他平台', 'insp.noDomain': '未分赛道',
    'insp.empty': '灵感库还是空的，把领域发给 AI 即可开始采集',
    /* 项目库 */
    'proj.head': '项目库',
    'proj.sub': '四个阶段推进项目，门径与产出物随项目状态同步调整',
    'proj.allStage': '全部阶段',
    'proj.stage.idea': '构想', 'proj.stage.design': '设计',
    'proj.stage.execute': '执行', 'proj.stage.review': '复盘',
    'proj.search.ph': '搜索：项目名 / 目标…',
    'proj.count.unit': ' 个项目', 'proj.noGoal': '（未填目标）',
    'proj.wfPrefix': '工作流 ', 'proj.wfStep': ' 步 · 更新于 ', 'proj.updated': '更新于 ',
    'proj.empty.col': '暂无项目', 'proj.stageLabel': '阶段：',
    'proj.step': '步骤', 'proj.output': '产出：',
    'proj.status.done': '完成', 'proj.status.doing': '进行中', 'proj.status.todo': '待开始',
    'proj.noWf': '该项目还没有工作流步骤，把项目发给 AI，即可按类型 × 规模生成裁剪后的流程。',
    'proj.deliver': '产出物清单',
    /* 知识库 */
    'kn.head': '个人知识库',
    'kn.sub': '记录真正理解的实操知识：写清条件与后果，让 AI 照出思维盲区',
    'kn.form.title': '新增知识卡片',
    'kn.form.sub': '带 <span style="color:#e5534b">*</span> 为必填项，缺一不能提交。新录入的卡片先保存在本地（浏览器），可通过下方"导出"交给 AI 写回数据文件。',
    'kn.label.title': '知识标题 <span class="req">*</span>',
    'kn.label.domain': '领域',
    'kn.label.condition': '适用条件 <span class="req">*</span>（在什么情况下成立）',
    'kn.label.action': '具体做法 <span class="req">*</span>',
    'kn.label.consequence': '这样做的后果 <span class="req">*</span>（收益 / 会发生什么）',
    'kn.label.counterfactual': '不这么做的后果 <span class="req">*</span>',
    'kn.label.evidence': '我的实践证据 <span class="req">*</span>（亲身经历记录）',
    'kn.label.confidence': '置信度',
    'kn.conf.pending': '待验证', 'kn.conf.verified': '已验证',
    'kn.ph.title': '一句话概括这条知识',
    'kn.ph.domain': '如：沟通 / 投资 / 健康（可留空）',
    'kn.ph.condition': '例：当对方情绪激动、且议题不涉及原则问题时',
    'kn.ph.action': '例：先复述对方观点，确认理解后再表达自己',
    'kn.ph.consequence': '例：对方感到被尊重，沟通效率显著提升',
    'kn.ph.counterfactual': '例：直接反驳会激起防御心理，议题被搁置',
    'kn.ph.evidence': '例：上周项目评审会上用过一次，对方当场软化立场',
    'kn.save': '保存卡片',
    'kn.form.tip': '必填：标题 / 条件 / 做法 / 后果 / 不做的后果 / 实践证据',
    'kn.req.title': '标题', 'kn.req.condition': '适用条件', 'kn.req.action': '具体做法',
    'kn.req.consequence': '这样做的后果', 'kn.req.counterfactual': '不这么做的后果',
    'kn.req.evidence': '实践证据',
    'kn.errPrefix': '以下必填项为空：',
    'kn.allDomain': '全部领域', 'kn.allConf': '全部置信度',
    'kn.search.ph': '搜索：标题 / 条件 / 做法 / 后果 / 证据…',
    'kn.exportData': '导出全部数据', 'kn.exportReview': '导出思维记录',
    'kn.count.unit': ' 条',
    'kn.empty': '还没有知识卡片，从上方表单录入第一条吧',
    'kn.localBadge': '本地未写回', 'kn.updated': '更新于 ', 'kn.delete': '删除',
    'kn.item.condition': '适用条件', 'kn.item.action': '具体做法',
    'kn.item.consequence': '这样做的后果', 'kn.item.counterfactual': '不这么做的后果',
    'kn.item.evidence': '我的实践证据',
    'kn.uncategorized': '未分类',
    'kn.review.title': '待点评思维记录（把想法发给 AI，对照本卡片检查思维盲区）',
    'kn.review.ph': '针对这条知识，我最近的想法 / 决策是……',
    'kn.review.save': '记录',
    'kn.toast.reviewSaved': '思维记录已保存',
    'kn.toast.saved': '已保存到本地，记得"导出全部数据"交给 AI 写回',
    'kn.toast.exported': '已导出，把内容粘贴进 data/knowledge.js 即可',
    'kn.toast.noReview': '暂无思维记录',
    'kn.toast.reviewExported': '思维记录已导出，发给 AI 即可获得点评',
    'kn.toast.deleted': '卡片已删除',
    'kn.toast.undo': '撤销',
    'kn.toast.undone': '已恢复该卡片',
    'kn.export.header': '【待 AI 点评的思维记录】导出时间：',
    /* 灵感库 · 本地新增 */
    'insp.form.show': '＋ 记一条灵感', 'insp.form.hide': '收起表单',
    'insp.form.title': '手动记一条灵感',
    'insp.form.hint': '刷到的抖音/公众号好内容在这里手动记录，导出 JSON 放进仓库 inbox/ 文件夹，下一轮采集会自动拆解并入正式数据。',
    'insp.label.platform': '平台',
    'insp.label.title': '标题 *', 'insp.label.author': '博主（可空）',
    'insp.label.domain': '赛道（可空）', 'insp.label.summary': '内容总结 *',
    'insp.label.link': '原文链接（可空）', 'insp.viewOriginal': '查看原内容 ↗',
    'insp.label.transfer': '可迁移技巧（每行一条，可空）',
    'insp.save': '保存灵感', 'insp.err': '标题和内容总结必须填写',
    'insp.toast.saved': '灵感已存到本地', 'insp.export': '导出本地灵感',
    'insp.toast.exported': '已导出，发给 AI 做拆解并写回数据文件',
    'insp.toast.noLocal': '还没有本地灵感', 'insp.localBadge': '本地',
    'insp.refresh': '更新',
    'insp.updating': '更新中',
    'insp.token.title': '设置 GitHub 令牌',
    'insp.token.hint': '「更新」按钮通过 GitHub API 触发云端采集（Actions），需要一个仅限本仓库、具备 Actions 读写权限的令牌。令牌只保存在本机浏览器，不会写入公开代码库；未设置时点「更新」会自动弹出本面板。',
    'insp.token.label': '令牌',
    'insp.token.save': '保存令牌',
    'insp.token.clear': '清除令牌',
    'insp.token.saved': '令牌已保存到本机浏览器',
    'insp.token.cleared': '令牌已清除',
    'insp.toast.noToken': '请先设置 GitHub 令牌',
    'insp.toast.updating': '已触发采集，正在等待结果…',
    'insp.toast.done': '采集完成，本轮新增 {n} 条',
    'insp.toast.noNew': '采集已完成，本轮可能无新增内容',
    'insp.toast.triggerFail': '触发失败：{msg}',
    'insp.toast.badToken': '令牌无效或无权限，请重新设置',
    'insp.toast.runFailed': '采集任务执行失败，请稍后重试',
    'insp.meta': '数据更新于 {date} · 本轮新增 {n} 条 · 手动触发更新',
    'insp.like': '备档', 'insp.liked': '已备档',
    'insp.toast.liked': '已点赞，已转入项目库备档', 'insp.toast.unliked': '已取消备档',
    /* Skills · 本地新增 */
    'sk.form.show': '＋ 记一条方法论', 'sk.form.hide': '收起表单',
    'sk.form.title': '手动记一条方法论',
    'sk.form.hint': '新方法论先存本地（浏览器）。点「导出本地方法论」把内容发给 AI 校对并写回 data/skills.js。',
    'sk.label.book': '书名（可空）', 'sk.label.method': '方法论名 *',
    'sk.label.core': '核心思想 *', 'sk.label.steps': '操作步骤（每行一条，可空）',
    'sk.label.applicable': '适用场景（每行一条，可空）',
    'sk.label.misuse': '误用场景（每行一条，可空）',
    'sk.save': '保存方法论', 'sk.err': '方法论名和核心思想必须填写',
    'sk.toast.saved': '方法论已存到本地', 'sk.export': '导出本地方法论',
    'sk.toast.exported': '已导出，发给 AI 校对并写回数据文件',
    'sk.toast.noLocal': '还没有本地方法论', 'sk.localBadge': '本地',
    /* Skills */
    'sk.head': 'Skills 方法论',
    'sk.sub': '蒸馏书籍中的方法论，变成随取随用的行动指南',
    'sk.allBooks': '全部书籍',
    'sk.search.ph': '搜索：方法论 / 核心思想 / 步骤 / 场景…',
    'sk.count.unit': ' 个方法论',
    'sk.steps': '操作步骤', 'sk.scenarios': '适用场景',
    'sk.misuse': '常见误用', 'sk.linked': '关联知识卡片',
    'sk.notFound': '（未找到）', 'sk.noBook': '未分册',
    'sk.empty': '还没有方法论，把书名发给 AI 即可蒸馏'
  },
  en: {
    /* Nav & shared */
    'nav.home': 'Home', 'nav.inspiration': 'Inspiration', 'nav.projects': 'Projects',
    'nav.knowledge': 'Knowledge', 'nav.skills': 'Skills',
    'footer.text': 'Built with AI pair-programming · Data stored locally · Iterating',
    'clock.label': 'Beijing',
    'theme.auto': '◐ Auto', 'theme.light': '☀ Light', 'theme.dark': '☾ Dark',
    'theme.title.auto': 'Theme: Auto (dark from 19:00 to 06:00 Beijing time)',
    'theme.title.light': 'Theme: Light', 'theme.title.dark': 'Theme: Dark',
    'title.index': 'Raphael Liu · Home',
    'title.inspiration': 'Inspiration · Raphael Liu',
    'title.projects': 'Projects · Raphael Liu',
    'title.knowledge': 'Knowledge Base · Raphael Liu',
    'title.skills': 'Skills · Raphael Liu',
    'common.empty': '∅',
    /* Home */
    'index.subtitle': 'Ideas settle here, projects advance here, knowledge grows here',
    'index.tagline': 'AI-assisted · Local storage · Iterating',
    'mod.inspiration.title': 'Inspiration', 'mod.inspiration.unit': ' ideas',
    'mod.inspiration.desc': 'A curated feed of high-engagement content, deconstructing narrative techniques and distilling transferable skills.',
    'mod.projects.title': 'Projects', 'mod.projects.unit': ' projects',
    'mod.projects.desc': 'Advance projects with an Agent workflow: clarify → research → plan → risk → execute.',
    'mod.knowledge.title': 'Knowledge Base', 'mod.knowledge.unit': ' notes',
    'mod.knowledge.desc': 'Practical knowledge I truly understand: conditions, actions, outcomes — letting the AI reveal blind spots.',
    'mod.skills.title': 'Skills', 'mod.skills.unit': ' methods',
    'mod.skills.desc': 'Methodologies distilled from books, ready to use.',
    'mod.foot': 'Open this page →',
    'mod.empty.inspiration': 'Nothing yet — send a domain to the AI to start collecting',
    'mod.empty.projects': 'Nothing yet — kick off your first project in Projects',
    'mod.empty.knowledge': 'Nothing yet — record your first knowledge card',
    'mod.empty.skills': 'Nothing yet — send a book title to the AI to distill',
    /* Inspiration */
    'insp.head': 'Inspiration',
    'insp.sub': 'Hot topics across five tracks — finance, tech, politics, military and energy storage — with narrative deconstruction and transferable skills',
    'insp.allDomain': 'All tracks',
    'insp.sort.likes': 'Most engagement first (likes ↓)', 'insp.sort.latest': 'Newest published first',
    'insp.search.ph': 'Search: title / creator / summary / narrative techniques…',
    'insp.count.unit': ' items',
    'insp.author': 'Creator: ', 'insp.unknown': 'unknown',
    'insp.likes': 'Likes', 'insp.comments': 'Comments',
    'insp.published': 'Published ', 'insp.noSummary': '(No summary yet)',
    'insp.expand': 'Show narrative analysis ↓', 'insp.collapse': 'Hide narrative analysis ↑',
    'insp.label.hook': 'Hook', 'insp.label.structure': 'Structure',
    'insp.label.emotion': 'Emotion curve', 'insp.label.transfer': 'Transferable techniques',
    'insp.pending': '(To be analyzed)', 'insp.otherPlatform': 'Other', 'insp.noDomain': 'Uncategorized',
    'insp.empty': 'The inspiration library is empty — send a topic to the AI to start collecting',
    /* Projects */
    'proj.head': 'Projects',
    'proj.sub': 'Move projects through four stages; gates and deliverables adjust with project status',
    'proj.allStage': 'All stages',
    'proj.stage.idea': 'Ideation', 'proj.stage.design': 'Design',
    'proj.stage.execute': 'Execution', 'proj.stage.review': 'Review',
    'proj.search.ph': 'Search: project / goal…',
    'proj.count.unit': ' projects', 'proj.noGoal': '(No goal set)',
    'proj.wfPrefix': 'Workflow ', 'proj.wfStep': ' steps · updated ', 'proj.updated': 'Updated ',
    'proj.empty.col': 'No projects', 'proj.stageLabel': 'Stage: ',
    'proj.step': 'Step', 'proj.output': 'Output: ',
    'proj.status.done': 'Done', 'proj.status.doing': 'In progress', 'proj.status.todo': 'Not started',
    'proj.noWf': 'No workflow yet. Send the project to the AI to generate a tailored process by type x scale.',
    'proj.deliver': 'Deliverables',
    /* Knowledge */
    'kn.head': 'Knowledge Base',
    'kn.sub': 'Practical knowledge I truly understand: conditions, actions and outcomes — let the AI reveal my blind spots',
    'kn.form.title': 'New Knowledge Card',
    'kn.form.sub': 'Fields marked <span style="color:#e5534b">*</span> are required. New cards are first stored locally (in the browser); use "Export" below to hand them to the AI for writing back.',
    'kn.label.title': 'Title <span class="req">*</span>',
    'kn.label.domain': 'Domain',
    'kn.label.condition': 'Applicable condition <span class="req">*</span> (when does it hold)',
    'kn.label.action': 'What to do <span class="req">*</span>',
    'kn.label.consequence': 'Outcome if done <span class="req">*</span> (benefit / what happens)',
    'kn.label.counterfactual': 'Outcome if not done <span class="req">*</span>',
    'kn.label.evidence': 'My evidence <span class="req">*</span> (firsthand records)',
    'kn.label.confidence': 'Confidence',
    'kn.conf.pending': 'To verify', 'kn.conf.verified': 'Verified',
    'kn.ph.title': 'Summarize this knowledge in one sentence',
    'kn.ph.domain': 'e.g. Communication / Investing / Health (optional)',
    'kn.ph.condition': 'e.g. When the other person is emotional and no principles are at stake',
    'kn.ph.action': 'e.g. Restate their point first, then share your own view',
    'kn.ph.consequence': 'e.g. They feel respected and communication improves noticeably',
    'kn.ph.counterfactual': 'e.g. A direct rebuttal triggers defensiveness and stalls the topic',
    'kn.ph.evidence': 'e.g. Used it once in last week’s project review — they softened on the spot',
    'kn.save': 'Save Card',
    'kn.form.tip': 'Required: title / condition / action / outcome / counter-outcome / evidence',
    'kn.req.title': 'title', 'kn.req.condition': 'condition', 'kn.req.action': 'action',
    'kn.req.consequence': 'outcome', 'kn.req.counterfactual': 'counter-outcome',
    'kn.req.evidence': 'evidence',
    'kn.errPrefix': 'Missing required fields: ',
    'kn.allDomain': 'All domains', 'kn.allConf': 'All confidence',
    'kn.search.ph': 'Search: title / condition / action / outcome / evidence…',
    'kn.exportData': 'Export all data', 'kn.exportReview': 'Export reflections',
    'kn.count.unit': ' notes',
    'kn.empty': 'No cards yet — add the first one with the form above',
    'kn.localBadge': 'Local only', 'kn.updated': 'Updated ', 'kn.delete': 'Delete',
    'kn.item.condition': 'Condition', 'kn.item.action': 'Action',
    'kn.item.consequence': 'Outcome if done', 'kn.item.counterfactual': 'Outcome if not done',
    'kn.item.evidence': 'My evidence',
    'kn.uncategorized': 'Uncategorized',
    'kn.review.title': 'Reflections for AI review (send them to the AI to check blind spots against this card)',
    'kn.review.ph': 'My recent thoughts / decisions regarding this knowledge…',
    'kn.review.save': 'Log',
    'kn.toast.reviewSaved': 'Reflection saved',
    'kn.toast.saved': 'Saved locally — remember to "Export all data" so the AI can write it back',
    'kn.toast.exported': 'Exported — paste the content into data/knowledge.js',
    'kn.toast.noReview': 'No reflections yet',
    'kn.toast.reviewExported': 'Reflections exported — send them to the AI for review',
    'kn.toast.deleted': 'Card deleted',
    'kn.toast.undo': 'Undo',
    'kn.toast.undone': 'Card restored',
    'kn.export.header': '[Reflections for AI review] Exported: ',
    /* Inspiration · local entries */
    'insp.form.show': '＋ Log an inspiration', 'insp.form.hide': 'Hide form',
    'insp.form.title': 'Log an inspiration manually',
    'insp.form.hint': 'Log great Douyin/WeChat content here. Export the JSON into the repo inbox/ folder — the next pipeline run will analyse and merge it.',
    'insp.label.platform': 'Platform',
    'insp.label.title': 'Title *', 'insp.label.author': 'Creator (optional)',
    'insp.label.domain': 'Track (optional)', 'insp.label.summary': 'Summary *',
    'insp.label.link': 'Original link (optional)', 'insp.viewOriginal': 'View original ↗',
    'insp.label.transfer': 'Transferable techniques (one per line, optional)',
    'insp.save': 'Save', 'insp.err': 'Title and summary are required',
    'insp.toast.saved': 'Inspiration saved locally', 'insp.export': 'Export local',
    'insp.toast.exported': 'Exported — send it to the AI to analyse and write back',
    'insp.toast.noLocal': 'No local inspirations yet', 'insp.localBadge': 'Local',
    'insp.refresh': 'Update',
    'insp.updating': 'Updating',
    'insp.token.title': 'GitHub token',
    'insp.token.hint': 'The Update button triggers the cloud pipeline (GitHub Actions) via the GitHub API. It needs a token scoped to this repo with Actions read/write. The token is kept only in this browser and never written to the public repo; this panel opens automatically if none is set.',
    'insp.token.label': 'Token',
    'insp.token.save': 'Save token',
    'insp.token.clear': 'Clear token',
    'insp.token.saved': 'Token saved in this browser',
    'insp.token.cleared': 'Token cleared',
    'insp.toast.noToken': 'Set a GitHub token first',
    'insp.toast.updating': 'Fetch triggered — waiting for results…',
    'insp.toast.done': 'Done — {n} new items this round',
    'insp.toast.noNew': 'Done — possibly no new items this round',
    'insp.toast.triggerFail': 'Trigger failed: {msg}',
    'insp.toast.badToken': 'Invalid token or missing permission — set it again',
    'insp.toast.runFailed': 'The fetch run failed — try again later',
    'insp.meta': 'Updated {date} · +{n} this round · manual updates',
    'insp.like': 'Archive', 'insp.liked': 'Archived',
    'insp.toast.liked': 'Liked and saved to Projects', 'insp.toast.unliked': 'Removed from Projects',
    /* Skills · local entries */
    'sk.form.show': '＋ Log a method', 'sk.form.hide': 'Hide form',
    'sk.form.title': 'Log a method manually',
    'sk.form.hint': 'Saved in this browser first. Use "Export local" and send the file to the AI to verify and write back to data/skills.js.',
    'sk.label.book': 'Book (optional)', 'sk.label.method': 'Method name *',
    'sk.label.core': 'Core idea *', 'sk.label.steps': 'Steps (one per line, optional)',
    'sk.label.applicable': 'Where it applies (one per line, optional)',
    'sk.label.misuse': 'Where it backfires (one per line, optional)',
    'sk.save': 'Save', 'sk.err': 'Method name and core idea are required',
    'sk.toast.saved': 'Method saved locally', 'sk.export': 'Export local',
    'sk.toast.exported': 'Exported — send it to the AI to verify and write back',
    'sk.toast.noLocal': 'No local methods yet', 'sk.localBadge': 'Local',
    /* Skills */
    'sk.head': 'Skills',
    'sk.sub': 'Methodologies distilled from books, ready to use',
    'sk.allBooks': 'All books',
    'sk.search.ph': 'Search: method / core idea / steps / scenarios…',
    'sk.count.unit': ' methods',
    'sk.steps': 'Steps', 'sk.scenarios': 'Where it applies',
    'sk.misuse': 'Common misuse', 'sk.linked': 'Linked cards',
    'sk.notFound': ' (not found)', 'sk.noBook': 'Unsorted',
    'sk.empty': 'No methods yet — send a book title to the AI to distill'
  }
};

/* ---------- 语言（中英切换） ---------- */
var LANG_KEY = 'site_lang';

function getLang() {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; }
  catch (e) { return 'zh'; }
}

/** 取词条；缺省回退中文，再缺省返回 key 本身 */
function t(key) {
  var lang = getLang();
  if (I18N[lang] && I18N[lang][key] != null) return I18N[lang][key];
  if (I18N.zh[key] != null) return I18N.zh[key];
  return key;
}

function toggleLang() {
  try { localStorage.setItem(LANG_KEY, getLang() === 'zh' ? 'en' : 'zh'); } catch (e) {}
  rerenderLang();
}

/** 切语言后整页无刷新重渲染：导航/页脚/静态词条/主题钮/时钟，再广播 langchange 让页面重渲染动态内容 */
function rerenderLang() {
  var navEl = document.getElementById('nav');
  if (navEl) navEl.innerHTML = renderNav();
  var footerEl = document.getElementById('footer');
  if (footerEl) footerEl.innerHTML = renderFooter();
  applyI18n();
  applyTheme();
  tickClock();
  document.dispatchEvent(new CustomEvent('langchange'));
}

/** 翻译静态元素：data-i18n 替换 innerHTML，data-i18n-ph 替换 placeholder */
function applyI18n() {
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) els[i].innerHTML = t(els[i].getAttribute('data-i18n'));
  var phs = document.querySelectorAll('[data-i18n-ph]');
  for (var j = 0; j < phs.length; j++) phs[j].placeholder = t(phs[j].getAttribute('data-i18n-ph'));
  var page = document.body.getAttribute('data-page');
  if (page) document.title = t('title.' + page);
  document.documentElement.setAttribute('lang', getLang() === 'en' ? 'en' : 'zh-CN');
}
document.addEventListener('DOMContentLoaded', applyI18n);

/* ---------- 北京时间（UTC+8，与访问者本地时区无关） ---------- */
function beijingNow() {
  var d = new Date();
  return new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }

function tickClock() {
  var el = document.getElementById('navClock');
  if (!el) return;
  var d = beijingNow();
  /* 中文：2026年9月3日 23:30:47；英文：2026-09-03 23:30:47 */
  var dateStr = getLang() === 'en'
    ? d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  el.textContent = t('clock.label') + ' ' + dateStr + ' ' +
    pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}
document.addEventListener('DOMContentLoaded', tickClock);

/* ---------- 主题：白天 / 黑夜 / 自动（按北京时间 19:00–06:00 为黑夜） ---------- */
var THEME_KEY = 'site_theme';

function getThemeMode() {
  try {
    var v = localStorage.getItem(THEME_KEY);
    return (v === 'light' || v === 'dark') ? v : 'auto';
  } catch (e) { return 'auto'; }
}

function beijingHour() { return beijingNow().getHours(); }

function isNightByBeijing() {
  var h = beijingHour();
  return h >= 19 || h < 6;
}

function applyTheme() {
  var mode = getThemeMode();
  var dark = mode === 'dark' || (mode === 'auto' && isNightByBeijing());
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.setAttribute('data-theme-mode', mode);
  var btn = document.getElementById('themeBtn');
  if (btn) {
    btn.innerHTML = t('theme.' + mode);
    btn.title = t('theme.title.' + mode);
  }
}

/** 循环切换：自动 → 白天 → 黑夜 → 自动 */
function cycleTheme() {
  var order = ['auto', 'light', 'dark'];
  var next = order[(order.indexOf(getThemeMode()) + 1) % order.length];
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  applyTheme();
}

/* app.js 在 head 中同步加载，首屏渲染前即套用主题，避免闪白 */
applyTheme();

/* 每秒：刷新时钟；自动模式下到达边界时间即时切换昼夜 */
setInterval(function () {
  tickClock();
  if (getThemeMode() === 'auto') applyTheme();
}, 1000);

/* =========================================================
 * 弹窗公共助手（.modal-mask 容器）
 *  - openModal：记录触发焦点 → 显示 → 焦点移入首个表单控件
 *  - closeModal：隐藏 → 焦点还原到触发元素
 *  - ESC 统一关闭当前打开的弹窗
 * 页面侧弹窗内容容器请加 role="dialog" aria-modal="true"
 * ========================================================= */
var MODAL_STATE = {};

function openModal(maskEl) {
  if (!maskEl) return;
  MODAL_STATE[maskEl.id] = document.activeElement;
  maskEl.classList.add('show');
  var target = maskEl.querySelector('input[type="text"], textarea, select, button');
  if (target) target.focus();
}

function closeModal(maskEl) {
  if (!maskEl) return;
  maskEl.classList.remove('show');
  var last = MODAL_STATE[maskEl.id];
  delete MODAL_STATE[maskEl.id];
  if (last && typeof last.focus === 'function') last.focus();
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var open = document.querySelectorAll('.modal-mask.show');
  for (var i = 0; i < open.length; i++) closeModal(open[i]);
});

/* =========================================================
 * 数据与渲染工具（原有能力）
 * ========================================================= */

/** 读取模块数据（容错：数据文件未加载时返回空数组） */
function getData(name) {
  var map = {
    inspiration: window.DATA_INSPIRATION,
    projects: window.DATA_PROJECTS,
    knowledge: window.DATA_KNOWLEDGE,
    skills: window.DATA_SKILLS
  };
  return Array.isArray(map[name]) ? map[name] : [];
}

/** HTML 转义，防止数据内容破坏页面结构 */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 数字格式化：中文 1.2万，英文 1.2k */
function fmtNum(n) {
  n = Number(n) || 0;
  if (getLang() === 'en') {
    return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
  }
  return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + ' 万' : String(n);
}

/** 关键词匹配（多字段，忽略大小写） */
function matchKeyword(item, kw, fields) {
  if (!kw) return true;
  kw = kw.toLowerCase();
  return fields.some(function (f) {
    var v = f.split('.').reduce(function (o, k) { return o && o[k]; }, item);
    if (Array.isArray(v)) v = v.join(' ');
    return String(v || '').toLowerCase().indexOf(kw) >= 0;
  });
}

/** 构建顶部导航（含北京时间、中英切换、昼夜主题三个工具）；activePage 缺省时按当前路径推断 */
function renderNav(activePage) {
  if (!activePage) activePage = location.pathname.split('/').pop() || 'index.html';
  var links = [
    ['index.html', t('nav.home')],
    ['inspiration.html', t('nav.inspiration')],
    ['projects.html', t('nav.projects')],
    ['knowledge.html', t('nav.knowledge')],
    ['skills.html', t('nav.skills')]
  ];
  var mode = getThemeMode();
  return '<header class="site-header"><div class="container">' +
    '<a class="site-logo" href="index.html">Hello, Raphael Liu!</a>' +
    '<div class="nav-right">' +
      '<nav class="site-nav">' +
        links.map(function (l) {
          var cls = l[0] === activePage ? ' class="active" aria-current="page"' : '';
          return '<a href="' + l[0] + '"' + cls + '>' + l[1] + '</a>';
        }).join('') +
      '</nav>' +
      '<div class="nav-tools">' +
        '<span class="nav-clock" id="navClock" title="UTC+8">--:--:--</span>' +
        '<button type="button" class="nav-tool-btn" id="langBtn" onclick="toggleLang()" title="中文 / English">' +
          (getLang() === 'zh' ? 'EN' : '中文') + '</button>' +
        '<button type="button" class="nav-tool-btn" id="themeBtn" onclick="cycleTheme()" title="' +
          t('theme.title.' + mode) + '">' + t('theme.' + mode) + '</button>' +
      '</div>' +
    '</div>' +
  '</div></header>';
}

/** 构建页脚 */
function renderFooter() {
  return '<footer class="site-footer">' + t('footer.text') + '</footer>';
}
