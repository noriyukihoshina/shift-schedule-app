# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

single_work_def = """    eliminateSingleDayWork() {
        const dates = this.dates || [];
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;

            for (let pass = 0; pass < 3; pass++) {
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (sym !== SYMBOLS.WORK || this.grid[s][d].isFixed) continue;

                    const prevSym = this.getSymbol(s, d - 1);
                    const nextSym = (d + 1 < this.numDays) ? this.getSymbol(s, d + 1) : '';

                    // 休 ○ 休 の単発勤務か
                    if (isHolidaySymbol(prevSym) && (d + 1 < this.numDays && isHolidaySymbol(nextSym))) {
                        // パターン1: 翌々日(d+2)が○なら、公休(d+1)をd+2にずらす！
                        // [休, ○(d), 休(d+1), ○(d+2)] => [休, ○(d), ○(d+1), 休(d+2)]
                        if (d + 2 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 2].isFixed && this.grid[s][d + 2].symbol === SYMBOLS.WORK) {
                            this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                            this.grid[s][d + 2].symbol = SYMBOLS.OFF;
                            continue;
                        }

                        // パターン2: 前々日(d-2)が○なら、公休(d-1)をd-2にずらす！
                        // [○(d-2), 休(d-1), ○(d), 休] => [休(d-2), ○(d-1), ○(d), 休]
                        if (d - 2 >= 0 && !this.grid[s][d - 1].isFixed && this.grid[s][d - 1].symbol === SYMBOLS.OFF && !this.grid[s][d - 2].isFixed && this.grid[s][d - 2].symbol === SYMBOLS.WORK) {
                            this.grid[s][d - 1].symbol = SYMBOLS.WORK;
                            this.grid[s][d - 2].symbol = SYMBOLS.OFF;
                            continue;
                        }

                        // パターン3: d+1(休)の次の日が休日で連休になっている場合、d(○)を休みにし、d+1(休)を○にする
                        // [休, ○(d), 休(d+1), 休(d+2)] => [休, 休(d), ○(d+1), 休(d+2)]
                        // または d(○)を休みにし、連勤中の他の未固定公休を出勤にする
                        if (d + 1 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF) {
                            this.grid[s][d].symbol = SYMBOLS.OFF;
                            this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                            continue;
                        }
                    }
                }
            }
        }
    }"""

import re
code = re.sub(r'eliminateSingleDayWork\(\) \{[\s\S]*?\}\n    \}', single_work_def, code, count=1)

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated eliminateSingleDayWork with simple shift")
