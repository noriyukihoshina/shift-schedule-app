# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_balance_st = """    balanceWorkforceForST() {
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
        });"""

replacement_balance_st = """    balanceWorkforceForST() {
        const floors = ['1F', '2F', '3F', '南'];

        // ★ ユーザー指示: STテーブルの平均化は出勤人数（頭数）ではなく「実数（0.5トグル考慮）」で行う！
        const getSTRealWork = (s, d) => {
            const sym = this.grid[s][d].symbol;
            if (!isWorkSymbol(sym)) return 0.0;
            if (this.staffList[s].isZeroCount) return 0.0;
            if (this.staffList[s].isHalf || sym.includes('/')) return 0.5;
            return 1.0;
        };

        // 1. 各フロア内での実数平準化（極端な不足日1.5や超過日3.0を完全根絶しブレ幅を最小化）
        floors.forEach(fl => {
            const floorStaff = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused && this.staffList[s].floor === fl) {
                    floorStaff.push(s);
                }
            }
            if (floorStaff.length <= 1) return;

            for (let iter = 0; iter < 150; iter++) {
                let improved = false;
                const dailyLoads = [];
                for (let d = 0; d < this.numDays; d++) {
                    let realSum = 0;
                    floorStaff.forEach(s => { realSum += getSTRealWork(s, d); });
                    dailyLoads.push({ d, realSum });
                }

                const maxDayObj = dailyLoads.reduce((max, cur) => cur.realSum > max.realSum ? cur : max, dailyLoads[0]);
                const minDayObj = dailyLoads.reduce((min, cur) => cur.realSum < min.realSum ? cur : min, dailyLoads[0]);
                if (maxDayObj.realSum - minDayObj.realSum <= 0.5) break; // ブレ幅0.5以内なら達成！

                // 超過日 (realSum >= 2.75) と 不足日 (realSum <= 1.75) を優先ペアリング
                const highDays = dailyLoads.filter(x => x.realSum > minDayObj.realSum + 0.5).sort((a, b) => b.realSum - a.realSum);
                const lowDays = dailyLoads.filter(x => x.realSum < maxDayObj.realSum - 0.5).sort((a, b) => a.realSum - b.realSum);

                // 日付の近いペアから優先的にスワップ試行
                const candidatePairs = [];
                for (const h of highDays) {
                    for (const l of lowDays) {
                        candidatePairs.push({ h: h.d, l: l.d, dist: Math.abs(h.d - l.d) });
                    }
                }
                candidatePairs.sort((a, b) => a.dist - b.dist);

                for (const pair of candidatePairs) {
                    for (const s of floorStaff) {
                        if (this.grid[s][pair.h].isFixed || this.grid[s][pair.l].isFixed) continue;
                        const symH = this.grid[s][pair.h].symbol;
                        const symL = this.grid[s][pair.l].symbol;
                        if (!isWorkSymbol(symH) || symL !== SYMBOLS.OFF) continue;

                        // スケ可保護: pair.h から s が抜けても残りのスケ可スタッフがいるか
                        if (this.staffList[s].canSched) {
                            let remSched = 0;
                            floorStaff.forEach(oS => {
                                if (oS !== s && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][pair.h].symbol)) {
                                    remSched++;
                                }
                            });
                            if (remSched < 1) continue;
                        }

                        // スワップ試行
                        const nextSymL = (symH === '早') ? '早' : SYMBOLS.WORK;
                        this.setSymbol(s, pair.h, SYMBOLS.OFF, false);
                        this.setSymbol(s, pair.l, nextSymL, false);

                        if (this.isStaffHardValid(s)) {
                            improved = true;
                            break;
                        } else {
                            this.setSymbol(s, pair.h, symH, false);
                            this.setSymbol(s, pair.l, symL, false);
                        }
                    }
                    if (improved) break;
                }
                if (!improved) break;
            }
        });"""

if target_balance_st in content:
    content = content.replace(target_balance_st, replacement_balance_st, 1)
    print("ST balance algorithm replaced successfully.")
else:
    print("Warning: target_balance_st not found in solver.js!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
