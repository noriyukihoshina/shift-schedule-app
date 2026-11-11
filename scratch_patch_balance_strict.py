import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# balanceSpecialDuties の集計部と制限部を厳格化
old_balance_fn = """            // 各スタッフの現在回数を集計
            const counts = {
                early: new Array(this.numStaff).fill(0),
                late: new Array(this.numStaff).fill(0),
                eve: new Array(this.numStaff).fill(0),
                total: new Array(this.numStaff).fill(0)
            };
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (sym === SYMBOLS.EARLY) { counts.early[s]++; counts.total[s]++; }
                    if (sym === SYMBOLS.LATE) { counts.late[s]++; counts.total[s]++; }
                    if (sym === SYMBOLS.EVE) { counts.eve[s]++; counts.total[s]++; }
                }
            }

            // 1. 8時スタッフで合計が3回以上になっている人を減らす（目標: 2回以下）
            // 2. または一般スタッフで合計が6回以上になっている人を減らす（目標: 4〜5回）
            // 3. または特定勤務種別で上限を超えている人（遅>=2、E>=3、早>=3）を減らす
            const overStaffList = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                const limitTotal = is8(s) ? 2 : 5;
                let overScore = 0;
                if (counts.total[s] > limitTotal) overScore += (counts.total[s] - limitTotal) * 100;
                if (counts.late[s] > 1) overScore += (counts.late[s] - 1) * 80;
                if (counts.eve[s] > 2) overScore += (counts.eve[s] - 2) * 50;
                if (!is8(s) && counts.early[s] > 2) overScore += (counts.early[s] - 2) * 30;
                if (is8(s) && counts.early[s] > 1) overScore += (counts.early[s] - 1) * 40;

                if (overScore > 0) {
                    overStaffList.push({ staff: s, overScore, is8: is8(s) });
                }
            }"""

new_balance_fn = """            // 各スタッフの現在回数を集計（8時も含めて厳密に集計！）
            const counts = {
                early: new Array(this.numStaff).fill(0),
                late: new Array(this.numStaff).fill(0),
                eve: new Array(this.numStaff).fill(0),
                h8: new Array(this.numStaff).fill(0),
                total: new Array(this.numStaff).fill(0)
            };
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (sym === SYMBOLS.EARLY) { counts.early[s]++; counts.total[s]++; }
                    if (sym === SYMBOLS.LATE) { counts.late[s]++; counts.total[s]++; }
                    if (sym === SYMBOLS.EVE) { counts.eve[s]++; counts.total[s]++; }
                    if (sym === SYMBOLS.H8) { counts.h8[s]++; }
                }
            }

            // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！一般スタッフは4回均等！
            const overStaffList = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                const has8 = counts.h8[s] > 0 || is8(s);
                const grandTotal = counts.total[s] + counts.h8[s];
                let overScore = 0;
                if (has8) {
                    // 8時がある人は全特殊勤務合計が「2回」を超えていたら最優先で減らす！
                    if (grandTotal > 2) overScore += (grandTotal - 2) * 300;
                } else {
                    // 一般スタッフは合計が4回を超えていたら減らす（目標4回）
                    if (counts.total[s] > 4) overScore += (counts.total[s] - 4) * 100;
                }
                if (counts.late[s] > 1) overScore += (counts.late[s] - 1) * 80;
                if (counts.eve[s] > 2) overScore += (counts.eve[s] - 2) * 50;

                if (overScore > 0) {
                    overStaffList.push({ staff: s, overScore, is8: has8 });
                }
            }"""

if old_balance_fn in text:
    text = text.replace(old_balance_fn, new_balance_fn)
    print("SUCCESS: Updated balanceSpecialDuties counts and overStaffList")
else:
    print("WARNING: old_balance_fn not found directly")

# スワップ先スタッフの選択条件でも、8時がある人は grandTotal >= 2 なら除外する
old_under_check = "if (counts.total[otherS] >= (is8(otherS) ? 2 : 4)) continue;"
new_under_check = """const otherHas8 = counts.h8[otherS] > 0 || is8(otherS);
                    const otherGrandTotal = counts.total[otherS] + counts.h8[otherS];
                    if (otherHas8 && otherGrandTotal >= 2) continue; // 8時担当者は2回でストップ
                    if (!otherHas8 && counts.total[otherS] >= 4) continue; // 一般スタッフは4回でストップ"""

if old_under_check in text:
    text = text.replace(old_under_check, new_under_check)
    print("SUCCESS: Updated underStaff check to strictly stop at 2 for 8h staff and 4 for general staff")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("solver.js updated successfully.")
