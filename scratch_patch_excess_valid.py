with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_excess = """            // ★ 超過分がある場合（8日超過・9日バグの完全解消！）
            while (curOff > stdHols) {
                const cands = [];
                for (let d = 0; d < this.numDays; d++) {
                    const di = dates[d];
                    const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
                    if (!isSun && !this.grid[s][d].isFixed && this.grid[s][d].symbol === SYMBOLS.OFF) {
                        cands.push({ d, offCount: dailyPatBOff[d] });
                    }
                }
                if (cands.length === 0) break;
                // 休みの多い日を優先して勤務「○」に戻す
                cands.sort((a, b) => b.offCount - a.offCount);
                this.grid[s][cands[0].d].symbol = SYMBOLS.WORK;
                dailyPatBOff[cands[0].d]--;
                curOff--;
            }"""

target_new_excess = """            // ★ 超過分がある場合（8日超過・9日バグの完全解消！）
            while (curOff > stdHols) {
                const cands = [];
                for (let d = 0; d < this.numDays; d++) {
                    const di = dates[d];
                    const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
                    if (!isSun && !this.grid[s][d].isFixed && this.grid[s][d].symbol === SYMBOLS.OFF) {
                        // ★ 連勤チェック: その公休を「○」に戻しても連勤超過（5連勤超）にならない候補のみを抽出！
                        this.grid[s][d].symbol = SYMBOLS.WORK;
                        const valid = this.isStaffHardValid(s);
                        this.grid[s][d].symbol = SYMBOLS.OFF;
                        if (valid) {
                            cands.push({ d, offCount: dailyPatBOff[d] });
                        }
                    }
                }
                if (cands.length === 0) break;
                // 休みの多い日を優先して勤務「○」に戻す
                cands.sort((a, b) => b.offCount - a.offCount);
                this.grid[s][cands[0].d].symbol = SYMBOLS.WORK;
                dailyPatBOff[cands[0].d]--;
                curOff--;
            }"""

if target_old_excess in content:
    content = content.replace(target_old_excess, target_new_excess)
    print("Replaced excess holiday check with isStaffHardValid")
else:
    print("target NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js")
