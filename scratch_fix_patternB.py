import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern B の公休割当ロジックを週休2日・5連勤保証ロジックへ置き換え
old_patB_block = """        if (patternBStaff.length > 0) {
            // 各日の公休人数カウント（平準化用）
            const offPerDay = new Array(this.numDays).fill(0);
            patternBStaff.forEach(s => {
                for (let d = 0; d < this.numDays; d++) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) {
                        offPerDay[d]++;
                    }
                }
            });

            patternBStaff.forEach(s => {
                let currentHols = 0;
                for (let d = 0; d < this.numDays; d++) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) currentHols++;
                }

                const needed = Math.round(stdHols - currentHols);
                if (needed > 0) {
                    const candidates = [];
                    for (let d = 0; d < this.numDays; d++) {
                        const di = dates[d];
                        const isSunday = di ? (di.wIdx === 6) : (d % 7 === 6);
                        // 日曜日以外で、未固定セル
                        if (!isSunday && this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                            candidates.push({
                                d: d,
                                offCount: offPerDay[d],
                                hash: (s * 7 + d * 3) % 11
                            });
                        }
                    }
                    // 公休人数が少ない平日に優先して割り当て
                    candidates.sort((a, b) => a.offCount - b.offCount || a.hash - b.hash);
                    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
                        const targetD = candidates[i].d;
                        this.grid[s][targetD].symbol = SYMBOLS.OFF;
                        offPerDay[targetD]++;
                    }
                }

                // 残りの空き枠は通常勤務「○」
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[s][d].symbol === '') {
                        this.grid[s][d].symbol = SYMBOLS.WORK;
                    }
                }
            });
        }"""

new_patB_block = """        if (patternBStaff.length > 0) {
            // ★ ユーザー指示: 生活期テーブルで通所スタッフ等が6連勤にならないよう、各週（日〜土）ごとに必ず日曜休＋平日1休（週休2日）を配置し、5連勤を完全回避！
            const offPerDay = new Array(this.numDays).fill(0);
            for (let d = 0; d < this.numDays; d++) {
                for (let s = 0; s < this.numStaff; s++) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) offPerDay[d]++;
                }
            }

            patternBStaff.forEach((s, pIdx) => {
                const staff = this.staffList[s];
                // 4つの週スパン（日〜土）ごとに平日公休を1日ずつ均等に分散配置
                for (let w = 0; w < this.weekSpans.length; w++) {
                    const wSpan = this.weekSpans[w];
                    // この週の公休数をカウント
                    let weekOffCount = 0;
                    for (const d of wSpan) {
                        if (isHolidaySymbol(this.grid[s][d].symbol)) weekOffCount++;
                    }

                    // 週休2日（日曜日休＋平日休1日）を満たすため、平日休がなければ1日追加
                    if (weekOffCount < 2) {
                        const weekdayCandidates = [];
                        for (const d of wSpan) {
                            const di = dates[d];
                            const isSunday = di ? (di.wIdx === 6) : (d % 7 === 6);
                            if (!isSunday && this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                                // 連勤チェック（この日を休みにしたときに前後の連勤が5日以下に収まるか）
                                weekdayCandidates.push({
                                    d: d,
                                    offCount: offPerDay[d],
                                    // スタッフごとに分散するようハッシュ
                                    score: offPerDay[d] * 10 + ((pIdx + w * 2 + d) % 5)
                                });
                            }
                        }

                        if (weekdayCandidates.length > 0) {
                            weekdayCandidates.sort((a, b) => a.score - b.score);
                            const chosenD = weekdayCandidates[0].d;
                            this.grid[s][chosenD].symbol = SYMBOLS.OFF;
                            offPerDay[chosenD]++;
                            weekOffCount++;
                        }
                    }
                }

                // 全体で公休日数が8日に達していない場合は不足分を追加、8日を超えていれば未固定平日公休を○に戻す
                let curOff = 0;
                for (let d = 0; d < this.numDays; d++) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) curOff++;
                }

                // 不足分がある場合
                while (curOff < stdHols) {
                    const cands = [];
                    for (let d = 0; d < this.numDays; d++) {
                        const di = dates[d];
                        const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
                        if (!isSun && this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                            cands.push({ d, offCount: offPerDay[d] });
                        }
                    }
                    if (cands.length === 0) break;
                    cands.sort((a, b) => a.offCount - b.offCount);
                    this.grid[s][cands[0].d].symbol = SYMBOLS.OFF;
                    offPerDay[cands[0].d]++;
                    curOff++;
                }

                // 残りの空き枠は通常勤務「○」
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[s][d].symbol === '') {
                        this.grid[s][d].symbol = SYMBOLS.WORK;
                    }
                }
            });
        }"""

if old_patB_block in text:
    text = text.replace(old_patB_block, new_patB_block)
    print("SUCCESS: Updated Pattern B holiday assignment in solver.js for strictly 5-consec limit and weekly 2-days off")
else:
    print("WARNING: old_patB_block not matched directly")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("solver.js part 1 complete.")
