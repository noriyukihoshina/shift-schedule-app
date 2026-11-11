# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = "    balanceDailyWorkforce() {"

method_def = """    /**
     * ★ 全テーブル共通: 「休 ○ 休」（単発1勤）の完全撲滅
     * ユーザー指示: 「休〇休」は1勤です。可能な限り作らない。公休をひとつずらせば済む話です。
     * 単発勤務（前日も翌日も休日）を検知し、前後の公休をずらすなどして2連勤または連休に変換！
     */
    eliminateSingleDayWork() {
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
                    // パターンA: 翌日(d+1)が未固定の「休」で、翌々日(d+2)が未固定の「○」ならスワップ！
                    // [休, ○(d), 休(d+1), ○(d+2)] => [休, ○(d), ○(d+1), 休(d+2)] (2連勤に変換)
                    if (d + 2 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 2].isFixed && this.grid[s][d + 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 2].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターンB: 前日(d-1)が未固定の「休」で、前々日(d-2)が未固定の「○」ならスワップ！
                    // [○(d-2), 休(d-1), ○(d), 休(d+1)] => [休(d-2), ○(d-1), ○(d), 休(d+1)] (2連勤に変換)
                    if (d - 2 >= 0 && !this.grid[s][d - 1].isFixed && this.grid[s][d - 1].symbol === SYMBOLS.OFF && !this.grid[s][d - 2].isFixed && this.grid[s][d - 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d - 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d - 2].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターンC: 翌日(d+1)が未固定の「休」で、d+3が未固定の「○」ならスワップ
                    if (d + 3 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 3].isFixed && this.grid[s][d + 3].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 3].symbol = SYMBOLS.OFF;
                        continue;
                    }
                }
            }
        }
    }

"""

if 'eliminateSingleDayWork() {' not in code:
    code = code.replace(target, method_def + target)
    print("Added eliminateSingleDayWork method definition to ShiftScheduler")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated solver.js")
