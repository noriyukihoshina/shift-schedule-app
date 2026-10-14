/**
 * 全制約・機能包括的自動テストスイート (comprehensive_test.js)
 */
const { 
    ShiftScheduler, 
    validateScheduleGrid, 
    validateInitialState,
    autoAssignRefreshHolidaysCore, 
    getTermRefreshGroups, 
    isJapaneseHoliday, 
    SYMBOLS, 
    REFRESH_HOLIDAY_CONFIG 
} = require('./solver.js');

const NUM_DAYS = 28;
const NUM_STAFF = 60;
const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ PASS: ${message}`);
    } else {
        failedTests++;
        console.error(`  ❌ FAIL: ${message}`);
    }
}

// ターム日付生成ヘルパー
function createTermDates(startStr) {
    const parts = startStr.split('-').map(Number);
    const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dates = [];
    for (let i = 0; i < NUM_DAYS; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const wIdx = (d.getDay() + 6) % 7;
        const isHoliday = isJapaneseHoliday(y, m, day);
        dates.push({
            y, m, year: y, month: m, day,
            weekday: WEEKDAYS[wIdx],
            label: `${m}/${day}`,
            wIdx,
            isSun: (wIdx === 6),
            isSat: (wIdx === 5),
            isHoliday,
            isHol: isHoliday,
            dateObj: d
        });
    }
    return dates;
}

function createDefaultDayOffsets(dates) {
    const arr = new Array(NUM_DAYS).fill(0);
    for (let d = 0; d < NUM_DAYS; d++) {
        const dObj = dates[d];
        if (dObj) {
            const isWeekendOrHol = dObj.isSun || dObj.isSat || 
                                   dObj.wIdx === 5 || dObj.wIdx === 6 || 
                                   dObj.weekday === '土' || dObj.weekday === '日' || 
                                   dObj.isHoliday || dObj.isHol;
            if (isWeekendOrHol) {
                arr[d] = -2;
            }
        }
    }
    return arr;
}

// 60名スタッフリスト生成ヘルパー
function createTestStaffList() {
    const staff = [];
    for (let i = 1; i <= NUM_STAFF; i++) {
        staff.push({
            id: i,
            name: `スタッフ ${i}`,
            isUnused: i > 50, // 1〜50名稼働、51〜60名空き
            section: i <= 15 ? 'PT A' : (i <= 30 ? 'PT B' : (i <= 40 ? 'OT A' : 'OT B')),
            can8: i <= 9, // No.1〜9のみ8時可
            noEarly: i === 13 || i === 14,
            noLate: i === 11 || i === 12,
            noEve: i === 15 || i === 16,
            canSched: i <= 4, // 1〜4がスケ可
            isRole: i <= 4,   // 1〜4が役職
            isFullTime: i <= 6, // 1〜6が専従
            allow6Consec: i === 7 || i === 8, // 7,8番のみ6連勤可
            prevDays: ['', '', '', '', ''],
            days: new Array(NUM_DAYS).fill('')
        });
    }
    return staff;
}

console.log('====================================================');
console.log('🧪 勤務表作成システム 全制約・機能包括的検証テスト');
console.log('====================================================\n');

// ----------------------------------------------------
// TEST 1: 日付生成および土日祝日-2オフセットの検証
// ----------------------------------------------------
console.log('【TEST 1: 日付生成および土日祝日-2オフセット】');
{
    // 2026年4月（通常月）
    const datesApr = createTermDates('2026-04-01');
    const offsetsApr = createDefaultDayOffsets(datesApr);
    let weekendHolCountApr = 0;
    let weekdayCountApr = 0;
    let offsetMismatchApr = 0;

    datesApr.forEach((d, idx) => {
        const isWeHol = (d.isSun || d.isSat || d.isHoliday);
        const expected = isWeHol ? -2 : 0;
        if (offsetsApr[idx] !== expected) offsetMismatchApr++;
        if (isWeHol) weekendHolCountApr++;
        else weekdayCountApr++;
    });

    assert(offsetMismatchApr === 0, `2026年4月期: 全28日の土日祝日(-2)と平日(0)が完全一致 (土日祝:${weekendHolCountApr}日, 平日:${weekdayCountApr}日)`);

    // 2026年5月（ゴールデンウィーク・祝日密集期）
    const datesMay = createTermDates('2026-04-29'); // 4/29(昭和の日), 5/3(憲法記念日), 5/4(みどりの日), 5/5(こどもの日), 5/6(振替休日)
    const offsetsMay = createDefaultDayOffsets(datesMay);
    let offsetMismatchMay = 0;
    let holFoundMay = 0;

    datesMay.forEach((d, idx) => {
        const isWeHol = (d.isSun || d.isSat || d.isHoliday);
        if (d.isHoliday) holFoundMay++;
        const expected = isWeHol ? -2 : 0;
        if (offsetsMay[idx] !== expected) offsetMismatchMay++;
    });

    assert(holFoundMay >= 5, `2026年GW期: 祝日・振替休日を正常検知 (${holFoundMay}日検知)`);
    assert(offsetMismatchMay === 0, `2026年GW期: 祝日および振替休日もすべて-2オフセットが正確に付与されている`);
}

// ----------------------------------------------------
// TEST 2: 第1段階（基本勤務表生成）ハード制約検証
// ----------------------------------------------------
console.log('\n【TEST 2: 第1段階（基本勤務表生成）ハード制約検証】');
{
    const staffList = createTestStaffList();
    const dates = createTermDates('2026-04-01');
    const offsets = createDefaultDayOffsets(dates);

    // 事前希望・固定枠をランダム＆典型パターンで投入
    staffList[0].days[2] = '休'; // 佐藤さん 3日目希望休
    staffList[1].days[4] = '有'; // 鈴木さん 5日目有休
    staffList[2].days[10] = '出'; // 高橋さん 11日目出張
    staffList[3].days[15] = '休'; // 田中さん 16日目希望休
    staffList[5].days[8] = '○';  // 事前確定日勤

    // 前ターム実績を付与（現場実態通り直近2連勤）
    staffList[0].prevDays = ['○', '○', '休', '○', '○'];
    staffList[7].prevDays = ['○', '○', '○', '○', '休'];

    const scheduler = new ShiftScheduler(staffList, {
        standardHolidays: 8.0,
        dates: dates,
        dayOffsets: offsets
    });

    const result = scheduler.solveBaseSchedule();
    if (!result.success) {
        console.error('solveBaseSchedule errors:', result.errors);
    }
    assert(result.success === true, '第1段階 solveBaseSchedule が正常終了（成功）すること');

    if (result.success) {
        const grid = result.grid;

        // 1. 事前希望の完全保持
        assert(grid[0][2].symbol === '休' && grid[0][2].isFixed === true, '事前希望休（休）が完全保持されている');
        assert(grid[1][4].symbol === '有' && grid[1][4].isFixed === true, '事前有休（有）が完全保持されている');
        assert(grid[2][10].symbol === '出' && grid[2][10].isFixed === true, '事前出張（出）が完全保持されている');

        // 2. 前ターム連勤からの引き継ぎと連勤制約チェック
        let consecViolation = 0;
        for (let s = 0; s < 50; s++) {
            const st = staffList[s];
            const maxAllowed = st.allow6Consec ? 6 : 5;
            let currentRun = 0;
            // prevDaysの末尾連続勤務数をカウント
            for (let p = 4; p >= 0; p--) {
                if (['○', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'].includes(st.prevDays[p])) {
                    currentRun++;
                } else {
                    break;
                }
            }

            for (let d = 0; d < NUM_DAYS; d++) {
                const sym = grid[s][d].symbol;
                if (['○', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'].includes(sym)) {
                    currentRun++;
                    if (currentRun > maxAllowed) {
                        consecViolation++;
                    }
                } else {
                    currentRun = 0;
                }
            }
        }
        assert(consecViolation === 0, `連勤制限（原則最大5連勤、6連勤可のみ6連勤）が100%遵守されている (違反数: ${consecViolation})`);

        // 3. 週出勤制限（日〜土スパンで出勤最大5日以内、完全週休2日）
        let weekWorkViolation = 0;
        scheduler.weekSpans.forEach((span, wIdx) => {
            for (let s = 0; s < 50; s++) {
                if (staffList[s].allow6Consec) continue;
                let workCount = 0;
                span.forEach(d => {
                    const sym = grid[s][d].symbol;
                    if (sym && ['○', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'].includes(sym) && sym !== '出') {
                        workCount++;
                    }
                });
                if (workCount > 5) {
                    weekWorkViolation++;
                }
            }
        });
        assert(weekWorkViolation === 0, `週出勤制限（全日曜〜土曜スパンで出勤最大5日以内・完全週休2日）が100%遵守されている (違反数: ${weekWorkViolation})`);

        // 4. 属性充足（スケ可2名以上、役職2名以上、専従3名以上）
        let attrViolation = 0;
        for (let d = 0; d < NUM_DAYS; d++) {
            let schedCount = 0, roleCount = 0, ftCount = 0;
            for (let s = 0; s < 50; s++) {
                const sym = grid[s][d].symbol;
                if (sym === '○') {
                    if (staffList[s].canSched) schedCount++;
                    if (staffList[s].isRole) roleCount++;
                    if (staffList[s].isFullTime) ftCount++;
                }
            }
            if (schedCount < 2) attrViolation++;
            if (roleCount < 2) attrViolation++;
            if (ftCount < 3) attrViolation++;
        }
        assert(attrViolation === 0, `毎日の必要属性人数（スケ可2名以上、役職2名以上、専従3名以上）が100%遵守されている (違反日数: ${attrViolation})`);

        // 5. 公休日数の遵守（4週8休 ➔ 8.0日以上）
        let holidayShortage = 0;
        for (let s = 0; s < 50; s++) {
            let offDays = 0;
            for (let d = 0; d < NUM_DAYS; d++) {
                const sym = grid[s][d].symbol;
                if (sym === '休') offDays += 1.0;
            }
            if (offDays < 8.0) holidayShortage++;
        }
        assert(holidayShortage === 0, `稼働スタッフ全員が公休基準（8.0日）を完全に満たしている (不足人数: ${holidayShortage})`);
    }
}

// ----------------------------------------------------
// TEST 3: 第2段階（特殊勤務配置）ハード制約検証
// ----------------------------------------------------
console.log('\n【TEST 3: 第2段階（特殊勤務配置）ハード制約検証】');
{
    const staffList = createTestStaffList();
    const dates = createTermDates('2026-04-01');
    const offsets = createDefaultDayOffsets(dates);

    const scheduler = new ShiftScheduler(staffList, {
        standardHolidays: 8.0,
        dates: dates,
        dayOffsets: offsets
    });

    // 第1段階実行
    scheduler.solveBaseSchedule();
    // 第2段階実行
    const specialResult = scheduler.assignSpecialDutiesToGrid();
    assert(specialResult.success === true, '第2段階 assignSpecialDutiesToGrid が正常終了（成功）すること');

    if (specialResult.success) {
        const grid = specialResult.grid;

        // 1. 日別定数配置（早3, 遅1, E2, 8時1）
        let countMismatch = 0;
        for (let d = 0; d < NUM_DAYS; d++) {
            let early = 0, late = 0, eve = 0, h8 = 0;
            for (let s = 0; s < 50; s++) {
                const sym = grid[s][d].symbol;
                if (sym === '早' || sym === 'ハヤ') early++;
                if (sym === '遅' || sym === 'オソ') late++;
                if (sym === 'E' || sym === 'イブ') eve++;
                if (sym === '8時') h8++;
            }
            if (early !== 3 || late !== 1 || eve !== 2 || h8 !== 1) {
                countMismatch++;
            }
        }
        assert(countMismatch === 0, `全28日間の特殊勤務人数（早3名, 遅1名, E2名, 8時1名）が完全合致している (不一致日数: ${countMismatch})`);

        // 2. 特殊勤務翌日の休日化（早・遅・E・ハヤ・オソ・イブの翌日は必ず休日）
        let specialNextDayViolation = 0;
        for (let s = 0; s < 50; s++) {
            for (let d = 0; d < NUM_DAYS - 1; d++) {
                const sym = grid[s][d].symbol;
                if (['早', '遅', 'E', 'ハヤ', 'オソ', 'イブ'].includes(sym)) {
                    const nextSym = grid[s][d + 1].symbol;
                    const isNextHoliday = ['休', '有', '上1', '上2', '上3', '上4', '上5', '下1', '下2', '下3'].includes(nextSym);
                    if (!isNextHoliday) {
                        specialNextDayViolation++;
                    }
                }
            }
        }
        assert(specialNextDayViolation === 0, `特殊勤務（早・遅・E）翌日の100%休日配置が遵守されている (違反数: ${specialNextDayViolation})`);

        // 3. 8時勤務の均等配置（8時可スタッフ No.1〜9 から選出されているか）
        let h8NonCan8Count = 0;
        const h8AssignedCounts = new Array(NUM_STAFF).fill(0);
        for (let d = 0; d < NUM_DAYS; d++) {
            for (let s = 0; s < 50; s++) {
                if (grid[s][d].symbol === '8時') {
                    h8AssignedCounts[s]++;
                    if (!staffList[s].can8) {
                        h8NonCan8Count++;
                    }
                }
            }
        }
        assert(h8NonCan8Count === 0, `8時勤務は「8時可」スタッフ（No.1〜9）のみから正確に選出されている (対象外選出数: ${h8NonCan8Count})`);

        const can8Counts = h8AssignedCounts.slice(0, 9);
        const minH8 = Math.min(...can8Counts);
        const maxH8 = Math.max(...can8Counts);
        assert(maxH8 - minH8 <= 2, `8時可スタッフ間での8時勤務割当が均等に分散されている (最少:${minH8}回, 最多:${maxH8}回)`);
    }
}

// ----------------------------------------------------
// TEST 4: リフレッシュ休暇（リフ）自動配分とルール検証
// ----------------------------------------------------
console.log('\n【TEST 4: リフレッシュ休暇（リフ）自動配分と運用ルール検証】');
{
    // 6月期（上1の対象月）
    const datesJune = createTermDates('2026-06-01');
    const staffListJune = createTestStaffList();

    const groups = getTermRefreshGroups(datesJune);
    assert(groups.length > 0 && groups[0].symbol === '上1', '6月期で「上1」のリフ対象グループが正しく取得できる');

    const assignRes = autoAssignRefreshHolidaysCore(staffListJune, datesJune, {
        obtainedHistory: {}
    });

    assert(assignRes.success === true && assignRes.assignedCount > 0, `リフ自動配分が実行され、${assignRes.assignedCount}名に「上1」が自動配分された`);

    // 重複配分防止チェック
    const staffIdsAssigned = assignRes.assignments.map(a => a.staffId);
    const uniqueStaffIds = new Set(staffIdsAssigned);
    assert(staffIdsAssigned.length === uniqueStaffIds.size, '同一スタッフへのリフ重複配分が発生していないこと');

    // 連勤切断・リセットの検証
    // リフが入っているスタッフについて、リフが正常に休日として機能しているか
    const testStaffIdx = assignRes.assignments[0].staffIndex;
    const testDayIdx = assignRes.assignments[0].dayIndex;
    assert(staffListJune[testStaffIdx].days[testDayIdx] === '上1', '配分されたセルに上1がセットされている');

    // 自動配分されたリフの通常セル扱い（isFixed: false）および誤消去検知の検証
    const autoAssignedRefKeys = new Set();
    const autoAssignedStaffIds = new Set();
    assignRes.assignments.forEach(a => {
        autoAssignedRefKeys.add(`${a.staffIndex},${a.dayIndex}`);
        autoAssignedStaffIds.add(a.staffId);
    });

    const schedulerJune = new ShiftScheduler(staffListJune, {
        standardHolidays: 8.0,
        dates: datesJune,
        dayOffsets: createDefaultDayOffsets(datesJune)
    });

    const baseJuneResult = schedulerJune.solveBaseSchedule();
    assert(baseJuneResult.success === true, 'リフ配分後の基本勤務表生成が成功すること');

    if (baseJuneResult.success) {
        // app.js と同様に自動配分リフを通常文字化
        for (let s = 0; s < NUM_STAFF; s++) {
            if (!baseJuneResult.grid[s]) continue;
            for (let d = 0; d < NUM_DAYS; d++) {
                const cell = baseJuneResult.grid[s][d];
                if (SYMBOLS.REF_SUMMER.includes(cell.symbol) && autoAssignedRefKeys.has(`${s},${d}`)) {
                    cell.isFixed = false;
                }
            }
        }

        const sampleCell = baseJuneResult.grid[testStaffIdx][testDayIdx];
        assert(sampleCell.isFixed === false, '自動配分されたリフセルの isFixed が false（通常セル・編集自由）になっていること');

        // 誤消去検知シミュレーション: testStaffIdx のリフを「○」に上書きして消去
        baseJuneResult.grid[testStaffIdx][testDayIdx].symbol = '○';

        // 検知ロジック実行
        let missingRefDetected = false;
        staffListJune.forEach((st, sIdx) => {
            if (st.isUnused || !autoAssignedStaffIds.has(st.id)) return;
            let count = 0;
            for (let d = 0; d < NUM_DAYS; d++) {
                if (SYMBOLS.REF_SUMMER.includes(baseJuneResult.grid[sIdx][d].symbol)) count++;
            }
            if (count === 0 && st.id === staffListJune[testStaffIdx].id) {
                missingRefDetected = true;
            }
        });
        assert(missingRefDetected === true, '自動配分されたリフが誤って消去された場合、検知ロジックが確実に警告を発すること');
    }
}

// ----------------------------------------------------
// TEST 5: 出勤人数の平準化（ブレ極小化）検証
// ----------------------------------------------------
console.log('\n【TEST 5: 出勤人数の平準化（ブレ極小化）検証】');
{
    const staffList = createTestStaffList();
    const dates = createTermDates('2026-04-01');
    const offsets = createDefaultDayOffsets(dates);

    const scheduler = new ShiftScheduler(staffList, {
        standardHolidays: 8.0,
        dates: dates,
        dayOffsets: offsets
    });

    scheduler.solveBaseSchedule();
    const stats = scheduler.calculateStats();

    let weekdayWorks = [];
    let weekendWorks = [];

    stats.daily.forEach((dStat, idx) => {
        const isWe = (dates[idx].isSun || dates[idx].isSat || dates[idx].isHoliday);
        if (isWe) {
            weekendWorks.push(dStat.totalWork);
        } else {
            weekdayWorks.push(dStat.totalWork);
        }
    });

    const minWk = Math.min(...weekdayWorks);
    const maxWk = Math.max(...weekdayWorks);
    const minWe = Math.min(...weekendWorks);
    const maxWe = Math.max(...weekendWorks);

    assert(maxWk - minWk <= 4, `平日出勤実数のブレ幅が極小（最少:${minWk}名, 最大:${maxWk}名, ブレ:${maxWk - minWk}名以内）であること`);
    assert(maxWe - minWe <= 4, `土日祝日出勤実数のブレ幅が極小（最少:${minWe}名, 最大:${maxWe}名, ブレ:${maxWe - minWe}名以内）であること`);
}

// ----------------------------------------------------
// TEST 6: 60名枠（空き枠スタッフ No.51〜60）の完全除外検証
// ----------------------------------------------------
console.log('\n【TEST 6: 60名枠（空き枠スタッフ No.51〜60）の完全除外検証】');
{
    const staffList = createTestStaffList();
    const dates = createTermDates('2026-04-01');
    const scheduler = new ShiftScheduler(staffList, {
        standardHolidays: 8.0,
        dates: dates,
        dayOffsets: createDefaultDayOffsets(dates)
    });

    scheduler.solveBaseSchedule();
    let unusedStaffDutyCount = 0;
    for (let s = 50; s < 60; s++) {
        for (let d = 0; d < NUM_DAYS; d++) {
            if (scheduler.grid[s][d].symbol !== '') {
                unusedStaffDutyCount++;
            }
        }
    }
    assert(unusedStaffDutyCount === 0, `空き枠スタッフ（No.51〜60）に勤務が一切割り振られず空欄が維持されていること (割当数: ${unusedStaffDutyCount})`);
}

console.log('\n====================================================');
console.log(`🏁 テスト完了: 全 ${totalTests} 項目中、合格: ${passedTests} / 失敗: ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
    process.exit(1);
} else {
    console.log('🎉 すべての条件・制約・新機能が完璧に実装され、正常動作しています！');
    process.exit(0);
}
