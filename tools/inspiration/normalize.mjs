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

/**
 * 常见繁体 → 简体映射：BBC 中文等境外源产出繁体，关键词表用简体。
 * 只覆盖新闻标题里的高频字，未收录的字原样保留。
 */
const TRAD_PAIRS = '國国 會会 議议 選选 舉举 黨党 歐欧 聯联 際际 導导 總总 統统 書书 記记 長长 員员 幹干 門门 團团 訪访 問问 見见 談谈 簽签 協协 條条 約约 機机 飛飞 彈弹 艦舰 潛潜 艇艇 軍军 戰战 爭争 擊击 襲袭 隊队 師师 區区 縣县 鄉乡 鎮镇 農农 業业 產产 電电 動动 車车 輛辆 網网 絡络 資资 訊讯 數数 據据 庫库 雲云 軟软 體体 應应 開开 發发 進进 實实 現现 態态 轉转 億亿 萬万 銀银 債债 匯汇 幣币 價价 漲涨 經经 濟济 貿贸 稅税 關关 財财 監监 紀纪 檢检 審审 調调 執执 領领 華华 爾尔 與与 為为 這这 個个 們们 時时 間间 對对 將将 衝冲 陸陆 處处 勢势 權权 護护 難难 內内 閣阁 亂乱 騷骚 遊游 罷罢 勞劳 醫医 藥药 衛卫 環环 氣气 溫温 變变 綠绿 雙双 測测 證证 認认 識识 誰谁 該该 學学 習习 話话 說说 讀读 寫写 語语 譯译 專专 場场 豐丰 島岛 臺台 灣湾 廣广 東东 遼辽 寧宁 陝陕 貴贵 慶庆 興兴 邊边 遠远 運运 輸输 鐵铁 鋼钢 礦矿 廠厂 辦办 務务 頻频 寬宽 帶带 顯显 腦脑 試试 驗验 藥药 劃划 歸归 灣湾 襲袭 佈布 佔占 據据 衝冲 証证 牴抵 紮扎 責责 訓训 負负 載载 網网';
const TRAD_MAP = new Map(
  TRAD_PAIRS.split(' ').filter(p => p.length === 2).map(p => [p[0], p[1]])
);

/** 繁体标题转简体，仅用于关键词匹配，不改动展示文案 */
export function toSimp(text) {
  return String(text || '').replace(/[\u4e00-\u9fff]/g, ch => TRAD_MAP.get(ch) || ch);
}

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
