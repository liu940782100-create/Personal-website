/**
 * HTTP 抓取层：统一 UA / 超时 / 重试，不依赖任何第三方库（Node 20 原生 fetch）。
 */
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function request(url, { timeoutMs = 20000, headers = {}, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(800 * attempt);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept': '*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          ...headers
        },
        signal: ac.signal
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function getText(url, opts = {}) {
  const r = await request(url, opts);
  return await r.text();
}
