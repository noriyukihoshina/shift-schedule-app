import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. assign8ClockDuties の上限2回を撤廃し、8時可能スタッフ全体に3〜4回均等配分
old_h8_loop_guard = """                // ★ ユーザー指示: 8時の回数は1人最大1回（どうしても不足する場合のみ2回）！3回以上は絶対禁止！
                if (counts[s] >= 2) continue;"""

new_h8_loop_guard = """                // ★ ユーザー指示: 8時は全体で毎日1名必要（1人あたり3〜4回均等配分）。上限2回で足切りせず均等選出！
                // 割当回数が極端に多いスタッフ（既に平均回数を超えている）のみ抑制"""

text = text.replace(old_h8_loop_guard, new_h8_loop_guard)

# 8時のスコアリング部
old_h8_scoring = """                // 回数ペナルティ: 0回のスタッフを最優先（1回のスタッフは強く抑制）
                const countPenalty = counts[s] * 10000;

                // スコア: チーム均等 + 割当回数0回優先 + 直近ローテーション
                let score = countPenalty + teamPenalty - (d - lastAssignedDay[s]);"""

new_h8_scoring = """                // 回数ペナルティ: 既に8時を担当した回数が少ないスタッフを優先（全員に均等に3〜4回ずつ配分）
                const countPenalty = counts[s] * 3000;

                // スコア: チーム均等（A対B 14回対14回） + 個人回数平準化 + 直近ローテーション間隔
                let score = countPenalty + teamPenalty - (d - lastAssignedDay[s]);"""

text = text.replace(old_h8_scoring, new_h8_scoring)

# 2. assignSpecialDuties で、8時担当者の「早・遅・E」の合計を2個程度（最大2個）に抑える！
# counts.h8[s]: 8時回数, counts.total[s]: 早・遅・Eの合計回数
old_spec_guard = """                    // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！
                    const is8ClockStaff = !!this.staffList[s].can8;
                    const grandTotalSpecial = counts.total[s] + counts.h8[s];
                    if (counts.h8[s] > 0 || is8ClockStaff) {
                        // 8時が1回以上ある、または8時担当スタッフは、全特殊勤務合計が「2回」に達したら絶対に追加しない！
                        if (grandTotalSpecial >= 2) continue;
                    }"""

new_spec_guard = """                    // ★ ユーザー指示: 8時担当スタッフは、8時を3〜4回担当して日勤が減るため、早・遅・Eなどの「他の特殊勤務」を2個程度（最大2個）に抑える！
                    const is8ClockStaff = !!this.staffList[s].can8;
                    const has8 = counts.h8[s] > 0 || is8ClockStaff;
                    if (has8) {
                        // 早・遅・Eの合計（counts.total[s]）が2回に達していれば、それ以上早遅Eを追加しない！
                        if (counts.total[s] >= 2) continue;
                    }"""

text = text.replace(old_spec_guard, new_spec_guard)

# ペナルティ部
old_spec_pen = """                        if (grandTotalSpecial === 1) {
                            totalCountPenalty = -50000; // 1回あるスタッフは2回目（合計2）の枠として超強力に優先配分！
                        } else if (grandTotalSpecial === 0) {
                            totalCountPenalty = -5000;
                        } else {
                            totalCountPenalty = 999999; // 2回に達したら絶対に追加割当しない（2回固定）
                        }"""

new_spec_pen = """                        // 8時担当スタッフ: 早・遅・Eの合計（counts.total[s]）を2個程度（0〜2回）に抑える
                        if (counts.total[s] === 1) {
                            totalCountPenalty = 10000; // 1回あれば十分
                        } else if (counts.total[s] === 0) {
                            totalCountPenalty = -2000; // 0回〜1回まで許容
                        } else {
                            totalCountPenalty = 500000; // 早遅Eが2回に達したら追加禁止
                        }"""

text = text.replace(old_spec_pen, new_spec_pen)

# 3. balanceSpecialDuties でも、8時担当者の早遅E合計（counts.total[s]）を2個以内に制限
old_bal_guard = """                const has8 = counts.h8[s] > 0 || is8(s);
                const grandTotal = counts.total[s] + counts.h8[s];
                let overScore = 0;
                if (has8) {
                    // 8時がある人は全特殊勤務合計が「2回」を超えていたら最優先で減らす！
                    if (grandTotal > 2) overScore += (grandTotal - 2) * 300;
                } else {
                    // 一般スタッフは合計が4回を超えていたら減らす（目標4回）
                    if (counts.total[s] > 4) overScore += (counts.total[s] - 4) * 100;
                }"""

new_bal_guard = """                const has8 = counts.h8[s] > 0 || is8(s);
                let overScore = 0;
                if (has8) {
                    // 8時担当スタッフは早・遅・Eの合計が2回を超えていたら最優先で減らす！
                    if (counts.total[s] > 2) overScore += (counts.total[s] - 2) * 300;
                } else {
                    // 一般スタッフは早・遅・E合計が4回を超えていたら減らす（目標4回）
                    if (counts.total[s] > 4) overScore += (counts.total[s] - 4) * 100;
                }"""

text = text.replace(old_bal_guard, new_bal_guard)

old_slow_check = """                        // ★ ユーザー指示: 8時担当スタッフは「全特殊勤務合計ちょうど2回固定」！一般スタッフは最大4回！
                        const isLow8 = counts.h8[sLow] > 0 || is8(sLow);
                        const sLowGrandTotal = counts.total[sLow] + counts.h8[sLow];
                        const sLowLimit = isLow8 ? 2 : 4;
                        if (sLowGrandTotal >= sLowLimit) continue;"""

new_slow_check = """                        // ★ ユーザー指示: 8時担当スタッフは早・遅・Eの合計を最大2個に抑える！一般スタッフは最大4回！
                        const isLow8 = counts.h8[sLow] > 0 || is8(sLow);
                        if (isLow8 && counts.total[sLow] >= 2) continue;
                        if (!isLow8 && counts.total[sLow] >= 4) continue;"""

text = text.replace(old_slow_check, new_slow_check)

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Updated solver.js for correct 8h distribution (3-4 times) and other special duties suppressed to <= 2!")
