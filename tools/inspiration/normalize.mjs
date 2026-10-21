/**
 * 归一化：URL 身份、发布时间、时效判断。
 * URL 身份判重参考 AIHOT「同一网址只留一份」的做法：去掉锚点与跟踪参数。
 */

/** 时效上限（天）：超过即视为陈旧内容，不入候选、写回时也淘汰 */
export const FRESH_DAYS = Number(process.env.INSPIRATION_FRESH_DAYS) || 60;

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'spm', 'spm_id_from', 'from', 'from_spmid', 'share_source', 'share_medium',
  'share_plat', 'share_session_id', 'share_tag', 'timestamp', 'unique_k',
  'vd_source', 'buvid', 'is_story_h5', 'plat_id', 'seo_source'
]);

/** 规范化 URL，用于判重；非法 URL 原样返回 */
export function canonicalUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || !/^https?:\/\//i.test(s)) return s;
  try {
    const u = new URL(s);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');

    const bv = host === 'bilibili.com' && u.pathname.match(/^\/video\/(BV[0-9A-Za-z]+)/);
    if (bv) return 'https://www.bilibili.com/video/' + bv[1];

    const pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.protocol + '//' + host + (u.port ? ':' + u.port : '') + pathname + u.search;
  } catch {
    return s;
  }
}

/** 统一输出 YYYY-MM-DD（按北京时间取日期，避免 UTC 偏移把当天内容算到前一天） */
export function parseDate(input) {
  const s = String(input || '').trim();
  if (!s) return '';

  const ymd = s.match(/^(20\d{2})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
  if (ymd) return validDate(ymd[1], ymd[2], ymd[3]);

  const t = new Date(s);
  if (isNaN(t.getTime())) return '';
  const y = t.getUTCFullYear();
  if (y < 2000 || y > 2100) return '';
  return new Date(t.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 从原文页 meta 里取发布时间（政府网站常用 firstpublishedtime） */
export function dateFromHtml(html) {
  const s = String(html || '');
  const patterns = [
    /<meta[^>]+name=["'](?:firstpublishedtime|firstpublished|pubdate|publishdate|publish_date|date)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["'](?:firstpublishedtime|firstpublished|pubdate|publishdate|publish_date|date)["']/i,
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    const d = m && parseDate(m[1]);
    if (d) return d;
  }
  return '';
}

/** 从 URL 路径推断发布日期（列表页条目常常没有日期） */
export function dateFromUrl(url) {
  const s = String(url || '');
  let m = s.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  if (m) return validDate(m[1], m[2], m[3]);
  m = s.match(/\/(20\d{2})\/(\d{2})-(\d{2})\//);
  if (m) return validDate(m[1], m[2], m[3]);
  m = s.match(/\/(20\d{2})\/(\d{2})(\d{2})\//);
  if (m) return validDate(m[1], m[2], m[3]);
  m = s.match(/\/(20\d{6})\//);
  if (m) return validDate(m[1].slice(0, 4), m[1].slice(4, 6), m[1].slice(6, 8));
  return '';
}

function validDate(y, mo, d) {
  const m = Number(mo), day = Number(d);
  if (!(m >= 1 && m <= 12 && day >= 1 && day <= 31)) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 有日期且未超时效 → 新鲜；无日期放行（由排序降权） */
export function isFresh(date, days = FRESH_DAYS) {
  if (!date) return true;
  const t = new Date(date + 'T00:00:00Z').getTime();
  if (isNaN(t)) return true;
  return (Date.now() - t) / 86400000 <= days;
}

export function today() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
