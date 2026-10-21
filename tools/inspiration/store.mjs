/**
 * 数据文件读写：data/inspiration.js 保持 window.DATA_INSPIRATION / DATA_INSPIRATION_META 结构不变。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const BANNER =
  '/* 本文件由 tools/fetch_inspiration.mjs 维护（定时 + 手动触发）；a* 为采集条目，i* 为人工示例 */\n';

export function readStore(file) {
  const text = readFileSync(file, 'utf8');
  const items = new Function('window', text + ';return window.DATA_INSPIRATION;')({});
  return Array.isArray(items) ? items : [];
}

export function writeStore(file, items, meta) {
  writeFileSync(
    file,
    BANNER
      + 'window.DATA_INSPIRATION = ' + JSON.stringify(items, null, 2) + ';'
      + '\nwindow.DATA_INSPIRATION_META = ' + JSON.stringify(meta) + ';\n',
    'utf8'
  );
}
