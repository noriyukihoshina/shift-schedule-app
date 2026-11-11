# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_repair = """                // ★ 連勤チェック & 自動修復（5連勤以下を完全保証）
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
                }"""

new_repair = """                // ★ 連勤厳格解消 & 公休総数維持スワッパー
                // 前ターム末尾からの連勤を含め、何連勤でも必ず maxConsec 以下になるまで修復
                for (let iter = 0; iter < 10; iter++) {
                    let maxStreak = 0;
                    let streakEnd = -1;
                    let streakLen = 0;

                    // 前ターム末尾の実績カウント
                    let initStreak = 0;
                    if (staff.prevDays && Array.isArray(staff.prevDays)) {
                        for (let p = staff.prevDays.length - 1; p >= 0; p--) {
                            if (isWorkSymbol(staff.prevDays[p])) initStreak++;
                            else break;
                        }
                    }

                    streakLen = initStreak;
                    for (let d = 0; d < this.numDays; d++) {
                        if (isWorkSymbol(this.grid[s][d].symbol)) {
                            streakLen++;
                            if (streakLen > maxStreak) {
                                maxStreak = streakLen;
                                streakEnd = d;
                            }
                        } else {
                            streakLen = 0;
                        }
                    }

                    if (maxStreak <= maxConsec) break; // 連勤制限クリア！

                    // 連勤超過しているブロックの中から、未固定のセルを1つ選んで「休」にする
                    // 連勤の中央付近を休みにすると前後の連勤を最も小さく分断できる
                    const streakStart = Math.max(0, streakEnd - (maxStreak - 1));
                    let cutD = -1;
                    let bestDist = 999;
                    const midD = (streakStart + streakEnd) / 2;

                    for (let cd = streakStart; cd <= streakEnd; cd++) {
                        if (!this.grid[s][cd].isFixed && this.grid[s][cd].symbol === SYMBOLS.WORK) {
                            const dist = Math.abs(cd - midD);
                            if (dist < bestDist) {
                                bestDist = dist;
                                cutD = cd;
                            }
                        }
                    }

                    if (cutD === -1) break; // 固定枠のみでカット不可

                    this.grid[s][cutD].symbol = SYMBOLS.OFF;
                    dailyOffCounts[cutD]++;

                    // 公休日数が増えたので、既存の休みのうち「○」に変えても新たな連勤（> maxConsec）を生まない未固定セルを1つ選んで「○」に戻す
                    let swapped = false;
                    for (let candD = 0; candD < this.numDays; candD++) {
                        if (candD !== cutD && !this.grid[s][candD].isFixed && this.grid[s][candD].symbol === SYMBOLS.OFF) {
                            // candD を ○ に仮変更したときの最大連勤をチェック
                            this.grid[s][candD].symbol = SYMBOLS.WORK;
                            let testStreak = initStreak;
                            let testMax = 0;
                            for (let td = 0; td < this.numDays; td++) {
                                if (isWorkSymbol(this.grid[s][td].symbol)) {
                                    testStreak++;
                                    if (testStreak > testMax) testMax = testStreak;
                                } else {
                                    testStreak = 0;
                                }
                            }
                            if (testMax <= maxConsec) {
                                // 連勤基準クリア！このスワップを採用
                                dailyOffCounts[candD]--;
                                swapped = true;
                                break;
                            } else {
                                // 戻す
                                this.grid[s][candD].symbol = SYMBOLS.OFF;
                            }
                        }
                    }

                    if (!swapped) {
                        // 連勤基準を崩さないスワップ候補が見つからなかった場合でも、公休が1日増えるのは連勤違反よりも安全
                    }
                }"""

norm_content = content.replace('\r\n', '\n')
norm_old = old_repair.replace('\r\n', '\n')
norm_new = new_repair.replace('\r\n', '\n')

if norm_old in norm_content:
    norm_content = norm_content.replace(norm_old, norm_new, 1)
    with open('solver.js', 'w', encoding='utf-8', newline='\n') as f:
        f.write(norm_content)
    print("REPAIR_UPDATED_SUCCESSFULLY")
else:
    print("REPAIR_NOT_FOUND")
