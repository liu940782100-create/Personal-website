/**
 * 列表页抓取（AIHOT 信源类型 web_list 的无依赖版本）。
 * 用正则代替 CSS 选择器：pattern 捕获组 1 = 链接，2 = 标题。
 * 发布日期优先从 URL 路径推断（列表页通常不带日期）。
 */
import { getText } from '../http.mjs';
import { dateFromUrl } from '../normalize.mjs';

const stripTags = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export function extractLinks(html, src, max = 30) {
  const out = [];
  const seen = new Set();
  const re = new RegExp(src.pattern, 'g');
  let m;
  while ((m = re.exec(String(html || ''))) && out.length < max) {
    let url = m[1] || '';
    const title = stripTags(m[2]);
    if (!url || !title || title.length < 4) continue;
    if (!/^https?:\/\//i.test(url)) {
      try { url = new URL(url, src.base || src.url).href; } catch { continue; }
    }
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title, url, desc: '', date: dateFromUrl(url), src: '' });
  }
  return out;
}

export async function fetchWebList(src) {
  const html = await getText(src.url, { timeoutMs: src.timeoutMs });
  return extractLinks(html, src, src.maxItems || 30);
}
