import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_block = """                    // ★ 要件: 8時担当スタッフの特殊勤務（早・遅・E）は2回程度に抑え、8時をやらない一般スタッフの特殊勤務を4〜5回に増やして平準化！
                    const is8ClockStaff = !!this.staffList[s].can8;

                    // 8時担当スタッフは特殊勤務（早・遅・E）の合計が既に2回に達していれば完全除外（最大2回を物理保証）！
                    if (is8ClockStaff && counts.total[s] >= 2) continue;

                    // 1. 合計回数ペナルティ（早+遅+E）
                    let totalCountPenalty = 0;
                    if (is8ClockStaff) {
                        // 8時担当スタッフ: 早・遅・Eの合計は「2回程度」（原則1〜2回）
                        if (counts.total[s] === 1) {
                            totalCountPenalty = 8000; // 1回あるスタッフは強く抑制
                        } else {
                            totalCountPenalty = -1000; // 0回のスタッフのみ許可
                        }
                    } else {
                        // 8時以外の一般スタッフ: 8時の特殊削減分を引き受け、合計目標は 4〜5回！
                        if (counts.total[s] >= 6) {
                            totalCountPenalty = 150000 + (counts.total[s] - 6) * 60000; // 6回以上は強く抑える
                        } else if (counts.total[s] === 5) {
                            totalCountPenalty = 15000;
                        } else if (counts.total[s] === 4) {
                            totalCountPenalty = 2000; // 4回までは積極的に配分
                        } else if (counts.total[s] === 3) {
                            totalCountPenalty = -2000;
                        } else if (counts.total[s] === 2) {
                            totalCountPenalty = -5000;
                        } else if (counts.total[s] === 1) {
                            totalCountPenalty = -8000;
                        } else {
                            totalCountPenalty = -12000; // まだ0回のスタッフを最優先！
                        }
                    }"""

new_block = """                    // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！
                    // counts.h8[s]: 8時回数, counts.total[s]: 早+遅+E回数
                    const is8ClockStaff = !!this.staffList[s].can8;
                    const grandTotalSpecial = counts.total[s] + counts.h8[s];
                    if (is8ClockStaff || counts.h8[s] > 0) {
                        // 8時があるスタッフは、特殊勤務（早・遅・E・8時）の合計が「2回」に達していれば完全除外！
                        if (grandTotalSpecial >= 2) continue;
                    }

                    // 1. 合計回数ペナルティ（早+遅+E）
                    let totalCountPenalty = 0;
                    if (is8ClockStaff || counts.h8[s] > 0) {
                        // 8時担当スタッフ: 全特殊勤務の合計がちょうど2回になるように誘導
                        if (grandTotalSpecial === 1) {
                            totalCountPenalty = -1000; // 1回あれば2回目として配置可能
                        } else if (grandTotalSpecial === 0) {
                            totalCountPenalty = -3000; // 0回なら優先配置
                        } else {
                            totalCountPenalty = 200000; // 2回以上は配置不可
                        }
                    } else {
                        // ★ ユーザー指示: 特殊勤務の合計数が3の人と5の人がいる。ばらつきを極限まで減らして極力全員4回均等配分！
                        if (counts.total[s] >= 5) {
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
                        }
                    }"""

if old_block in text:
    text = text.replace(old_block, new_block)
    print("SUCCESS: Patched is8ClockStaff and special duties penalty accurately")
    with open('solver.js', 'w', encoding='utf-8') as f:
        f.write(text)
else:
    print("ERROR: old_block not found")
