/**
 * B站 UP 主投稿（自建 external 信源类型）。
 * wbi 签名直连官方接口；接口易触发 -352 风控，因此：
 *   全局串行链 + 调用间隔 2–3.5s + wbi key 进程内缓存 + 4 次重试（每次重置 cookie/key）
 * 参考：https://socialsisteryi.github.io/bilibili-API-collect/ 的 wbi 签名方案
 */
import crypto from 'node:crypto';

const BILI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BILI_MIXIN = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19,
  29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];

let cookie = '';
let wbiKey = '';
let chain = Promise.resolve(); /* 全局串行链：B站接口严格串行 + 随机间隔，降低风控触发概率 */

export async function biliBootstrap() {
  if (cookie) return;
  try {
    const r = await fetch('https://www.bilibili.com/', { headers: { 'User-Agent': BILI_UA } });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    cookie = sc.map(c => c.split(';')[0]).join('; ');
  } catch { /* 拿不到 cookie 也继续，部分接口不强制 */ }
}

const delay = () => new Promise(r => setTimeout(r, 2000 + Math.floor(Math.random() * 1500)));

async function apiOnce(path, params) {
  await biliBootstrap();
  if (!wbiKey) {
    const nav = await fetch('https://api.bilibili.com/x/web-interface/nav', {
      headers: { 'User-Agent': BILI_UA, Cookie: cookie }
    });
    const nj = await nav.json();
    const img = (nj.data?.wbi_img?.img_url || '').split('/').pop().split('.')[0];
    const sub = (nj.data?.wbi_img?.sub_url || '').split('/').pop().split('.')[0];
    if (!img || !sub) throw new Error('bilibili nav 无 wbi key');
    wbiKey = BILI_MIXIN.map(i => (img + sub)[i]).join('').slice(0, 32);
  }
  const p = { ...params, wts: Math.floor(Date.now() / 1000) };
  const qs = Object.keys(p).sort()
    .map(k => `${k}=${encodeURIComponent(String(p[k])).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))}`)
    .join('&');
  const r = await fetch('https://api.bilibili.com' + path + '?' + qs + '&w_rid=' +
    crypto.createHash('md5').update(qs + wbiKey).digest('hex'),
    { headers: { 'User-Agent': BILI_UA, Cookie: cookie, Referer: 'https://www.bilibili.com/' } });
  const j = await r.json();
  if (j.code !== 0) throw new Error('bilibili api ' + j.code + ' ' + (j.message || ''));
  return j;
}

async function api(path, params) {
  const run = async () => {
    for (let i = 0; i < 4; i++) {
      if (i > 0) {
        cookie = '';   /* 强制重新拿 buvid */
        wbiKey = '';
        await new Promise(r => setTimeout(r, 3000 * i));
      }
      try { return await apiOnce(path, params); }
      catch (e) {
        if (i === 3) throw e;
        console.warn(`[B站] 请求失败（第 ${i + 1} 次），重试：${e.message.slice(0, 80)}`);
      }
    }
  };
  const p = chain.then(run, run);
  chain = p.then(delay, delay);
  return p;
}

/** 按名字精确解析 UP 主 mid；解析不到返回空串 */
export async function resolveUid(name) {
  try {
    const j = await api('/x/web-interface/wbi/search/type', { search_type: 'bili_user', keyword: name, page: '1' });
    const hit = (j.data?.result || []).find(u => u.uname === name);
    if (hit) {
      console.log(`[B站] ${name} → mid=${hit.mid}（fans=${hit.fans}）`);
      return String(hit.mid);
    }
    console.warn(`[B站] 用户搜索无精确匹配：${name}`);
  } catch (e) {
    console.warn(`[B站] 用户解析失败 ${name}：${e.message}`);
  }
  return '';
}

/** UP 主最新投稿（按发布时间倒序） */
export async function userVideos(mid, ps = 10) {
  const j = await api('/x/space/wbi/arc/search', { mid, ps: String(ps), pn: '1', order: 'pubdate' });
  return (j.data?.list?.vlist || []).map(v => ({
    title: String(v.title || '').trim(),
    url: 'https://www.bilibili.com/video/' + v.bvid,
    desc: String(v.description || '').trim().slice(0, 300),
    date: v.created ? new Date((v.created + 8 * 3600) * 1000).toISOString().slice(0, 10) : '',
    src: ''
  }));
}

/** 信源入口：uid 已核对的直接用；留空的运行时按名字解析 */
export async function fetchBiliUser(src) {
  const uid = src.uid || await resolveUid(src.resolveName || src.name);
  if (!uid) return [];
  return userVideos(uid, src.maxItems || 15);
}
