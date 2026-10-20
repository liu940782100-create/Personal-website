#!/usr/bin/env node
/**
 * 灵感库采集管道（定时 + 手动触发）
 * 五赛道：科技 / 财经 / 政治 / 军事 / 储能，每赛道默认 8 条
 *
 * 流程：抓各赛道「真实原文链接」内容源 → 按赛道关键词过滤（博主/企业源 allPass 直通）→ 赛道内多源混排取 8 条
 *      → 补全正文摘要 → LLM 精简总结 + 叙事拆解
 *      → 合并手动补强收件箱（微信公众号 / 抖音 / 推特 / 油管等无公开接口平台）
 *      → 去重写回 data/inspiration.js
 *
 * 重要：条目的原文链接一律取自抓取结果本身；AI 只负责文字分析，绝不采用 AI 生成的链接
 *      （实测 AI 生成的链接 404 率极高）。AI 联网搜索同样不可用（返回幻觉链接）。
 *
 * 源可用性实测（2026-10）：
 *   ✅ 中新网 RSS / 首页、央视新闻·央视军事·央视国际、中国政府网、人民网首页、中国军网首页、
 *      凤凰军事、IT之家、量子位、雷锋网、北极星储能网
 *   ❌ 人民网 RSS / 新华网 RSS（内容停更，返回 2025 及更早旧闻，故作废）、环球网（WAF 拦截）、
 *      观察者网·澎湃·财联社（JS 渲染，无静态链接）、36氪 / 第一财经 feed（无 item）
 *
 * 环境变量：
 *   LLM_API_KEY / LLM_BASE_URL / LLM_MODEL     缺失时降级为规则式摘要
 *   INSPIRATION_PER_TRACK                      每赛道最多新增条数（默认 8）
 *   INSPIRATION_MAX_ITEMS                      数据文件最大条目数（默认 600）
 * 运行：node tools/fetch_inspiration.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data', 'inspiration.js');
const INBOX_DIR = path.join(ROOT, 'inbox');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const PER_TRACK = Number(process.env.INSPIRATION_PER_TRACK) || 8;

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

/** 极简 RSS/Atom 解析：返回 {title,url,desc,date} */
function parseRss(xml, limit = 40) {
  const items = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/g) || [];
  for (const b of blocks.slice(0, limit)) {
    const title = (b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
    const link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1]
      || (b.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || '';
    const desc = (b.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)
      || b.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) || [])[1] || '';
    const pd = (b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || b.match(/<updated[^>]*>([\s\S]*?)<\/updated>/) || [])[1] || '';
    let d = '';
    if (pd) { const t = new Date(pd.trim()); if (!isNaN(t.getTime())) d = t.toISOString().slice(0, 10); }
    /* Google News 等源会在 <source> 里给出真实发布媒体名 */
    const src = (b.match(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/) || [])[1] || '';
    items.push({
      title: title.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
      url: link.trim(),
      desc: desc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300),
      date: d,
      src: src.trim()
    });
  }
  return items;
}

/** 从列表页 HTML 里按正则抽文章链接，返回 {title,url,desc,date} */
function parseHtmlLinks(html, re, base, max = 30) {
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
    /* 从 URL 里的 YYYYMMDD / YYYY/MM/DD 推断发布日期 */
    let d = (url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//) || []).slice(1).join('-');
    if (!d) {
      const u = url.match(/\/(\d{4})\/(\d{2})-(\d{2})\//);
      if (u) d = u[1] + '-' + u[2] + '-' + u[3];
    }
    out.push({ title, url, desc: '', date: d });
  }
  return out;
}

/* ---------- Bilibili：wbi 签名直连官方接口（查用户 / 拉视频列表） ----------
 * UP 主配置：uid 已实测核对的直接填；uid 留空的每次运行按名字精确解析（解析不到自动跳过）。
 * 郭晶晶博士：B 站用户搜索无此名，「晶晶博士CASS」（金融史学博士，科普工作者）为最接近的候选；
 *   若这不是你想关注的 UP，把 uid 换成正确 mid（space.bilibili.com/<mid>）即可。
 * 参考：https://socialsisteryi.github.io/bilibili-API-collect/ 的 wbi 签名方案。 */
const BILI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BILI_MIXIN = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19,
  29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];
let biliCookie = '';

async function biliBootstrap() {
  if (biliCookie) return;
  try {
    const r = await fetch('https://www.bilibili.com/', { headers: { 'User-Agent': BILI_UA } });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    biliCookie = sc.map(c => c.split(';')[0]).join('; ');
  } catch (e) { /* 拿不到 cookie 也继续，部分接口不强制 */ }
}

async function biliApi(path, params) {
  // B站风控偶发返回 HTML 而非 JSON：重置 cookie 后重试（最多 3 次）
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      biliCookie = ''; // 强制重新拿 buvid
      await new Promise(r => setTimeout(r, 1500 * i));
    }
    try { return await biliApiOnce(path, params); }
    catch (e) {
      if (i === 2) throw e;
      console.warn(`[B站] 请求失败（第 ${i + 1} 次），重试：${e.message.slice(0, 80)}`);
    }
  }
}

async function biliApiOnce(path, params) {
  await biliBootstrap();
  const nav = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: { 'User-Agent': BILI_UA, Cookie: biliCookie } });
  const nj = await nav.json();
  const img = (nj.data?.wbi_img?.img_url || '').split('/').pop().split('.')[0];
  const sub = (nj.data?.wbi_img?.sub_url || '').split('/').pop().split('.')[0];
  if (!img || !sub) throw new Error('bilibili nav 无 wbi key');
  const key = BILI_MIXIN.map(i => (img + sub)[i]).join('').slice(0, 32);
  const p = { ...params, wts: Math.floor(Date.now() / 1000) };
  const qs = Object.keys(p).sort()
    .map(k => `${k}=${encodeURIComponent(String(p[k])).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))}`)
    .join('&');
  const r = await fetch('https://api.bilibili.com' + path + '?' + qs + '&w_rid=' +
    crypto.createHash('md5').update(qs + key).digest('hex'),
    { headers: { 'User-Agent': BILI_UA, Cookie: biliCookie, Referer: 'https://www.bilibili.com/' } });
  const j = await r.json();
  if (j.code !== 0) throw new Error('bilibili api ' + j.code + ' ' + (j.message || ''));
  return j;
}

/** 按名字精确解析 UP 主 mid；解析不到返回空串 */
async function biliResolveUid(name) {
  try {
    const j = await biliApi('/x/web-interface/wbi/search/type', { search_type: 'bili_user', keyword: name, page: '1' });
    const hit = (j.data?.result || []).find(u => u.uname === name);
    if (hit) { console.log(`[B站] ${name} → mid=${hit.mid}（fans=${hit.fans}）`); return String(hit.mid); }
    console.warn(`[B站] 用户搜索无精确匹配：${name}`);
  } catch (e) { console.warn(`[B站] 用户解析失败 ${name}：${e.message}`); }
  return '';
}

/** UP 主最新投稿（按发布时间倒序） */
async function biliUserVideos(mid, ps = 10) {
  const j = await biliApi('/x/space/wbi/arc/search', { mid, ps: String(ps), pn: '1', order: 'pubdate' });
  return (j.data?.list?.vlist || []).map(v => ({
    title: String(v.title || '').trim(),
    url: 'https://www.bilibili.com/video/' + v.bvid,
    desc: String(v.description || '').trim().slice(0, 300),
    date: v.created ? new Date(v.created * 1000).toISOString().slice(0, 10) : ''
  }));
}

/** 财经 / 科技博主（uid 为实测核对过的 mid；留空则运行时按名解析） */
const BILI_BLOGGERS = [
  { name: '小Lin说', uid: '520819684', track: '财经' },
  { name: '兔子念金', uid: '1335565146', track: '财经' },
  { name: '晶晶博士CASS', uid: '180549227', track: '财经' },
  { name: '老石谈芯', uid: '', track: '科技' }
];

/* ---------- 源注册表：全部为实测可拿到「真实原文链接」的源 ---------- */
const SRC = {
  ithome: {
    name: 'IT之家', platform: 'IT之家', priority: 3.0,
    fetch: async () => parseRss(await get('https://www.ithome.com/rss/', 20000), 60)
  },
  qbitai: {
    name: '量子位', platform: '量子位', priority: 3.0,
    fetch: async () => parseRss(await get('https://www.qbitai.com/feed', 20000), 30)
  },
  leiphone: {
    name: '雷锋网', platform: '雷锋网', priority: 2.8,
    fetch: async () => parseRss(await get('https://www.leiphone.com/feed', 25000), 30)
  },
  chinanewsScroll: {
    name: '中新网·滚动', platform: '中新网', priority: 2.6,
    fetch: async () => parseRss(await get('https://www.chinanews.com.cn/rss/scroll-news.xml', 20000), 40)
  },
  chinanewsFinance: {
    name: '中新网·财经', platform: '中新网', priority: 3.0,
    fetch: async () => parseRss(await get('https://www.chinanews.com.cn/rss/finance.xml', 20000), 40)
  },
  chinanewsHome: {
    name: '中新网·首页', platform: '中新网', priority: 2.6,
    fetch: async () => parseHtmlLinks(
      await get('https://www.chinanews.com.cn/', 25000),
      /href="(\/[a-z]+\/\d{4}\/\d{2}-\d{2}\/\d+\.shtml)"[^>]*>([\s\S]{4,90}?)<\/a>/,
      'https://www.chinanews.com.cn/', 40
    )
  },
  govCn: {
    name: '中国政府网', platform: '中国政府网', priority: 3.2,
    fetch: async () => parseHtmlLinks(
      await get('https://www.gov.cn/', 25000),
      /href="(https?:\/\/www\.gov\.cn\/(?:yaowen\/liebiao|zhengce\/[a-z]+\/[a-z]+)\/20\d{4}\/content_\d+\.htm)"[^>]*>([\s\S]{4,90}?)<\/a>/,
      'https://www.gov.cn/', 30
    )
  },
  peopleHome: {
    name: '人民网·首页', platform: '人民网', priority: 2.2,
    fetch: async () => parseHtmlLinks(
      await get('https://www.people.com.cn/', 25000),
      /href="(https?:\/\/(?:politics|world|finance|military|scitech|it)\.people\.com\.cn\/n\d+\/\d{4}\/\d{4}\/c\d+-\d+\.html)"[^>]*>([\s\S]{4,90}?)<\/a>/,
      'https://www.people.com.cn/', 30
    )
  },
  cctvNews: {
    name: '央视新闻', platform: '央视新闻', priority: 3.0,
    fetch: async () => parseHtmlLinks(
      await get('https://news.cctv.com/', 25000),
      /href="(https?:\/\/news\.cctv\.com\/\d{4}\/\d{2}\/\d{2}\/ARTI[A-Za-z0-9]+\.shtml)"[^>]*>([\s\S]{4,80}?)<\/a>/,
      'https://news.cctv.com/', 30
    )
  },
  cctvMil: {
    name: '央视军事', platform: '央视军事', priority: 3.2,
    fetch: async () => parseHtmlLinks(
      await get('https://military.cctv.com/', 25000),
      /href="(https?:\/\/military\.cctv\.com\/\d{4}\/\d{2}\/\d{2}\/ARTI[A-Za-z0-9]+\.shtml)"[^>]*>([\s\S]{4,80}?)<\/a>/,
      'https://military.cctv.com/', 20
    )
  },
  cctvWorld: {
    name: '央视国际', platform: '央视新闻', priority: 2.8,
    fetch: async () => parseHtmlLinks(
      await get('https://news.cctv.com/world/', 25000),
      /href="(https?:\/\/news\.cctv\.com\/\d{4}\/\d{2}\/\d{2}\/ARTI[A-Za-z0-9]+\.shtml)"[^>]*>([\s\S]{4,80}?)<\/a>/,
      'https://news.cctv.com/', 20
    )
  },
  junwang81: {
    name: '中国军网', platform: '中国军网', priority: 3.2,
    fetch: async () => parseHtmlLinks(
      await get('https://www.81.cn/', 25000),
      /href="(https?:\/\/www\.81\.cn\/yw_\d+\/\d+\.html)"[^>]*>([\s\S]{6,90}?)<\/a>/,
      'https://www.81.cn/', 25
    )
  },
  ifengMil: {
    name: '凤凰军事', platform: '凤凰军事', priority: 2.4,
    fetch: async () => parseHtmlLinks(
      await get('https://mil.ifeng.com/', 25000),
      /href="(https?:\/\/mil\.ifeng\.com\/c\/[A-Za-z0-9]+)"[^>]*>([\s\S]{6,90}?)<\/a>/,
      'https://mil.ifeng.com/', 25
    )
  },
  bjxStorage: {
    name: '北极星储能网', platform: '北极星储能网', priority: 3.5,
    fetch: async () => parseHtmlLinks(
      await get('https://chuneng.bjx.com.cn/', 25000),
      /href="((?:https?:\/\/news\.bjx\.com\.cn)?\/html\/\d{8}\/\d+\.shtml)"[^>]*>([\s\S]{4,90}?)<\/a>/,
      'https://chuneng.bjx.com.cn/', 30
    )
  }
};

/* 动态注册：B 站博主（视频直连官方接口；allPass = 不再过赛道关键词，博主本人就是筛选条件） */
for (const b of BILI_BLOGGERS) {
  SRC['bili_' + (b.uid || b.name)] = {
    name: 'B站·' + b.name, platform: 'B站', priority: 3.6, allPass: true,
    fetch: async () => {
      const uid = b.uid || await biliResolveUid(b.name);
      if (!uid) return [];
      return biliUserVideos(uid);
    }
  };
}

/* 动态注册：储能头部企业资讯（Google News RSS，查询本身已限定公司名，allPass）。
 * 链接是 news.google.com 的跳转地址，浏览器打开会自动转到原发布媒体；
 * 该源在 GitHub Actions（海外网络）下生效，本地直连失败只告警不影响其他源。 */
const GNEWS_COMPANIES = ['华为数字能源', '阳光电源', '宁德时代', '国轩高科', '亿纬锂能', '海辰储能'];
GNEWS_COMPANIES.forEach((c, i) => {
  SRC['gnews_company' + i] = {
    name: '企业资讯·' + c, platform: '媒体报道', priority: 3.4, allPass: true,
    fetch: async () => parseRss(await get(
      'https://news.google.com/rss/search?q=' + encodeURIComponent('"' + c + '"') +
      '&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', 20000), 12)
  };
});
/* 科技赛道：AI 发布会 / 大模型发布动态 */
SRC.gnewsAi = {
  name: 'AI发布会', platform: '媒体报道', priority: 3.2, allPass: true,
  fetch: async () => parseRss(await get(
    'https://news.google.com/rss/search?q=' + encodeURIComponent('AI 发布会 OR 大模型 发布') +
    '&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', 20000), 12)
};

const KEY_科技 = ['科技', 'AI', '人工智能', '大模型', '智能体', '算法', '算力', '芯片', '半导体', '光刻', 'GPU',
  'CPU', '处理器', '机器人', '人形机器人', '量子', '操作系统', '开源', '软件', '硬件', '数据中心', '云计算',
  '5G', '6G', '自动驾驶', '智能驾驶', '手机', '电脑', '笔记本', '苹果', '华为', '英伟达', '微软', '谷歌',
  '字节', '腾讯', '阿里', 'DeepSeek', '智能', '数字化', '空间站', '航天', '卫星', '火箭', '北斗', '元宇宙', 'AR', 'VR'];

const KEY_财经 = ['金融', '财经', '银行', '股市', '股票', '证券', '基金', '保险', '债券', '利率', '汇率', '人民币',
  '财政', '税收', 'GDP', '经济', '央行', '货币政策', 'A股', '港股', '美股', '上市', '融资', 'IPO', '投资',
  '贷款', '信贷', '存款', '外贸', '出口', '进口', '物价', 'CPI', 'PPI', '房地产', '楼市', '消费', '外汇',
  '信托', '并购', '重组', '市值', '券商', '期货', '黄金', '数字货币', '跨境', '自贸', '关税', '制造业',
  '招商', '营商', '产业', '企业', '市场', '订单', '营收', '利润'];

const KEY_政治 = ['习近平', '李强', '赵乐际', '王沪宁', '丁薛祥', '国务院', '中共中央', '全国人大', '全国政协',
  '外交部', '政策', '会议', '讲话', '考察', '访问', '会见', '调研', '主持', '部署', '审议', '表决', '党建',
  '中央', '国家主席', '总理', '外长', '王毅', '部长', '省委', '市委', '改革', '规划', '十五五', '五年规划',
  '政府工作报告', '反腐', '审查调查', '纪委', '监察', '巡视', '干部', '任命', '免职', '常委', '书记', '座谈',
  '论坛', '峰会', '国际合作', '一带一路', '外交', '条约', '协定'];

const KEY_军事 = ['军事', '国防', '军队', '部队', '军演', '演习', '导弹', '战机', '航母', '军舰', '海军',
  '空军', '陆军', '火箭军', '士兵', '军官', '战区', '武器', '装备', '无人机', '防空', '雷达', '坦克', '潜艇',
  '战争', '冲突', '停火', '军费', '国防部', '阅兵', '维和', '作战', '军事基地', '安全构想', '军力', '兵役',
  '征兵', '边境', '袭击', '空袭', '停战', '和谈', '联军', '北约', '军事行动'];

const KEY_储能 = ['储能', '电池', '锂电', '钠电', '固态电池', '电解液', '正极', '负极', '隔膜', 'PCS', 'BMS',
  '构网型', '虚拟电厂', '光伏', '风电', '氢能', '电网', '电力', '新能源', '充电', '碳达峰', '碳中和', '双碳',
  '能源', '容量电价', '峰谷价差', '独立储能', '共享储能', '工商储', '大储', '户储', '微电网', '特高压', '绿电',
  '零碳', '绿色转型', '能源转型', '新型电力系统', '新型储能', '充换电', '动力电池', '锂电池',
  '宁德时代', '宁德', '国轩高科', '国轩', '亿纬锂能', '亿纬', '海辰储能', '海辰', '阳光电源', '华为数字能源'];

/** 赛道定义：sources 按 priority 从高到低排列，取数时多源轮转混排，保证来源多样 */
const TRACKS = [
  { name: '科技', keywords: KEY_科技, sources: ['ithome', 'qbitai', 'cctvNews', 'leiphone', 'gnewsAi', 'bili_老石谈芯', 'chinanewsScroll', 'chinanewsHome'] },
  { name: '财经', keywords: KEY_财经, sources: ['bili_520819684', 'bili_1335565146', 'bili_180549227', 'chinanewsFinance', 'cctvNews', 'chinanewsScroll', 'chinanewsHome'] },
  { name: '政治', keywords: KEY_政治, sources: ['govCn', 'cctvNews', 'chinanewsScroll', 'chinanewsHome', 'peopleHome'] },
  { name: '军事', keywords: KEY_军事, sources: ['junwang81', 'cctvMil', 'cctvNews', 'cctvWorld', 'chinanewsScroll', 'chinanewsHome', 'ifengMil'] },
  { name: '储能', keywords: KEY_储能, sources: ['gnews_company0', 'gnews_company1', 'gnews_company2', 'gnews_company3', 'gnews_company4', 'gnews_company5', 'bjxStorage', 'chinanewsScroll', 'chinanewsHome'] }
];

/* ---------- LLM（OpenAI 兼容接口）---------- */
function llmConfig() {
  const key = process.env.LLM_API_KEY, base = process.env.LLM_BASE_URL, model = process.env.LLM_MODEL;
  return key && base && model ? { key, base: base.replace(/\/$/, ''), model } : null;
}

async function llmChat(cfg, messages, timeoutMs = 120000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let body = { model: cfg.model, messages, temperature: 0.4 };
    /* 服务商特有参数（如千问的 {"enable_thinking":false}） */
    if (process.env.LLM_EXTRA_JSON) {
      try { body = { ...JSON.parse(process.env.LLM_EXTRA_JSON), ...body }; } catch (e) { /* 忽略坏配置 */ }
    }
    const r = await fetch(cfg.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify(body),
      signal: ac.signal
    });
    if (!r.ok) throw new Error('LLM HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    return d.choices[0].message.content;
  } finally { clearTimeout(timer); }
}

/** 拆解一批内容：AI 只输出文字分析，不输出链接（链接由调用方从抓取结果绑定） */
async function analyseBatch(cfg, items, track) {
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

function fallbackAnalysis(item) {
  const txt = (item.desc || item.title || '').replace(/\s+/g, ' ').trim();
  return {
    summary: txt.slice(0, 80) + (txt.length > 80 ? '…' : ''),
    hook: '（待拆解）', structure: '（待拆解）', emotion: '（待拆解）', transferable: []
  };
}

/** 正文摘要补全：列表页抓到的条目没有 desc 时，取原文页的 meta description（不编造） */
async function enrich(item) {
  if (item.desc && item.desc.length > 40) return item;
  try {
    const html = await get(item.url, 12000);
    const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,400})["']/i)
      || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,400})["']/i)
      || html.match(/<meta[^>]+content=["']([^"']{20,400})["'][^>]+name=["']description["']/i);
    if (m) item.desc = m[1].replace(/&quot;|&#34;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  } catch (e) { /* 补全失败不致命 */ }
  return item;
}

/** 有并发上限的批量执行 */
async function mapLimit(arr, limit, fn) {
  const out = new Array(arr.length);
  let i = 0;
  const workers = new Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    while (i < arr.length) { const k = i++; out[k] = await fn(arr[k], k); }
  });
  await Promise.all(workers);
  return out;
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

/* ---------- 收件箱：手动补强（页面导出 JSON 丢进 inbox/）---------- */
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
  const usedTitles = new Set(existing.map(x => String(x.title || '').trim()));
  const usedIds = new Set(existing.map(x => String(x.id || '')));

  /* 1. 并发抓取全部源（同一源只抓一次，供多个赛道复用） */
  const keys = Object.keys(SRC);
  const raw = await mapLimit(keys, 6, async k => {
    try {
      const items = await SRC[k].fetch();
      console.log(`[${SRC[k].name}] 抓到 ${items.length} 条`);
      return items.map(x => ({ ...x, source: SRC[k].name, platform: SRC[k].platform, priority: SRC[k].priority, allPass: !!SRC[k].allPass }));
    } catch (e) {
      console.warn(`[${SRC[k].name}] 抓取失败：${e.message}`);
      return [];
    }
  });
  const poolOf = {};
  keys.forEach((k, i) => { poolOf[k] = raw[i]; });

  /* 2. 逐赛道：关键词过滤 → 赛道内去重 → 多源轮转混排 → 取 8 条 */
  const cfg = llmConfig();
  if (!cfg) console.log('未配置 LLM 密钥，使用规则式降级');
  const added = [];
  const trackStat = {};

  for (const tr of TRACKS) {
    const buckets = tr.sources
      .map(k => (poolOf[k] || [])
        .filter(x => x.title && x.url && (x.allPass || tr.keywords.some(w => x.title.includes(w))))
        .filter(x => !usedTitles.has(x.title.trim())))
      .map(arr => arr.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))));

    /* 多源轮转：每轮从各源各取 1 条，保证 8 条覆盖尽量多的来源 */
    const picked = [];
    const seenT = new Set();
    for (let round = 0; picked.length < PER_TRACK; round++) {
      let moved = false;
      for (const arr of buckets) {
        const it = arr[round];
        if (!it) continue;
        moved = true;
        const t = it.title.trim();
        if (seenT.has(t) || usedTitles.has(t)) continue;
        seenT.add(t); usedTitles.add(t);
        picked.push(it);
        if (picked.length >= PER_TRACK) break;
      }
      if (!moved) break;
    }

    console.log(`\n【${tr.name}】候选 ${buckets.reduce((s, a) => s + a.length, 0)} 条 → 取 ${picked.length} 条`
      + `（${picked.map(x => x.source).join('、')}）`);

    if (!picked.length) { trackStat[tr.name] = 0; continue; }

    /* 3. 补全正文摘要（列表页条目缺 desc 时取原文 meta description） */
    await mapLimit(picked, 6, enrich);

    /* 4. LLM 拆解（每赛道一次，失败降级） */
    let analyses = null;
    if (cfg) {
      try {
        analyses = await analyseBatch(cfg, picked, tr.name);
        console.log(`  LLM 拆解完成：${analyses.length} 条`);
      } catch (e) {
        console.warn('  LLM 拆解失败，拆半重试：', e.message);
        try {
          const half = Math.ceil(picked.length / 2);
          const a1 = await analyseBatch(cfg, picked.slice(0, half), tr.name);
          const a2 = await analyseBatch(cfg, picked.slice(half), tr.name);
          analyses = a1.concat(a2);
          console.log(`  LLM 拆解完成（拆半）：${analyses.length} 条`);
        } catch (e2) { console.warn('  仍失败，降级规则式：', e2.message); }
      }
    }

    picked.forEach((x, i) => {
      const a = (analyses && analyses[i]) || fallbackAnalysis(x);
      added.push({
        id: nextId(usedIds),
        platform: x.platform, domain: tr.name, track: tr.name,
        title: x.title, author: String(x.src || x.source || '').replace(/^B站·/, ''), link: x.url,
        metrics: { likes: 0, comments: 0, collected: today() },
        contentSummary: a.summary || fallbackAnalysis(x).summary,
        narrativeAnalysis: {
          hook: a.hook || '（待拆解）', structure: a.structure || '（待拆解）',
          emotionCurve: a.emotion || '（待拆解）',
          transferable: Array.isArray(a.transferable) ? a.transferable : []
        }
      });
    });
    trackStat[tr.name] = picked.length;
  }

  /* 5. 收件箱：微信 / 抖音 / 推特 / 油管等手动录入条目，AI 拆解后并入 */
  const inbox = readInbox().filter(x => /^local-/.test(String(x.id || '')));
  for (const item of inbox) {
    if (usedTitles.has(String(item.title || '').trim())) continue;
    let a = null;
    if (cfg) {
      try { [a] = await analyseBatch(cfg, [item], item.track || item.domain || '其他'); } catch (e) { console.warn('inbox 拆解失败：', e.message); }
    }
    const fb = a || fallbackAnalysis(item);
    added.push({
      id: nextId(usedIds),
      platform: item.platform || '其他平台',
      domain: item.track || item.domain || '其他', track: item.track || item.domain || '其他',
      title: item.title, author: item.author || '', link: item.link || '',
      metrics: { likes: (item.metrics && item.metrics.likes) || 0, comments: (item.metrics && item.metrics.comments) || 0, collected: today() },
      contentSummary: item.contentSummary || fb.summary,
      narrativeAnalysis: {
        hook: fb.hook || (item.narrativeAnalysis && item.narrativeAnalysis.hook) || '（待拆解）',
        structure: fb.structure || (item.narrativeAnalysis && item.narrativeAnalysis.structure) || '（待拆解）',
        emotionCurve: fb.emotion || (item.narrativeAnalysis && item.narrativeAnalysis.emotionCurve) || '（待拆解）',
        transferable: (item.narrativeAnalysis && item.narrativeAnalysis.transferable && item.narrativeAnalysis.transferable.length)
          ? item.narrativeAnalysis.transferable : (fb.transferable || [])
      }
    });
  }
  if (inbox.length) {
    for (const f of new Set(inbox.map(x => x.__inboxFile))) unlinkSync(path.join(INBOX_DIR, f));
    console.log(`\n收件箱 ${inbox.length} 条已消化，源文件已删除`);
  }

  /* 6. 合并写回 */
  const merged = [...added, ...existing];
  const MAX = Number(process.env.INSPIRATION_MAX_ITEMS) || 600;
  const keep = merged.filter(x => /^(i|a|local-)/.test(String(x.id || '')));
  const trimmed = keep.length > MAX
    ? keep.filter(x => /^i/.test(String(x.id)))
      .concat(keep.filter(x => !/^i/.test(String(x.id))).slice(0, MAX))
    : keep;

  const banner = `/* 本文件由 tools/fetch_inspiration.mjs 维护（手动触发更新）；a* 为采集条目，i* 为人工示例 */\n`;
  const meta = `\nwindow.DATA_INSPIRATION_META = ${JSON.stringify({
    updatedAt: today(), added: added.length, total: trimmed.length,
    tracks: trackStat
  })};\n`;
  writeFileSync(DATA_FILE, banner + 'window.DATA_INSPIRATION = ' + JSON.stringify(trimmed, null, 2) + ';' + meta, 'utf8');
  console.log(`\n写回完成：新增 ${added.length}，总计 ${trimmed.length} 条 → data/inspiration.js`);
  console.log('赛道分布：' + JSON.stringify(trackStat));
}

main().catch(e => { console.error('管道失败：', e); process.exit(1); });
