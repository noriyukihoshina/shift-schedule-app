with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_st_bal = """    balanceWorkforceForST() {
        const floors = ['1F', '2F', '3F', '南'];

        // 1. 各フロア内での平準化
        floors.forEach(fl => {
            const floorStaff = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused && this.staffList[s].floor === fl) {
                    floorStaff.push(s);
                }
            }
            if (floorStaff.length <= 1) return;

            for (let iter = 0; iter < 100; iter++) {
                let improved = false;
                // 日別出勤数を計算
                const dailyLoads = [];
                for (let d = 0; d < this.numDays; d++) {
                    let cnt = 0;
                    floorStaff.forEach(s => {
                        if (isWorkSymbol(this.grid[s][d].symbol)) cnt++;
                    });
                    dailyLoads.push({ d, cnt });
                }
                dailyLoads.sort((a, b) => b.cnt - a.cnt);

                const maxDay = dailyLoads[0];
                const minDay = dailyLoads[dailyLoads.length - 1];
                if (maxDay.cnt - minDay.cnt <= 1) break; // ブレ幅が1名以内なら完璧

                // maxDay に○で、minDay に休のスタッフを探してスワップ
                for (const s of floorStaff) {
                    if (this.grid[s][maxDay.d].isFixed || this.grid[s][minDay.d].isFixed) continue;
                    if (this.grid[s][maxDay.d].symbol !== SYMBOLS.WORK || this.grid[s][minDay.d].symbol !== SYMBOLS.OFF) continue;

                    // スケ可スタッフの場合、maxDay を休にしてもスケ可が残るか
                    if (this.staffList[s].canSched) {
                        let remSched = 0;
                        floorStaff.forEach(oS => {
                            if (oS !== s && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][maxDay.d].symbol)) remSched++;
                        });
                        if (remSched < 1) continue;
                    }

                    // スワップ試行
                    this.setSymbol(s, maxDay.d, SYMBOLS.OFF, false);
                    this.setSymbol(s, minDay.d, SYMBOLS.WORK, false);

                    if (this.isStaffHardValid(s)) {
                        improved = true;
                        break;
                    } else {
                        this.setSymbol(s, maxDay.d, SYMBOLS.WORK, false);
                        this.setSymbol(s, minDay.d, SYMBOLS.OFF, false);
                    }
                }
                if (!improved) break;
            }
        });

        // 2. 4フロア合計出勤人数の平準化（各フロア2〜3名出勤を維持したまま、全体出勤を11〜12名に収束）
        for (let iter = 0; iter < 120; iter++) {
            let improved = false;
            const dailyTotals = [];
            for (let d = 0; d < this.numDays; d++) {
                let cnt = 0;
                for (let s = 0; s < this.numStaff; s++) {
                    if (!this.staffList[s].isUnused && isWorkSymbol(this.grid[s][d].symbol)) cnt++;
                }
                dailyTotals.push({ d, cnt });
            }
            dailyTotals.sort((a, b) => b.cnt - a.cnt);

            const highD = dailyTotals[0];
            const lowD = dailyTotals[dailyTotals.length - 1];
            if (highD.cnt - lowD.cnt <= 1) break;"""

target_new_st_bal = """    balanceWorkforceForST() {
        const floors = ['1F', '2F', '3F', '南'];

        // ★ ユーザー指示: STテーブルの平均化は出勤人数（頭数）ではなく「実数（0.5トグル考慮）」で行う！
        const getSTRealWork = (s, d) => {
            const sym = this.grid[s][d].symbol;
            if (!isWorkSymbol(sym)) return 0.0;
            if (this.staffList[s].isZeroCount) return 0.0;
            if (this.staffList[s].isHalf || sym.includes('/')) return 0.5;
            return 1.0;
        };

        // 1. 各フロア内での実数平準化
        floors.forEach(fl => {
            const floorStaff = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused && this.staffList[s].floor === fl) {
                    floorStaff.push(s);
                }
            }
            if (floorStaff.length <= 1) return;

            for (let iter = 0; iter < 100; iter++) {
                let improved = false;
                // 日別出勤実数を計算
                const dailyLoads = [];
                for (let d = 0; d < this.numDays; d++) {
                    let realSum = 0;
                    floorStaff.forEach(s => {
                        realSum += getSTRealWork(s, d);
                    });
                    dailyLoads.push({ d, realSum });
                }
                dailyLoads.sort((a, b) => b.realSum - a.realSum);

                const maxDay = dailyLoads[0];
                const minDay = dailyLoads[dailyLoads.length - 1];
                if (maxDay.realSum - minDay.realSum <= 0.5) break; // ブレ幅が0.5実数以内なら完璧

                // maxDay に○で、minDay に休のスタッフを探してスワップ
                for (const s of floorStaff) {
                    if (this.grid[s][maxDay.d].isFixed || this.grid[s][minDay.d].isFixed) continue;
                    if (this.grid[s][maxDay.d].symbol !== SYMBOLS.WORK || this.grid[s][minDay.d].symbol !== SYMBOLS.OFF) continue;

                    // スケ可スタッフの場合、maxDay を休にしてもスケ可が残るか
                    if (this.staffList[s].canSched) {
                        let remSched = 0;
                        floorStaff.forEach(oS => {
                            if (oS !== s && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][maxDay.d].symbol)) remSched++;
                        });
                        if (remSched < 1) continue;
                    }

                    // スワップ試行
                    this.setSymbol(s, maxDay.d, SYMBOLS.OFF, false);
                    this.setSymbol(s, minDay.d, SYMBOLS.WORK, false);

                    if (this.isStaffHardValid(s)) {
                        improved = true;
                        break;
                    } else {
                        this.setSymbol(s, maxDay.d, SYMBOLS.WORK, false);
                        this.setSymbol(s, minDay.d, SYMBOLS.OFF, false);
                    }
                }
                if (!improved) break;
            }
        });

        // 2. 4フロア合計出勤実数の平準化（各フロアの実数を崩さず全体実数のブレ幅を最小化）
        for (let iter = 0; iter < 120; iter++) {
            let improved = false;
            const dailyTotals = [];
            for (let d = 0; d < this.numDays; d++) {
                let realSum = 0;
                for (let s = 0; s < this.numStaff; s++) {
                    if (!this.staffList[s].isUnused) realSum += getSTRealWork(s, d);
                }
                dailyTotals.push({ d, realSum });
            }
            dailyTotals.sort((a, b) => b.realSum - a.realSum);

            const highD = dailyTotals[0];
            const lowD = dailyTotals[dailyTotals.length - 1];
            if (highD.realSum - lowD.realSum <= 0.5) break;"""

if target_old_st_bal in content:
    content = content.replace(target_old_st_bal, target_new_st_bal)
    print("Replaced ST balance with real work calculation")
else:
    print("ST balance old target NOT found!")

# 2番目のループ内の残り（highD.cnt ➔ highD.realSum）
target_old_loop2 = """            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                if (this.grid[s][highD.d].isFixed || this.grid[s][lowD.d].isFixed) continue;
                if (this.grid[s][highD.d].symbol !== SYMBOLS.WORK || this.grid[s][lowD.d].symbol !== SYMBOLS.OFF) continue;

                const fl = this.staffList[s].floor;
                // このフロアのhighDでの出勤人数が2名以下なら休みにできない
                let flWorkHigh = 0;
                for (let oS = 0; oS < this.numStaff; oS++) {
                    if (this.staffList[oS].floor === fl && isWorkSymbol(this.grid[oS][highD.d].symbol)) flWorkHigh++;
                }
                if (flWorkHigh <= 2) continue;

                // スケ可保護
                if (this.staffList[s].canSched) {
                    let remSchedHigh = 0;
                    for (let oS = 0; oS < this.numStaff; oS++) {
                        if (oS !== s && this.staffList[oS].floor === fl && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][highD.d].symbol)) remSchedHigh++;
                    }
                    if (remSchedHigh < 1) continue;
                }

                this.setSymbol(s, highD.d, SYMBOLS.OFF, false);
                this.setSymbol(s, lowD.d, SYMBOLS.WORK, false);

                if (this.isStaffHardValid(s)) {
                    improved = true;
                    break;
                } else {
                    this.setSymbol(s, highD.d, SYMBOLS.WORK, false);
                    this.setSymbol(s, lowD.d, SYMBOLS.OFF, false);
                }
            }
            if (!improved) break;
        }
    }"""

target_new_loop2 = """            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                if (this.grid[s][highD.d].isFixed || this.grid[s][lowD.d].isFixed) continue;
                if (this.grid[s][highD.d].symbol !== SYMBOLS.WORK || this.grid[s][lowD.d].symbol !== SYMBOLS.OFF) continue;

                const fl = this.staffList[s].floor;
                // このフロアのhighDでの出勤実数が1.5以下なら休みにできない
                let flRealHigh = 0;
                for (let oS = 0; oS < this.numStaff; oS++) {
                    if (this.staffList[oS].floor === fl) flRealHigh += getSTRealWork(oS, highD.d);
                }
                if (flRealHigh <= 1.5) continue;

                // スケ可保護
                if (this.staffList[s].canSched) {
                    let remSchedHigh = 0;
                    for (let oS = 0; oS < this.numStaff; oS++) {
                        if (oS !== s && this.staffList[oS].floor === fl && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][highD.d].symbol)) remSchedHigh++;
                    }
                    if (remSchedHigh < 1) continue;
                }

                this.setSymbol(s, highD.d, SYMBOLS.OFF, false);
                this.setSymbol(s, lowD.d, SYMBOLS.WORK, false);

                if (this.isStaffHardValid(s)) {
                    improved = true;
                    break;
                } else {
                    this.setSymbol(s, highD.d, SYMBOLS.WORK, false);
                    this.setSymbol(s, lowD.d, SYMBOLS.OFF, false);
                }
            }
            if (!improved) break;
        }
    }"""

if target_old_loop2 in content:
    content = content.replace(target_old_loop2, target_new_loop2)
    print("Replaced ST balance loop 2")
else:
    print("ST balance loop 2 NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js with ST real balance successfully!")
