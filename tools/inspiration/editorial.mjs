/**
 * 编辑层（AIHOT editorial 的简化版）：
 * 候选过滤（赛道关键词 / 时效 / 已收录）→ LLM 打分（单门槛 60）→ 视频优先配额 → 正文摘要补全 → 叙事拆解。
 * 视频（B站账号本身即筛选条件）不参与打分门槛，直接按发布时间排序优先占位。
 */
import { canonicalUrl, isFresh, dateFromHtml, toSimp } from './normalize.mjs';
import { getText } from './http.mjs';
import { llmChat } from './llm.mjs';

const SCORE_PASS = 60;

export const isVideo = x =>
  String(x.platform || '') === 'B站' || /bilibili\.com/.test(String(x.url || ''));

const pubKey = x => String(x.date || '');

/** 赛道候选池：关键词 + 时效 + 已收录标题/网址过滤，赛道内按 URL/标题判重 */
export function candidatesForTrack(track, poolOf, { existingTitles, existingUrls }) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const id of track.sources) {
    for (const x of poolOf[id] || []) {
      if (!x.title || !x.url) continue;
      const title = x.title.trim();
      /* 境外源多为繁体，先转简体再匹配关键词；英文关键词忽略大小写 */
      const norm = toSimp(title).toLowerCase();
      if (!x.allPass && !track.keywords.some(w => norm.includes(w.toLowerCase()))) continue;
      if (!isFresh(x.date)) continue;
      if (existingTitles.has(title)) continue;
      const u = canonicalUrl(x.url);
      if (existingUrls.has(u)) continue;
      if (seenUrl.has(u) || seenTitle.has(title)) continue;
      seenUrl.add(u);
      seenTitle.add(title);
      out.push(x);
    }
  }
  return out;
}

/**
 * 赛道取稿：视频先占名额，图文按「分数 ≥ 60 → 全量回填」的顺序补足。
 * claimed 为跨赛道共享集合，保证同一条内容只归属一个赛道。
 */
export function selectTrack({ candidates, quota, claimed, maxVideos }) {
  const fresh = candidates.filter(x => !claimed.has(x.title.trim()));

  const videos = fresh.filter(isVideo)
    .sort((a, b) => pubKey(b).localeCompare(pubKey(a)) || (b.priority || 0) - (a.priority || 0));

  const texts = fresh.filter(x => !isVideo(x));
  const scoreOf = x => (typeof x.score === 'number' ? x.score : 60);
  const byScore = (a, b) =>
    scoreOf(b) - scoreOf(a) || pubKey(b).localeCompare(pubKey(a)) || (b.priority || 0) - (a.priority || 0);
  const passed = texts.filter(x => scoreOf(x) >= SCORE_PASS).sort(byScore);
  const rest = texts.filter(x => scoreOf(x) < SCORE_PASS).sort(byScore);

  /* 视频先占名额（赛道可用 maxVideos 压低上限，给图文留位置）；图文按「及格优先 → 分数 → 发布日期」补足，并限制单信源条数，保留多源混排 */
  const perSourceCap = Math.max(3, Math.ceil(quota / 3));
  const videoCap = Math.min(quota, maxVideos > 0 ? maxVideos : quota);
  const picked = videos.slice(0, videoCap);
  const counts = {};
  const queue = [...passed, ...rest];
  for (const x of queue) {
    if (picked.length >= quota) break;
    const src = x.source || x.platform || '其他';
    if ((counts[src] || 0) >= perSourceCap) continue;
    counts[src] = (counts[src] || 0) + 1;
    picked.push(x);
  }
  /* 信源不足时放开限制回填，保证配额尽量打满 */
  if (picked.length < quota) {
    for (const x of queue) {
      if (picked.length >= quota) break;
      if (!picked.includes(x)) picked.push(x);
    }
  }
  /* 图文仍不足时才让视频突破上限，避免赛道留空 */
  if (picked.length < quota) {
    for (const x of videos.slice(videoCap)) {
      if (picked.length >= quota) break;
      picked.push(x);
    }
  }

  for (const x of picked) claimed.add(x.title.trim());
  return picked;
}

/** 批量打分（0-100），只依据标题与摘要，不输出链接；失败后隔 3s 重试一次，避免瞬时网络抖动让整赛道退回默认分 */
export async function scoreItems(cfg, items, limit = 60) {
  const batch = items.slice(0, limit);
  if (!batch.length) return;
  const rows = batch.map((x, i) => ({ i, title: x.title, desc: String(x.desc || '').slice(0, 120) }));
  const prompt = [
    '你是内容主编，为「个人灵感库」筛选值得学习叙事与选题的内容。',
    '对每条按「信息密度 / 时效性 / 可迁移价值」综合打分 0-100（60 分及格），只输出 JSON 数组：',
    '[{"i":0,"score":82}]，不要任何多余文字。',
    '条目：' + JSON.stringify(rows)
  ].join('\n');
  const msgs = [
    { role: 'system', content: '只输出 JSON 数组，不要 markdown 代码块标记。' },
    { role: 'user', content: prompt }
  ];
  let text = null, lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { text = await llmChat(cfg, msgs, 120000); break; }
    catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (text == null) throw lastErr;
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('打分输出无 JSON 数组');
  const byIndex = new Map();
  for (const row of JSON.parse(m[0])) {
    const i = Number(row.i), s = Number(row.score);
    if (Number.isInteger(i) && Number.isFinite(s)) byIndex.set(i, Math.max(0, Math.min(100, s)));
  }
  batch.forEach((x, i) => { x.score = byIndex.has(i) ? byIndex.get(i) : SCORE_PASS; });
  for (const x of items.slice(limit)) x.score = SCORE_PASS;
}

/** 正文摘要补全 + 发布时间回填：列表页缺 desc / 缺日期时取原文页 meta（不编造） */
export async function enrichDescription(item) {
  const needDesc = !item.desc || item.desc.length <= 40;
  const needDate = !item.date;
  if (!needDesc && !needDate) return item;
  try {
    const html = await getText(item.url, { timeoutMs: 12000 });
    if (needDesc) {
      const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,400})["']/i)
        || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,400})["']/i)
        || html.match(/<meta[^>]+content=["']([^"']{20,400})["'][^>]+name=["']description["']/i);
      if (m) item.desc = m[1].replace(/&quot;|&#34;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    }
    if (needDate) {
      const d = dateFromHtml(html);
      if (d) item.date = d;
    }
  } catch { /* 补全失败不致命 */ }
  return item;
}

/** 拆解一批内容：AI 只输出文字分析，不输出链接（链接由调用方从抓取结果绑定） */
export async function analyseBatch(cfg, items, track) {
  const prompt = [
    `你是内容运营专家。下面是「${track}」赛道的内容条目（JSON 数组，含 title/desc）。`,
    '对每一条输出一个 JSON 对象，最后只输出一个 JSON 数组，不要多余文字。字段：',
    '- summary: 80字内精简总结这条内容的核心信息（说清发生了什么、关键数字/主体）',
    '- hook: 标题或内容用的开头钩子手法（20字内）',
    '- structure: 叙事结构（如：结论先行→数据佐证→行业影响）',
    '- emotion: 情绪曲线（如：政策焦虑→算账清晰→行动希望）',
    '- transferable: 3条可迁移的创作技巧，每条15字内',
    '要求：只依据给定 title/desc 分析，不要编造事实与数字。',
    '条目：' + JSON.stringify(items.map(x => ({ title: x.title, desc: x.desc })))
  ].join('\n');
  const text = await llmChat(cfg, [
    { role: 'system', content: '只输出 JSON 数组，不要 markdown 代码块标记。' },
    { role: 'user', content: prompt }
  ], 180000);
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('LLM 输出无 JSON 数组');
  return JSON.parse(m[0]);
}

export function fallbackAnalysis(item) {
  const txt = (item.desc || item.title || '').replace(/\s+/g, ' ').trim();
  return {
    summary: txt.slice(0, 80) + (txt.length > 80 ? '…' : ''),
    hook: '（待拆解）', structure: '（待拆解）', emotion: '（待拆解）', transferable: []
  };
}

export { SCORE_PASS };
