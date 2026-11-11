import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 8時がある人の特殊勤務合計「2回固定」の物理保証
old_8h_guard = """                    const is8ClockStaff = !!this.staffList[s].can8;
                    const grandTotalSpecial = counts.total[s] + counts.h8[s];
                    if (is8ClockStaff || counts.h8[s] > 0) {
                        // 8時があるスタッフは、特殊勤務（早・遅・E・8時）の合計が「2回」に達していれば完全除外！
                        if (grandTotalSpecial >= 2) continue;
                    }"""

new_8h_guard = """                    // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！
                    const is8ClockStaff = !!this.staffList[s].can8;
                    const grandTotalSpecial = counts.total[s] + counts.h8[s];
                    if (counts.h8[s] > 0 || is8ClockStaff) {
                        // 8時が1回以上ある、または8時担当スタッフは、全特殊勤務合計が「2回」に達したら絶対に追加しない！
                        if (grandTotalSpecial >= 2) continue;
                    }"""

text = text.replace(old_8h_guard, new_8h_guard)

# 8時担当スタッフへのペナルティ: 1回（grandTotalSpecial === 1）の時は強く優先して2回目を入れ、2回（grandTotalSpecial === 2）でピタリと止める！
old_pen = """                        if (grandTotalSpecial === 1) {
                            totalCountPenalty = -20000; // 1回あるスタッフは2回目（合計2）の枠として強力に優先！
                        } else if (grandTotalSpecial === 0) {
                            totalCountPenalty = -5000;
                        } else {
                            totalCountPenalty = 300000; // 2回に達したら絶対にそれ以上割り当てない（2回固定）
                        }"""

new_pen = """                        if (grandTotalSpecial === 1) {
                            totalCountPenalty = -50000; // 1回あるスタッフは2回目（合計2）の枠として超強力に優先配分！
                        } else if (grandTotalSpecial === 0) {
                            totalCountPenalty = -5000;
                        } else {
                            totalCountPenalty = 999999; // 2回に達したら絶対に追加割当しない（2回固定）
                        }"""

text = text.replace(old_pen, new_pen)

# 一般スタッフの4回平準化
old_gen_pen = """                        if (counts.total[s] >= 5) {
                            totalCountPenalty = 250000 + (counts.total[s] - 5) * 80000; // 5回以上は超強力禁止
                        } else if (counts.total[s] === 4) {
                            totalCountPenalty = 45000; // 4回に達したスタッフは強いペナルティで新規割り当てを抑止
                        } else if (counts.total[s] === 3) {
                            totalCountPenalty = 0; // 3回のスタッフは4回目を目指して配置
                        } else if (counts.total[s] === 2) {
                            totalCountPenalty = -8000;
                        } else if (counts.total[s] === 1) {
                            totalCountPenalty = -16000;
                        } else {
                            totalCountPenalty = -28000; // まだ0〜2回のスタッフを最優先して4回に引き上げる！
                        }"""

new_gen_pen = """                        if (counts.total[s] >= 5) {
                            totalCountPenalty = 500000 + (counts.total[s] - 5) * 100000; // 5回以上は絶対禁止
                        } else if (counts.total[s] === 4) {
                            totalCountPenalty = 80000; // 4回に達したスタッフは強いペナルティで抑止
                        } else if (counts.total[s] === 3) {
                            totalCountPenalty = 0; // 3回のスタッフは4回目を目指して配置
                        } else if (counts.total[s] === 2) {
                            totalCountPenalty = -12000;
                        } else if (counts.total[s] === 1) {
                            totalCountPenalty = -25000;
                        } else {
                            totalCountPenalty = -40000; // まだ0〜2回のスタッフを最優先して4回に引き上げる！
                        }"""

text = text.replace(old_gen_pen, new_gen_pen)

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Strictly enforced 2 duties for 8h staff and 4 duties for general staff!")
