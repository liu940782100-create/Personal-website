#!/usr/bin/env node
/**
 * 灵感库自动更新管道
 * 流程：抓开放源热门内容 → 关键词过滤（AI科技/储能）→ LLM 总结+叙事拆解（无 key 自动降级）
 *      → 合并"手动补强收件箱" → 去重写回 data/inspiration.js
 *
 * 环境变量：
 *   LLM_API_KEY / LLM_BASE_URL / LLM_MODEL   缺失时自动降级为规则式摘要
 *   INSPIRATION_MAX_ITEMS                     数据文件最大条目数（默认 300）
 * 运行：node tools/fetch_inspiration.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data', 'inspiration.js');
const INBOX_DIR = path.join(ROOT, 'inbox');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

const KEYWORDS = ['AI', 'ai', '人工智能', '大模型', 'LLM', 'GPT', '智能体', 'Agent', '算力', '芯片', '半导体',
  '机器人', '自动驾驶', 'Prompt', '提示词', '储能', '电池', '锂电', '光伏', '充电', '电网', '新能源',
  '电力', '氢能', '固态电池', '钠电', '构网型', '虚拟电厂', '能源'];

const today = () => new Date().toISOString().slice(0, 10);

async function get(url, timeoutMs = 10000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' }, signal: ac.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

/** 极简 RSS/Atom 解析：<item><title>/<link>/<description> 或 <entry><title>/<link href>/<summary> */
function parseRss(xml, limit = 25) {
  const items = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/g) || [];
  for (const b of blocks.slice(0, limit)) {
    const title = (b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
    const link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1]
      || (b.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || '';
    const desc = (b.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)
      || b.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) || [])[1] || '';
    items.push({
      title: title.replace(/<[^>]+>/g, '').trim(),
      url: link.trim(),
      desc: desc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
    });
  }
  return items;
}

/* ---------- 源适配器：每个返回 [{title, url, desc, hot}] ---------- */
const SOURCES = [
  {
    /* imsyy/DailyHotApi 公共实例的知乎热榜镜像；本机网络不通时在 Actions 海外环境通常可用，失败自动跳过 */
    name: '知乎热榜', platform: '知乎',
    fetch: async () => {
      const d = JSON.parse(await get('https://api-hot.imsyy.top/zhihu'));
      return (d.data || []).map(x => ({
        title: String(x.title || '').trim(), url: x.url || '', desc: x.desc || '',
        hot: Number(String(x.hot || '').replace(/[^\d]/g, '')) || 0
      }));
    }
  },
  {
    name: 'IT之家', platform: '官方媒体',
    fetch: async () => (await parseRss(await get('https://www.ithome.com/rss/'))).map(x => ({ ...x, hot: 0 }))
  },
  {
    name: 'cnBeta', platform: '官方媒体',
    fetch: async () => (await parseRss(await get('https://rss.cnbeta.com/rss'))).map(x => ({ ...x, hot: 0 }))
  },
  {
    name: '量子位', platform: '官方媒体',
    fetch: async () => (await parseRss(await get('https://www.qbitai.com/feed'))).map(x => ({ ...x, hot: 0 }))
  },
  {
    name: '少数派', platform: '官方媒体',
    fetch: async () => (await parseRss(await get('https://sspai.com/feed'))).map(x => ({ ...x, hot: 0 }))
  }
];

/* ---------- LLM（OpenAI 兼容接口）---------- */
function llmConfig() {
  const key = process.env.LLM_API_KEY, base = process.env.LLM_BASE_URL, model = process.env.LLM_MODEL;
  return key && base && model ? { key, base: base.replace(/\/$/, ''), model } : null;
}

async function llmChat(cfg, messages, timeoutMs = 60000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(cfg.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages, temperature: 0.4 }),
      signal: ac.signal
    });
    if (!r.ok) throw new Error('LLM HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    return d.choices[0].message.content;
  } finally { clearTimeout(timer); }
}

/** 拆解一批内容，返回逐条结果；失败的单条返回 null */
async function analyseBatch(cfg, items) {
  const prompt = [
    '你是内容运营专家。下面是科技/储能领域的热门内容条目（JSON 数组，含 title/desc）。',
    '对每一条输出 JSON 对象（最后输出一个 JSON 数组，不要多余文字），字段：',
    '- summary: 60字内精简总结内容核心',
    '- hook: 博主/标题用的开头钩子手法（20字内）',
    '- structure: 叙事结构（如：现象→反常识观点×3→行动清单）',
    '- emotion: 情绪曲线（如：焦虑共鸣→认知颠覆→行动希望）',
    '- transferable: 3条可迁移的创作技巧，每条15字内',
    '- domain: 从 [AI科技, 储能能源, 科技×能源] 中选一个',
    '条目：' + JSON.stringify(items.map(x => ({ title: x.title, desc: x.desc })))
  ].join('\n');
  const text = await llmChat(cfg, [
    { role: 'system', content: '只输出 JSON 数组，不要 markdown 代码块标记。' },
    { role: 'user', content: prompt }
  ]);
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('LLM 输出无 JSON 数组');
  return JSON.parse(m[0]);
}

function fallbackAnalysis(item) {
  return {
    summary: (item.desc || item.title).slice(0, 80) + (item.desc && item.desc.length > 80 ? '…' : ''),
    hook: '（待拆解）', structure: '（待拆解）', emotion: '（待拆解）',
    transferable: [], domain: /储能|电池|光伏|电网|电力|氢能|钠电|构网|虚拟电厂|新能源|充电|锂电|能源/.test(item.title) ? '储能能源' : 'AI科技'
  };
}

/** 生成当日唯一 id：a{YYYYMMDD}{两位序号}，跨轮次续号（查 existing + 本轮已加） */
function nextId(existing, added) {
  const prefix = 'a' + today().replace(/-/g, '');
  const used = new Set([...existing, ...added].map(x => String(x.id || '')).filter(id => id.startsWith(prefix)));
  let n = 1;
  while (used.has(prefix + String(n).padStart(2, '0'))) n++;
  return prefix + String(n).padStart(2, '0');
}

/* ---------- 收件箱：手动补强平台内容（页面上导出的 JSON 丢进 inbox/ 目录）---------- */
function readInbox() {
  const out = [];
  if (!existsSync(INBOX_DIR)) return out;
  for (const f of readdirSync(INBOX_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const text = readFileSync(path.join(INBOX_DIR, f), 'utf8').replace(/^\uFEFF/, '');
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) out.push(...arr.map(x => ({ ...x, __inboxFile: f })));
    } catch (e) { console.warn('inbox 跳过坏文件', f, e.message); }
  }
  return out;
}

/* ---------- 主流程 ---------- */
async function main() {
  const existing = new Function('window', readFileSync(DATA_FILE, 'utf8') + ';return window.DATA_INSPIRATION;')({});
  const knownTitles = new Set(existing.map(x => String(x.title || '').trim()));
  const added = [];

  /* 1. 抓源 + 过滤 */
  const pool = [];
  for (const src of SOURCES) {
    try {
      const items = await src.fetch();
      const hit = items.filter(x => x.title && KEYWORDS.some(k => x.title.includes(k)));
      console.log(`[${src.name}] 抓到 ${items.length} 条，命中关键词 ${hit.length} 条`);
      hit.slice(0, 8).forEach(x => pool.push({ ...x, platform: src.platform, source: src.name }));
    } catch (e) { console.warn(`[${src.name}] 抓取失败：${e.message}`); }
  }

  /* 2. 去重（对现有 + 池内）*/
  const seen = new Set(knownTitles);
  const fresh = pool.filter(x => { const t = x.title.trim(); if (seen.has(t)) return false; seen.add(t); return true; });
  fresh.sort((a, b) => b.hot - a.hot);
  const picked = fresh.slice(0, 12);
  console.log(`新增候选 ${picked.length} 条（池 ${fresh.length}，上限 12）`);

  /* 3. LLM 拆解或降级 */
  const cfg = llmConfig();
  let analyses = null;
  if (cfg && picked.length) {
    try {
      analyses = await analyseBatch(cfg, picked);
      console.log(`LLM 拆解完成：${analyses.length} 条`);
    } catch (e) { console.warn('LLM 拆解失败，降级规则式：', e.message); }
  } else if (!cfg) console.log('未配置 LLM_API_KEY/LLM_BASE_URL/LLM_MODEL，使用规则式降级');

  picked.forEach((x, i) => {
    const a = (analyses && analyses[i]) || fallbackAnalysis(x);
    added.push({
      id: nextId(existing, added),
      platform: x.platform, domain: a.domain || 'AI科技',
      title: x.title, author: x.source, link: x.url,
      metrics: { likes: x.hot || 0, comments: 0, collected: today() },
      contentSummary: a.summary || fallbackAnalysis(x).summary,
      narrativeAnalysis: {
        hook: a.hook || '（待拆解）', structure: a.structure || '（待拆解）',
        emotionCurve: a.emotion || '（待拆解）', transferable: Array.isArray(a.transferable) ? a.transferable : []
      }
    });
  });

  /* 4. 手动补强收件箱：页面上导出的 local 条目由 AI 拆解后并入正式数据 */
  const inbox = readInbox().filter(x => /^local-/.test(String(x.id || '')));
  for (const item of inbox) {
    if (knownTitles.has(String(item.title || '').trim())) continue;
    let a = null;
    if (cfg) {
      try { [a] = await analyseBatch(cfg, [item]); } catch (e) { console.warn('inbox 拆解失败：', e.message); }
    }
    const fb = a || fallbackAnalysis(item);
    added.push({
      id: nextId(existing, added),
      platform: item.platform || '其他平台', domain: item.domain || a?.domain || 'AI科技',
      title: item.title, author: item.author || '', link: item.link || '',
      metrics: { likes: item.metrics?.likes || 0, comments: item.metrics?.comments || 0, collected: today() },
      contentSummary: item.contentSummary || fb.summary,
      narrativeAnalysis: {
        hook: fb.hook || item.narrativeAnalysis?.hook || '（待拆解）',
        structure: fb.structure || item.narrativeAnalysis?.structure || '（待拆解）',
        emotionCurve: fb.emotion || item.narrativeAnalysis?.emotionCurve || '（待拆解）',
        transferable: item.narrativeAnalysis?.transferable?.length ? item.narrativeAnalysis.transferable : (fb.transferable || [])
      }
    });
  }
  if (inbox.length) {
    for (const f of new Set(inbox.map(x => x.__inboxFile))) unlinkSync(path.join(INBOX_DIR, f));
    console.log(`收件箱 ${inbox.length} 条已消化，源文件已删除`);
  }

  /* 5. 合并写回：新条目插头部，超出上限裁掉最旧（保留人工示例 i* 条目） */
  const merged = [...added, ...existing];
  const MAX = Number(process.env.INSPIRATION_MAX_ITEMS) || 300;
  const keep = merged.filter(x => /^i/.test(String(x.id || '')) || /^a/.test(String(x.id || '')) || /^local-/.test(String(x.id || '')));
  const trimmed = keep.length > MAX
    ? keep.filter(x => /^i/.test(String(x.id))) // 人工示例永远保留
      .concat(keep.filter(x => !/^i/.test(String(x.id))).slice(0, MAX))
    : keep;

  const banner = `/* 本文件由 tools/fetch_inspiration.mjs 自动维护（每日 20:00 更新）；a* 开头为自动采集条目，i* 开头为人工示例 */\n`;
  const meta = `\nwindow.DATA_INSPIRATION_META = ${JSON.stringify({ updatedAt: today(), added: added.length, total: trimmed.length })};\n`;
  writeFileSync(DATA_FILE, banner + 'window.DATA_INSPIRATION = ' + JSON.stringify(trimmed, null, 2) + ';' + meta, 'utf8');
  console.log(`写回完成：新增 ${added.length}，总计 ${trimmed.length} 条 → data/inspiration.js`);
  if (!added.length) process.exitCode = 0;
}

main().catch(e => { console.error('管道失败：', e); process.exit(1); });
