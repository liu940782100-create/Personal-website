/**
 * RSS / Atom 解析（AIHOT 信源类型 rss）。
 * 返回统一结构 {title,url,desc,date,src}，date 为 YYYY-MM-DD。
 */
import { getText } from '../http.mjs';
import { parseDate } from '../normalize.mjs';

const decodeEntities = s => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#3[49];|&apos;/g, "'").replace(/&nbsp;/g, ' ');

const stripTags = s => decodeEntities(String(s || '')
  .replace(/<!\[CDATA\[|\]\]>/g, ''))
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export function parseRss(xml, limit = 40) {
  const items = [];
  const blocks = String(xml || '').match(/<(item|entry)[\s\S]*?<\/\1>/g) || [];
  for (const b of blocks.slice(0, limit)) {
    const title = (b.match(/<title[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/title>/) || [])[1] || '';
    const link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1]
      || (b.match(/<link[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/link>/) || [])[1] || '';
    const desc = (b.match(/<description[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/description>/)
      || b.match(/<summary[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/summary>/) || [])[1] || '';
    const pd = (b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)
      || b.match(/<updated[^>]*>([\s\S]*?)<\/updated>/) || [])[1] || '';
    /* Google News 等源会在 <source> 里给出真实发布媒体名 */
    const src = (b.match(/<source[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/source>/) || [])[1] || '';

    items.push({
      title: stripTags(title),
      url: decodeEntities(String(link).trim()).replace(/<!\[CDATA\[|\]\]>/g, ''),
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
