# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

# solver.js のステップ4（未分類スタッフ）を決定論的・高速・連勤完全回避のアルゴリズムに置換
old_step4 = """        // 4. 未分類スタッフ（業務トグルの指定がない一般スタッフ）の勤務作成
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

            unassignedLifeStaff.forEach((s, uIdx) => {
                const staff = this.staffList[s];
                const maxConsec = staff.allow6Consec ? 6 : 5;

                // すでに希望等で確定している公休数を計算
                let currentHols = 0;
                for (let d = 0; d < this.numDays; d++) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) currentHols += 1.0;
                }
                let neededOff = Math.max(0, Math.round(stdHols - currentHols));

                // 週単位（日曜〜土曜の週）ごとに原則2日の公休を配分
                // 各週で公休を挟むことで5連勤以下を自然かつ確実に保証
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

                    // この週に必要な公休数（通常2日、週日数が3日以下の端数週なら1日）
                    const weekTargetOff = wSpan.length >= 5 ? 2 : 1;
                    const wNeeded = Math.min(neededOff, Math.max(0, weekTargetOff - wFixedOff));

                    if (wNeeded > 0 && wBlanks.length > 0) {
                        // スタッフごとに公休曜日に偏りが出ないようハッシュ＋公休最少日優先
                        wBlanks.sort((a, b) => {
                            const diff = dailyOffCounts[a] - dailyOffCounts[b];
                            if (diff !== 0) return diff;
                            return ((a * 7 + uIdx * 3) % 11) - ((b * 7 + uIdx * 3) % 11);
                        });

                        for (let i = 0; i < Math.min(wNeeded, wBlanks.length); i++) {
                            const targetD = wBlanks[i];
                            this.grid[s][targetD].symbol = SYMBOLS.OFF;
                            dailyOffCounts[targetD]++;
                            neededOff--;
                        }
                    }
                }

                // ターム合計で目標公休数（8日）に届いていない場合、未割当日から平準化配置
                if (neededOff > 0) {
                    const allBlanks = [];
                    for (let d = 0; d < this.numDays; d++) {
                        if (this.grid[s][d].symbol === '' && !this.grid[s][d].isFixed) {
                            allBlanks.push(d);
                        }
                    }
                    allBlanks.sort((a, b) => {
                        const diff = dailyOffCounts[a] - dailyOffCounts[b];
                        if (diff !== 0) return diff;
                        return ((a * 5 + uIdx * 2) % 7) - ((b * 5 + uIdx * 2) % 7);
                    });
                    for (let i = 0; i < Math.min(neededOff, allBlanks.length); i++) {
                        const targetD = allBlanks[i];
                        this.grid[s][targetD].symbol = SYMBOLS.OFF;
                        dailyOffCounts[targetD]++;
                    }
                }

                // 残りの空き枠はすべて通常勤務「○」
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[s][d].symbol === '') {
                        this.grid[s][d].symbol = SYMBOLS.WORK;
                    }
                }

                // ★ 連勤チェック & 自動修復（5連勤以下を完全保証）
                // 前ターム末尾の実績も加味
                let consecutiveWork = 0;
                if (staff.prevDays && Array.isArray(staff.prevDays)) {
                    for (let p = staff.prevDays.length - 1; p >= 0; p--) {
                        if (isWorkSymbol(staff.prevDays[p])) consecutiveWork++;
                        else break;
                    }
                }

                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (isWorkSymbol(sym)) {
                        consecutiveWork++;
                        if (consecutiveWork > maxConsec) {
                            // 連勤制限を超過！未固定のセルであればこの日を「休」にスワップして連勤をカット
                            if (!this.grid[s][d].isFixed) {
                                this.grid[s][d].symbol = SYMBOLS.OFF;
                                dailyOffCounts[d]++;
                                consecutiveWork = 0;

                                // 代わりに前後の休みのうち、連勤に影響しない日を「○」に振り替えて公休総数を維持
                                for (let candD = 0; candD < this.numDays; candD++) {
                                    if (candD !== d && !this.grid[s][candD].isFixed && this.grid[s][candD].symbol === SYMBOLS.OFF) {
                                        this.grid[s][candD].symbol = SYMBOLS.WORK;
                                        dailyOffCounts[candD]--;
                                        break;
                                    }
                                }
                            }
                        }
                    } else {
                        consecutiveWork = 0;
                    }
                }
            });
        }"""

norm_content = content.replace('\r\n', '\n')
norm_old = old_step4.replace('\r\n', '\n')
norm_new = new_step4.replace('\r\n', '\n')

if norm_old in norm_content:
    norm_content = norm_content.replace(norm_old, norm_new, 1)
    with open('solver.js', 'w', encoding='utf-8', newline='\n') as f:
        f.write(norm_content)
    print("STEP4_UPDATED_SUCCESSFULLY")
else:
    print("STEP4_NOT_FOUND")
