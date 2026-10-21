#!/usr/bin/env node
/**
 * 灵感库采集管道入口
 *
 * 实现位于 tools/inspiration/（分层结构参考 AIHOT）：
 *   sources.mjs    信源注册表（rss / web_list / bilibili，声明式配置）
 *   collect.mjs    并行采集 + URL 身份判重 + 健康记录
 *   editorial.mjs  赛道过滤 → LLM 打分（门槛 60）→ 视频优先配额 → 叙事拆解
 *   store.mjs      读写 data/inspiration.js（结构保持不变）
 *   run.mjs        编排 + CLI
 *
 * 运行：node tools/fetch_inspiration.mjs [--preview] [--dry-run] [--no-llm]
 *                                        [--source=id] [--track=科技] [--limit=20]
 *
 * 环境变量：LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
 *           INSPIRATION_PER_TRACK（每赛道保留上限，默认 8）
 */
import { run } from './inspiration/run.mjs';

run(process.argv.slice(2)).catch(e => {
  console.error('管道失败：', e);
  process.exit(1);
});
