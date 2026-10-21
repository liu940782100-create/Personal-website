/**
 * 灵感库采集管道（分层结构参考 AIHOT）
 *
 *   collect   → 按信源配置并发抓取，URL 身份判重，输出健康记录
 *   editorial → 赛道关键词 / 时效 / 已收录过滤 → LLM 打分（门槛 60）→ 视频优先配额 → 摘要补全 → 叙事拆解
 *   publish   → 合并手动收件箱 → 每赛道保留最新 N 条 → 写回 data/inspiration.js
 *
 * 用法：
 *   node tools/fetch_inspiration.mjs                         正常采集并写回
 *   node tools/fetch_inspiration.mjs --preview               只预览候选（不调 LLM、不写回）
 *   node tools/fetch_inspiration.mjs --preview --source=ithome --limit=20
 *   node tools/fetch_inspiration.mjs --dry-run --no-llm      跑完整管道但不写文件
 *   node tools/fetch_inspiration.mjs --track=科技             只采集指定赛道
 *
 * 环境变量：LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / LLM_EXTRA_JSON
 *           INSPIRATION_PER_TRACK（每赛道保留上限，默认 8）
 */
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { TRACKS } from './sources.mjs';
import { llmConfig } from './llm.mjs';
import { collectSources } from './collect.mjs';
import {
  candidatesForTrack, selectTrack, scoreItems, enrichDescription,
  analyseBatch, fallbackAnalysis, isVideo, SCORE_PASS
} from './editorial.mjs';
import { canonicalUrl, today, FRESH_DAYS } from './normalize.mjs';
import { readStore, writeStore } from './store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_FILE = path.join(ROOT, 'data', 'inspiration.js');
const INBOX_DIR = path.join(ROOT, 'inbox');

const DEFAULT_LIMIT = 20;

function parseArgs(argv) {
  const opts = { preview: false, dryRun: false, noLlm: false, help: false, sourceIds: [], track: '', limit: DEFAULT_LIMIT };
  for (const a of argv) {
    if (a === '--preview') opts.preview = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--no-llm') opts.noLlm = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--source=')) opts.sourceIds.push(...a.slice(9).split(',').map(s => s.trim()).filter(Boolean));
    else if (a.startsWith('--track=')) opts.track = a.slice(8).trim();
    else if (a.startsWith('--limit=')) opts.limit = Math.max(1, Number(a.slice(8)) || DEFAULT_LIMIT);
    else console.warn('忽略未知参数：' + a);
  }
  return opts;
}

function printHelp() {
  console.log([
    '灵感库采集管道',
    '',
    '  node tools/fetch_inspiration.mjs                         正常采集并写回 data/inspiration.js',
    '  node tools/fetch_inspiration.mjs --preview               只预览候选，不调 LLM、不写回',
    '  --preview --source=ithome,chinanews_scroll --limit=20    只看指定信源',
    '  --track=科技                                             只跑指定赛道',
    '  --dry-run --no-llm                                       完整跑一遍但不写文件',
    ''
  ].join('\n'));
}

function mapLimit(arr, limit, fn) {
  const out = new Array(arr.length);
  let i = 0;
  const workers = new Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    while (i < arr.length) { const k = i++; out[k] = await fn(arr[k], k); }
  });
  return Promise.all(workers).then(() => out);
}

/** 生成当日唯一 id：a{YYYYMMDD}{两位序号}，跨轮次续号 */
function nextId(used) {
  const prefix = 'a' + today().replace(/-/g, '');
  let n = 1;
  while (used.has(prefix + String(n).padStart(2, '0'))) n++;
  const id = prefix + String(n).padStart(2, '0');
  used.add(id);
  return id;
}

/* ---------- 收件箱：手动补强（页面导出 JSON 丢进 inbox/） ---------- */
function readInbox() {
  const out = [];
  if (!existsSync(INBOX_DIR)) return out;
  for (const f of readdirSync(INBOX_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const text = readFileSync(path.join(INBOX_DIR, f), 'utf8').replace(/^\uFEFF/, '');
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) out.push(...arr.map(x => ({ ...x, __inboxFile: f })));
    } catch (e) {
      console.warn('inbox 跳过坏文件', f, e.message);
    }
  }
  return out;
}

function printHealth(health) {
  const failed = health.filter(h => h.error);
  console.log(`\n信源健康：成功 ${health.length - failed.length} / 失败 ${failed.length}`);
  for (const h of health) {
    console.log(`  ${h.error ? '✗' : '✓'} ${h.id.padEnd(20)} ${String(h.count).padStart(3)} 条 ${String(h.ms).padStart(6)}ms`
      + (h.error ? '｜' + h.error.slice(0, 100) : ''));
  }
}

function previewTracks(tracks, poolOf, opts, existingTitles, existingUrls) {
  console.log('\n—— 预览模式：不调用 LLM、不写回 ——');
  const claimed = new Set();
  for (const track of tracks) {
    const candidates = candidatesForTrack(track, poolOf, { existingTitles, existingUrls });
    const picked = selectTrack({ candidates, quota: opts.limit, claimed });
    const videos = picked.filter(isVideo).length;
    console.log(`\n【${track.name}】候选 ${candidates.length} 条 → 预览 ${picked.length} 条（视频 ${videos} / 图文 ${picked.length - videos}）`);
    picked.forEach((x, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. [${x.platform}] ${x.title}  | ${x.date || '无发布时间'} | ${x.url}`);
    });
  }
}

/* ---------- 主流程 ---------- */
export async function run(argv = []) {
  const opts = parseArgs(argv);
  if (opts.help) { printHelp(); return; }

  const perTrack = Number(process.env.INSPIRATION_PER_TRACK) || 8;
  const cfg = (opts.preview || opts.noLlm) ? null : llmConfig();
  if (!cfg) console.log(opts.preview ? '预览模式：跳过 LLM' : '未配置 LLM 密钥，使用规则式降级');

  const existing = readStore(DATA_FILE);
  const existingTitles = new Set(existing.map(x => String(x.title || '').trim()).filter(Boolean));
  const existingUrls = new Set(existing.map(x => canonicalUrl(x.link)).filter(Boolean));
  const usedIds = new Set(existing.map(x => String(x.id || '')));

  /* 1. 采集 */
  const { poolOf, health } = await collectSources({ sourceIds: opts.sourceIds });
  printHealth(health);

  let tracks = TRACKS;
  if (opts.track) {
    const hit = TRACKS.filter(t => t.name === opts.track);
    if (!hit.length) console.warn(`未找到赛道「${opts.track}」，可用：${TRACKS.map(t => t.name).join(' / ')}`);
    else tracks = hit;
  }

  if (opts.preview) {
    previewTracks(tracks, poolOf, opts, existingTitles, existingUrls);
    return;
  }

  /* 2. 候选池 */
  const trackCands = tracks.map(track => ({
    track,
    candidates: candidatesForTrack(track, poolOf, { existingTitles, existingUrls })
  }));

  /* 3. LLM 打分（一次调用覆盖全部候选前 60 条；失败则退回按发布时间排序） */
  if (cfg) {
    const unique = new Map();
    for (const { candidates } of trackCands) {
      for (const x of candidates) {
        const k = canonicalUrl(x.url);
        if (!unique.has(k)) unique.set(k, x);
      }
    }
    try {
      await scoreItems(cfg, [...unique.values()]);
      console.log(`\nLLM 打分完成：${Math.min(unique.size, 60)} 条（门槛 ${SCORE_PASS}）`);
    } catch (e) {
      console.warn('LLM 打分失败，改为按发布时间排序：', e.message);
    }
  }

  /* 4. 逐赛道取稿 + 拆解 */
  const claimed = new Set();
  const added = [];
  const trackStat = {};

  for (const { track, candidates } of trackCands) {
    const picked = selectTrack({ candidates, quota: perTrack, claimed });
    console.log(`\n【${track.name}】候选 ${candidates.length} 条 → 取 ${picked.length} 条`
      + `（${picked.map(x => x.source).join('、')}）`);
    if (!picked.length) { trackStat[track.name] = 0; continue; }

    await mapLimit(picked, 6, enrichDescription);

    let analyses = null;
    if (cfg) {
      try {
        analyses = await analyseBatch(cfg, picked, track.name);
        console.log(`  LLM 拆解完成：${analyses.length} 条`);
      } catch (e) {
        console.warn('  LLM 拆解失败，拆半重试：', e.message);
        try {
          const half = Math.ceil(picked.length / 2);
          const a1 = await analyseBatch(cfg, picked.slice(0, half), track.name);
          const a2 = await analyseBatch(cfg, picked.slice(half), track.name);
          analyses = a1.concat(a2);
          console.log(`  LLM 拆解完成（拆半）：${analyses.length} 条`);
        } catch (e2) {
          console.warn('  仍失败，降级规则式：', e2.message);
        }
      }
    }

    picked.forEach((x, i) => {
      const a = (analyses && analyses[i]) || fallbackAnalysis(x);
      added.push({
        id: nextId(usedIds),
        platform: x.platform, domain: track.name, track: track.name,
        title: x.title, author: String(x.src || x.source || '').replace(/^B站·/, ''), link: x.url,
        published: String(x.date || ''),
        metrics: { likes: 0, comments: 0, collected: today() },
        contentSummary: a.summary || fallbackAnalysis(x).summary,
        narrativeAnalysis: {
          hook: a.hook || String(x.title || '').slice(0, 18), /* LLM 漏 hook 时用标题兜底，避免条目被当占位丢弃 */
          structure: a.structure || '（待拆解）',
          emotionCurve: a.emotion || '（待拆解）',
          transferable: Array.isArray(a.transferable) ? a.transferable : []
        }
      });
    });
    trackStat[track.name] = picked.length;
  }

  /* 5. 收件箱：微信 / 抖音 / 推特 / 油管等手动录入条目，AI 拆解后并入 */
  const inbox = readInbox().filter(x => /^local-/.test(String(x.id || '')));
  const inboxTitles = new Set(existingTitles);
  for (const item of inbox) {
    if (inboxTitles.has(String(item.title || '').trim())) continue;
    let a = null;
    if (cfg) {
      try { [a] = await analyseBatch(cfg, [item], item.track || item.domain || '其他'); }
      catch (e) { console.warn('inbox 拆解失败：', e.message); }
    }
    const fb = a || fallbackAnalysis(item);
    added.push({
      id: nextId(usedIds),
      platform: item.platform || '其他平台',
      domain: item.track || item.domain || '其他', track: item.track || item.domain || '其他',
      title: item.title, author: item.author || '', link: item.link || '',
      metrics: {
        likes: (item.metrics && item.metrics.likes) || 0,
        comments: (item.metrics && item.metrics.comments) || 0,
        collected: today()
      },
      contentSummary: item.contentSummary || fb.summary,
      narrativeAnalysis: {
        hook: fb.hook || (item.narrativeAnalysis && item.narrativeAnalysis.hook) || '（待拆解）',
        structure: fb.structure || (item.narrativeAnalysis && item.narrativeAnalysis.structure) || '（待拆解）',
        emotionCurve: fb.emotion || (item.narrativeAnalysis && item.narrativeAnalysis.emotionCurve) || '（待拆解）',
        transferable: (item.narrativeAnalysis && item.narrativeAnalysis.transferable && item.narrativeAnalysis.transferable.length)
          ? item.narrativeAnalysis.transferable : (fb.transferable || [])
      }
    });
    inboxTitles.add(String(item.title || '').trim());
  }
  if (inbox.length) {
    if (!opts.dryRun) {
      for (const f of new Set(inbox.map(x => x.__inboxFile))) unlinkSync(path.join(INBOX_DIR, f));
      console.log(`\n收件箱 ${inbox.length} 条已消化，源文件已删除`);
    } else {
      console.log(`\n收件箱 ${inbox.length} 条已读入（dry-run 不删除源文件）`);
    }
  }

  /* 6. 合并写回：每赛道保留最新 PER_TRACK 条（视频先占名额；占位拆解条目剔除） */
  const merged = [...added, ...existing];
  const keep = merged.filter(x => /^(i|a|local-)/.test(String(x.id || '')));
  const manual = keep.filter(x => /^i/.test(String(x.id)));
  const auto = keep.filter(x => !/^i/.test(String(x.id)))
    .filter(x => !(x.narrativeAnalysis && x.narrativeAnalysis.hook === '（待拆解）'))
    .filter(x => {
      const p = String(x.published || '');
      if (!p) return true;
      const t = new Date(p + 'T00:00:00Z').getTime();
      return isNaN(t) || (Date.now() - t) / 86400000 <= FRESH_DAYS;
    });
  const pubKey = x => String(x.published || (x.metrics && x.metrics.collected) || '');
  auto.sort((a, b) => {
    const va = isVideo(a) ? 0 : 1, vb = isVideo(b) ? 0 : 1;
    if (va !== vb) return va - vb;
    return pubKey(b).localeCompare(pubKey(a));
  });

  const quota = {};
  const finalPicked = [];
  for (const x of auto) {
    const t = x.track || x.domain || '其他';
    if ((quota[t] || 0) >= perTrack) continue;
    quota[t] = (quota[t] || 0) + 1;
    finalPicked.push(x);
  }
  const trimmed = manual.concat(finalPicked);
  const finalStat = {};
  for (const x of finalPicked) {
    const t = x.track || x.domain || '其他';
    finalStat[t] = (finalStat[t] || 0) + 1;
  }

  const addedIds = new Set(added.map(x => x.id));
  const keptAdded = trimmed.filter(x => addedIds.has(x.id)).length; /* 实际保留的新增（占位条目剔除后） */
  const meta = {
    updatedAt: today(), added: keptAdded, total: trimmed.length, tracks: finalStat
  };

  if (opts.dryRun) {
    console.log(`\n[dry-run] 不写文件。新增 ${added.length}，预计保留新增 ${keptAdded}，总计 ${trimmed.length} 条`);
    console.log('赛道分布：' + JSON.stringify(finalStat));
    return;
  }

  writeStore(DATA_FILE, trimmed, meta);
  console.log(`\n写回完成：新增 ${added.length}，总计 ${trimmed.length} 条（每赛道上限 ${perTrack}）→ data/inspiration.js`);
  console.log('赛道分布：' + JSON.stringify(finalStat));
  console.log('视频条目：' + trimmed.filter(isVideo).length + ' 条');
}
