# -*- coding: utf-8 -*-
"""
solver.js の改修:
1. solveLife の完全改修:
   - 「土日休」「日休」トグル連動
   - 公休8日厳格死守（超過時は○に振替）
   - CL2（2名）の平日公休直交化（重複防止）
   - 通所＋CL2の月〜土出勤均等化
   - 訪問の月〜金8時毎日1名配置
2. eliminateSingleDayWork の実装（全テーブル共通で「休 ○ 休」撲滅）
3. PO病棟のAチーム・Bチーム8時完全均等配分（14対14）
4. PO病棟の特殊勤務配分（4回なら早2遅1E1を厳格維持、遅番は最大1回、Eは1〜2回、早番は2〜3回、合計4〜5回）
"""
import re

with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

# -------------------------------------------------------------
# 1. solveLife の完全改修
# -------------------------------------------------------------
new_solve_life = '''    /**
     * 生活期専用ソルバー (solveLife)
     * - Pattern A (土日休): 訪問, 管理, Cl1, ハ1, ハ2, または「土日休」トグルON
     * - Pattern B (日休＋平日分散): 通所, Cl2, ハ3, ハ4/ハ南, または「日休」トグルON
     * - 公休8日厳格死守（9日になるバグを完全解消）
     * - CL2（2名）の平日公休が重ならない直交・交互配置
     * - 通所＋CL2の月〜土出勤人数・実数の均等平準化
     * - 訪問の月〜金（平日）に毎日1名8時勤務を均等選出
     */
    solveLife(options = {}) {
        const stdHols = this.options.standardHolidays || 8;
        const dates = this.dates || [];

        // 1. 各スタッフの事前希望枠を初期設定
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;

            for (let d = 0; d < this.numDays; d++) {
                const wish = (staff.days && staff.days[d]) ? staff.days[d] : '';
                if (wish) {
                    this.grid[s][d] = {
                        symbol: wish.replace(/[◦•･◯〇●]/g, '○'),
                        isFixed: true,
                        isOriginalWish: true
                    };
                } else {
                    this.grid[s][d] = {
                        symbol: '',
                        isFixed: false
                    };
                }
            }
        }

        // 2. スタッフごとの勤務パターン分類
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;

            const sec = staff.lifeSection || '';
            const ha = staff.haSection || '';

            // Group A（土日休み固定）: 土日休トグルON、または訪問, 管理, Cl1, ハ1, ハ2
            const isPatternA = !!staff.isSatSunOff || (!staff.isSunOff && (sec === '訪問' || sec === '管理' || sec === 'Cl1' || ha === 'ハ1' || ha === 'ハ2'));
            // Group B（日曜休み固定＋平日分散公休）: 日休トグルON、または通所, Cl2, ハ3, ハ南
            const isPatternB = !isPatternA && (!!staff.isSunOff || (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4'));

            if (isPatternA) {
                // 土日休み固定（土日休トグルON / 訪問等）
                for (let d = 0; d < this.numDays; d++) {
                    const di = dates[d];
                    const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
                    if (isWeekend) {
                        // 土日は事前希望がなければ公休「休」。事前希望があれば優先
                        if (!this.grid[s][d].isFixed || this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = SYMBOLS.OFF;
                        }
                    } else {
                        // 平日は事前希望がなければ通常勤務「○」
                        if (this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = SYMBOLS.WORK;
                        }
                    }
                }
            } else if (isPatternB) {
                // 日曜日休み固定（日休トグルON / 通所・Cl2等）
                for (let d = 0; d < this.numDays; d++) {
                    const di = dates[d];
                    const isSunday = di ? (di.wIdx === 6) : (d % 7 === 6);
                    if (isSunday) {
                        // 日曜日は事前希望がなければ公休「休」。事前希望があれば優先
                        if (!this.grid[s][d].isFixed || this.grid[s][d].symbol === '') {
                            this.grid[s][d].symbol = SYMBOLS.OFF;
                        }
                    }
                }
            }
        }

        // 3. Pattern B スタッフのリストアップ（CL2を優先、通所スタッフ等を均等分散）
        const cl2Staff = [];
        const otherPatternBStaff = [];

        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;
            const sec = staff.lifeSection || '';
            const ha = staff.haSection || '';
            const isPatA = !!staff.isSatSunOff || (!staff.isSunOff && (sec === '訪問' || sec === '管理' || sec === 'Cl1' || ha === 'ハ1' || ha === 'ハ2'));
            const isPatB = !isPatA && (!!staff.isSunOff || (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4'));

            if (isPatB) {
                if (sec === 'Cl2' || staff.name.includes('クラーク通所') || staff.name.includes('Cl2')) {
                    cl2Staff.push(s);
                } else {
                    otherPatternBStaff.push(s);
                }
            }
        }

        // ★ ユーザー指示: CL2（クラーク通所2名）は日曜日以外の平日公休が同じ日に重ならないように直交・交互配置！
        const cl2OffDays = [new Set(), new Set()];
        if (cl2Staff.length >= 2) {
            const s1 = cl2Staff[0];
            const s2 = cl2Staff[1];
            // 各週（日〜土）ごとに平日公休を1日ずつ、s1とs2で異なる曜日に選定
            for (let w = 0; w < this.weekSpans.length; w++) {
                const wSpan = this.weekSpans[w];
                const weekdays = wSpan.filter(d => {
                    const di = dates[d];
                    return di ? (di.wIdx !== 6) : (d % 7 !== 6);
                });
                if (weekdays.length >= 2) {
                    // s1には前半平日（例: 火曜/水曜）、s2には後半平日（例: 木曜/金曜）
                    const d1 = weekdays[w % weekdays.length];
                    const d2 = weekdays[(w + 2) % weekdays.length];
                    if (!this.grid[s1][d1].isFixed && this.grid[s1][d1].symbol === '') {
                        this.grid[s1][d1].symbol = SYMBOLS.OFF;
                        cl2OffDays[0].add(d1);
                    }
                    if (!this.grid[s2][d2].isFixed && this.grid[s2][d2].symbol === '') {
                        this.grid[s2][d2].symbol = SYMBOLS.OFF;
                        cl2OffDays[1].add(d2);
                    }
                }
            }
        }

        // Pattern B 全体の平日公休分散配置（日別の通所出勤人数・実数が月〜土で均等になるように配置）
        const allPatB = [...cl2Staff, ...otherPatternBStaff];
        const dailyPatBOff = new Array(this.numDays).fill(0);
        for (let d = 0; d < this.numDays; d++) {
            for (const s of allPatB) {
                if (isHolidaySymbol(this.grid[s][d].symbol)) dailyPatBOff[d]++;
            }
        }

        allPatB.forEach((s, pIdx) => {
            const staff = this.staffList[s];
            // 4〜5つの週スパンごとに平日公休を均等に配置
            for (let w = 0; w < this.weekSpans.length; w++) {
                const wSpan = this.weekSpans[w];
                let weekOffCount = 0;
                for (const d of wSpan) {
                    if (isHolidaySymbol(this.grid[s][d].symbol)) weekOffCount++;
                }

                // 週休2日（日曜日休＋平日休1日）を満たす
                if (weekOffCount < 2) {
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
                            const score = dailyPatBOff[d] * 100 + ((pIdx * 3 + w + d) % 7);
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
            }

            // ★ 公休日数8日（stdHols）の厳格死守！
            let curOff = 0;
            for (let d = 0; d < this.numDays; d++) {
                if (isHolidaySymbol(this.grid[s][d].symbol)) curOff++;
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
                        cands.push({ d, offCount: dailyPatBOff[d] });
                    }
                }
                if (cands.length === 0) break;
                // 休みの多い日を優先して勤務「○」に戻す
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
        });

        // 4. 空き枠の全スタッフ確定（念のため全体チェック）
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === '') {
                    this.grid[s][d].symbol = SYMBOLS.WORK;
                }
            }
        }

        // 5. 訪問スタッフから月〜金（平日）に毎日1名「8時」勤務を選出！
        const h8StaffList = [];
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused || staff.isSectionChief) continue;
            const sec = staff.lifeSection || '';
            const isVisit = (sec === '訪問' || (!staff.isSunOff && !staff.isSatSunOff && sec !== '通所' && sec !== 'Cl2'));
            if (isVisit && (staff.can8 || sec === '訪問')) {
                h8StaffList.push(s);
            }
        }

        const h8AssignedCounts = new Array(this.numStaff).fill(0);
        for (let d = 0; d < this.numDays; d++) {
            const di = dates[d];
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            if (isWeekend) continue; // 土日は8時なし

            let alreadyH8 = false;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.grid[s][d].symbol === SYMBOLS.H8) {
                    alreadyH8 = true;
                    h8AssignedCounts[s]++;
                    break;
                }
            }
            if (alreadyH8) continue;

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

        // 6. 「休 ○ 休」（単発1勤）の撲滅リペア
        this.eliminateSingleDayWork();

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };
    }'''

# solveLife を置換
code = re.sub(r'solveLife\(options = \{\}\) \{[\s\S]*?\n    \}', new_solve_life, code, count=1)
print("1. Replaced solveLife with enhanced version")

# -------------------------------------------------------------
# 2. eliminateSingleDayWork の実装
# -------------------------------------------------------------
eliminate_single_work_def = '''    /**
     * ★ 全テーブル共通: 「休 ○ 休」（単発1勤）の完全撲滅
     * ユーザー指示: 「休〇休」は1勤です。可能な限り作らない。公休をひとつずらせば済む話です。
     * 単発勤務（前日も翌日も休日）を検知し、前後の公休をずらすなどして2連勤または連休に変換！
     */
    eliminateSingleDayWork() {
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;

            for (let d = 0; d < this.numDays; d++) {
                const sym = this.grid[s][d].symbol;
                // 通常勤務「○」または特殊勤務で、事前固定でない場合
                if (sym !== SYMBOLS.WORK || this.grid[s][d].isFixed) continue;

                const prevSym = this.getSymbol(s, d - 1);
                const nextSym = (d + 1 < this.numDays) ? this.getSymbol(s, d + 1) : '';

                // 前後が休日（公休・有休・リフ）で挟まれている単発1勤かチェック
                const isPrevOff = isHolidaySymbol(prevSym);
                const isNextOff = (d + 1 < this.numDays) ? isHolidaySymbol(nextSym) : true;

                if (isPrevOff && isNextOff) {
                    // パターンA: 翌日(d+1)が未固定の「休」で、翌々日(d+2)が未固定の「○」ならスワップ！
                    // [休, ○(d), 休(d+1), ○(d+2)] => [休, ○(d), ○(d+1), 休(d+2)] (2連勤に変換)
                    if (d + 2 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 2].isFixed && this.grid[s][d + 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 2].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターンB: 前日(d-1)が未固定の「休」で、前々日(d-2)が未固定の「○」ならスワップ！
                    // [○(d-2), 休(d-1), ○(d), 休(d+1)] => [休(d-2), ○(d-1), ○(d), 休(d+1)] (2連勤に変換)
                    if (d - 2 >= 0 && !this.grid[s][d - 1].isFixed && this.grid[s][d - 1].symbol === SYMBOLS.OFF && !this.grid[s][d - 2].isFixed && this.grid[s][d - 2].symbol === SYMBOLS.WORK) {
                        this.grid[s][d - 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d - 2].symbol = SYMBOLS.OFF;
                        continue;
                    }

                    // パターンC: 翌日(d+1)が未固定の「休」で、d+3が「○」ならd+1とd+3をスワップ
                    if (d + 3 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 3].isFixed && this.grid[s][d + 3].symbol === SYMBOLS.WORK) {
                        this.grid[s][d + 1].symbol = SYMBOLS.WORK;
                        this.grid[s][d + 3].symbol = SYMBOLS.OFF;
                        continue;
                    }
                }
            }
        }
    }

'''

if 'eliminateSingleDayWork()' not in code:
    code = code.replace("    assignSpecialDutiesToGrid(", eliminate_single_work_def + "    assignSpecialDutiesToGrid(")
    print("2. Added eliminateSingleDayWork method")

# assignSpecialDutiesToGrid の最後に eliminateSingleDayWork を呼出
if 'this.eliminateSingleDayWork();' not in code:
    code = code.replace("this.balanceDailyWorkforce();", "this.balanceDailyWorkforce();\n        this.eliminateSingleDayWork();")
    print("3. Called eliminateSingleDayWork in assignSpecialDutiesToGrid")

# -------------------------------------------------------------
# 3. PO病棟のAチーム・Bチーム8時完全均等配分（14対14）
# -------------------------------------------------------------
# assign8ClockDuties 内でのチーム選出ロジックを強化
old_team_penalty = "const teamDiff = team8Counts[team] - (team === 'A' ? team8Counts.B : team8Counts.A);\n                const teamPenalty = teamDiff * 5000;"
new_team_penalty = """// ★ ユーザー指示: AチームとBチームの8時を完全均等（14回対14回）に厳格配分！
                const targetTeam = (team8Counts.A <= team8Counts.B) ? 'A' : 'B';
                const teamDiff = team8Counts[team] - (team === 'A' ? team8Counts.B : team8Counts.A);
                let teamPenalty = teamDiff * 50000;
                if (team !== targetTeam && Math.abs(team8Counts.A - team8Counts.B) >= 1) {
                    teamPenalty += 200000; // 枠が多いチームは超強力に抑止
                }"""

if old_team_penalty in code:
    code = code.replace(old_team_penalty, new_team_penalty)
    print("4. Enhanced PO 8h team balancing (14 vs 14)")

# -------------------------------------------------------------
# 4. PO病棟の特殊勤務配分（4回なら早2遅1E1を厳格維持）
# -------------------------------------------------------------
# late, eve, early のペナルティをユーザー指定「早2遅1E1」に厳密適合
old_duty_penalties = """                    if (req.key === 'late') {
                        // 遅番: 1ターム28回＝スタッフ44名に対し28回のため「1人あたり最大1回」！
                        if (counts.late[s] >= 1) {
                            dutyTypePenalty = 150000 + counts.late[s] * 30000; // 2回目は原則絶対禁止！
                        } else {
                            dutyTypePenalty = 0; // 0回の人から選ぶ
                        }
                    } else if (req.key === 'eve') {
                        // E: 1ターム56回＝スタッフ44名に対し56回（1人あたり1.27回＝1〜2回）
                        if (counts.eve[s] >= 2) {
                            dutyTypePenalty = 80000 + (counts.eve[s] - 2) * 30000; // 3回目は極力禁止
                        } else if (counts.eve[s] === 1) {
                            dutyTypePenalty = 5000; // 1回ある人は抑えめ
                        } else {
                            dutyTypePenalty = -2500; // 0回の人を優先
                        }
                    } else if (req.key === 'early') {
                        // 早番: 1ターム84回＝一般スタッフは1人あたり約2.0回、8時スタッフは1〜2回
                        if (is8ClockStaff) {
                            if (counts.early[s] >= 2) {
                                dutyTypePenalty = 60000 + (counts.early[s] - 2) * 20000;
                            } else if (counts.early[s] === 1) {
                                dutyTypePenalty = 2000;
                            } else {
                                dutyTypePenalty = -1000;
                            }
                        } else {
                            if (counts.early[s] >= 3) {
                                dutyTypePenalty = 80000 + (counts.early[s] - 3) * 30000; // 3回以上は強く禁止
                            } else if (counts.early[s] === 2) {
                                dutyTypePenalty = 12000; // 目標2回に達した人は抑制
                            } else if (counts.early[s] === 1) {
                                dutyTypePenalty = 800;
                            } else {
                                dutyTypePenalty = -3500; // まだ早番0回のスタッフを最優先！
                            }
                        }
                    }"""

new_duty_penalties = """                    // ★ ユーザー指示: 特殊勤務の回数バランス（もし4回なら早2、遅1、E1）を厳密遵守！
                    if (req.key === 'late') {
                        // 遅番: 全スタッフ「最大1回」絶対厳守（2回以上は絶対禁止！）
                        if (counts.late[s] >= 1) {
                            dutyTypePenalty = 1000000 + counts.late[s] * 500000;
                        } else {
                            dutyTypePenalty = -5000; // 0回の人を最優先
                        }
                    } else if (req.key === 'eve') {
                        // E(イブニング): 原則1回（最大2回まで）。0回の人を最優先して1回行き届かせる
                        if (counts.eve[s] >= 2) {
                            dutyTypePenalty = 500000 + (counts.eve[s] - 2) * 200000; // 3回以上は絶対禁止
                        } else if (counts.eve[s] === 1) {
                            dutyTypePenalty = 25000; // 1回ある人は抑制
                        } else {
                            dutyTypePenalty = -8000; // 0回の人を最優先！
                        }
                    } else if (req.key === 'early') {
                        // 早番: 目標「2回」（枠数に応じて一部3回）。0〜1回の人を最優先して2回まで均等配分！
                        if (is8ClockStaff) {
                            if (counts.early[s] >= 2) {
                                dutyTypePenalty = 500000;
                            } else if (counts.early[s] === 1) {
                                dutyTypePenalty = 10000;
                            } else {
                                dutyTypePenalty = -3000;
                            }
                        } else {
                            if (counts.early[s] >= 3) {
                                dutyTypePenalty = 500000 + (counts.early[s] - 3) * 100000; // 3回を超えたら禁止
                            } else if (counts.early[s] === 2) {
                                dutyTypePenalty = 30000; // 2回に達したら強く抑制
                            } else if (counts.early[s] === 1) {
                                dutyTypePenalty = -2000; // 1回の人は2回目を目指す
                            } else {
                                dutyTypePenalty = -15000; // まだ早番0回のスタッフを最優先！
                            }
                        }
                    }"""

if old_duty_penalties in code:
    code = code.replace(old_duty_penalties, new_duty_penalties)
    print("5. Enforced exact Early 2 / Late 1 / Eve 1 distribution ratio")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved solver.js successfully.")
