const { ShiftScheduler, autoAssignRefreshHolidaysCore, SYMBOLS, isWorkSymbol, isHolidaySymbol } = require('../solver.js');

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

function generateJuneDates() {
    const dates = [];
    const startDate = new Date(2026, 5, 1);
    for (let d = 0; d < 28; d++) {
        const cur = new Date(startDate);
        cur.setDate(startDate.getDate() + d);
        const y = cur.getFullYear();
        const m = cur.getMonth() + 1;
        const dt = cur.getDate();
        const wIdx = cur.getDay();
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

const dates = generateJuneDates();
const dayOffsets = new Array(28).fill(0);
for (let d = 0; d < 28; d++) {
    if (dates[d].isSun || dates[d].isSat) dayOffsets[d] = -2;
}

console.log('=== 公式 verifyBaseHardConstraints による厳密検証 ===\n');

['1f', 'south', '2f', '3f'].forEach(fl => {
    console.log(`--- フロア: ${fl.toUpperCase()} ---`);
    const isSouth = (fl === 'south');

    // 方式A: リフ先入れ
    const staffA = generateTestStaffList(fl);
    const refA = autoAssignRefreshHolidaysCore(staffA, dates, {});
    const schedA = new ShiftScheduler(staffA, { standardHolidays: 8.0, dates, dayOffsets, isSouth });
    const resA = schedA.solveBaseSchedule();
    const errsA = schedA.verifyBaseHardConstraints();

    console.log(`[方式A: 現行先入れ] 成功: ${resA.success}, 公式エラー数: ${errsA.length} 件`);
    if (errsA.length > 0) {
        console.log(`  エラー詳細例:`, errsA.slice(0, 3));
    }

    // 方式B: 骨格先生成＋後入れ昇格
    const staffB = generateTestStaffList(fl);
    const schedB = new ShiftScheduler(staffB, { standardHolidays: 8.0, dates, dayOffsets, isSouth });
    const resB = schedB.solveBaseSchedule();

    // 骨格完成後にリフを配分
    let targetCount = refA.assignedCount;
    let assignedB = 0;
    const activeStaff = staffB.filter(s => !s.isUnused).map(s => s.id - 1);

    // 日別出勤者数
    const dailyCounts = new Array(28).fill(0);
    for (let d = 0; d < 28; d++) {
        for (const s of activeStaff) {
            if (isWorkSymbol(schedB.grid[s][d].symbol)) dailyCounts[d]++;
        }
    }

    for (const s of activeStaff.slice(0, targetCount)) {
        let bestD = -1;
        let bestScore = -99999;
        for (let d = 0; d < 28; d++) {
            if (schedB.grid[s][d].symbol !== SYMBOLS.WORK || schedB.grid[s][d].isFixed) continue;
            
            // 係長等の土日休みスタッフは平日限定
            if (staffB[s].isSectionChief && (dates[d].isSat || dates[d].isSun)) continue;

            // 役職者保護: 主任・副主任がこの日に休んでも、当日に別の主任・副主任が残るか確認
            if (staffB[s].isChief || staffB[s].isSubChief) {
                let remainingRole = 0;
                for (const otherS of activeStaff) {
                    if (otherS === s) continue;
                    if ((staffB[otherS].isChief || staffB[otherS].isSubChief) && isWorkSymbol(schedB.grid[otherS][d].symbol)) {
                        remainingRole++;
                    }
                }
                if (remainingRole < 1) continue; // 役職不在になる日はリフを置かない！
            }

            // スケ可保護
            if (staffB[s].canSched) {
                let remainingSched = 0;
                for (const otherS of activeStaff) {
                    if (otherS === s) continue;
                    if (staffB[otherS].canSched && isWorkSymbol(schedB.grid[otherS][d].symbol)) remainingSched++;
                }
                if (remainingSched < 2) continue; // スケ可2名未満になる日は避ける！
            }

            let score = dailyCounts[d] * 10;
            const prevSym = d > 0 ? schedB.grid[s][d - 1].symbol : '';
            const nextSym = d < 27 ? schedB.grid[s][d + 1].symbol : '';
            if (isHolidaySymbol(prevSym)) score += 50;
            if (isHolidaySymbol(nextSym)) score += 50;

            if (score > bestScore) {
                bestScore = score;
                bestD = d;
            }
        }

        if (bestD !== -1) {
            schedB.grid[s][bestD].symbol = '上1';
            schedB.grid[s][bestD].isFixed = false;
            dailyCounts[bestD]--;
            assignedB++;
        }
    }

    const errsB = schedB.verifyBaseHardConstraints();
    console.log(`[方式B: 後入れ昇格] 成功: ${resB.success}, 公式エラー数: ${errsB.length} 件 (リフ付与: ${assignedB}/${targetCount})`);
    if (errsB.length > 0) {
        console.log(`  エラー詳細例:`, errsB.slice(0, 3));
    }
    console.log('');
});
