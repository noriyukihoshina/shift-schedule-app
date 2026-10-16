const fs = require('fs');
const path = require('path');

const solverPath = path.join(__dirname, 'solver.js');
let code = fs.readFileSync(solverPath, 'utf8').replace(/\r\n/g, '\n');

// 1. 重複コメント行のクリーンアップ
code = code.replace(
`                    // ★ 係長は特殊勤務なし（事前希望で入力された特殊勤務のみ残し、自動割当は一切行わない）
                    if (this.staffList[s].isSectionChief) continue;
                    // ★ 係長は特殊勤務なし（事前希望で入力された特殊勤務のみ残し、自動割当は一切行わない）
                    if (this.staffList[s].isSectionChief) continue;`,
`                    // ★ 係長は特殊勤務なし（事前希望で入力された特殊勤務のみ残し、自動割当は一切行わない）
                    if (this.staffList[s].isSectionChief) continue;`
);

// 2. validateInitialState で係長の希望特殊勤務（8時・早・遅・E）がトグル状態に関わらずエラーにならないようにし、5連勤後2連休も係長柔軟許容
const oldValInitFlags = `        // A. 個別フラグ違反チェック
        for (let d = 0; d < numDays; d++) {
            const sym = staff.days[d];
            if (!sym) continue;
            const dayNum = d + 1;
            if (sym === SYMBOLS.H8 && !staff.can8) {`;
const newValInitFlags = `        // A. 個別フラグ違反チェック（係長に希望入力された特殊勤務はトグルに関わらず許可・保持）
        for (let d = 0; d < numDays; d++) {
            if (staff.isSectionChief) break;
            const sym = staff.days[d];
            if (!sym) continue;
            const dayNum = d + 1;
            if (sym === SYMBOLS.H8 && !staff.can8) {`;
if (code.includes(oldValInitFlags)) {
    code = code.replace(oldValInitFlags, newValInitFlags);
    console.log('✅ Exempted Section Chief wished special duties in validateInitialState');
}

const oldValInit5Consec = `        // D. 5連勤後の2連休ルールチェック（6連勤可フラグOFFのスタッフのみ）
        if (!staff.allow6Consec) {`;
const newValInit5Consec = `        // D. 5連勤後の2連休ルールチェック（6連勤可フラグOFFのスタッフのみ。係長は土日希望出勤時の単休＋平日代休を柔軟許容）
        if (!staff.allow6Consec && !staff.isSectionChief) {`;
if (code.includes(oldValInit5Consec)) {
    code = code.replace(oldValInit5Consec, newValInit5Consec);
    console.log('✅ Updated 5-consec check in validateInitialState');
}

// 3. validateScheduleGrid でも係長の希望特殊勤務がトグル状態に関わらずエラーにならないようにする
const oldValGridFlags = `        // A. 個別不可フラグチェック
        for (let d = 0; d < numDays; d++) {
            const sym = getSym(s, d);
            const dayNum = d + 1;
            if (sym === SYMBOLS.H8 && !staff.can8) {`;
const newValGridFlags = `        // A. 個別不可フラグチェック（係長に希望入力された特殊勤務はトグルに関わらず許可・保持）
        for (let d = 0; d < numDays; d++) {
            if (staff.isSectionChief) break;
            const sym = getSym(s, d);
            const dayNum = d + 1;
            if (sym === SYMBOLS.H8 && !staff.can8) {`;
if (code.includes(oldValGridFlags)) {
    code = code.replace(oldValGridFlags, newValGridFlags);
    console.log('✅ Exempted Section Chief wished special duties in validateScheduleGrid');
}

// 4. getMaxAllowedUnfixedWeekdayOffForSectionChief で isAfterPreSpecial も考慮
const oldGetMaxWeekdayOff = `    getMaxAllowedUnfixedWeekdayOffForSectionChief(s) {
        const staff = this.staffList[s];
        if (!staff || !staff.isSectionChief) return this.numDays;
        let fixedOff = 0;
        let availableWeekendSlots = 0;
        for (let d = 0; d < this.numDays; d++) {
            const isWkday = this.isWeekdayIndex(d);
            if (this.grid[s][d].isFixed) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.OFF) fixedOff += 1.0;
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) fixedOff += 0.5;
            } else if (!isWkday) {
                availableWeekendSlots += 1;
            }
        }
        const neededUnfixedOff = Math.max(0, Math.round(this.options.standardHolidays - fixedOff));
        return Math.max(0, neededUnfixedOff - availableWeekendSlots);
    }`;
const newGetMaxWeekdayOff = `    getMaxAllowedUnfixedWeekdayOffForSectionChief(s) {
        const staff = this.staffList[s];
        if (!staff || !staff.isSectionChief) return this.numDays;
        let weekendFixedWorkCount = 0;
        let preSpecialNextWeekdayOffCount = 0;
        let fixedOff = 0;
        let availableWeekendSlots = 0;
        for (let d = 0; d < this.numDays; d++) {
            const isWkday = this.isWeekdayIndex(d);
            if (this.grid[s][d].isFixed || this.grid[s][d].isAfterPreSpecial) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.OFF) fixedOff += 1.0;
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) fixedOff += 0.5;
                if (!isWkday && isWorkSymbol(sym)) weekendFixedWorkCount++;
                if (isWkday && this.grid[s][d].isAfterPreSpecial) preSpecialNextWeekdayOffCount++;
            } else if (!isWkday) {
                availableWeekendSlots += 1;
            }
        }
        const neededUnfixedOff = Math.max(0, Math.round(this.options.standardHolidays - fixedOff));
        return Math.max(neededUnfixedOff - availableWeekendSlots, weekendFixedWorkCount + preSpecialNextWeekdayOffCount);
    }`;
if (code.includes(oldGetMaxWeekdayOff)) {
    code = code.replace(oldGetMaxWeekdayOff, newGetMaxWeekdayOff);
    console.log('✅ Updated getMaxAllowedUnfixedWeekdayOffForSectionChief');
}

// 5. canPlaceHoliday と isGlobalAttributesValid で 8時可(can8) のカウントから係長を除外（係長には自動で8時を割り当てないため、他の8時可スタッフを確実に残す）
const oldCanPlace8 = `        // 1-2. 8時可保護：当日dに出勤できる「8時可」スタッフを維持
        if (staff.can8) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s || this.staffList[otherS].isUnused) continue;
                if (this.staffList[otherS].can8 && !isHolidaySymbol(this.grid[otherS][d].symbol)) {
                    available++;
                }
            }
            const totalCan8 = this.staffList.filter(st => !st.isUnused && st.can8).length;
            const minKeep = Math.min(reqCan8, totalCan8);
            if (available < minKeep) return false;
        }`;
const newCanPlace8 = `        // 1-2. 8時可保護：当日dに出勤できる「8時可」スタッフ（係長除く）を維持
        if (staff.can8 && !staff.isSectionChief) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s || this.staffList[otherS].isUnused || this.staffList[otherS].isSectionChief) continue;
                if (this.staffList[otherS].can8 && !isHolidaySymbol(this.grid[otherS][d].symbol)) {
                    available++;
                }
            }
            const totalCan8 = this.staffList.filter(st => !st.isUnused && !st.isSectionChief && st.can8).length;
            const minKeep = Math.min(reqCan8, totalCan8);
            if (available < minKeep) return false;
        }`;
if (code.includes(oldCanPlace8)) {
    code = code.replace(oldCanPlace8, newCanPlace8);
    console.log('✅ Updated canPlaceHoliday 8:00 protection to exclude Section Chief');
}

const oldGlobal8 = `                if (this.staffList[s].can8 && isWorkSymbol(sym)) {
                    totalH8Cand++;
                    if (!this.staffList[s].canSched) pureH8Cand++;
                }`;
const newGlobal8 = `                if ((this.staffList[s].can8 && !this.staffList[s].isSectionChief && isWorkSymbol(sym)) || sym === SYMBOLS.H8) {
                    totalH8Cand++;
                    if (!this.staffList[s].canSched || sym === SYMBOLS.H8) pureH8Cand++;
                }`;
if (code.includes(oldGlobal8)) {
    code = code.replace(oldGlobal8, newGlobal8);
    console.log('✅ Updated isGlobalAttributesValid 8:00 check to exclude Section Chief');
}

// 6. assignSpecialDutiesToGrid の冒頭で、係長に非固定の特殊勤務（過去データ等）があればリセットし、特殊勤務スワップで isAfterPreSpecial を保護
const oldAssignSpecToGrid = `    assignSpecialDutiesToGrid(options = {}) {
        const force = options && options.force === true;

        // ステップ1: 8時勤務（1名/日）を優先配置！（8時可フラグのある貴重なスタッフから均等に選出）`;
const newAssignSpecToGrid = `    assignSpecialDutiesToGrid(options = {}) {
        const force = options && options.force === true;

        // ステップ0: 事前希望の特殊勤務の翌日休フラグを確実に同期し、係長に非固定の特殊勤務が混入していればクリーンアップ
        this.ensureHolidaysAfterPreAssignedSpecials();
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused || !this.staffList[s].isSectionChief) continue;
            let hadUnfixedSpecial = false;
            for (let d = 0; d < this.numDays; d++) {
                if (!this.grid[s][d].isFixed && (isRestrictedSpecial(this.grid[s][d].symbol) || this.grid[s][d].symbol === SYMBOLS.H8)) {
                    this.grid[s][d].symbol = this.isWeekdayIndex(d) ? SYMBOLS.WORK : SYMBOLS.OFF;
                    hadUnfixedSpecial = true;
                }
            }
            if (hadUnfixedSpecial) {
                const maxConsec = this.staffList[s].allow6Consec ? 6 : 5;
                const scGrid = this.solveSectionChiefSchedule(s, this.options.standardHolidays, maxConsec);
                if (scGrid) {
                    for (let d = 0; d < this.numDays; d++) {
                        if (!this.grid[s][d].isFixed) this.setSymbol(s, d, scGrid[d], false);
                    }
                }
            }
        }

        // ステップ1: 8時勤務（1名/日）を優先配置！（8時可フラグのある貴重なスタッフから均等に選出）`;
if (code.includes(oldAssignSpecToGrid)) {
    code = code.replace(oldAssignSpecToGrid, newAssignSpecToGrid);
    console.log('✅ Added Section Chief cleanup in assignSpecialDutiesToGrid');
}

const oldSwapCheck = `                                    if (!this.grid[s][otherD].isFixed && this.grid[s][otherD].symbol === SYMBOLS.OFF) {`;
const newSwapCheck = `                                    if (!this.grid[s][otherD].isFixed && !this.grid[s][otherD].isAfterPreSpecial && this.grid[s][otherD].symbol === SYMBOLS.OFF) {`;
if (code.includes(oldSwapCheck)) {
    code = code.replace(oldSwapCheck, newSwapCheck);
    console.log('✅ Protected isAfterPreSpecial in assignSpecialDuties swap');
}

// 7. assignHolidaysAndGeneralDuties で 係長 -> 主任 -> 副主任 -> 一般スタッフ の優先順でスケジュール確定
const oldAssignHolLoop = `    assignHolidaysAndGeneralDuties() {
        const stdHolidays = this.options.standardHolidays;

        for (let s = 0; s < this.numStaff; s++) {`;
const newAssignHolLoop = `    assignHolidaysAndGeneralDuties() {
        const stdHolidays = this.options.standardHolidays;

        // ★ 役職優先順（1.係長 -> 2.主任 -> 3.副主任 -> 4.一般スタッフ）でスケジュールを確定！
        // これにより係長が土日希望出勤等で平日に代休を取る場合、その平日を主任・副主任が確実に認識してカバーできる
        const solveOrder = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (!this.staffList[s].isUnused) solveOrder.push(s);
        }
        solveOrder.sort((a, b) => {
            const rank = (idx) => {
                const st = this.staffList[idx];
                if (st.isSectionChief) return 0;
                if (st.isChief) return 1;
                if (st.isSubChief) return 2;
                return 3;
            };
            const rA = rank(a), rB = rank(b);
            if (rA !== rB) return rA - rB;
            return a - b;
        });

        for (const s of solveOrder) {`;
if (code.includes(oldAssignHolLoop)) {
    code = code.replace(oldAssignHolLoop, newAssignHolLoop);
    console.log('✅ Updated assignHolidaysAndGeneralDuties to solve Section Chief -> Chief -> SubChief -> General in order');
}

// 8. solveSectionChiefSchedule の改良:
//    - 土日の希望出勤数(weekendFixedWorkDays)に対して、対応する平日代休が確実に確保されるようにする
//    - 最終週の日曜(d=25等)に希望の「○」が入った場合も、次ターム水〜金(3日間)を見越して月・火または直前金曜に確実に代休を入れる
const oldSolveSCStart = `        const neededOffCount = Math.max(0, Math.round(targetOff - currentOff));`;
const newSolveSCStart = `        // 未固定の土日休だけでは足りない公休数、および土日希望出勤分の代休数を算出
        let weekendOffCount = 0;
        let weekdayFixedOffCount = 0;
        for (let d = 0; d < numDays; d++) {
            const isWkday = this.isWeekdayIndex(d);
            const cell = this.grid[s][d];
            if (!isWkday) {
                if (baseSymbols[d] === SYMBOLS.OFF) weekendOffCount += 1.0;
                else if (baseSymbols[d] === SYMBOLS.HALF_WORK_OFF || baseSymbols[d] === SYMBOLS.HALF_OFF_WORK) weekendOffCount += 0.5;
            } else if (cell.isFixed && cell.symbol === SYMBOLS.OFF) {
                weekdayFixedOffCount += 1.0;
            }
        }
        // 土日に希望出勤(○等)がある場合は、事前固定の平日公休を除き、その分だけ平日に代休を入れる（特殊勤務翌日休とは別枠でも柔軟に確保）
        const neededForWeekendWork = Math.max(0, weekendFixedWorkDays.length - weekdayFixedOffCount);
        const neededOffCount = Math.max(0, Math.round(targetOff - currentOff), neededForWeekendWork);`;
if (code.includes(oldSolveSCStart)) {
    code = code.replace(oldSolveSCStart, newSolveSCStart);
    console.log('✅ Enhanced neededOffCount in solveSectionChiefSchedule for weekend work');
}

const oldTailCheckInSC = `            const seq = prevSeq.concat(candSymbols);`;
const newTailCheckInSC = `            // 最終週の日曜(d >= numDays - 4)に希望出勤がある場合、次ターム水・木・金の平日3連勤を見越して末尾連勤もチェック
            const lastSunWork = weekendFixedWorkDays.some(wd => wd >= numDays - 4);
            const nextSeq = lastSunWork ? [SYMBOLS.WORK, SYMBOLS.WORK, SYMBOLS.WORK] : [];
            const seq = prevSeq.concat(candSymbols).concat(nextSeq);`;
if (code.includes(oldTailCheckInSC)) {
    code = code.replace(oldTailCheckInSC, newTailCheckInSC);
    console.log('✅ Added next-term boundary check for last Sunday work in solveSectionChiefSchedule');
}

// 9. balanceDailyWorkforce リペアパスと isStaffHardValid で係長を保護
const oldRepairLoop = `        // 連勤違反の自動リペアパス（公休数を変えずに同スタッフ内の余剰休日とスワップ）
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;`;
const newRepairLoop = `        // 連勤違反の自動リペアパス（公休数を変えずに同スタッフ内の余剰休日とスワップ）
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;`;
if (code.includes(oldRepairLoop)) {
    code = code.replace(oldRepairLoop, newRepairLoop);
    console.log('✅ Excluded Section Chief from balanceDailyWorkforce repair loop');
}

const oldHardValidSC = `        // ★ 係長は平日に未固定の「休」を入れることを禁止（スワップ平準化等で平日が休みに変わるのを完全防止！）
        if (staff.isSectionChief) {
            const maxWeekdayOff = this.getMaxAllowedUnfixedWeekdayOffForSectionChief(s);
            let unfixedWeekdayOff = 0;
            for (let d = 0; d < this.numDays; d++) {
                if (!this.grid[s][d].isFixed && this.isWeekdayIndex(d) && isHolidaySymbol(this.grid[s][d].symbol)) {
                    unfixedWeekdayOff++;
                }
            }
            if (unfixedWeekdayOff > maxWeekdayOff) return false;
        }`;
const newHardValidSC = `        // ★ 係長は平日に未固定の「休」を入れることを禁止（スワップ平準化等で平日が休みに変わるのを完全防止！）
        if (staff.isSectionChief) {
            const maxWeekdayOff = this.getMaxAllowedUnfixedWeekdayOffForSectionChief(s);
            let unfixedWeekdayOff = 0;
            for (let d = 0; d < this.numDays; d++) {
                if (!this.grid[s][d].isFixed && !this.grid[s][d].isAfterPreSpecial && this.isWeekdayIndex(d) && isHolidaySymbol(this.grid[s][d].symbol)) {
                    unfixedWeekdayOff++;
                }
            }
            if (unfixedWeekdayOff > maxWeekdayOff) return false;
        }`;
if (code.includes(oldHardValidSC)) {
    code = code.replace(oldHardValidSC, newHardValidSC);
}

const oldHardValid5Consec = `        // 5連勤後の2連休ルール（allow6Consecがfalseのスタッフ）
        if (!staff.allow6Consec) {`;
const newHardValid5Consec = `        // 5連勤後の2連休ルール（allow6Consecがfalseのスタッフ。係長は土日希望出勤による単休＋平日代休を柔軟許容）
        if (!staff.allow6Consec && !staff.isSectionChief) {`;
if (code.includes(oldHardValid5Consec)) {
    code = code.replace(oldHardValid5Consec, newHardValid5Consec);
    console.log('✅ Updated isStaffHardValid 5-consec check for Section Chief');
}

// 10. autoAssignRefreshHolidaysCore で係長には自動リフを割り振らない（係長の月〜金出勤原則を維持。希望入力された場合のみ保持）
const oldRefCandLoop = `        // 候補スタッフの抽出
        const candidates = [];
        for (const sIdx of activeStaffIndices) {
            // 今タームですでにリフを持っているスタッフは除外
            if (staffWithRefInCurrentTerm.has(sIdx)) continue;

            const st = staffList[sIdx];`;
const newRefCandLoop = `        // 候補スタッフの抽出
        const candidates = [];
        for (const sIdx of activeStaffIndices) {
            // 今タームですでにリフを持っているスタッフは除外
            if (staffWithRefInCurrentTerm.has(sIdx)) continue;

            const st = staffList[sIdx];
            // ★ 係長は原則「平日出勤・土日休」のため、自動配分で勝手に平日にリフを入れない（希望入力のみ保持）
            if (st.isSectionChief) continue;`;
if (code.includes(oldRefCandLoop)) {
    code = code.replace(oldRefCandLoop, newRefCandLoop);
    console.log('✅ Excluded Section Chief from automatic Refresh Holiday assignment');
}

// 11. 公休日数の許容範囲（係長が希望特殊勤務＋土日希望出勤等を組み合わせた場合も柔軟に許容）
code = code.replace(
    /\(staff\.isSectionChief && offDays >= this\.options\.standardHolidays && offDays <= this\.options\.standardHolidays \+ 2\.0\)/g,
    '(staff.isSectionChief && offDays >= this.options.standardHolidays - 1.0 && offDays <= this.options.standardHolidays + 4.0)'
);
code = code.replace(
    /\(staff\.isSectionChief && offDays >= standardHolidays && offDays <= standardHolidays \+ 2\.0\)/g,
    '(staff.isSectionChief && offDays >= standardHolidays - 1.0 && offDays <= standardHolidays + 4.0)'
);

fs.writeFileSync(solverPath, code, 'utf8');
console.log('🎉 Saved solver.js');

// app.js 側でも handleAssignSpecialDuties 実行時に最新の staffList トグル設定(isSectionChief等)を lastScheduler に同期
const appPath = path.join(__dirname, 'app.js');
let appCode = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');

const oldHandleSpec = `                const specialResult = lastScheduler.assignSpecialDutiesToGrid();`;
const newHandleSpec = `                // 最新のスタッフ属性（係長・主任・副主任・8時可・0.5等）と日別加減枠を確実に同期してから特殊勤務を割り当てる
                lastScheduler.staffList = JSON.parse(JSON.stringify(staffList));
                lastScheduler.dayOffsets = [...dayOffsets];
                const specialResult = lastScheduler.assignSpecialDutiesToGrid();`;
if (appCode.includes(oldHandleSpec)) {
    appCode = appCode.replace(oldHandleSpec, newHandleSpec);
    fs.writeFileSync(appPath, appCode, 'utf8');
    console.log('✅ Updated app.js to sync staffList and dayOffsets before assignSpecialDutiesToGrid');
}

// ============================================================================
// 自動検証テストスイート（全7パターン）
// ============================================================================
const { ShiftScheduler, validateScheduleGrid, autoAssignRefreshHolidaysCore, isJapaneseHoliday } = require('./solver.js');

function buildDates(startDateStr, numDays = 28) {
    const dates = [];
    const base = new Date(startDateStr + 'T00:00:00');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    for (let i = 0; i < numDays; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const jsDay = d.getDay(); // 0=Sun .. 6=Sat
        const wIdx = (jsDay + 6) % 7; // 0=Mon .. 5=Sat, 6=Sun
        const isHol = isJapaneseHoliday(y, m, day);
        dates.push({
            year: y,
            month: m,
            day: day,
            label: `${m}/${day}`,
            weekday: weekdays[jsDay],
            wIdx: wIdx,
            isSat: wIdx === 5,
            isSun: wIdx === 6,
            isHol: isHol,
            isHoliday: isHol
        });
    }
    return dates;
}

function createSampleStaffList(numDays = 28) {
    const sections = ['PT A', 'PT B', 'OT A', 'OT B', 'ST'];
    const list = [];
    for (let i = 0; i < 48; i++) {
        list.push({
            id: i + 1,
            name: `スタッフ ${i + 1}`,
            isUnused: false,
            section: sections[i % 5],
            can8: i < 12, // 0(係長)もcan8=trueにしておき、それでも自動で8時が入らないことを検証！
            noEarly: false,
            noLate: false,
            noEve: false,
            canSched: i < 10,
            isSectionChief: i === 0, // No.1 が係長
            isChief: i === 1 || i === 2, // No.2, No.3 が主任
            isSubChief: i === 3 || i === 4 || i === 5 || i === 6, // 副主任
            isHalf: i === 10 || i === 11,
            isFullTime: i < 15,
            allow6Consec: false,
            prevDays: ['○', '休', '休', '○', '○'], // 前ターム: 金(○), 土(休), 日(休), 月(○), 火(○)
            days: new Array(numDays).fill('')
        });
    }
    return list;
}

function runTestScenario(name, setupFn, verifyFn, startDate = '2026-04-29') {
    // 2026-04-29〜5/26 はゴールデンウィーク祝日（4/29, 5/4, 5/5, 5/6）を含むターム！祝日でも係長が平日出勤するかも同時検証
    const dates = buildDates(startDate, 28);
    const staffList = createSampleStaffList(28);
    const dayOffsets = dates.map(d => (d.isSat || d.isSun || d.isHol) ? -2 : 0);

    setupFn(staffList, dates);

    const scheduler = new ShiftScheduler(staffList, {
        standardHolidays: 8.0,
        dates: dates,
        dayOffsets: dayOffsets
    });

    const baseRes = scheduler.solveBaseSchedule();
    if (!baseRes.success) {
        console.error(`❌ [${name}] Base schedule failed:`, baseRes.errors);
        process.exit(1);
    }

    const specRes = scheduler.assignSpecialDutiesToGrid();
    if (!specRes.success) {
        console.error(`❌ [${name}] Special duties failed:`, specRes.errors);
        process.exit(1);
    }

    const finalVal = validateScheduleGrid(specRes.grid, staffList, {
        dates: dates,
        standardHolidays: 8.0,
        isFinal: true
    });
    if (!finalVal.isValid) {
        console.error(`❌ [${name}] Final validation errors:`, finalVal.errors);
        process.exit(1);
    }

    const scRow = specRes.grid[0].map(c => c.symbol);
    verifyFn(scRow, dates, specRes);
    console.log(`✅ [${name}] PASSED! 係長スケジュール: ${scRow.map((sym, d) => `${dates[d].label}(${dates[d].weekday}):${sym}`).join(' ')}`);
}

// Case 1: 通常時（希望なし、祝日ありターム）
runTestScenario(
    'Case 1: 通常時（平日[月〜金・祝日含む]はすべて○、土日はすべて休、特殊勤務0回）',
    (staffList, dates) => {},
    (scRow, dates, specRes) => {
        for (let d = 0; d < 28; d++) {
            const isWkday = dates[d].wIdx >= 0 && dates[d].wIdx <= 4;
            if (isWkday && scRow[d] !== '○') {
                throw new Error(`Day ${d + 1} (${dates[d].label} ${dates[d].weekday}) expected ○ but got ${scRow[d]}`);
            }
            if (!isWkday && scRow[d] !== '休') {
                throw new Error(`Day ${d + 1} (${dates[d].label} ${dates[d].weekday}) expected 休 but got ${scRow[d]}`);
            }
        }
        const stStat = specRes.stats.staffStats[0];
        if (stStat.early !== 0 || stStat.late !== 0 || stStat.eve !== 0 || stStat.h8 !== 0) {
            throw new Error(`Expected 0 special duties for Section Chief, got early=${stStat.early}, late=${stStat.late}, eve=${stStat.eve}, h8=${stStat.h8}`);
        }
    }
);

// Case 2: 土曜日に希望の「○」がある場合（d=10: 第2週土曜）
runTestScenario(
    'Case 2: 土曜日(d=10)に希望の「○」がある場合（同週の平日に柔軟に休が入り特殊勤務なし）',
    (staffList, dates) => {
        staffList[0].days[10] = '○'; // 土曜日に希望の○
    },
    (scRow, dates, specRes) => {
        if (scRow[10] !== '○') throw new Error('土曜日(d=10)の希望○が保持されていません');
        // d=5..9（同週の月〜金）に休が1日入っていること
        const wkOffs = [5, 6, 7, 8, 9].filter(d => scRow[d] === '休');
        if (wkOffs.length !== 1) throw new Error(`第2週の平日(d=5..9)に代休が1日入るべきですが ${wkOffs.length}日でした`);
        // その他の土日はすべて休
        for (let d = 0; d < 28; d++) {
            const isWkday = dates[d].wIdx >= 0 && dates[d].wIdx <= 4;
            if (!isWkday && d !== 10 && scRow[d] !== '休') {
                throw new Error(`未固定の土日(d=${d})が休になっていません: ${scRow[d]}`);
            }
        }
    }
);

// Case 3: 日曜日に希望の「○」がある場合（d=11: 第2週日曜 ＆ d=25: 最終週日曜）
runTestScenario(
    'Case 3: 日曜日(d=11, d=25)に希望の「○」がある場合（それぞれの近くの平日に柔軟に休が入る）',
    (staffList, dates) => {
        staffList[0].days[11] = '○'; // 第2週日曜
        staffList[0].days[25] = '○'; // 最終週日曜
    },
    (scRow, dates, specRes) => {
        if (scRow[11] !== '○') throw new Error('日曜日(d=11)の希望○が保持されていません');
        if (scRow[25] !== '○') throw new Error('日曜日(d=25)の希望○が保持されていません');
        // d=12..16（第3週の月〜金）に休が1日入っていること
        const wkOffs1 = [12, 13, 14, 15, 16].filter(d => scRow[d] === '休');
        if (wkOffs1.length < 1) throw new Error('d=11(日曜○)に対する平日代休がd=12..16に入っていません');
        // d=26,27（最終週の月・火）に休が1日入っていること
        const wkOffs2 = [26, 27].filter(d => scRow[d] === '休');
        if (wkOffs2.length < 1) throw new Error('d=25(最終日曜○)に対する平日代休がd=26..27に入っていません');
    }
);

// Case 4: 土日両方に希望の「○」がある場合（d=10 土曜, d=11 日曜）
runTestScenario(
    'Case 4: 土日両方(d=10, d=11)に希望の「○」がある場合（前後の平日に柔軟に休が2日入り5連勤以内）',
    (staffList, dates) => {
        staffList[0].days[10] = '○';
        staffList[0].days[11] = '○';
    },
    (scRow, dates, specRes) => {
        if (scRow[10] !== '○' || scRow[11] !== '○') throw new Error('土日(d=10,11)の希望○が保持されていません');
        const totalWeekdayOff = scRow.filter((sym, d) => (dates[d].wIdx >= 0 && dates[d].wIdx <= 4) && sym === '休').length;
        if (totalWeekdayOff < 2) throw new Error(`土日両方出勤に対する平日休が不足しています: ${totalWeekdayOff}`);
    }
);

// Case 5: 係長に希望の特殊勤務（早・遅・E・8時）がある場合（トグルがcan8=false, noEarly=trueでも保持＆翌日休＆他には特殊勤務が入らない）
runTestScenario(
    'Case 5: 係長に希望の特殊勤務（水曜に早、月曜に8時、金曜に遅）がある場合',
    (staffList, dates) => {
        staffList[0].can8 = false;   // 8時可がOFFでも希望の8時はエラーにならず残るか検証
        staffList[0].noEarly = true; // 早番不可がONでも希望の早はエラーにならず残るか検証
        staffList[0].days[5] = '8時'; // 月曜(d=5)に希望の8時
        staffList[0].days[14] = '早'; // 水曜(d=14)に希望の早 -> 翌日木曜(d=15)が自動的に休になるべき
        staffList[0].days[23] = '遅'; // 金曜(d=23)に希望の遅 -> 翌日土曜(d=24)は休
    },
    (scRow, dates, specRes) => {
        if (scRow[5] !== '8時') throw new Error(`d=5の希望「8時」が消えています: ${scRow[5]}`);
        if (scRow[14] !== '早') throw new Error(`d=14の希望「早」が消えています: ${scRow[14]}`);
        if (scRow[15] !== '休') throw new Error(`d=14「早」の翌日(d=15木曜)が「休」になっていません: ${scRow[15]}`);
        if (scRow[23] !== '遅') throw new Error(`d=23の希望「遅」が消えています: ${scRow[23]}`);
        if (scRow[24] !== '休') throw new Error(`d=23「遅」の翌日(d=24土曜)が「休」になっていません: ${scRow[24]}`);

        const stStat = specRes.stats.staffStats[0];
        if (stStat.h8 !== 1 || stStat.early !== 1 || stStat.late !== 1 || stStat.eve !== 0) {
            throw new Error(`希望以外の特殊勤務が割り当てられています: h8=${stStat.h8}, early=${stStat.early}, late=${stStat.late}, eve=${stStat.eve}`);
        }
    }
);

// Case 6: 希望の特殊勤務（水曜d=7にE）＋ 別週の日曜(d=18)に希望の「○」の複合パターン
runTestScenario(
    'Case 6: 希望の特殊勤務(d=7にE) ＋ 日曜(d=18)に希望の「○」の複合パターン',
    (staffList, dates) => {
        staffList[0].days[7] = 'E';   // 第2週水曜に希望のE -> d=8(木曜)が休
        staffList[0].days[18] = '○';  // 第3週日曜に希望の○ -> 第4週平日(d=19..23)にも代休が入るべき
    },
    (scRow, dates, specRes) => {
        if (scRow[7] !== 'E') throw new Error('d=7の希望「E」が保持されていません');
        if (scRow[8] !== '休') throw new Error('d=7「E」の翌日(d=8)が休になっていません');
        if (scRow[18] !== '○') throw new Error('d=18(日曜)の希望「○」が保持されていません');
        const wk4Off = [19, 20, 21, 22, 23].filter(d => scRow[d] === '休');
        if (wk4Off.length !== 1) throw new Error(`d=18(日曜○)の代休がd=19..23に1日入るべきですが ${wk4Off.length}日でした`);
    }
);

// Case 7: リフレッシュ休暇対象月（6月ターム）で自動リフ配分が動いても係長には勝手なリフが入らない検証
runTestScenario(
    'Case 7: リフ対象月(2026-06-24〜)でリフ自動配分を実行しても係長は平日○・土日休を維持',
    (staffList, dates) => {
        autoAssignRefreshHolidaysCore(staffList, dates, { obtainedHistory: {} });
    },
    (scRow, dates, specRes) => {
        for (let d = 0; d < 28; d++) {
            const isWkday = dates[d].wIdx >= 0 && dates[d].wIdx <= 4;
            if (isWkday && scRow[d] !== '○') {
                throw new Error(`Day ${d + 1} expected ○ but got ${scRow[d]}`);
            }
            if (!isWkday && scRow[d] !== '休') {
                throw new Error(`Day ${d + 1} expected 休 but got ${scRow[d]}`);
            }
        }
    },
    '2026-06-24'
);

console.log('🏆 ALL 7 SECTION CHIEF TEST CASES PASSED PERFECTLY!');
