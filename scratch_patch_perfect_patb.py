with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern B スタッフの平日公休配置ロジックを最適化
target_old_patB_loop = """        allPatB.forEach((s, pIdx) => {
            const staff = this.staffList[s];
            // 4〜5つの週スパンごとに平日公休を均等に配置
            for (let w = 0; w < this.weekSpans.length; w++) {
                const wSpan = this.weekSpans[w];
                let weekOffCount = 0;
                for (const d of wSpan) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) weekOffCount++;
                }

                // 週休2日（日曜日休＋平日休1日）を満たす。第1週で前タームから連勤が続く場合は水〜土に必ず平日公休を1日配置！
                let needOffInWeek = 2;
                if (w === 0 && staff.prevDays) {
                    let prevC = 0;
                    for (let p = 4; p >= 0; p--) {
                        if (isWorkSymbol(staff.prevDays[p])) prevC++;
                        else break;
                    }
                    // 前ターム末から2連勤以上ある場合、第1週の日曜休に加えて水〜土に公休が必須
                    if (prevC >= 2) {
                        let hasMidOff = false;
                        for (const d of wSpan) {
                            const di = dates[d];
                            if (di && di.wIdx !== 6 && isHolidaySymbol(this.grid[s][d].symbol)) hasMidOff = true;
                        }
                        if (!hasMidOff) needOffInWeek = 3; // 日曜休＋平日休を確実に選出
                    }
                }
                if (weekOffCount < needOffInWeek) {
                    const weekdayCandidates = [];
                    for (const d of wSpan) {
                        const di = dates[d];
                        const isSunday = di ? (di.wIdx === 6) : (d % 7 === 6);
                        if (!isSunday && this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                            // CL2同士の重なり防止
                            if (cl2Staff.includes(s)) {
                                const otherCl2 = cl2Staff.find(other => other !== s);
                                if (otherCl2 && isHolidaySymbol(this.grid[otherCl2][d].symbol)) continue;
                            }
                            // 日別平準化スコア＆連勤防止ボーナス
                            let score = dailyPatBOff[d] * 100 + ((pIdx * 3 + w + d) % 7);
                            // 土曜日は日曜日と合わせて2連休になるため、5連勤防止に極めて有効
                            if (di && di.wIdx === 5) score -= 30;
                            // 第1週目で前ターム末から連勤が伸びている場合、前半日(d <= 3)の公休を強く優遇
                            if (w === 0 && d <= 3) {
                                let prevConsec = 0;
                                if (staff.prevDays) {
                                    for (let p = 4; p >= 0; p--) {
                                        if (isWorkSymbol(staff.prevDays[p])) prevConsec++;
                                        else break;
                                    }
                                }
                                if (prevConsec >= 2) score -= (prevConsec * 40);
                            }
                            weekdayCandidates.push({ d, score });
                        }
                    }

                    if (weekdayCandidates.length > 0) {
                        weekdayCandidates.sort((a, b) => a.score - b.score);
                        const chosenD = weekdayCandidates[0].d;
                        this.grid[s][chosenD].symbol = SYMBOLS.OFF;
                        dailyPatBOff[chosenD]++;
                        weekOffCount++;
                    }
                }
            }"""

target_new_patB_loop = """        allPatB.forEach((s, pIdx) => {
            const staff = this.staffList[s];
            // 各週スパンごとに平日公休を1日ずつ均等配置（日曜4日＋平日4日＝計8日公休満額達成）
            for (let w = 0; w < this.weekSpans.length; w++) {
                const wSpan = this.weekSpans[w];
                // この週スパン内に既に日曜以外の公休があるかチェック
                let hasWeekdayOff = false;
                for (const d of wSpan) {
                    const di = dates[d];
                    const isSunday = di ? (di.wIdx === 6) : (d % 7 === 6);
                    if (!isSunday && isHolidaySymbol(this.grid[s][d].symbol)) {
                        hasWeekdayOff = true;
                        break;
                    }
                }

                if (!hasWeekdayOff) {
                    const weekdayCandidates = [];
                    for (const d of wSpan) {
                        const di = dates[d];
                        const isSunday = di ? (di.wIdx === 6) : (d % 7 === 6);
                        if (!isSunday && this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                            // CL2同士の重なり防止
                            if (cl2Staff.includes(s)) {
                                const otherCl2 = cl2Staff.find(other => other !== s);
                                if (otherCl2 && isHolidaySymbol(this.grid[otherCl2][d].symbol)) continue;
                            }
                            // 日別平準化スコア
                            let score = dailyPatBOff[d] * 100 + ((pIdx * 3 + w + d) % 7);
                            // 土曜日は日曜日と合わせて2連休になるため連勤防止に有効
                            if (di && di.wIdx === 5) score -= 20;
                            // 第1週目で前ターム末からの連勤がある場合、前半日の公休を優遇して6連勤を確実に防止
                            if (w === 0 && d <= 3) {
                                let prevConsec = 0;
                                if (staff.prevDays) {
                                    for (let p = 4; p >= 0; p--) {
                                        if (isWorkSymbol(staff.prevDays[p])) prevConsec++;
                                        else break;
                                    }
                                }
                                if (prevConsec >= 2) score -= 50;
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
            }"""

if target_old_patB_loop in content:
    content = content.replace(target_old_patB_loop, target_new_patB_loop)
    print("Replaced PatB loop with perfect weekday distribution")
else:
    print("target NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js successfully!")
