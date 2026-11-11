import sys
sys.stdout.reconfigure(encoding='utf-8')

# 1. solver.js の solveSectionChiefSchedule に finalizeChiefSchedule を追加
with open('solver.js', 'r', encoding='utf-8') as f:
    solver_text = f.read()

old_sc_end = """                searchComb(0, []);
                if (bestCand) return bestCand;
            }
        }

        return baseSymbols;
    }"""

new_sc_end = """                searchComb(0, []);
                if (bestCand) return finalizeChiefSchedule(bestCand);
            }
        }

        return finalizeChiefSchedule(baseSymbols);
    }"""

# searchCombの前に finalizeChiefSchedule の定義を追加
old_search_comb_def = """        // 必要公休数 neededOffCount（それで連勤が解消しない場合は +1〜+2 日まで柔軟に許容）の平日休組み合わせを探索"""

new_search_comb_def = """        // ★ ユーザー指示: 係長（スタッフ01）の公休日数が9日になるバグを根絶！
        // 平日代休等を追加しても、全タームの公休日数が厳格に targetOff（8日）ちょうどになるよう土日休を「○」に振替調整
        const finalizeChiefSchedule = (symbols) => {
            if (!symbols) return symbols;
            const res = [...symbols];
            let offCount = 0;
            for (let d = 0; d < numDays; d++) {
                if (res[d] === SYMBOLS.OFF) offCount += 1.0;
                else if (res[d] === SYMBOLS.HALF_WORK_OFF || res[d] === SYMBOLS.HALF_OFF_WORK) offCount += 0.5;
            }
            if (offCount > targetOff) {
                let toRemove = Math.round(offCount - targetOff);
                // まず未固定の土日休を優先して「○」に変更
                for (let d = numDays - 1; d >= 0 && toRemove > 0; d--) {
                    if (!this.isWeekdayIndex(d) && !this.grid[s][d].isFixed && !this.grid[s][d].isAfterPreSpecial && res[d] === SYMBOLS.OFF) {
                        res[d] = SYMBOLS.WORK;
                        toRemove--;
                    }
                }
                // それでも超過していれば未固定の平日休を「○」に変更
                for (let d = numDays - 1; d >= 0 && toRemove > 0; d--) {
                    if (this.isWeekdayIndex(d) && !this.grid[s][d].isFixed && !this.grid[s][d].isAfterPreSpecial && res[d] === SYMBOLS.OFF) {
                        res[d] = SYMBOLS.WORK;
                        toRemove--;
                    }
                }
            }
            return res;
        };

        // 必要公休数 neededOffCount（それで連勤が解消しない場合は +1〜+2 日まで柔軟に許容）の平日休組み合わせを探索"""

assert old_sc_end in solver_text, "old_sc_end not found in solver.js"
assert old_search_comb_def in solver_text, "old_search_comb_def not found in solver.js"

solver_text = solver_text.replace(old_search_comb_def, new_search_comb_def)
solver_text = solver_text.replace(old_sc_end, new_sc_end)

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(solver_text)

print("SUCCESS: solver.js patched with finalizeChiefSchedule!")
