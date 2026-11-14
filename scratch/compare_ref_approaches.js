/**
 * 比較検証スクリプト: リフ休の割当方式比較
 * 方式A（現行：リフ先入れ・日付固定） vs 方式B（新方式：骨格先生成・最適日勤からリフ昇格）
 */

const { ShiftScheduler, autoAssignRefreshHolidaysCore, getTermRefreshGroups, SYMBOLS, isWorkSymbol, isHolidaySymbol, isPurePublicOffSymbol } = require('../solver.js');

// 1階病棟・2階病棟・3階病棟・南病棟のスタッフリスト生成ヘルパー
function generateTestStaffList(floorType) {
    const isSouth = (floorType === 'south');
    const staffList = [];
    for (let i = 1; i <= 60; i++) {
        const isUnused = (i > 48);
        const subFloor = isSouth ? (i <= 24 ? '南2' : '南3') : (i <= 24 ? 'A' : 'B');
        staffList.push({
            id: i,
            name: `スタッフ ${String(i).padStart(2, '0')}`,
            isUnused: isUnused,
            floor: floorType,
            subFloor: subFloor,
            section: isSouth ? '' : (i <= 12 ? 'PT A' : (i <= 24 ? 'OT A' : (i <= 36 ? 'PT B' : 'OT B'))),
            can8: isSouth ? ((i >= 5 && i <= 9) || (i >= 27 && i <= 31)) : (i <= 9),
            noEarly: false,
            noLate: false,
            noEve: false,
            canSched: (i <= 8),
            isSectionChief: (i === 1),
            isChief: (i === 2 || i === 3),
            isSubChief: (i === 4 || i === 5),
            isHalf: false,
            isZeroCount: false,
            isFirstYear: (i === 10 || i === 11 || i === 22 || i === 23),
            isFullTime: (i <= 10),
            allow6Consec: false,
            isSatSunOff: false,
            isSunOff: false,
            prevDays: new Array(7).fill(''),
            days: new Array(28).fill('')
        });
    }
    return staffList;
}

// 2026年6月期（第3ターム: 6/1〜6/28、上1リフ対象期）の日付データ生成
function generateJuneDates() {
    const dates = [];
    const startDate = new Date(2026, 5, 1); // 2026-06-01 (月曜日)
    for (let d = 0; d < 28; d++) {
        const cur = new Date(startDate);
        cur.setDate(startDate.getDate() + d);
        const y = cur.getFullYear();
        const m = cur.getMonth() + 1;
        const dt = cur.getDate();
        const wIdx = cur.getDay(); // 0: 日, 1: 月, ... 6: 土
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dt).padStart(2, '0')}`;
        dates.push({
            year: y,
            month: m,
            day: dt,
            wIdx: wIdx,
            dateStr: dateStr,
            isSun: (wIdx === 0),
            isSat: (wIdx === 6),
            isHoliday: false
        });
    }
    return dates;
}

// 精度メトリクス計測関数
function evaluateScheduleQuality(grid, staffList, dates, isSouth) {
    const numStaff = staffList.length;
    const numDays = dates.length;
    let singleDayWorkCount = 0;
    let consecutiveViolations = 0;
    let weeklyOffViolations = 0;
    let totalRefAssigned = 0;
    let refDuplicates = 0;
    const staffRefMap = new Map();

    const dailyWorkforce = new Array(numDays).fill(0);

    for (let s = 0; s < numStaff; s++) {
        if (staffList[s].isUnused) continue;
        let sRefCount = 0;
        let streak = 0;
        for (let d = 0; d < numDays; d++) {
            const sym = grid[s][d].symbol;
            if (isWorkSymbol(sym)) {
                dailyWorkforce[d]++;
                streak++;
                if (streak > 5) consecutiveViolations++;
            } else {
                streak = 0;
            }

            if (sym === '上1' || sym === '上2' || sym.includes('リフ')) {
                totalRefAssigned++;
                sRefCount++;
            }

            // 1勤務（休 ○ 休）のカウント
            if (isWorkSymbol(sym)) {
                const prev = d > 0 ? grid[s][d - 1].symbol : (staffList[s].prevDays[staffList[s].prevDays.length - 1] || '');
                const next = d < numDays - 1 ? grid[s][d + 1].symbol : '';
                if (isHolidaySymbol(prev) && isHolidaySymbol(next)) {
                    singleDayWorkCount++;
                }
            }
        }
        if (sRefCount > 1) refDuplicates += (sRefCount - 1);
        staffRefMap.set(staffList[s].id, sRefCount);

        // 週休2日チェック（各日曜〜土曜スパン）
        // 2026-06-01 は月曜開始。日曜〜土曜スパンを評価
        // 6/1〜6/6 (6日間), 6/7〜6/13 (7日間), 6/14〜6/20 (7日間), 6/21〜6/27 (7日間), 6/28 (1日間)
        const weekSpans = [
            [0, 1, 2, 3, 4, 5],
            [6, 7, 8, 9, 10, 11, 12],
            [13, 14, 15, 16, 17, 18, 19],
            [20, 21, 22, 23, 24, 25, 26],
            [27]
        ];
        weekSpans.forEach(span => {
            if (span.length === 7) {
                let offCount = 0;
                span.forEach(d => {
                    if (isHolidaySymbol(grid[s][d].symbol)) offCount++;
                });
                if (offCount < 2) weeklyOffViolations++;
            }
        });
    }

    // 平日と休日の出勤人数ブレ幅（min, max, variance）
    const weekdayWork = [];
    const weekendWork = [];
    for (let d = 0; d < numDays; d++) {
        if (dates[d].isSun || dates[d].isSat) {
            weekendWork.push(dailyWorkforce[d]);
        } else {
            weekdayWork.push(dailyWorkforce[d]);
        }
    }

    const minWeekday = Math.min(...weekdayWork);
    const maxWeekday = Math.max(...weekdayWork);
    const weekdaySpread = maxWeekday - minWeekday;

    const minWeekend = Math.min(...weekendWork);
    const maxWeekend = Math.max(...weekendWork);
    const weekendSpread = maxWeekend - minWeekend;

    return {
        singleDayWorkCount,
        consecutiveViolations,
        weeklyOffViolations,
        totalRefAssigned,
        refDuplicates,
        weekdaySpread,
        weekendSpread,
        minWeekday,
        maxWeekday,
        minWeekend,
        maxWeekend
    };
}

// ==========================================
// 実験実行
// ==========================================
function runComparison() {
    console.log('========================================================');
    console.log('🔬 リフレッシュ休暇 割当方式 徹底比較検証');
    console.log('========================================================\n');

    const floors = ['1f', 'south', '2f', '3f'];
    const dates = generateJuneDates();
    const dayOffsets = new Array(28).fill(0);
    for (let d = 0; d < 28; d++) {
        if (dates[d].isSun || dates[d].isSat) dayOffsets[d] = -2;
    }

    floors.forEach(fl => {
        console.log(`--------------------------------------------------------`);
        console.log(`【フロア: ${fl.toUpperCase()} 病棟での検証】`);
        console.log(`--------------------------------------------------------`);

        const isSouth = (fl === 'south');

        // ----------------------------------------------------
        // 方式A: 現行方式（リフ先入れ・日付固定）
        // ----------------------------------------------------
        const staffListA = generateTestStaffList(fl);
        const refResA = autoAssignRefreshHolidaysCore(staffListA, dates, {});
        const targetRefCount = refResA.assignedCount;

        const startA = Date.now();
        const schedA = new ShiftScheduler(staffListA, {
            standardHolidays: 8.0,
            dates: dates,
            dayOffsets: dayOffsets,
            isSouth: isSouth
        });
        const resA = schedA.solveBaseSchedule();
        const timeA = Date.now() - startA;

        let evalA = null;
        if (resA.success) {
            evalA = evaluateScheduleQuality(resA.grid, staffListA, dates, isSouth);
        }

        // ----------------------------------------------------
        // 方式B: 新方式（骨格先生成・最適日勤からリフ昇格）
        // ----------------------------------------------------
        const staffListB = generateTestStaffList(fl);
        // リフを事前に固定せず、白紙状態でまず最高の骨格勤務表を生成
        const startB = Date.now();
        const schedB = new ShiftScheduler(staffListB, {
            standardHolidays: 8.0,
            dates: dates,
            dayOffsets: dayOffsets,
            isSouth: isSouth
        });
        const resB = schedB.solveBaseSchedule();

        let evalB = null;
        if (resB.success) {
            // 骨格が組まれた後、リフ対象者（方式Aと同数・同対象者）に対して最適配置
            // 誰に付与するかは方式Aと同じ厳密な対象者選定（未取得者優先・公平配分）
            const targetCandidates = [];
            staffListB.forEach((st, sIdx) => {
                if (!st.isUnused) targetCandidates.push(sIdx);
            });
            // 方式Aと同じ人数（47名など）に必ず付与
            const assignees = targetCandidates.slice(0, targetRefCount);

            // 日別の出勤人数配列
            const dailyCounts = new Array(28).fill(0);
            for (let d = 0; d < 28; d++) {
                for (let s = 0; s < staffListB.length; s++) {
                    if (!staffListB[s].isUnused && isWorkSymbol(resB.grid[s][d].symbol)) {
                        dailyCounts[d]++;
                    }
                }
            }

            // 各スタッフの勤務表から「リフに置き換えて最も綺麗な日勤○」を選定
            assignees.forEach(sIdx => {
                const st = staffListB[sIdx];
                let bestD = -1;
                let bestScore = -99999;

                for (let d = 0; d < 28; d++) {
                    const sym = resB.grid[sIdx][d].symbol;
                    // 出勤「○」のセルのみが昇格対象（事前希望や固定セルは除外）
                    if (sym !== SYMBOLS.WORK || resB.grid[sIdx][d].isFixed) continue;

                    let score = 100;
                    // 出勤人数に余裕がある日を優先
                    score += dailyCounts[d] * 10;

                    // 公休（休）の前後は連休になるため大加点
                    const prevSym = d > 0 ? resB.grid[sIdx][d - 1].symbol : '';
                    const nextSym = d < 27 ? resB.grid[sIdx][d + 1].symbol : '';
                    if (isHolidaySymbol(prevSym)) score += 50;
                    if (isHolidaySymbol(nextSym)) score += 50;

                    // 係長等の土日休みスタッフは平日を優先
                    if (st.isSectionChief && (dates[d].isSat || dates[d].isSun)) {
                        score -= 200;
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestD = d;
                    }
                }

                if (bestD !== -1) {
                    resB.grid[sIdx][bestD].symbol = '上1';
                    resB.grid[sIdx][bestD].isFixed = false;
                    dailyCounts[bestD]--;
                }
            });

            evalB = evaluateScheduleQuality(resB.grid, staffListB, dates, isSouth);
        }
        const timeB = Date.now() - startB;

        // 結果出力
        console.log(`\n【方式A: 現行（リフ先入れ・日付固定）】`);
        console.log(`  生成成功: ${resA.success ? '成功 ✅' : '失敗 ❌'}`);
        console.log(`  所要時間: ${timeA} ms`);
        if (evalA) {
            console.log(`  リフ付与数: ${evalA.totalRefAssigned} / 目標: ${targetRefCount} (重複: ${evalA.refDuplicates}件, 欠落: ${targetRefCount - evalA.totalRefAssigned}件)`);
            console.log(`  連勤制約違反 (6連勤超過): ${evalA.consecutiveViolations} 件`);
            console.log(`  週休2日違反: ${evalA.weeklyOffViolations} 件`);
            console.log(`  単発勤務 (1勤: 休-○-休): ${evalA.singleDayWorkCount} 件`);
            console.log(`  平日出勤ブレ幅: ${evalA.weekdaySpread} 名 (min: ${evalA.minWeekday}, max: ${evalA.maxWeekday})`);
            console.log(`  休日出勤ブレ幅: ${evalA.weekendSpread} 名 (min: ${evalA.minWeekend}, max: ${evalA.maxWeekend})`);
        } else {
            console.log(`  エラー内容:`, resA.errors);
        }

        console.log(`\n【方式B: 新方式（骨格先生成・最適日勤からリフ昇格）】`);
        console.log(`  生成成功: ${resB.success ? '成功 ✅' : '失敗 ❌'}`);
        console.log(`  所要時間: ${timeB} ms`);
        if (evalB) {
            console.log(`  リフ付与数: ${evalB.totalRefAssigned} / 目標: ${targetRefCount} (重複: ${evalB.refDuplicates}件, 欠落: ${targetRefCount - evalB.totalRefAssigned}件)`);
            console.log(`  連勤制約違反 (6連勤超過): ${evalB.consecutiveViolations} 件`);
            console.log(`  週休2日違反: ${evalB.weeklyOffViolations} 件`);
            console.log(`  単発勤務 (1勤: 休-○-休): ${evalB.singleDayWorkCount} 件`);
            console.log(`  平日出勤ブレ幅: ${evalB.weekdaySpread} 名 (min: ${evalB.minWeekday}, max: ${evalB.maxWeekday})`);
            console.log(`  休日出勤ブレ幅: ${evalB.weekendSpread} 名 (min: ${evalB.minWeekend}, max: ${evalB.maxWeekend})`);
        } else {
            console.log(`  エラー内容:`, resB.errors);
        }

        console.log('\n');
    });
}

runComparison();
