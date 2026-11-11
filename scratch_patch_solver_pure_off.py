# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. isPurePublicOffSymbol の追加
target_off_fn = """// ★ 公休（休）およびリフレッシュ休暇（上/下）判定。連勤を切断・リセット！
// リフレッシュ休暇は丸1日の休暇であるため連勤を切断（前借り・後回しや連続取得も完全許容）
function isFullOffSymbol(sym) {
    if (!sym) return false;
    if (isExcludeSymbol(sym)) return true; // ★ 異動・退職等で勤務していないため連勤をリセット・切断
    if (sym === SYMBOLS.OFF) return true;
    if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) return true;
    return false;
}"""

replacement_off_fn = """// ★ 純粋な公休判定（公休間隔の切断判定用）
// ユーザー制約:「公休から公休の間は6までです。間にリフや有があってもNGです。」
// したがって、公休（休、半休）、および未在籍・対象外（-）のみが公休間隔をリセットできる。
// 有休やリフレッシュ休暇（上1〜5、下1〜3）は公休ではないため公休間隔をリセットしない！
function isPurePublicOffSymbol(sym) {
    if (!sym) return false;
    if (isExcludeSymbol(sym)) return true; // 対象外枠はカウント除外（リセット）
    if (sym === SYMBOLS.OFF) return true;
    if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK || sym === '○/休' || sym === '休/○' || sym === '〇/休' || sym === '休/〇') return true;
    return false;
}

// ★ 公休（休）およびリフレッシュ休暇（上/下）判定
function isFullOffSymbol(sym) {
    if (!sym) return false;
    if (isExcludeSymbol(sym)) return true;
    if (sym === SYMBOLS.OFF) return true;
    if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) return true;
    return false;
}"""

if target_off_fn in content:
    content = content.replace(target_off_fn, replacement_off_fn, 1)
    print("1. isPurePublicOffSymbol added successfully.")
else:
    print("Warning: target_off_fn not found!")

# 2. validateWishConstraints の公休間隔チェック修正
target_wish = """        // C. 連勤チェック (公休から公休の間のカウント。有休やリフ休は公休ではないため連勤を切断しない！)
        // ※「6連勤可」フラグがONのスタッフは最大6連勤まで許容、通常は最大5連勤
        const maxAllowedConsec = staff.allow6Consec ? 6 : 5;
        let nonOffStreak = [];
        for (let d = 0; d < numDays; d++) {
            const sym = staff.days[d];
            if (sym && !isFullOffSymbol(sym)) {
                nonOffStreak.push(d);
                if (nonOffStreak.length > maxAllowedConsec) {
                    const ruleMsg = staff.allow6Consec ? '6連勤許可ですが7日以上の連続公休なし' : '公休から公休の間は最大5日以内';
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】${d + 1}日目時点で公休のない連続期間が${nonOffStreak.length}日となっています（${ruleMsg}です）。`);
                    nonOffStreak.forEach(wDay => {
                        conflictCells.push({ staffIndex: sIdx, dayIndex: wDay, reason: `公休間隔が上限(${maxAllowedConsec}日)を超えているため公休(休)を挟んでください` });
                    });
                }
            } else if (isFullOffSymbol(sym)) {
                nonOffStreak = [];
            } else {
                nonOffStreak = [];
            }
        }"""

replacement_wish = """        // C. 公休間隔・連勤チェック（公休から公休の間は最大6日以内。有休やリフがあってもNG！）
        // ユーザー制約:「公休から公休の間は6までです。間にリフや有があってもNGです。」
        const maxAllowedConsec = staff.allow6Consec ? 6 : 5;
        let nonOffStreak = [];
        for (let d = 0; d < numDays; d++) {
            const sym = staff.days[d];
            if (sym && !isPurePublicOffSymbol(sym)) {
                nonOffStreak.push(d);
                if (nonOffStreak.length > maxAllowedConsec) {
                    const ruleMsg = staff.allow6Consec ? '公休から公休の間は最大6日以内（間に有休やリフがあってもNG）' : '公休から公休の間は最大5日以内（間に有休やリフがあってもNG）';
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】${d + 1}日目時点で公休のない連続期間が${nonOffStreak.length}日となっています（${ruleMsg}です）。`);
                    nonOffStreak.forEach(wDay => {
                        conflictCells.push({ staffIndex: sIdx, dayIndex: wDay, reason: `公休間隔が上限(${maxAllowedConsec}日)を超えているため公休(休)を挟んでください（有休・リフは公休に含まれません）` });
                    });
                }
            } else if (isPurePublicOffSymbol(sym)) {
                nonOffStreak = [];
            } else {
                nonOffStreak = [];
            }
        }"""

if target_wish in content:
    content = content.replace(target_wish, replacement_wish, 1)
    print("2. validateWishConstraints updated successfully.")
else:
    print("Warning: target_wish not found!")

# 3. validateScheduleGrid の連勤・公休間隔チェック修正
target_grid_val = """        // 3. 連勤チェック（最大5連勤、allow6Consecなら6連勤）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;
            const maxAllowed = staff.allow6Consec ? 6 : 5;
            const sequence = [];
            for (let p = 0; p < 5; p++) {
                let pSym = (staff.prevDays && staff.prevDays[p]) || '';
                if (staff.isSectionChief && (p === 1 || p === 2) && isWorkSymbol(pSym)) pSym = SYMBOLS.OFF;
                sequence.push(pSym);
            }
            for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

            let streak = 0;
            let startIdx = 0;
            for (let idx = 0; idx < sequence.length; idx++) {
                if (sequence[idx] === '') {
                    streak = 0;
                } else if (!isFullOffSymbol(sequence[idx])) {
                    if (streak === 0) startIdx = idx;
                    streak++;
                    if (streak > maxAllowed) {
                        const sLabel = startIdx < 5 ? `前${5 - startIdx}日` : this.formatDateLabel(startIdx - 5);
                        const eLabel = idx < 5 ? `前${5 - idx}日` : this.formatDateLabel(idx - 5);
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】${sLabel}〜${eLabel}で公休なし${streak}日連続（上限${maxAllowed}連勤違反）です。`);
                        break;
                    }
                } else {
                    streak = 0;
                }
            }
        }"""

replacement_grid_val = """        // 3. 公休間隔・連勤チェック（公休から公休の間は最大6日以内。有休やリフがあってもNG！）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;
            const maxAllowed = staff.allow6Consec ? 6 : 5;
            const sequence = [];
            for (let p = 0; p < 5; p++) {
                let pSym = (staff.prevDays && staff.prevDays[p]) || '';
                if (staff.isSectionChief && (p === 1 || p === 2) && isWorkSymbol(pSym)) pSym = SYMBOLS.OFF;
                sequence.push(pSym);
            }
            for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

            let streak = 0;
            let startIdx = 0;
            for (let idx = 0; idx < sequence.length; idx++) {
                if (sequence[idx] === '') {
                    streak = 0;
                } else if (!isPurePublicOffSymbol(sequence[idx])) {
                    if (streak === 0) startIdx = idx;
                    streak++;
                    if (streak > maxAllowed) {
                        const sLabel = startIdx < 5 ? `前${5 - startIdx}日` : this.formatDateLabel(startIdx - 5);
                        const eLabel = idx < 5 ? `前${5 - idx}日` : this.formatDateLabel(idx - 5);
                        const errReason = (streak > 6) ? `公休から公休の間は最大6日以内制約違反（間に有休やリフがあってもNG）` : `上限${maxAllowed}連勤違反`;
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】${sLabel}〜${eLabel}で公休なし${streak}日連続（${errReason}）です。`);
                        break;
                    }
                } else {
                    streak = 0;
                }
            }
        }"""

if target_grid_val in content:
    content = content.replace(target_grid_val, replacement_grid_val, 1)
    print("3. validateScheduleGrid updated successfully.")
else:
    print("Warning: target_grid_val not found!")

# 4. verifyStaffSchedule の公休間隔チェック修正
target_verify = """        // 2. 連勤制限（公休間隔カウント）
        let consec = 0;
        for (let i = 0; i < sequence.length; i++) {
            if (sequence[i] === '') {
                consec = 0;
            } else if (!isFullOffSymbol(sequence[i])) {
                consec++;
                if (consec > maxConsec) return false;
            } else {
                consec = 0;
            }
        }"""

replacement_verify = """        // 2. 連勤制限（公休間隔カウント。有休やリフがあっても公休ではないためカウント継続！）
        let consec = 0;
        for (let i = 0; i < sequence.length; i++) {
            if (sequence[i] === '') {
                consec = 0;
            } else if (!isPurePublicOffSymbol(sequence[i])) {
                consec++;
                if (consec > maxConsec) return false;
            } else {
                consec = 0;
            }
        }"""

if target_verify in content:
    content = content.replace(target_verify, replacement_verify, 1)
    print("4. verifyStaffSchedule updated successfully.")
else:
    print("Warning: target_verify not found!")

# 5. repairScheduleViolations の連勤・公休間隔チェック修正
target_repair = """                for (let idx = 0; idx < sequence.length; idx++) {
                    if (!isFullOffSymbol(sequence[idx])) {
                        consec++;
                        if (consec > maxAllowed) {
                            violationEnd = idx - 5;
                            break;
                        }
                    } else {
                        consec = 0;
                    }
                }"""

replacement_repair = """                for (let idx = 0; idx < sequence.length; idx++) {
                    if (!isPurePublicOffSymbol(sequence[idx])) {
                        consec++;
                        if (consec > maxAllowed) {
                            violationEnd = idx - 5;
                            break;
                        }
                    } else {
                        consec = 0;
                    }
                }"""

if target_repair in content:
    content = content.replace(target_repair, replacement_repair, 1)
    print("5. repairScheduleViolations updated successfully.")
else:
    print("Warning: target_repair not found!")

# 6. 行 3288 と 行 5156 の isFullOffSymbol も isPurePublicOffSymbol に変更
target_sc = """            for (let i = 0; i < seq.length; i++) {
                if (seq[i] === '') consec = 0;
                else if (!isFullOffSymbol(seq[i])) {
                    consec++;
                    if (consec > maxConsec) return false;
                } else {
                    consec = 0;
                }
            }"""

replacement_sc = """            for (let i = 0; i < seq.length; i++) {
                if (seq[i] === '') consec = 0;
                else if (!isPurePublicOffSymbol(seq[i])) {
                    consec++;
                    if (consec > maxConsec) return false;
                } else {
                    consec = 0;
                }
            }"""

if target_sc in content:
    content = content.replace(target_sc, replacement_sc, 1)
    print("6. Section chief consec check updated successfully.")
else:
    print("Warning: target_sc not found!")

target_repair2 = """        for (let idx = 0; idx < sequence.length; idx++) {
            if (sequence[idx] === '') {
                consec = 0;
            } else if (!isFullOffSymbol(sequence[idx])) {
                consec++;
                if (consec > maxConsec) return false;
            } else {
                consec = 0;
            }
        }"""

replacement_repair2 = """        for (let idx = 0; idx < sequence.length; idx++) {
            if (sequence[idx] === '') {
                consec = 0;
            } else if (!isPurePublicOffSymbol(sequence[idx])) {
                consec++;
                if (consec > maxConsec) return false;
            } else {
                consec = 0;
            }
        }"""

if target_repair2 in content:
    content = content.replace(target_repair2, replacement_repair2, 1)
    print("7. repair2 consec check updated successfully.")
else:
    print("Warning: target_repair2 not found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("All solver replacements done.")
