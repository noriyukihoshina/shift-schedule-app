# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

single_work_def = """    eliminateSingleDayWork() {
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
                    // 解決策1: 直前の日(d-1)が未固定の「休」なら、公休を1日ずらしてdを休みに、d-1を出勤にする！
                    // [○(d-2), 休(d-1), ○(d), 休(d+1)] => [○(d-2), ○(d-1), 休(d), 休(d+1)] (2連休に変換・単発完全撲滅！)
                    if (d - 1 >= 0 && !this.grid[s][d - 1].isFixed && this.grid[s][d - 1].symbol === SYMBOLS.OFF) {
                        this.grid[s][d - 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // 解決策2: 翌日(d+1)が未固定の「休」なら、公休を1日ずらしてdを休みに、d+1を出勤にする！
                    // [休(d-1), ○(d), 休(d+1), ○(d+2)] => [休(d-1), 休(d), ○(d+1), ○(d+2)] (2連休に変換・単発完全撲滅！)
                    if (d + 1 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF) {
                        this.grid[s][d].symbol = SYMBOLS.OFF;
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        continue;
                    }

                    // 解決策3: 翌々日(d+2)が未固定の「○」ならスワップ
                    if (d + 2 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 2].isFixed && this.grid[s][d + 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 2].symbol = SYMBOLS.OFF;
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

print("Updated eliminateSingleDayWork with immediate 1-day shift")
