/**
 * RSS / Atom 解析（AIHOT 信源类型 rss）。
 * 返回统一结构 {title,url,desc,date,src}，date 为 YYYY-MM-DD。
 */
import { getText } from '../http.mjs';
import { parseDate } from '../normalize.mjs';

const stripTags = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export function parseRss(xml, limit = 40) {
  const items = [];
  const blocks = String(xml || '').match(/<(item|entry)[\s\S]*?<\/\1>/g) || [];
  for (const b of blocks.slice(0, limit)) {
    const title = (b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
    const link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1]
      || (b.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || '';
    const desc = (b.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)
      || b.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) || [])[1] || '';
    const pd = (b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)
      || b.match(/<updated[^>]*>([\s\S]*?)<\/updated>/) || [])[1] || '';
    /* Google News 等源会在 <source> 里给出真实发布媒体名 */
    const src = (b.match(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/) || [])[1] || '';

    items.push({
      title: stripTags(title),
      url: String(link).trim(),
      desc: stripTags(desc).slice(0, 300),
      date: parseDate(pd),
      src: stripTags(src)
    });
  }
  return items;
}

export function rssUrl(src) {
  if (!src.urlTemplate) return src.url;
  return src.urlTemplate.replace('{q}', encodeURIComponent(src.query || ''));
}

export async function fetchRss(src) {
  const xml = await getText(rssUrl(src), { timeoutMs: src.timeoutMs });
  return parseRss(xml, src.maxItems || 40);
}
