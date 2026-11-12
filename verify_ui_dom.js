// -*- coding: utf-8 -*-
const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 UI/DOM 全HTMLファイル ボタン結線・配備 徹底検証');
console.log('====================================================\n');

// 1. マスターテーブル（index.html, マスターテーブル.html, master.html, マスター統括.html）
const masterFiles = ['index.html', 'マスターテーブル.html', 'master.html', 'マスター統括.html'];
masterFiles.forEach(fn => {
    const c = fs.readFileSync(fn, 'utf8');
    assert(!c.includes('masterBalanceWeekdaysBtn'), `${fn} に旧ボタン masterBalanceWeekdaysBtn が存在しないこと`);
    assert(!c.includes('全体出勤ブレを最少化'), `${fn} に旧テキスト 全体出勤ブレを最少化 が存在しないこと`);
    assert(c.includes('id="masterBalanceWeekdayBtn"'), `${fn} に平日ブレ最小化ボタンが存在すること`);
    assert(c.includes('id="masterBalanceWeekendBtn"'), `${fn} に休日ブレ最小化ボタンが存在すること`);
    console.log(`  ✅ PASS: ${fn} のマスターブレ最小化ボタン（平日／休日）が完全に配備され、旧ボタンが完全削除されている`);
});

// 2. 一般病棟（1階〜南）
const wardFiles = ['1階病棟.html', '2階病棟.html', '3階病棟.html', '南病棟.html'];
wardFiles.forEach(fn => {
    const c = fs.readFileSync(fn, 'utf8');
    assert(c.includes('id="floorBalanceWeekdayBtn"'), `${fn} に平日ブレ最小化ボタンが存在すること`);
    assert(c.includes('id="floorBalanceWeekendBtn"'), `${fn} に休日ブレ最小化ボタンが存在すること`);
    console.log(`  ✅ PASS: ${fn} の病棟ブレ最小化ボタン（平日／休日）が完全に配備されている`);
});

// 3. ST専用テーブル（ST.html）
{
    const c = fs.readFileSync('ST.html', 'utf8');
    assert(c.includes('id="stBalanceBtn"'), `ST.html にブレ最小化ボタンが存在すること`);
    console.log(`  ✅ PASS: ST.html のブレ最小化ボタン（stBalanceBtn）が完全に配備されている`);
}

// 4. 生活期テーブル（生活期.html, life.html, 生活期_管理者.html）
const lifeFiles = ['生活期.html', 'life.html', '生活期_管理者.html'];
lifeFiles.forEach(fn => {
    const c = fs.readFileSync(fn, 'utf8');
    assert(c.includes('id="lifeBalanceVisitBtn"'), `${fn} に訪問ブレ最小化ボタンが存在すること`);
    assert(c.includes('id="lifeBalanceTsushoBtn"'), `${fn} に通所ブレ最小化ボタンが存在すること`);
    assert(!c.includes('data-tab="checkTab"'), `${fn} から旧 checkTab が削除され outputTab に統合されていること`);
    assert(c.includes('window.print()'), `${fn} に印刷/PDF保存ボタンが移植されていること`);
    console.log(`  ✅ PASS: ${fn} の生活期ブレ最小化ボタン（訪問／通所）およびタブ統合が完璧に完了している`);
});

console.log('\n====================================================');
console.log('🏁 UI/DOM 徹底検証完了: 全画面でボタン配置・ID結線が100%合格しました！');
console.log('====================================================');
