# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 現在のステップ4の開始行と終了行を探す
start_marker = "        // 4. 未分類スタッフ（業務トグルの指定がない一般スタッフ）の勤務作成"
end_marker = "        // 5. 訪問スタッフの8時開始配置"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("MARKERS_NOT_FOUND")
    exit(1)

new_step4 = """        // 4. 未分類スタッフ（業務トグルの指定がない一般スタッフ）の勤務作成
        // ★ 指示: 作成の指示が無い者は通常のPO同様公休を割り振ってください（不必要な連勤回避）。
        // ただし8時などトグルがONになっていなければ〇か休のみ（希望やリフは除く）
        const unassignedLifeStaff = [];
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;
            const sec = staff.lifeSection || '';
            const isPatternA = (sec === '訪問' || sec === '管理' || sec === 'Cl1');
            const isPatternB = (sec === '通所' || sec === 'Cl2');
            if (!isPatternA && !isPatternB) {
                unassignedLifeStaff.push(s);
            }
        }

        if (unassignedLifeStaff.length > 0) {
            unassignedLifeStaff.forEach(s => {
                const staff = this.staffList[s];
                const maxConsec = staff.allow6Consec ? 6 : 5;

                // 通常のPO同様に週単位スケジュールエンジンで公休8日・週休2日・5連勤以下・5連勤後2連休を厳密充足！
                let solved = this.solveStaffScheduleWeekly(s, stdHols, maxConsec);

                // もし事前希望で6連勤以上または週6日勤務以上が入力されており、allow6ConsecがOFFの場合:
                // ハード制約（週休2日・最大5連勤）を満たすため、希望の「○」のうち連勤が長くなっているセルを緩和して再求解
                if (!solved) {
                    const tempGridBackup = [];
                    for (let d = 0; d < this.numDays; d++) {
                        tempGridBackup.push({ symbol: this.grid[s][d].symbol, isFixed: this.grid[s][d].isFixed });
                    }

                    // 5連勤以上の「○」希望をカット
                    let streak = 0;
                    for (let d = 0; d < this.numDays; d++) {
                        if (this.grid[s][d].symbol === SYMBOLS.WORK || this.grid[s][d].symbol === '○') {
                            streak++;
                            if (streak >= 5) {
                                this.grid[s][d].symbol = '';
                                this.grid[s][d].isFixed = false;
                                streak = 0;
                            }
                        } else {
                            streak = 0;
                        }
                    }

                    solved = this.solveStaffScheduleWeekly(s, stdHols, maxConsec);

                    // それでも解けない場合のフォールバック（週2休を必ず配分）
                    if (!solved) {
                        for (let d = 0; d < this.numDays; d++) {
                            this.grid[s][d].symbol = tempGridBackup[d].symbol;
                            this.grid[s][d].isFixed = tempGridBackup[d].isFixed;
                        }
                    }
                }

                if (solved) {
                    for (let d = 0; d < this.numDays; d++) {
                        if (!this.grid[s][d].isFixed || this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = solved[d] || SYMBOLS.WORK;
                        }
                    }
                } else {
                    // 究極の安全フォールバック: 各週に必ず2日ずつ公休を配置
                    let curOff = 0;
                    for (let d = 0; d < this.numDays; d++) {
                        if (isHolidaySymbol(this.grid[s][d].symbol)) curOff++;
                    }
                    let needed = Math.max(0, Math.round(stdHols - curOff));

                    for (let w = 0; w < this.weekSpans.length && needed > 0; w++) {
                        const wSpan = this.weekSpans[w];
                        let wOff = 0;
                        const blanks = [];
                        wSpan.forEach(d => {
                            if (isHolidaySymbol(this.grid[s][d].symbol)) wOff++;
                            else if (!this.grid[s][d].isFixed && this.grid[s][d].symbol === '') blanks.push(d);
                        });
                        const toAdd = Math.min(needed, Math.max(0, (wSpan.length >= 5 ? 2 : 1) - wOff));
                        for (let i = 0; i < toAdd && i < blanks.length; i++) {
                            this.grid[s][blanks[i]].symbol = SYMBOLS.OFF;
                            needed--;
                        }
                    }
                    for (let d = 0; d < this.numDays; d++) {
                        if (this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = SYMBOLS.WORK;
                        }
                    }
                }
            });
        }

"""

new_content = content[:start_idx] + new_step4 + content[end_idx:]

with open('solver.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(new_content)

print("SOLVER_REPLACED_SUCCESSFULLY")
