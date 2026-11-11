with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

pos_start = content.find('allPatB.forEach((s, pIdx) => {')
pos_end = content.find('        // 4. 空き枠の全スタッフ確定', pos_start)

new_patB_block = """allPatB.forEach((s, pIdx) => {
            const staff = this.staffList[s];

            // 主要4週スパン（d=0〜3, d=4〜10, d=11〜17, d=18〜24）
            const majorSpans = [
                this.weekSpans[0] || [0, 1, 2, 3],
                (this.weekSpans[1] || [4, 5, 6, 7, 8, 9, 10]).filter(d => dates[d] && dates[d].wIdx !== 6),
                (this.weekSpans[2] || [11, 12, 13, 14, 15, 16, 17]).filter(d => dates[d] && dates[d].wIdx !== 6),
                (this.weekSpans[3] || [18, 19, 20, 21, 22, 23, 24]).filter(d => dates[d] && dates[d].wIdx !== 6)
            ];

            majorSpans.forEach((wSpan, wIdx) => {
                let hasWeekdayOff = false;
                for (const d of wSpan) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) { hasWeekdayOff = true; break; }
                }

                if (!hasWeekdayOff) {
                    const weekdayCandidates = [];
                    for (const d of wSpan) {
                        const di = dates[d];
                        const isSunday = di ? (di.wIdx === 6) : (d % 7 === 6);
                        if (!isSunday && this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                            if (cl2Staff.includes(s)) {
                                const otherCl2 = cl2Staff.find(other => other !== s);
                                if (otherCl2 && isHolidaySymbol(this.grid[otherCl2][d].symbol)) continue;
                            }
                            let score = dailyPatBOff[d] * 100 + ((pIdx * 3 + wIdx + d) % 7);
                            // 土曜日は日曜日と合わせて土日2連休になるため連勤防止に有効
                            if (di && di.wIdx === 5) score -= 25;
                            // 第1週目で前ターム末からの連勤がある場合、前半日(d <= 3)を最優先
                            if (wIdx === 0 && d <= 3) {
                                let prevConsec = 0;
                                if (staff.prevDays) {
                                    for (let p = 4; p >= 0; p--) {
                                        if (isWorkSymbol(staff.prevDays[p])) prevConsec++;
                                        else break;
                                    }
                                }
                                if (prevConsec >= 2) score -= 60;
                            }
                            weekdayCandidates.push({ d, score });
                        }
                    }

                    if (weekdayCandidates.length > 0) {
                        weekdayCandidates.sort((a, b) => a.score - b.score);
                        const chosenD = weekdayCandidates[0].d;
                        this.grid[s][chosenD].symbol = SYMBOLS.OFF;
                        dailyPatBOff[chosenD]++;
                    }
                }
            });

            // ★ 公休日数8日（stdHols）の厳格死守！
            let curOff = 0;
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === SYMBOLS.OFF) curOff += 1.0;
                else if (this.grid[s][d].symbol === '○/休' || this.grid[s][d].symbol === '休/○' || this.grid[s][d].symbol === '〇/休' || this.grid[s][d].symbol === '休/〇') curOff += 0.5;
            }

            // 不足分がある場合（8日未満）
            while (curOff < stdHols) {
                const cands = [];
                for (let d = 0; d < this.numDays; d++) {
                    const di = dates[d];
                    const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
                    if (!isSun && this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                        cands.push({ d, offCount: dailyPatBOff[d] });
                    }
                }
                if (cands.length === 0) break;
                cands.sort((a, b) => a.offCount - b.offCount);
                this.grid[s][cands[0].d].symbol = SYMBOLS.OFF;
                dailyPatBOff[cands[0].d]++;
                curOff++;
            }

            // ★ 超過分がある場合（8日超過・9日バグの完全解消！）
            while (curOff > stdHols) {
                const cands = [];
                for (let d = 0; d < this.numDays; d++) {
                    const di = dates[d];
                    const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
                    if (!isSun && !this.grid[s][d].isFixed && this.grid[s][d].symbol === SYMBOLS.OFF) {
                        let prevC = 0;
                        if (staff.prevDays) {
                            for (let p = 4; p >= 0; p--) {
                                if (isWorkSymbol(staff.prevDays[p])) prevC++;
                                else break;
                            }
                        }
                        if (prevC >= 2 && d <= 3) continue;

                        this.grid[s][d].symbol = SYMBOLS.WORK;
                        const valid = this.isStaffHardValid(s);
                        this.grid[s][d].symbol = SYMBOLS.OFF;
                        if (valid) {
                            cands.push({ d, offCount: dailyPatBOff[d] });
                        }
                    }
                }
                if (cands.length === 0) break;
                cands.sort((a, b) => b.offCount - a.offCount);
                this.grid[s][cands[0].d].symbol = SYMBOLS.WORK;
                dailyPatBOff[cands[0].d]--;
                curOff--;
            }

            // 残りの空き枠を通常勤務「○」に確定
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === '') {
                    this.grid[s][d].symbol = SYMBOLS.WORK;
                }
            }
        });\n\n"""

content = content[:pos_start] + new_patB_block + content[pos_end:]
with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js successfully!")
