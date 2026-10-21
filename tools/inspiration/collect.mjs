/**
 * 采集层（AIHOT collect 的简化版）：
 * 按信源类型分派解析器 → 并发抓取 → 源内按 URL 身份判重 → 附加源元信息 + 健康记录。
 */
import { SOURCES, DEFAULTS } from './sources.mjs';
import { fetchRss } from './parsers/rss.mjs';
import { fetchWebList } from './parsers/web-list.mjs';
import { fetchBiliUser } from './parsers/bili.mjs';
import { canonicalUrl } from './normalize.mjs';

export function fetchSource(src) {
  const s = { ...DEFAULTS, ...src };   /* 让 DEFAULTS 的 maxItems / timeoutMs 对缺省信源生效 */
  switch (s.type) {
    case 'rss': return fetchRss(s);
    case 'web_list': return fetchWebList(s);
    case 'bilibili': return fetchBiliUser(s);
    default: throw new Error('未知信源类型：' + s.type);
  }
}

function dedupe(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const x of items) {
    if (!x.title || !x.url) continue;
    const u = canonicalUrl(x.url);
    const t = x.title.trim();
    if (seenUrl.has(u) || seenTitle.has(t)) continue;
    seenUrl.add(u);
    seenTitle.add(t);
    out.push(x);
  }
  return out;
}

/**
 * @returns {{ poolOf: Record<string, object[]>, health: object[] }}
 */
export async function collectSources({ sourceIds = [], concurrency = DEFAULTS.concurrency } = {}) {
  const ids = [...new Set(sourceIds.length ? sourceIds : Object.keys(SOURCES))];
  const unknown = ids.filter(id => !SOURCES[id]);
  if (unknown.length) throw new Error('未知信源：' + unknown.join(', ') + '（可用：' + Object.keys(SOURCES).join(', ') + '）');

  const poolOf = {};
  const health = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const src = SOURCES[id];
      const started = Date.now();
      try {
        const items = dedupe(await fetchSource(src));
        poolOf[id] = items.map(x => ({
          ...x,
          source: src.name,
          platform: src.platform,
          priority: src.priority || 0,
          allPass: !!src.allPass
        }));
        health.push({ id, name: src.name, type: src.type, count: poolOf[id].length, ms: Date.now() - started });
        console.log(`[${src.name}] 抓到 ${poolOf[id].length} 条`);
      } catch (e) {
        poolOf[id] = [];
        health.push({ id, name: src.name, type: src.type, count: 0, ms: Date.now() - started, error: e.message });
        console.warn(`[${src.name}] 抓取失败：${e.message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  health.sort((a, b) => a.id.localeCompare(b.id));
  return { poolOf, health };
}
