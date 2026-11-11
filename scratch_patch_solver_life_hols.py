with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. solveLife 内の公休日数カウント修正
# 旧: if (isHolidaySymbol(this.grid[s][d].symbol)) curOff++;
# 新: if (this.grid[s][d].symbol === SYMBOLS.OFF) curOff++;

target_old_curOff = """            // ★ 公休日数8日（stdHols）の厳格死守！
            let curOff = 0;
            for (let d = 0; d < this.numDays; d++) {
                if (isHolidaySymbol(this.grid[s][d].symbol)) curOff++;
            }"""

target_new_curOff = """            // ★ 公休日数8日（stdHols）の厳格死守！
            // ★ ユーザー指示: リフレッシュ休暇(上/下)や有休は公休とは別枠！純粋な公休「休」だけで必ず8日満額配置する！
            let curOff = 0;
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === SYMBOLS.OFF) curOff += 1.0;
                else if (this.grid[s][d].symbol === '○/休' || this.grid[s][d].symbol === '休/○' || this.grid[s][d].symbol === '〇/休' || this.grid[s][d].symbol === '休/〇') curOff += 0.5;
            }"""

if target_old_curOff in content:
    content = content.replace(target_old_curOff, target_new_curOff)
    print("Replaced Pattern B curOff")
else:
    print("Pattern B curOff NOT found!")

# 2. Pattern A（訪問等）スタッフの公休8日満額保証を追加
target_old_patA_fill = """                    } else {
                        // 平日は事前希望がなければ通常勤務「○」
                        if (this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = SYMBOLS.WORK;
                        }
                    }
                }
            } else if (isPatternB) {"""

target_new_patA_fill = """                    } else {
                        // 平日は事前希望がなければ通常勤務「○」
                        if (this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = SYMBOLS.WORK;
                        }
                    }
                }

                // ★ ユーザー指示: リフが入っても公休8日は別枠で維持！土日にリフや有休が入って公休「休」が8日未満なら平日に公休を追加
                let curOffA = 0;
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[s][d].symbol === SYMBOLS.OFF) curOffA += 1.0;
                    else if (this.grid[s][d].symbol === '○/休' || this.grid[s][d].symbol === '休/○' || this.grid[s][d].symbol === '〇/休' || this.grid[s][d].symbol === '休/〇') curOffA += 0.5;
                }
                while (curOffA < stdHols) {
                    // 平日の中で非固定の「○」を1日選んで公休「休」にする（月曜または金曜優先で3連休化）
                    let candD = -1;
                    for (let d = 0; d < this.numDays; d++) {
                        const di = dates[d];
                        const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
                        if (!isWeekend && !this.grid[s][d].isFixed && this.grid[s][d].symbol === SYMBOLS.WORK) {
                            if (candD === -1 || di.wIdx === 0 || di.wIdx === 4) {
                                candD = d;
                                if (di.wIdx === 0 || di.wIdx === 4) break;
                            }
                        }
                    }
                    if (candD !== -1) {
                        this.grid[s][candD].symbol = SYMBOLS.OFF;
                        curOffA++;
                    } else {
                        break;
                    }
                }
            } else if (isPatternB) {"""

if target_old_patA_fill in content:
    content = content.replace(target_old_patA_fill, target_new_patA_fill)
    print("Replaced Pattern A holiday guarantee")
else:
    print("Pattern A holiday guarantee NOT found!")

# 3. 訪問8時選出の確実化＆後処理保護
target_old_h8_post = """        // 6. 「休 ○ 休」（単発1勤）の撲滅リペア
        this.eliminateSingleDayWork();

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };"""

target_new_h8_post = """        // 6. 「休 ○ 休」（単発1勤）の撲滅リペア
        this.eliminateSingleDayWork();

        // 7. ★ 訪問8時の平日完全充足リペア（平日で8時が0名の日を100%根絶！）
        for (let d = 0; d < this.numDays; d++) {
            const di = dates[d];
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            if (isWeekend) continue; // 土日は8時なし

            let curH8Count = 0;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.grid[s][d].symbol === SYMBOLS.H8) curH8Count++;
            }

            if (curH8Count === 0) {
                // 出勤中の8時可スタッフから選出
                const cands = [];
                for (const s of h8StaffList) {
                    if (this.grid[s][d].symbol === SYMBOLS.WORK && !this.grid[s][d].isFixed) {
                        cands.push({ s, count: h8AssignedCounts[s] });
                    }
                }
                if (cands.length > 0) {
                    cands.sort((a, b) => a.count - b.count);
                    const pick = cands[0].s;
                    this.grid[pick][d].symbol = SYMBOLS.H8;
                    h8AssignedCounts[pick]++;
                }
            }
        }

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };"""

if target_old_h8_post in content:
    content = content.replace(target_old_h8_post, target_new_h8_post)
    print("Replaced h8 post repair")
else:
    print("h8 post repair NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js successfully!")
