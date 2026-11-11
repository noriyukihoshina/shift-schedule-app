# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. assign8HoursDuty の上限ガードと個人均等化ペナルティ強化
t_assign8 = """                // 回数ペナルティ: 既に8時を担当した回数が少ないスタッフを優先（全員に均等に3〜4回ずつ配分）
                const countPenalty = counts[s] * 3000;

                // スコア: チーム均等（A対B 14回対14回） + 個人回数平準化 + 直近ローテーション間隔
                let score = countPenalty + teamPenalty - (d - lastAssignedDay[s]);
                candidates.push({ staffIndex: s, score, team });"""

r_assign8 = """                // ★ ユーザー指示: 8時は特定スタッフに偏らせず全体に均等配分（1人3〜4回程度に抑制）！
                // 既に4回以上（または平均回数+1）担当しているスタッフは極力除外
                const totalCan8Count = this.staffList.filter(st => !st.isUnused && !st.isSectionChief && st.can8).length;
                const maxAllowed8h = Math.max(3, Math.ceil(this.numDays / Math.max(1, totalCan8Count)) + 1);
                if (counts[s] >= maxAllowed8h && !force) continue; // 上限到達者は除外！

                // 回数ペナルティ: 指数関数的にペナルティを爆発させ、全員に完全均等（3〜4回）に分散！
                const countPenalty = Math.pow(counts[s], 2) * 80000;

                // スコア: 個人回数最優先均等化 + チーム均等（A対B 14回対14回） + 直近ローテーション間隔
                let score = countPenalty + teamPenalty - (d - lastAssignedDay[s]);
                candidates.push({ staffIndex: s, score, team });"""

if t_assign8 in content:
    content = content.replace(t_assign8, r_assign8, 1)
    print("1. assign8HoursDuty penalty & cap updated successfully.")
else:
    print("Warning: t_assign8 not found!")

# 2. repairScheduleViolations の8時選出ロジックを「最少回数スタッフ優先」に修正
t_repair8 = """                if (curH8 === 0) {
                    // 出勤中の8時可（can8）スタッフから1名選出して8時に変更
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                        if (!this.staffList[s].can8) continue;
                        if (this.isSouth && this.getSubFloor(s) !== '南3' && this.getSubFloor(s) !== '南2') continue;
                        if (this.grid[s][d].symbol === SYMBOLS.WORK && !this.grid[s][d].isFixed) {
                            this.setSymbol(s, d, SYMBOLS.H8, false);
                            break;
                        }
                    }
                }"""

r_repair8 = """                if (curH8 === 0) {
                    // ★ ユーザー指示: 先頭スタッフに集中させず、当タームで8時割当回数が最少のcan8スタッフから公平に選出！
                    let bestS = -1;
                    let minH8Count = 999;
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                        if (!this.staffList[s].can8) continue;
                        if (this.isSouth && this.getSubFloor(s) !== '南3' && this.getSubFloor(s) !== '南2') continue;
                        if (this.grid[s][d].symbol === SYMBOLS.WORK && !this.grid[s][d].isFixed) {
                            let sH8 = 0;
                            for (let cd = 0; cd < this.numDays; cd++) {
                                if (this.grid[s][cd].symbol === SYMBOLS.H8) sH8++;
                            }
                            if (sH8 < minH8Count) {
                                minH8Count = sH8;
                                bestS = s;
                            }
                        }
                    }
                    if (bestS >= 0) {
                        this.setSymbol(bestS, d, SYMBOLS.H8, false);
                    }
                }"""

if t_repair8 in content:
    content = content.replace(t_repair8, r_repair8, 1)
    print("2. repairScheduleViolations 8h selection updated successfully.")
else:
    print("Warning: t_repair8 not found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("solver.js 8h fixes completed.")
