import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. 南病棟の8時スキップ解除 (assign8ClockDuties)
old_south_guard = "assign8ClockDuties(options = {}) {\n        if (this.isSouth) return { success: true };"
new_south_guard = """assign8ClockDuties(options = {}) {
        // ★ 南病棟でも南2・南3スタッフから毎日1名8時を選出！"""

if old_south_guard in text:
    text = text.replace(old_south_guard, new_south_guard)
    print("SUCCESS: Removed south guard in assign8ClockDuties")
else:
    print("WARNING: old_south_guard not found directly, checking regex")
    import re
    text = re.sub(r'assign8ClockDuties\s*\(\s*options\s*=\s*\{\}\s*\)\s*\{\s*if\s*\(\s*this\.isSouth\s*\)\s*return\s*\{\s*success:\s*true\s*\};',
                  'assign8ClockDuties(options = {}) {\n        // ★ 南病棟でも南2・南3スタッフから毎日1名8時を選出！', text)

# 2. 南病棟での8時候補者選出ロジックの改善
# 南病棟の場合、can8トグルがONのスタッフを優先し、いなければ南2・南3の一般スタッフからも選出可能に
old_cands_check = "if (!this.staffList[s].can8) continue;"
new_cands_check = """// 南病棟では can8 がONのスタッフを最優先。もし該当者がいなければ南2/南3の一般スタッフも候補に含める
                if (this.isSouth) {
                    const hasAnyCan8 = this.staffList.some(st => !st.isUnused && !st.isSectionChief && st.can8);
                    if (hasAnyCan8 && !this.staffList[s].can8) continue;
                } else {
                    if (!this.staffList[s].can8) continue;
                }"""

if old_cands_check in text:
    text = text.replace(old_cands_check, new_cands_check, 1)
    print("SUCCESS: Updated can8 candidate selection for South in assign8ClockDuties")

# 3. 特殊勤務の平準化: 8時担当者は合計2回固定、他は極力4回均等化
old_special_penalty = """                    // 8時担当スタッフは特殊勤務（早・遅・E）の合計が2回に達していれば完全除外（最大2回を物理保証）！
                    if (is8ClockStaff && counts.total[s] >= 2) continue;

                    // 1. 合計回数ペナルティ（早+遅+E）
                    let totalCountPenalty = 0;
                    if (is8ClockStaff) {
                        // 8時担当スタッフ: 早・遅・Eの合計は「2回以下」（目標1〜2回）
                        if (counts.total[s] === 1) {
                            totalCountPenalty = 8000; // 1回あるスタッフは強力抑制
                        } else {
                            totalCountPenalty = -1000; // 0回のスタッフのみ許可
                        }
                    } else {
                        // 8時以外の一般スタッフ: 8時の穴埋めを受け、合計目標は 4〜5回！
                        if (counts.total[s] >= 6) {
                            totalCountPenalty = 150000 + (counts.total[s] - 6) * 60000; // 6回以上は激痛
                        } else if (counts.total[s] === 5) {
                            totalCountPenalty = 15000;
                        } else if (counts.total[s] === 4) {
                            totalCountPenalty = 2000; // 4回までは積極的に配分
                        } else if (counts.total[s] === 3) {
                            totalCountPenalty = -2000;
                        } else if (counts.total[s] === 2) {
                            totalCountPenalty = -5000;
                        } else if (counts.total[s] === 1) {
                            totalCountPenalty = -8000;
                        } else {
                            totalCountPenalty = -12000; // まだ0回のスタッフ最優先！
                        }
                    }"""

new_special_penalty = """                    // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！
                    // counts.h8[s]: 8時回数, counts.total[s]: 早+遅+E回数
                    const grandTotalSpecial = counts.total[s] + counts.h8[s];
                    if (is8ClockStaff || counts.h8[s] > 0) {
                        // 8時がある（または担当する）スタッフは、全特殊勤務合計が「2回」に達していたら完全除外！
                        if (grandTotalSpecial >= 2) continue;
                    }

                    // 1. 合計回数ペナルティ（早+遅+E）
                    let totalCountPenalty = 0;
                    if (is8ClockStaff || counts.h8[s] > 0) {
                        // 8時担当スタッフ: 全特殊勤務の合計がちょうど2回になるように誘導
                        if (grandTotalSpecial === 1) {
                            totalCountPenalty = -1000; // 1回あれば2回目として配置可能
                        } else if (grandTotalSpecial === 0) {
                            totalCountPenalty = -3000; // 0回なら優先配置
                        } else {
                            totalCountPenalty = 200000; // 2回以上は配置不可
                        }
                    } else {
                        // ★ ユーザー指示: 特殊勤務の合計数が3の人と5の人がいる。ばらつきを極限まで減らして極力全員4回均等配分！
                        if (counts.total[s] >= 5) {
                            totalCountPenalty = 250000 + (counts.total[s] - 5) * 80000; // 5回以上は超強力禁止
                        } else if (counts.total[s] === 4) {
                            totalCountPenalty = 40000; // 4回に達したスタッフは強いペナルティで新規割り当てを抑止
                        } else if (counts.total[s] === 3) {
                            totalCountPenalty = 0; // 3回のスタッフは4回目を目指して配置
                        } else if (counts.total[s] === 2) {
                            totalCountPenalty = -8000;
                        } else if (counts.total[s] === 1) {
                            totalCountPenalty = -15000;
                        } else {
                            totalCountPenalty = -25000; // まだ0〜2回のスタッフを最優先して4回に引き上げる！
                        }
                    }"""

if old_special_penalty in text:
    text = text.replace(old_special_penalty, new_special_penalty)
    print("SUCCESS: Updated special duties penalty and 2-duty lock for 8h staff")
else:
    print("WARNING: old_special_penalty not found directly, checking alternative")

# 4. 出張「出」「出張」の実数0カウント（出勤実数に加算しない）
# calculateStats() 内で TRIP ('出' や '出張') のカウント
# SYMBOLS.TRIP は '出' または '出張'
old_trip_calc = "else if (sym === SYMBOLS.WORK || sym === '〇' || sym === '◯' || sym === SYMBOLS.TRIP || sym === SYMBOLS.NO_ALLOW_EARLY || sym === SYMBOLS.NO_ALLOW_LATE || sym === SYMBOLS.NO_ALLOW_EVE) {\n                    normal++; if (!isExcludedFromWork) totalWork += 1.0; staffWorkAmt = 1.0;\n                }"
new_trip_calc = """else if (sym === SYMBOLS.TRIP || sym === '出' || sym === '出張') {
                    // ★ ユーザー指示: 「出張」の人は実数に換算しない（0カウント）
                    normal++; // 勤務記号としては保持するが、出勤実数には加算しない
                    staffWorkAmt = 0;
                }
                else if (sym === SYMBOLS.WORK || sym === '〇' || sym === '◯' || sym === SYMBOLS.NO_ALLOW_EARLY || sym === SYMBOLS.NO_ALLOW_LATE || sym === SYMBOLS.NO_ALLOW_EVE) {
                    normal++; if (!isExcludedFromWork) totalWork += 1.0; staffWorkAmt = 1.0;
                }"""

if old_trip_calc in text:
    text = text.replace(old_trip_calc, new_trip_calc)
    print("SUCCESS: Updated calculateStats for business trip 0-count")

# 実数計算部（realWorkBase）での TRIP 除外
old_trip_real = "[SYMBOLS.EARLY, SYMBOLS.LATE, SYMBOLS.EVE, SYMBOLS.H8, SYMBOLS.WORK, '〇', '◯', SYMBOLS.TRIP, SYMBOLS.NO_ALLOW_EARLY, SYMBOLS.NO_ALLOW_LATE, SYMBOLS.NO_ALLOW_EVE].includes(sym)"
new_trip_real = "[SYMBOLS.EARLY, SYMBOLS.LATE, SYMBOLS.EVE, SYMBOLS.H8, SYMBOLS.WORK, '〇', '◯', SYMBOLS.NO_ALLOW_EARLY, SYMBOLS.NO_ALLOW_LATE, SYMBOLS.NO_ALLOW_EVE].includes(sym) && sym !== '出' && sym !== '出張' && sym !== SYMBOLS.TRIP"

if old_trip_real in text:
    text = text.replace(old_trip_real, new_trip_real)
    print("SUCCESS: Updated realWorkBase calculation to exclude trip 0-count")

# 5. リフレッシュ休暇: 公休8個を維持した上でリフを追加（公休8+リフ）
# リフ取得スタッフの公休配置で、公休数を7等に減らさず、8日公休を完全確保する
old_ref_hol = "const targetHols = (staff.refDays && staff.refDays > 0) ? Math.max(1, stdHols - staff.refDays) : stdHols;"
new_ref_hol = "// ★ ユーザー指示: リフの入れ方は公休8個にプラスしてリフを入れる（公休8日を減らさない）\nconst targetHols = stdHols;"

if old_ref_hol in text:
    text = text.replace(old_ref_hol, new_ref_hol)
    print("SUCCESS: Fixed refresh leave holiday count to standard 8 days + ref")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("solver.js update complete.")
