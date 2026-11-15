const fs = require('fs');
let code = fs.readFileSync('solver.js', 'utf8');

const target = `        if (patBStaff.length > 0 && tsushoWorkingDays.length >= 2) {
            for (let iter = 0; iter < 150; iter++) {
                // 通所出勤実数を計算（通所トグルON + CLトグルON + ハ3/ハ南トグルON(0.5換算)）
                const dailyLoads = tsushoWorkingDays.map(d => {
                    let real = 0;
                    for (const s of patBStaff) {
                        const sym = this.grid[s][d].symbol;
                        const ha = this.staffList[s].haSection || '';
                        const w = (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : (this.staffList[s].isZeroCount ? 0.0 : (this.staffList[s].isHalf ? 0.5 : 1.0));
                        if (isWorkSymbol(sym)) real += w;
                        else if (isHalfDuty(sym)) real += 0.5 * w;
                    }
                    return { day: d, real };
                });

                dailyLoads.sort((a, b) => b.real - a.real);
                const maxItem = dailyLoads[0];
                const minItem = dailyLoads[dailyLoads.length - 1];

                // ブレ幅が0.5名以内なら理想達成
                if (maxItem.real - minItem.real <= 0.6) break;

                let swapped = false;
                for (let h = 0; h < Math.min(8, dailyLoads.length); h++) {
                    const maxD = dailyLoads[h].day;
                    for (let l = dailyLoads.length - 1; l >= Math.max(0, dailyLoads.length - 8); l--) {
                        const minD = dailyLoads[l].day;
                        if (dailyLoads[h].real - dailyLoads[l].real <= 0.6) continue;

                        for (const s of patBStaff) {
                            const staff = this.staffList[s];
                            if (this.grid[s][maxD].symbol === SYMBOLS.WORK && !this.grid[s][maxD].isFixed &&
                                this.grid[s][minD].symbol === SYMBOLS.OFF && !this.grid[s][minD].isFixed) {

                                // CL2通所同士の公休重複回避
                                if (cl2Staff.includes(s)) {
                                    const otherCl2 = cl2Staff.find(o => o !== s);
                                    if (otherCl2 && isHolidaySymbol(this.grid[otherCl2][minD].symbol)) continue;
                                }

                                this.setSymbol(s, maxD, SYMBOLS.OFF, false);
                                this.setSymbol(s, minD, SYMBOLS.WORK, false);

                                const checkPureOffStreak = (sIdx) => {
                                    let strk = 0;
                                    const stf = this.staffList[sIdx];
                                    if (stf.prevDays) {
                                        for (let p = stf.prevDays.length - 1; p >= 0; p--) {
                                            if (!isPurePublicOffSymbol(stf.prevDays[p])) strk++;
                                            else break;
                                        }
                                    }
                                    for (let cd = 0; cd < this.numDays; cd++) {
                                        if (!isPurePublicOffSymbol(this.grid[sIdx][cd].symbol)) {
                                            strk++;
                                            if (strk > 6) return false;
                                        } else {
                                            strk = 0;
                                        }
                                    }
                                    return true;
                                };

                                if (this.isStaffHardValid(s) && checkPureOffStreak(s)) {
                                    swapped = true;
                                    break;
                                } else {
                                    this.setSymbol(s, maxD, SYMBOLS.WORK, false);
                                    this.setSymbol(s, minD, SYMBOLS.OFF, false);
                                }
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            }
        }`;

const replacement = `        if (patBStaff.length > 0 && tsushoWorkingDays.length >= 2) {
            const getTsushoLoad = (d) => {
                let real = 0;
                for (const s of patBStaff) {
                    const sym = this.grid[s][d].symbol;
                    const ha = this.staffList[s].haSection || '';
                    const w = (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : (this.staffList[s].isZeroCount ? 0.0 : (this.staffList[s].isHalf ? 0.5 : 1.0));
                    if (isWorkSymbol(sym)) real += w;
                    else if (isHalfDuty(sym)) real += 0.5 * w;
                }
                return real;
            };

            const checkPureOffStreak = (sIdx) => {
                let strk = 0;
                const stf = this.staffList[sIdx];
                if (stf.prevDays) {
                    for (let p = stf.prevDays.length - 1; p >= 0; p--) {
                        if (!isPurePublicOffSymbol(stf.prevDays[p])) strk++;
                        else break;
                    }
                }
                for (let cd = 0; cd < this.numDays; cd++) {
                    if (!isPurePublicOffSymbol(this.grid[sIdx][cd].symbol)) {
                        strk++;
                        if (strk > 6) return false;
                    } else {
                        strk = 0;
                    }
                }
                return true;
            };

            // ★ フェーズ1: 週内スワップ（Intra-week Swap）
            // 各週（日〜土）の中で月〜土の出勤実数を平準化！同一週内のため週休2日を絶対に壊さず土曜偏重を解消
            const weekSpans = this.weekSpans || [];
            for (let pass = 0; pass < 20; pass++) {
                let anySwapped = false;
                for (const span of weekSpans) {
                    const workDaysInSpan = span.filter(d => {
                        const di = dates[d];
                        return di ? !di.isSun : ((d % 7) !== 6);
                    });
                    if (workDaysInSpan.length < 2) continue;

                    for (let iter = 0; iter < 15; iter++) {
                        const loads = workDaysInSpan.map(d => ({ day: d, real: getTsushoLoad(d) }));
                        loads.sort((a, b) => b.real - a.real);

                        if (loads[0].real - loads[loads.length - 1].real <= 0.6) break;

                        let swapped = false;
                        for (let h = 0; h < loads.length; h++) {
                            const maxD = loads[h].day;
                            for (let l = loads.length - 1; l >= 0; l--) {
                                const minD = loads[l].day;
                                if (loads[h].real - loads[l].real <= 0.6) continue;

                                for (const s of patBStaff) {
                                    if (this.grid[s][maxD].symbol === SYMBOLS.WORK && !this.grid[s][maxD].isFixed &&
                                        this.grid[s][minD].symbol === SYMBOLS.OFF && !this.grid[s][minD].isFixed) {

                                        if (cl2Staff.includes(s) && cl2Staff.length >= 2) {
                                            const otherCl2 = cl2Staff.find(o => o !== s);
                                            if (otherCl2 && isHolidaySymbol(this.grid[otherCl2][maxD].symbol)) continue;
                                        }

                                        this.setSymbol(s, maxD, SYMBOLS.OFF, false);
                                        this.setSymbol(s, minD, SYMBOLS.WORK, false);

                                        if (this.isStaffHardValid(s) && checkPureOffStreak(s)) {
                                            swapped = true;
                                            anySwapped = true;
                                            break;
                                        } else {
                                            this.setSymbol(s, maxD, SYMBOLS.WORK, false);
                                            this.setSymbol(s, minD, SYMBOLS.OFF, false);
                                        }
                                    }
                                }
                                if (swapped) break;
                            }
                            if (swapped) break;
                        }
                        if (!swapped) break;
                    }
                }
                if (!anySwapped) break;
            }

            // ★ フェーズ2: 全体スワップ（Global Swap）
            for (let iter = 0; iter < 100; iter++) {
                const dailyLoads = tsushoWorkingDays.map(d => ({ day: d, real: getTsushoLoad(d) }));
                dailyLoads.sort((a, b) => b.real - a.real);

                const maxItem = dailyLoads[0];
                const minItem = dailyLoads[dailyLoads.length - 1];
                if (maxItem.real - minItem.real <= 0.6) break;

                let swapped = false;
                for (let h = 0; h < Math.min(10, dailyLoads.length); h++) {
                    const maxD = dailyLoads[h].day;
                    for (let l = dailyLoads.length - 1; l >= Math.max(0, dailyLoads.length - 10); l--) {
                        const minD = dailyLoads[l].day;
                        if (dailyLoads[h].real - dailyLoads[l].real <= 0.6) continue;

                        for (const s of patBStaff) {
                            if (this.grid[s][maxD].symbol === SYMBOLS.WORK && !this.grid[s][maxD].isFixed &&
                                this.grid[s][minD].symbol === SYMBOLS.OFF && !this.grid[s][minD].isFixed) {

                                if (cl2Staff.includes(s) && cl2Staff.length >= 2) {
                                    const otherCl2 = cl2Staff.find(o => o !== s);
                                    if (otherCl2 && isHolidaySymbol(this.grid[otherCl2][minD].symbol)) continue;
                                }

                                this.setSymbol(s, maxD, SYMBOLS.OFF, false);
                                this.setSymbol(s, minD, SYMBOLS.WORK, false);

                                if (this.isStaffHardValid(s) && checkPureOffStreak(s)) {
                                    swapped = true;
                                    break;
                                } else {
                                    this.setSymbol(s, maxD, SYMBOLS.WORK, false);
                                    this.setSymbol(s, minD, SYMBOLS.OFF, false);
                                }
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            }
        }`;

code = code.replace(/\r\n/g, '\n');
const normT = target.replace(/\r\n/g, '\n');
const normR = replacement.replace(/\r\n/g, '\n');

if (code.includes(normT)) {
    code = code.replace(normT, normR);
    console.log('✅ Updated balanceLifeWorkforceDirectly in solver.js');
} else {
    console.error('❌ Target not found in solver.js');
}

fs.writeFileSync('solver.js', code, 'utf8');
