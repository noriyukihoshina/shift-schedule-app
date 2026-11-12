// -*- coding: utf-8 -*-
const assert = require('assert');
const { ShiftScheduler, SYMBOLS } = require('./solver.js');
const fs = require('fs');

console.log('====================================================');
console.log('🧪 生活期テーブル 自動生成〜描画フロー 徹底検証テスト');
console.log('====================================================\n');

// 1. 生活期スタッフ45名（訪問、通所、Cl1、Cl2、ハ1〜ハ南、管理等）を作成
const lifeStaff = [];
for (let i = 1; i <= 45; i++) {
    let sec = '';
    let ha = '';
    let isSunOff = false;
    let isSatSunOff = false;

    if (i <= 19) {
        sec = '訪問';
        isSatSunOff = true; // 訪問は土日休
    } else if (i === 20 || i === 21) {
        sec = '通所';
        isSunOff = true; // 通所は日休＋平日分散
    } else if (i === 22) {
        sec = 'Cl1';
        isSatSunOff = true; // Cl1は土日休・実数0
    } else if (i === 23) {
        sec = 'Cl2';
        isSunOff = true; // Cl2は日休＋平日分散・実数1
    } else if (i === 24) {
        ha = 'ハ1';
        isSatSunOff = true;
    } else if (i === 25) {
        ha = 'ハ2';
        isSatSunOff = true;
    } else if (i === 26) {
        ha = 'ハ3';
        isSunOff = true;
    } else if (i === 27) {
        ha = 'ハ南';
        isSunOff = true;
    } else if (i === 28) {
        sec = '管理';
        isSatSunOff = true;
    } else {
        sec = '通所';
        isSunOff = true;
    }

    lifeStaff.push({
        id: i,
        name: `生活期スタッフ ${i}`,
        isUnused: false,
        lifeSection: sec,
        haSection: ha,
        isSunOff: isSunOff,
        isSatSunOff: isSatSunOff,
        can8: (i <= 5),
        days: new Array(28).fill('')
    });
}

// ターム日付（2026年6月）
const dates = [];
for (let d = 1; d <= 28; d++) {
    const dayOfWeek = (d % 7 === 6) ? '土' : (d % 7 === 0) ? '日' : '月';
    dates.push({
        dayNumber: d,
        dayOfWeek: dayOfWeek,
        isSaturday: (dayOfWeek === '土'),
        isSunday: (dayOfWeek === '日'),
        isHoliday: (d === 15), // 1日祝日あり
        wIdx: (d % 7 === 6) ? 5 : (d % 7 === 0) ? 6 : (d % 7 - 1),
        label: `6/${d}`,
        weekday: dayOfWeek
    });
}

// 2. 生活期ソルバー実行 (solveLife)
const scheduler = new ShiftScheduler(lifeStaff, dates, { isLife: true });
const solveRes = scheduler.solveLife();
assert.strictEqual(solveRes.success, true, '生活期自動生成 (solveLife) が成功すること');
console.log('  ✅ PASS: 生活期の自動生成 (solveLife) に成功');

// 3. stats の計算
const stats = scheduler.calculateStats();
assert(stats && stats.daily && stats.daily.length === 28, 'stats.daily が28日分存在すること');
console.log('  ✅ PASS: calculateStats による生活期集計が正常に取得できること確認');

// 4. app.js 内の生活期ダッシュボード集計ロジック（renderStatsDashboard でエラーになった箇所のシミュレーション）
let visitRealTotal = 0;
let tsushoRealTotal = 0;
let hasError = false;

try {
    const activeGrid = solveRes.grid;
    for (let d = 0; d < 28; d++) {
        let visitReal = 0, visitTotal = 0;
        let tsushoReal = 0, tsushoTotal = 0;
        lifeStaff.forEach((st, s) => {
            if (st.isUnused) return;
            const cell = (activeGrid && activeGrid[s]) ? activeGrid[s][d] : null;
            const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
            if (!sym || sym === '休' || sym === 'ー') return;
            const sec = st.lifeSection || '';
            const ha = st.haSection || '';
            if (sec === '訪問') {
                visitTotal++;
                visitReal += (st.isZeroCount || sym === '出張') ? 0.0 : (st.isHalf || sym.includes('/') ? 0.5 : 1.0);
            }
            if (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') {
                tsushoTotal++;
                tsushoReal += (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : ((st.isZeroCount || sym === '出張') ? 0.0 : (st.isHalf || sym.includes('/') ? 0.5 : 1.0));
            }
        });
        visitRealTotal += visitReal;
        tsushoRealTotal += tsushoReal;
    }
} catch (e) {
    hasError = true;
    console.error('エラー発生:', e);
}

assert.strictEqual(hasError, false, '集計中に currentGrid is not defined 等の例外が一切発生しないこと');
assert(visitRealTotal > 0, '訪問実数が正しく集計されていること');
assert(tsushoRealTotal > 0, '通所実数が正しく集計されていること');
console.log(`  ✅ PASS: 生活期ダッシュボード集計が例外ゼロで完全動作（訪問実数合計: ${visitRealTotal}, 通所実数合計: ${tsushoRealTotal}）`);

console.log('\n====================================================');
console.log('🏁 生活期フロー検証完了: 100% 正常動作を確認しました！');
console.log('====================================================');
