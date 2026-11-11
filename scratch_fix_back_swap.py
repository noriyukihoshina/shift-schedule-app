# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

single_work_def = """    eliminateSingleDayWork() {
        const dates = this.dates || [];
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;

            for (let d = 0; d < this.numDays; d++) {
                const sym = this.grid[s][d].symbol;
                // 通常勤務「○」で、事前固定でない場合
                if (sym !== SYMBOLS.WORK || this.grid[s][d].isFixed) continue;

                const prevSym = this.getSymbol(s, d - 1);
                const nextSym = (d + 1 < this.numDays) ? this.getSymbol(s, d + 1) : '';

                // 前後が休日（公休・有休・リフ）で挟まれている単発1勤かチェック
                const isPrevOff = isHolidaySymbol(prevSym);
                const isNextOff = (d + 1 < this.numDays) ? isHolidaySymbol(nextSym) : true;

                if (isPrevOff && isNextOff) {
                    const di = dates[d];
                    const prevDi = (d - 1 >= 0) ? dates[d - 1] : null;
                    const nextDi = (d + 1 < this.numDays) ? dates[d + 1] : null;
                    const isPrevSunday = prevDi ? (prevDi.wIdx === 6) : ((d - 1) % 7 === 6);
                    const isNextSunday = nextDi ? (nextDi.wIdx === 6) : ((d + 1) % 7 === 6);

                    // パターン1: 翌日(d+1)が未固定の「休」で最終日近辺の場合、
                    // d+1を「○」にし、手前の連続勤務日(d-2, d-3等)を「休」にスワップして連休化！
                    let swapped = false;
                    if (d + 1 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !isNextSunday) {
                        for (let backD = d - 2; backD >= Math.max(0, d - 6); backD--) {
                            if (!this.grid[s][backD].isFixed && this.grid[s][backD].symbol === SYMBOLS.WORK) {
                                const bPrev = this.getSymbol(s, backD - 1);
                                const bNext = this.getSymbol(s, backD + 1);
                                // backDを休みにしても単発1勤を作らないか
                                if (!isHolidaySymbol(bPrev) && !isHolidaySymbol(bNext)) {
                                    this.grid[s][backD].symbol = SYMBOLS.OFF;
                                    this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                                    swapped = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (swapped) continue;

                    // パターン2: 翌々日(d+2)が未固定の「○」なら、d+1(休)とd+2(○)をスワップ
                    if (d + 2 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 2].isFixed && this.grid[s][d + 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 2].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターン3: 前々日(d-2)が未固定の「○」なら、d-1(休)とd-2(○)をスワップ
                    if (d - 2 >= 0 && !this.grid[s][d - 1].isFixed && this.grid[s][d - 1].symbol === SYMBOLS.OFF && !this.grid[s][d - 2].isFixed && this.grid[s][d - 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d - 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d - 2].symbol = SYMBOLS.OFF;
                        continue;
                    }
                }
            }
        }
    }"""

import re
code = re.sub(r'eliminateSingleDayWork\(\) \{[\s\S]*?\}\n    \}', single_work_def, code, count=1)

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated eliminateSingleDayWork with back-swap pattern")
