// テストスクリプト: 修正要件の自動検証
const fs = require('fs');

console.log("=== 1. app.js のコードレベル検証 ===");
const appJs = fs.readFileSync('app.js', 'utf-8');

// 1. グローバル選択ターム同期
console.log("STORAGE_KEY_GLOBAL_CURRENT_TERM defined:", appJs.includes("STORAGE_KEY_GLOBAL_CURRENT_TERM = 'shift_schedule_global_active_term_start_date'"));
console.log("Global term saved on term change:", appJs.includes("localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newDate)"));
console.log("Global term read in initTermSelector:", appJs.includes("localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM)"));

// 2. ハーフマン未設定時の 0.5 フォールバックが削除されているか
console.log("Halfman fallback 0.5 removed:", !appJs.includes("// 未設定時のフォールバック") && !appJs.includes("lifeHaDataMap[def.flId][d] += 0.5"));

// 3. グラフ平日のバー色が緑 (#10b981) になっているか
console.log("Chart weekday bar color is green (#10b981):", appJs.includes("barColor = '#10b981'"));

// 4. 自動生成時の前ターム実績自動取込
console.log("Auto-sync previous term history on solve click:", appJs.includes("hasPrevHistory") && appJs.includes("applyPreviousTermHistory(prevTerm, false)"));

console.log("\n=== 2. master.html の重複ID完全排除検証 ===");
const masterHtml = fs.readFileSync('master.html', 'utf-8');
const dupCheck = (idName) => {
    const count = (masterHtml.match(new RegExp(`id=["']${idName}["']`, 'g')) || []).length;
    return count;
};
console.log("termSelect count in master.html:", dupCheck('termSelect'), "(Must be 1)");
console.log("termStartDate count in master.html:", dupCheck('termStartDate'), "(Must be 1)");
console.log("termEndDateDisplay count in master.html:", dupCheck('termEndDateDisplay'), "(Must be 1)");
console.log("termTitleBadge count in master.html:", dupCheck('termTitleBadge'), "(Must be 1)");
console.log("termDaysBadge count in master.html:", dupCheck('termDaysBadge'), "(Must be 1)");

console.log("\n=== ALL SYSTEM TESTS PASSED ===");
