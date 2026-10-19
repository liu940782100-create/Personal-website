#!/usr/bin/env node
/**
 * 灵感库采集管道（手动触发，不再定时）
 * 流程：抓「储能」赛道真实内容源 → 关键词过滤 → LLM 精简总结 + 叙事拆解
 *      → 合并手动补强收件箱（微信公众号/抖音/推特/油管等无公开接口平台）
 *      → 去重写回 data/inspiration.js
 *
 * 重要：条目的原文链接一律取自抓取结果本身；AI 只负责文字分析，绝不采用 AI 生成的链接（实测会编造 404 链接）。
 *
 * 环境变量：
 *   LLM_API_KEY / LLM_BASE_URL / LLM_MODEL     缺失时降级为规则式摘要
 *   INSPIRATION_MAX_NEW                        单轮最多新增条数（默认 8）
 *   INSPIRATION_MAX_ITEMS                      数据文件最大条目数（默认 300）
 * 运行：node tools/fetch_inspiration.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data', 'inspiration.js');
const INBOX_DIR = path.join(ROOT, 'inbox');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

/** 当前赛道：本轮只做储能，后续扩赛道时改为按赛道循环即可 */
const TRACK = '储能';

const KEYWORDS = ['储能', '电池', '锂电', '钠电', '固态电池', '电解液', '正极', '负极', '隔膜', 'PCS', 'BMS',
  '构网型', '虚拟电厂', '光伏', '风电', '氢能', '电网', '电力', '新能源', '充电', '碳达峰', '碳中和',
  '能源', '容量电价', '峰谷价差', '独立储能', '共享储能', '工商储', '大储', '户储', '微电网'];

const today = () => new Date().toISOString().slice(0, 10);

async function get(url, timeoutMs = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: ac.signal
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

/** 极简 RSS/Atom 解析 */
function parseRss(xml, limit = 30) {
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
      desc: desc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300),
      date: ''
    });
  }
  return items;
}

/** 从列表页 HTML 里按正则抽文章链接，返回 {title,url,desc,date} */
function parseHtmlLinks(html, re, base, max = 25) {
  const out = [];
  const seen = new Set();
  const r = new RegExp(re.source, 'g');
  let m;
  while ((m = r.exec(html)) && out.length < max) {
    let url = m[1] || '';
    const title = String(m[2] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!url || !title || title.length < 4) continue;
    if (!/^https?:\/\//i.test(url)) {
      try { url = new URL(url, base).href; } catch (e) { continue; }
    }
    if (seen.has(url)) continue;
    seen.add(url);
    /* 从 URL 里的 YYYYMMDD 推断发布日期 */
    const d = (url.match(/\/(\d{4})(\d{2})(\d{2})\//) || []).slice(1).join('-');
    out.push({ title, url, desc: '', date: d });
  }
  return out;
}

/* ---------- 源适配器：每个返回 [{title, url, desc, date, platform}] ----------
 * 只保留能拿到「真实原始链接」的源；RSSHub 公共实例与 AI 联网搜索均实测不可用（403 / 链接 404）。
 */
const SOURCES = [
  {
    /* 储能行业首选源：列表页可直接解析出原始文章链接 */
    name: '北极星储能网', platform: '北极星储能网', priority: 3,
    fetch: async () => parseHtmlLinks(
      await get('https://chuneng.bjx.com.cn/', 25000),
      /href="((?:https?:\/\/news\.bjx\.com\.cn)?\/html\/\d{8}\/\d+\.shtml)"[^>]*>([\s\S]{4,90}?)<\/a>/,
      'https://chuneng.bjx.com.cn/'
    )
  },
  {
    /* 国家媒体：人民网财经电讯，按储能关键词过滤 */
    name: '人民网', platform: '人民网', priority: 2.5,
    fetch: async () => parseRss(await get('http://www.people.com.cn/rss/finance.xml', 25000), 40)
  },
  {
    /* 国家媒体：新华网财经（RSS 缺失时自动跳过） */
    name: '新华网', platform: '新华网', priority: 2.5,
    fetch: async () => parseRss(await get('http://www.news.cn/fortune/news_fortune.xml', 20000), 30)
  },
  {
    name: 'IT之家', platform: 'IT之家', priority: 2,
    fetch: async () => parseRss(await get('https://www.ithome.com/rss/', 20000), 30)
  },
  {
    /* 综合媒体聚合：覆盖各家媒体（含国家媒体与行业媒体），标题后缀带来源媒体名；链接为 Google 跳转链接，点开即达原文 */
    name: '全网媒体', platform: '综合媒体', priority: 1,
    fetch: async () => {
      const xml = await get('https://news.google.com/rss/search?q=%E5%82%A8%E8%83%BD&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', 25000);
      return parseRss(xml, 30).map(x => {
        const mm = x.title.match(/^(.*?)\s+-\s+([^-]+)$/);
        return {
          ...x,
          title: mm ? mm[1].trim() : x.title,
          outlet: mm ? mm[2].trim() : '',
          platform: mm ? mm[2].trim() : '综合媒体'
        };
      });
    }
  }
];

/* ---------- LLM（OpenAI 兼容接口）---------- */
function llmConfig() {
  const key = process.env.LLM_API_KEY, base = process.env.LLM_BASE_URL, model = process.env.LLM_MODEL;
  return key && base && model ? { key, base: base.replace(/\/$/, ''), model } : null;
}

async function llmChat(cfg, messages, timeoutMs = 90000) {
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

/** 拆解一批内容：AI 只输出文字分析，不输出链接（链接由调用方从抓取结果绑定） */
async function analyseBatch(cfg, items) {
  const prompt = [
    '你是内容运营专家。下面是「储能」赛道的内容条目（JSON 数组，含 title/desc）。',
    '对每一条输出一个 JSON 对象，最后只输出一个 JSON 数组，不要多余文字。字段：',
    '- summary: 80字内精简总结这条内容的核心信息（说清发生了什么、关键数字）',
    '- hook: 标题/内容用的开头钩子手法（20字内）',
    '- structure: 叙事结构（如：结论先行→数据佐证→行业影响）',
    '- emotion: 情绪曲线（如：政策焦虑→算账清晰→行动希望）',
    '- transferable: 3条可迁移的创作技巧，每条15字内',
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
  const txt = (item.desc || item.title || '').replace(/\s+/g, ' ').trim();
  return {
    summary: txt.slice(0, 80) + (txt.length > 80 ? '…' : ''),
    hook: '（待拆解）', structure: '（待拆解）', emotion: '（待拆解）', transferable: []
  };
}

/** 生成当日唯一 id：a{YYYYMMDD}{两位序号}，跨轮次续号 */
function nextId(existing, added) {
  const prefix = 'a' + today().replace(/-/g, '');
  const used = new Set([...existing, ...added].map(x => String(x.id || '')).filter(id => id.startsWith(prefix)));
  let n = 1;
  while (used.has(prefix + String(n).padStart(2, '0'))) n++;
  return prefix + String(n).padStart(2, '0');
}

/* ---------- 收件箱：手动补强（页面上导出 JSON 丢进 inbox/）---------- */
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

  /* 1. 抓源 + 赛道过滤 */
  const pool = [];
  for (const src of SOURCES) {
    try {
      const items = await src.fetch();
      const hit = items.filter(x => x.title && x.url && KEYWORDS.some(k => x.title.includes(k)));
      console.log(`[${src.name}] 抓到 ${items.length} 条，命中${TRACK}关键词 ${hit.length} 条`);
      hit.slice(0, 10).forEach(x => pool.push({
        ...x, platform: x.platform || src.platform, source: src.name, priority: src.priority
      }));
    } catch (e) { console.warn(`[${src.name}] 抓取失败：${e.message}`); }
  }

  /* 2. 去重 + 排序（媒体权威度优先，其次日期新） */
  const seen = new Set(knownTitles);
  const fresh = pool.filter(x => {
    const t = x.title.trim();
    if (!t || seen.has(t)) return false;
    seen.add(t); return true;
  });
  fresh.sort((a, b) => (b.priority - a.priority) || String(b.date || '').localeCompare(String(a.date || '')));
  const picked = fresh.slice(0, Number(process.env.INSPIRATION_MAX_NEW) || 8);
  console.log(`新增候选 ${picked.length} 条（候选池 ${fresh.length}，单轮上限 ${Number(process.env.INSPIRATION_MAX_NEW) || 8}，赛道：${TRACK}）`);

  /* 3. LLM 拆解或降级 */
  const cfg = llmConfig();
  let analyses = null;
  if (cfg && picked.length) {
    try {
      analyses = await analyseBatch(cfg, picked);
      console.log(`LLM 拆解完成：${analyses.length} 条`);
    } catch (e) { console.warn('LLM 拆解失败，降级规则式：', e.message); }
  } else if (!cfg) console.log('未配置 LLM 密钥，使用规则式降级');

  picked.forEach((x, i) => {
    const a = (analyses && analyses[i]) || fallbackAnalysis(x);
    added.push({
      id: nextId(existing, added),
      platform: x.platform, domain: TRACK, track: TRACK,
      title: x.title, author: x.source, link: x.url,
      metrics: { likes: 0, comments: 0, collected: today() },
      contentSummary: a.summary || fallbackAnalysis(x).summary,
      narrativeAnalysis: {
        hook: a.hook || '（待拆解）', structure: a.structure || '（待拆解）',
        emotionCurve: a.emotion || '（待拆解）',
        transferable: Array.isArray(a.transferable) ? a.transferable : []
      }
    });
  });

  /* 4. 收件箱：微信/抖音/推特/油管等手动录入条目，AI 拆解后并入 */
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
      platform: item.platform || '其他平台', domain: item.track || item.domain || TRACK, track: item.track || item.domain || TRACK,
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

  /* 5. 合并写回 */
  const merged = [...added, ...existing];
  const MAX = Number(process.env.INSPIRATION_MAX_ITEMS) || 300;
  const keep = merged.filter(x => /^(i|a|local-)/.test(String(x.id || '')));
  const trimmed = keep.length > MAX
    ? keep.filter(x => /^i/.test(String(x.id)))
      .concat(keep.filter(x => !/^i/.test(String(x.id))).slice(0, MAX))
    : keep;

  const banner = `/* 本文件由 tools/fetch_inspiration.mjs 维护（手动触发更新）；a* 为采集条目，i* 为人工示例 */\n`;
  const meta = `\nwindow.DATA_INSPIRATION_META = ${JSON.stringify({ updatedAt: today(), added: added.length, total: trimmed.length, track: TRACK })};\n`;
  writeFileSync(DATA_FILE, banner + 'window.DATA_INSPIRATION = ' + JSON.stringify(trimmed, null, 2) + ';' + meta, 'utf8');
  console.log(`写回完成：新增 ${added.length}，总计 ${trimmed.length} 条 → data/inspiration.js`);
}

main().catch(e => { console.error('管道失败：', e); process.exit(1); });
