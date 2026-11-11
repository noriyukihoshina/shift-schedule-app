with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 候補者抽出での遅番上限
target_old_late_filter = """                    // ★ 遅番は全スタッフ「最大1回」絶対厳守！（事前入力等を含め既に遅番が1回あるスタッフは完全除外）
                    if (req.key === 'late' && counts.late[s] >= 1) continue;"""

target_new_late_filter = """                    // ★ 遅番上限: 1階〜3階病棟は全スタッフ「最大1回」厳守。
                    // 南病棟は南2で28回・南3で28回必要（各約23名）なため、全員1回行き届かせた上で不足分のみ2回まで均等選出！
                    const maxLate = this.isSouth ? 2 : 1;
                    if (req.key === 'late' && counts.late[s] >= maxLate) continue;"""

if target_old_late_filter in content:
    content = content.replace(target_old_late_filter, target_new_late_filter)
    print("Replaced late filter")
else:
    print("late filter NOT found!")

# 2. フォールバック候補者抽出での遅番上限
target_old_fallback_late = """                        if (req.key === 'late' && counts.late[s] >= 1) continue;"""
target_new_fallback_late = """                        const maxLateFb = this.isSouth ? 2 : 1;
                        if (req.key === 'late' && counts.late[s] >= maxLateFb) continue;"""

if target_old_fallback_late in content:
    content = content.replace(target_old_fallback_late, target_new_fallback_late)
    print("Replaced fallback late filter")
else:
    print("fallback late filter NOT found!")

# 3. 遅番ペナルティ計算
target_old_late_penalty = """                    if (req.key === 'late') {
                        // 遅番: 全スタッフ「最大1回」絶対厳守（2回以上は絶対禁止！）
                        if (counts.late[s] >= 1) {
                            dutyTypePenalty = 1000000 + counts.late[s] * 500000;
                        } else {
                            dutyTypePenalty = -5000; // 0回の人を最優先
                        }
                    }"""

target_new_late_penalty = """                    if (req.key === 'late') {
                        if (this.isSouth) {
                            if (counts.late[s] >= 2) {
                                dutyTypePenalty = 1000000 + (counts.late[s] - 2) * 500000;
                            } else if (counts.late[s] === 1) {
                                dutyTypePenalty = 20000; // 0回の人を優先しつつ2回目を均等配分
                            } else {
                                dutyTypePenalty = -12000; // 0回の人を最優先！
                            }
                        } else {
                            if (counts.late[s] >= 1) {
                                dutyTypePenalty = 1000000 + counts.late[s] * 500000;
                            } else {
                                dutyTypePenalty = -5000; // 0回の人を最優先
                            }
                        }
                    }"""

if target_old_late_penalty in content:
    content = content.replace(target_old_late_penalty, target_new_late_penalty)
    print("Replaced late penalty")
else:
    print("late penalty NOT found!")

# 4. balanceSpecialDuties での遅番上限
target_old_bal_req = """        const reqTypes = [
            { type: SYMBOLS.LATE, key: 'late', noFlag: 'noLate', maxNormal: 1, matchSyms: [SYMBOLS.LATE, SYMBOLS.NO_ALLOW_LATE] },"""

target_new_bal_req = """        const reqTypes = [
            { type: SYMBOLS.LATE, key: 'late', noFlag: 'noLate', maxNormal: (this.isSouth ? 2 : 1), matchSyms: [SYMBOLS.LATE, SYMBOLS.NO_ALLOW_LATE] },"""

if target_old_bal_req in content:
    content = content.replace(target_old_bal_req, target_new_bal_req)
    print("Replaced balanceSpecialDuties reqTypes")
else:
    print("balanceSpecialDuties reqTypes NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js south late fix successfully!")
