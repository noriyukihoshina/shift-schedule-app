# solver.js の改修スクリプト

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. solveLife() での8時候補選出を can8 が ON の訪問スタッフのみに厳密制限
target_h8_cand = '''        // 5. 訪問スタッフから月〜金（平日）に毎日1名「8時」勤務を選出！
        const h8StaffList = [];
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused || staff.isSectionChief) continue;
            const sec = staff.lifeSection || '';
            const isVisit = (sec === '訪問' || (!staff.isSunOff && !staff.isSatSunOff && sec !== '通所' && sec !== 'Cl2'));
            if (isVisit && (staff.can8 || sec === '訪問')) {
                h8StaffList.push(s);
            }
        }'''

replacement_h8_cand = '''        // 5. 訪問スタッフから月〜金（平日）に毎日1名「8時」勤務を選出！
        // ★ ユーザー指示: 8時可トグルがONの訪問スタッフのみを候補として選出！OFFの人には絶対に振らない
        const h8StaffList = [];
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused || staff.isSectionChief) continue;
            const sec = staff.lifeSection || '';
            const isVisit = (sec === '訪問' || (!staff.isSunOff && !staff.isSatSunOff && sec !== '通所' && sec !== 'Cl2'));
            if (isVisit && staff.can8) {
                h8StaffList.push(s);
            }
        }'''

if target_h8_cand in text:
    text = text.replace(target_h8_cand, replacement_h8_cand, 1)
    print("Fixed 1: h8StaffList in solveLife restricted to staff.can8 === true")
else:
    print("Warning: target_h8_cand not found in solver.js")

# 2. validateInitialState の can8Available チェックを生活期では平日のみ（土日は8時不要）に
target_can8_val = '''            const totalCan8 = staffList.filter(s => !s.isUnused && !s.isSectionChief && s.can8).length;
            if (totalCan8 >= 1 && can8Available < 1) {
                errors.push(`【${dayNum}日目】「8時可」スタッフの出勤可能人数が0名となっており、8時勤務（1名）を配置できません（8時可スタッフの希望休重複をご確認ください）。`);
                staffList.forEach((st, sIdx) => {
                    if (st.isUnused || st.isSectionChief || !st.can8) return;
                    const sym = st.days[d];
                    if (isWishLeaveSymbol(sym) || (sym && sym !== SYMBOLS.WORK && sym !== SYMBOLS.H8)) {
                        conflictCells.push({
                            staffIndex: sIdx,
                            dayIndex: d,
                            reason: `⚠️ ${dayNum}日目: 8時可スタッフ全員に希望休（${sym}）等が重なっており、8時勤務を配置できません`
                        });
                    }
                });
            }'''

replacement_can8_val = '''            const totalCan8 = staffList.filter(s => !s.isUnused && !s.isSectionChief && s.can8).length;
            // ★ 生活期テーブルでは土日は8時勤務が不要（定数0名）のため、平日の場合のみ8時可充足チェックを実施
            const di = (options.dates && options.dates[d]) ? options.dates[d] : null;
            const isWeekendDay = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            const isH8RequiredDay = isLife ? !isWeekendDay : true;

            if (isH8RequiredDay && totalCan8 >= 1 && can8Available < 1) {
                errors.push(`【${dayNum}日目】「8時可」スタッフの出勤可能人数が0名となっており、8時勤務（1名）を配置できません（8時可スタッフの希望休重複をご確認ください）。`);
                staffList.forEach((st, sIdx) => {
                    if (st.isUnused || st.isSectionChief || !st.can8) return;
                    const sym = st.days[d];
                    if (isWishLeaveSymbol(sym) || (sym && sym !== SYMBOLS.WORK && sym !== SYMBOLS.H8)) {
                        conflictCells.push({
                            staffIndex: sIdx,
                            dayIndex: d,
                            reason: `⚠️ ${dayNum}日目: 8時可スタッフ全員に希望休（${sym}）等が重なっており、8時勤務を配置できません`
                        });
                    }
                });
            }'''

if target_can8_val in text:
    text = text.replace(target_can8_val, replacement_can8_val, 1)
    print("Fixed 2: can8Available validation in validateInitialState adjusted for life")
else:
    print("Warning: target_can8_val not found in solver.js")

# 3. assignHolidaysForST でのリフレッシュ休暇による公休削減バグ解消
target_st_hols = '''                let currentOff = 0;
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (isFullOffSymbol(sym)) currentOff += 1.0;
                    else if (isHalfDuty(sym)) currentOff += 0.5;
                }'''

replacement_st_hols = '''                let currentOff = 0;
                // ★ ユーザー指示: リフレッシュ休暇は公休とは別枠！リフが入っても公休は必ず8日満額割り当てる！
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (isHolidaySymbol(sym)) currentOff += 1.0;
                    else if (isHalfDuty(sym)) currentOff += 0.5;
                }'''

if target_st_hols in text:
    text = text.replace(target_st_hols, replacement_st_hols, 1)
    print("Fixed 3: pure holiday counting in assignHolidaysForST (preserve 8 holidays with ref)")
else:
    print("Warning: target_st_hols not found in solver.js")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated solver.js successfully.")
