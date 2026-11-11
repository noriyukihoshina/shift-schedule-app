# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. eliminateSingleDayWork の強化（単発1勤の完全撲滅）
single_work_pattern = r"""eliminateSingleDayWork\(\) \{[\s\S]*?\}\n    \}"""

new_eliminate_single = """eliminateSingleDayWork() {
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
                    // パターン1: 翌日(d+1)が未固定の「休」で、翌々日(d+2)が未固定の「○」ならスワップ！
                    // [休, ○(d), 休(d+1), ○(d+2)] => [休, ○(d), ○(d+1), 休(d+2)] (2連勤に変換)
                    if (d + 2 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 2].isFixed && this.grid[s][d + 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 2].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターン2: 前日(d-1)が未固定の「休」で、前々日(d-2)が未固定の「○」ならスワップ！
                    // [○(d-2), 休(d-1), ○(d), 休(d+1)] => [休(d-2), ○(d-1), ○(d), 休(d+1)] (2連勤に変換)
                    if (d - 2 >= 0 && !this.grid[s][d - 1].isFixed && this.grid[s][d - 1].symbol === SYMBOLS.OFF && !this.grid[s][d - 2].isFixed && this.grid[s][d - 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d - 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d - 2].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターン3: 翌日(d+1)が未固定の「休」で、d+3が未固定の「○」ならスワップ
                    if (d + 3 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 3].isFixed && this.grid[s][d + 3].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 3].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターン4: 単発日(d)を「休」にし、別の未固定公休日(連休等)を「○」にスワップ（連休を1つ減らし単発を消去）
                    for (let otherD = 0; otherD < this.numDays; otherD++) {
                        if (Math.abs(otherD - d) <= 1) continue;
                        if (!this.grid[s][otherD].isFixed && this.grid[s][otherD].symbol === SYMBOLS.OFF) {
                            // otherD の前後が休日で3連休や2連休になっている場合
                            const oPrev = this.getSymbol(s, otherD - 1);
                            const oNext = (otherD + 1 < this.numDays) ? this.getSymbol(s, otherD + 1) : '';
                            if (isHolidaySymbol(oPrev) || isHolidaySymbol(oNext)) {
                                this.grid[s][d].symbol = SYMBOLS.OFF;
                                this.grid[s][otherD].symbol = SYMBOLS.WORK;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }"""

import re
code = re.sub(single_work_pattern, new_eliminate_single, code, count=1)
print("1. Enhanced eliminateSingleDayWork")

# 2. 特殊勤務の割り当てにおける遅番最大1回厳守 & 回数平準化
# counts.late[s] >= 1 のスタッフを絶対に遅番に割り当てないようハードガード
old_late_hard_guard = "if (this.staffList[s][req.noFlag]) continue;"
new_late_hard_guard = """if (this.staffList[s][req.noFlag]) continue;
                    // ★ 遅番は全スタッフ「最大1回」絶対厳守！（事前入力等を含め既に遅番が1回あるスタッフは完全除外）
                    if (req.key === 'late' && counts.late[s] >= 1) continue;
                    // ★ 8時担当スタッフは特殊勤務合計（早・遅・E・8時）をちょうど2回に固定（早遅Eは最大1回）
                    if (is8ClockStaff && counts.total[s] >= 1) continue;
                    // ★ 一般スタッフ（8時なし）は特殊勤務合計（早・遅・E）最大5回（6回以上は完全除外）
                    if (!is8ClockStaff && counts.total[s] >= 5) continue;
"""

if old_late_hard_guard in code:
    code = code.replace(old_late_hard_guard, new_late_hard_guard)
    print("2. Added hard exclusion for late >= 1 and total >= 5")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved solver.js")
