with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_score_calc = """                            // 日別平準化スコア
                            const score = dailyPatBOff[d] * 100 + ((pIdx * 3 + w + d) % 7);
                            weekdayCandidates.push({ d, score });"""

target_new_score_calc = """                            // 日別平準化スコア＆連勤防止ボーナス
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
                            weekdayCandidates.push({ d, score });"""

if target_old_score_calc in content:
    content = content.replace(target_old_score_calc, target_new_score_calc)
    print("Replaced PatB score calc")
else:
    print("target NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js")
