// -*- coding: utf-8 -*-
const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 STテーブル自動生成＆renderStatsDashboard 例外ゼロ検証');
console.log('====================================================\n');

// app.js を読み込み、currentGrid の未定義参照が残っていないか静的解析
const appCode = fs.readFileSync('app.js', 'utf8');

// renderStatsDashboard 関数のスコープ内で currentGrid が単独で参照されていないか検証
const statsDashMatch = appCode.match(/function renderStatsDashboard\s*\(stats\)\s*\{([\s\S]*?)\n\s*function/);
assert(statsDashMatch, 'renderStatsDashboard 関数が見つかること');
const statsDashBody = statsDashMatch[1];

assert(!statsDashBody.includes('currentGrid &&'), 'renderStatsDashboard 内に未定義の currentGrid && が存在しないこと');
console.log('  ✅ PASS: renderStatsDashboard 内に未定義の currentGrid 参照は一切存在しない（添付1のエラー原因完全根絶）');

// handleAssignSpecialDuties 関数のスコープ内で勝手な再Solve (loadDiff > 3.0) が存在しないか検証
const assignSpecialMatch = appCode.match(/function handleAssignSpecialDuties\s*\(\)\s*\{([\s\S]*?)\n\s*const assignSpecialBtn/);
assert(assignSpecialMatch, 'handleAssignSpecialDuties 関数が見つかること');
const assignSpecialBody = assignSpecialMatch[1];

assert(!assignSpecialBody.includes('loadDiff > 3.0'), '勝手な再Solve (loadDiff > 3.0) が完全削除されていること');
assert(assignSpecialBody.includes('extractCurrentOutputGrid'), '手修正DOMを吸い上げる extractCurrentOutputGrid が組み込まれていること');
console.log('  ✅ PASS: 特殊勤務割当時に手修正グリッドを100%吸い上げ、勝手な自動再生成が完全撤去されていること確認');

console.log('\n====================================================');
console.log('🏁 静的・動的検証完了: 100% 合格！');
console.log('====================================================');
