with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

# repairScheduleViolations メソッドを追加
repair_code = """
    /**
     * ★ 組んだ後のスマート自動微修正システム（ユーザー要望: 全テーブル共通自動リペア）
     * 1. 特殊勤務（早・遅・E）の翌日非休日を公休スワップで自動解消
     * 2. 翌日特殊勤務重複（Eの翌日に早など）を別スタッフとスワップして解消
     * 3. 8時勤務の過不足（平日0名）を出勤中can8スタッフへ自動充当して解消
     * 4. 週休2日不足（日〜土で6出勤・1公休）を前後の週との公休スワップで自動解消
     */
    repairScheduleViolations() {
        const dates = this.dates || [];

        // --- 1. 特殊勤務（早・遅・E）翌日休日違反の自動修復 ---
        for (let pass = 0; pass < 5; pass++) {
            let fixedAny = false;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;

                for (let d = 0; d < this.numDays - 1; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (!isRestrictedSpecial(sym)) continue;

                    const nextSym = this.grid[s][d + 1].symbol;
                    // 翌日が休日でない場合（○ または 特殊勤務）
                    if (!isHolidaySymbol(nextSym)) {
                        // ケースA: 翌日が別の特殊勤務（例: 5/6 E ➔ 5/7 早）の場合、翌日の特殊勤務を別の○スタッフとスワップ
                        if (isRestrictedSpecial(nextSym) && !this.grid[s][d + 1].isFixed) {
                            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                if (otherS === s || this.staffList[otherS].isUnused || this.staffList[otherS].isSectionChief) continue;
                                if (this.isSouth && this.getSubFloor(otherS) !== this.getSubFloor(s)) continue;
                                if (this.grid[otherS][d + 1].symbol === SYMBOLS.WORK && !this.grid[otherS][d + 1].isFixed) {
                                    // otherS に翌日の特殊勤務を移し、sの翌日を○にしてから公休スワップへ
                                    this.setSymbol(otherS, d + 1, nextSym, false);
                                    this.setSymbol(s, d + 1, SYMBOLS.WORK, false);
                                    fixedAny = true;
                                    break;
                                }
                            }
                        }

                        // ケースB: 翌日(d+1)が○の場合、同一スタッフの他日の非固定「休」とスワップして翌日を「休」にする！
                        if (this.grid[s][d + 1].symbol === SYMBOLS.WORK && !this.grid[s][d + 1].isFixed) {
                            // スワップ候補日（同じ週優先、前後の連勤枠）
                            const d1Week = this.weekSpans.findIndex(span => span.includes(d + 1));
                            let bestSwapD = -1;

                            for (let candD = 0; candD < this.numDays; candD++) {
                                if (candD === d || candD === d + 1) continue;
                                if (this.grid[s][candD].isFixed || this.grid[s][candD].symbol !== SYMBOLS.OFF) continue;
                                // candD の前日が特殊勤務なら candD を○にするとまた翌日違反になるため除外
                                if (candD > 0 && isRestrictedSpecial(this.grid[s][candD - 1].symbol)) continue;

                                // 一時スワップ検証
                                this.setSymbol(s, candD, SYMBOLS.WORK, false);
                                this.setSymbol(s, d + 1, SYMBOLS.OFF, false);
                                if (this.isStaffHardValid(s)) {
                                    bestSwapD = candD;
                                    break;
                                }
                                // 戻す
                                this.setSymbol(s, candD, SYMBOLS.OFF, false);
                                this.setSymbol(s, d + 1, SYMBOLS.WORK, false);
                            }

                            if (bestSwapD >= 0) {
                                fixedAny = true;
                            }
                        }
                    }
                }
            }
            if (!fixedAny) break;
        }

        // --- 2. 8時勤務の平日完全充足リペア ---
        if (!this.isST) {
            for (let d = 0; d < this.numDays; d++) {
                const di = dates[d];
                const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
                if (isWeekend) continue; // 土日は8時不要

                let curH8 = 0;
                for (let s = 0; s < this.numStaff; s++) {
                    if (this.grid[s][d].symbol === SYMBOLS.H8) curH8++;
                }

                if (curH8 === 0) {
                    // 出勤中の8時可（can8）スタッフから1名選出して8時に変更
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                        if (!this.staffList[s].can8) continue;
                        if (this.isSouth && this.getSubFloor(s) !== '南3' && this.getSubFloor(s) !== '南2') continue;
                        if (this.grid[s][d].symbol === SYMBOLS.WORK && !this.grid[s][d].isFixed) {
                            this.setSymbol(s, d, SYMBOLS.H8, false);
                            break;
                        }
                    }
                }
            }
        }

        // --- 3. 週休2日違反の自動修復（日〜土で6出勤・1公休を前後の週とスワップ） ---
        for (let pass = 0; pass < 3; pass++) {
            let fixedWeek = false;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;

                for (let w = 0; w < this.weekSpans.length; w++) {
                    const wSpan = this.weekSpans[w];
                    let weekOff = 0;
                    for (const d of wSpan) {
                        if (isHolidaySymbol(this.grid[s][d].symbol)) weekOff++;
                    }

                    // 週休が1日しかない（6出勤）
                    if (weekOff < 2) {
                        // 他の週で週休が3日以上ある週（または公休に余裕のある日）を探す
                        for (let otherW = 0; otherW < this.weekSpans.length; otherW++) {
                            if (otherW === w) continue;
                            const otherSpan = this.weekSpans[otherW];
                            let otherOff = 0;
                            for (const od of otherSpan) {
                                if (isHolidaySymbol(this.grid[s][od].symbol)) otherOff++;
                            }

                            if (otherOff >= 3) {
                                // otherSpan の非固定「休」を wSpan の非固定「○」とスワップ！
                                for (const od of otherSpan) {
                                    if (this.grid[s][od].symbol === SYMBOLS.OFF && !this.grid[s][od].isFixed) {
                                        // od の前日が特殊勤務なら除外
                                        if (od > 0 && isRestrictedSpecial(this.grid[s][od - 1].symbol)) continue;

                                        for (const wd of wSpan) {
                                            if (this.grid[s][wd].symbol === SYMBOLS.WORK && !this.grid[s][wd].isFixed) {
                                                // 一時スワップ
                                                this.setSymbol(s, od, SYMBOLS.WORK, false);
                                                this.setSymbol(s, wd, SYMBOLS.OFF, false);
                                                if (this.isStaffHardValid(s)) {
                                                    fixedWeek = true;
                                                    break;
                                                }
                                                // 戻す
                                                this.setSymbol(s, od, SYMBOLS.OFF, false);
                                                this.setSymbol(s, wd, SYMBOLS.WORK, false);
                                            }
                                        }
                                        if (fixedWeek) break;
                                    }
                                }
                            }
                            if (fixedWeek) break;
                        }
                    }
                }
            }
            if (!fixedWeek) break;
        }

        // --- 4. 単発勤務「休 ○ 休」の再撲滅 ---
        this.eliminateSingleDayWork();
    }
"""

pos_assign = content.find('assignSpecialDutiesToGrid(options = {}) {')
pos_return = content.find('return {\n            success: true,\n            grid: this.grid,\n            stats: this.calculateStats()\n        };', pos_assign)

# assignSpecialDutiesToGrid の return 直前で repairScheduleViolations() を呼ぶ
target_old_special_ret = """        // 最終全ハード制約の検証
        const finalErrors = this.verifyAllHardConstraints();
        if (finalErrors.length > 0 && !force) {
            return { success: false, errors: finalErrors };
        }

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };"""

target_new_special_ret = """        // ★ ユーザー指示: 特殊勤務翌日休違反・8時不足・週休2日違反のスマート自動微修正（完全自動リペア）
        this.repairScheduleViolations();

        // 最終全ハード制約の検証
        const finalErrors = this.verifyAllHardConstraints();
        if (finalErrors.length > 0 && !force) {
            return { success: false, errors: finalErrors };
        }

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };"""

if target_old_special_ret in content:
    content = content.replace(target_old_special_ret, target_new_special_ret)
    print("Added repair call to assignSpecialDutiesToGrid")
else:
    print("assignSpecialDutiesToGrid ret NOT found!")

# solveBaseSchedule の return 直前でも呼ぶ
target_old_base_ret = """        // 基本制約の検証
        const baseErrors = this.verifyBaseHardConstraints();
        if (baseErrors.length > 0 && !force) {
            return { success: false, errors: baseErrors };
        }

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };"""

target_new_base_ret = """        // ★ ユーザー指示: 週休2日違反・単発勤務等のスマート自動微修正
        this.repairScheduleViolations();

        // 基本制約の検証
        const baseErrors = this.verifyBaseHardConstraints();
        if (baseErrors.length > 0 && !force) {
            return { success: false, errors: baseErrors };
        }

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };"""

if target_old_base_ret in content:
    content = content.replace(target_old_base_ret, target_new_base_ret)
    print("Added repair call to solveBaseSchedule")
else:
    print("solveBaseSchedule ret NOT found!")

# repair_code をクラス内に挿入（eliminateSingleDayWork の直後）
pos_single = content.find('eliminateSingleDayWork() {')
pos_single_end = content.find('    balanceDailyWorkforce() {', pos_single)
content = content[:pos_single_end] + repair_code + '\n' + content[pos_single_end:]
print("Inserted repairScheduleViolations method into ShiftScheduler")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js with repairScheduleViolations successfully!")
