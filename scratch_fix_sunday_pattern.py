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

                    // 日曜日は固定休として守り、平日の公休を移動させる
                    const isPrevSunday = prevDi ? (prevDi.wIdx === 6) : ((d - 1) % 7 === 6);
                    const isNextSunday = nextDi ? (nextDi.wIdx === 6) : ((d + 1) % 7 === 6);

                    // パターンA: 翌日(d+1)が未固定の「休」で、日曜でない場合、d+1を出勤にしてdを休みにする
                    // （前日が日曜休の場合、日曜＋当日の2連休になり単発消滅！）
                    if (d + 1 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !isNextSunday) {
                        this.grid[s][d].symbol = SYMBOLS.OFF;
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        continue;
                    }

                    // パターンB: 前日(d-1)が未固定の「休」で、日曜でない場合、d-1を出勤にしてdを休みにする
                    if (d - 1 >= 0 && !this.grid[s][d - 1].isFixed && this.grid[s][d - 1].symbol === SYMBOLS.OFF && !isPrevSunday) {
                        this.grid[s][d - 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターンC: 翌々日(d+2)が未固定の「○」なら、d+1(休)とd+2(○)をスワップ
                    if (d + 2 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 2].isFixed && this.grid[s][d + 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 2].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターンD: 前々日(d-2)が未固定の「○」なら、d-1(休)とd-2(○)をスワップ
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

print("Updated eliminateSingleDayWork with sunday-protection pattern")
