/**
 * LLM 传输层（OpenAI 兼容接口）。
 * 缺失 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 时返回 null，调用方降级为规则式。
 */
export function llmConfig() {
  const key = process.env.LLM_API_KEY;
  const base = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  return key && base && model ? { key, base: base.replace(/\/$/, ''), model } : null;
}

export async function llmChat(cfg, messages, timeoutMs = 120000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let body = { model: cfg.model, messages, temperature: 0.4 };
    /* 服务商特有参数（如千问的 {"enable_thinking":false}） */
    if (process.env.LLM_EXTRA_JSON) {
      try { body = { ...JSON.parse(process.env.LLM_EXTRA_JSON), ...body }; } catch { /* 忽略坏配置 */ }
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
  } finally {
    clearTimeout(timer);
  }
}
