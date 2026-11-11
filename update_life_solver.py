# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """        // 4. 未分類スタッフのフォールバック（空き枠は日勤「○」）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === '') {
                    this.grid[s][d].symbol = SYMBOLS.WORK;
                }
            }
        }"""

replacement = """        // 4. 未分類スタッフ（業務トグルの指定がない一般スタッフ）の勤務作成
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
            // 日別の公休者数分布を追跡（日別出勤人数の平準化）
            const dailyOffCounts = new Array(this.numDays).fill(0);
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                for (let d = 0; d < this.numDays; d++) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) {
                        dailyOffCounts[d]++;
                    }
                }
            }

            unassignedLifeStaff.forEach(s => {
                const staff = this.staffList[s];
                const maxConsec = staff.allow6Consec ? 6 : 5;
                const solved = this.solveStaffScheduleWeekly(s, stdHols, maxConsec);
                if (solved) {
                    for (let d = 0; d < this.numDays; d++) {
                        if (!this.grid[s][d].isFixed && this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = solved[d] || SYMBOLS.WORK;
                            if (isHolidaySymbol(this.grid[s][d].symbol)) {
                                dailyOffCounts[d]++;
                            }
                        }
                    }
                } else {
                    // 安全な週単位公休割り当て（週2休ペース、最大5連勤以下で公休を分散配置）
                    let currentHols = 0;
                    for (let d = 0; d < this.numDays; d++) {
                        if (isHolidaySymbol(this.grid[s][d].symbol)) currentHols += 1.0;
                    }
                    let neededOff = Math.max(0, Math.round(stdHols - currentHols));

                    // 各週（weekSpans）ごとに公休を2日割り振る
                    for (let w = 0; w < this.weekSpans.length && neededOff > 0; w++) {
                        const wSpan = this.weekSpans[w];
                        let wFixedOff = 0;
                        const wBlanks = [];
                        wSpan.forEach(d => {
                            if (isHolidaySymbol(this.grid[s][d].symbol)) wFixedOff++;
                            else if (this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                                wBlanks.push(d);
                            }
                        });
                        const wNeeded = Math.min(neededOff, Math.max(0, 2 - wFixedOff));
                        if (wNeeded > 0 && wBlanks.length > 0) {
                            // 公休者が少ない日を優先
                            wBlanks.sort((a, b) => dailyOffCounts[a] - dailyOffCounts[b]);
                            for (let i = 0; i < Math.min(wNeeded, wBlanks.length); i++) {
                                const targetD = wBlanks[i];
                                this.grid[s][targetD].symbol = SYMBOLS.OFF;
                                dailyOffCounts[targetD]++;
                                neededOff--;
                            }
                        }
                    }

                    // それでも残っている公休があれば全体から割り当て
                    if (neededOff > 0) {
                        const allBlanks = [];
                        for (let d = 0; d < this.numDays; d++) {
                            if (this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                                allBlanks.push(d);
                            }
                        }
                        allBlanks.sort((a, b) => dailyOffCounts[a] - dailyOffCounts[b]);
                        for (let i = 0; i < Math.min(neededOff, allBlanks.length); i++) {
                            const targetD = allBlanks[i];
                            this.grid[s][targetD].symbol = SYMBOLS.OFF;
                            dailyOffCounts[targetD]++;
                        }
                    }

                    // 空き枠はすべて通常勤務「○」
                    for (let d = 0; d < this.numDays; d++) {
                        if (this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = SYMBOLS.WORK;
                        }
                    }
                }
            });
        }"""

norm_content = content.replace('\r\n', '\n')
norm_target = target.replace('\r\n', '\n')
norm_replacement = replacement.replace('\r\n', '\n')

if norm_target in norm_content:
    norm_content = norm_content.replace(norm_target, norm_replacement, 1)
    with open('solver.js', 'w', encoding='utf-8', newline='\n') as f:
        f.write(norm_content)
    print("REPLACED_SUCCESSFULLY")
else:
    print("TARGET_NOT_FOUND")
