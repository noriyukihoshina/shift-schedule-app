# -*- coding: utf-8 -*-
"""
app.js の改修:
1. 全テーブル共通のグローバル選択ターム同期 (STORAGE_KEY_GLOBAL_CURRENT_TERM)
   - どこかのテーブルでタームを変更したら、すべてのテーブルでそのタームが開くようにする。
   - 再度マスターテーブルを開いても変更後のタームが維持される。
2. renderMasterIntegrationView でのハーフマン未設定時フォールバック加算の完全撤廃
   - まだ組んでいない（データがない）時は正確に「0」にする。
3. ⚡ 勤務表を自動生成する（solveBtn / inputSolveBtn）時に前ターム実績未取込なら自動で直前タームから取込
4. グラフの平日の色を緑 (#10b981) に変更
5. renderMasterIntegrationView でのタイトル・終了日バッジの確実な動的更新
"""
import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# -------------------------------------------------------------
# 1. グローバル選択ターム同期キーの定義
# -------------------------------------------------------------
global_term_key_def = "const STORAGE_KEY_GLOBAL_CURRENT_TERM = 'shift_schedule_global_active_term_start_date';\n"
if 'STORAGE_KEY_GLOBAL_CURRENT_TERM' not in code:
    code = code.replace("const STORAGE_KEY_LAST_ACTIVE = ", global_term_key_def + "    const STORAGE_KEY_LAST_ACTIVE = ")
    print("1. Added STORAGE_KEY_GLOBAL_CURRENT_TERM definition")

# ターム切り替え時（initTermSelector の change イベント）にグローバルキーへ保存
target_term_change_save = "localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);"
new_term_change_save = """localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
            localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newDate);
            localStorage.setItem('shift_schedule_current_start_date', newDate);"""

if target_term_change_save in code:
    code = code.replace(target_term_change_save, new_term_change_save)
    print("2. Added global term save on term change")

# 起動時の targetDate 決定でグローバルキーを最優先参照
target_init_date = "const lastActiveDate = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE) || localStorage.getItem('shift_schedule_last_active_start_date');"
new_init_date = """const lastActiveDate = localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || localStorage.getItem('shift_schedule_current_start_date') || localStorage.getItem(STORAGE_KEY_LAST_ACTIVE) || localStorage.getItem('shift_schedule_last_active_start_date');"""

if target_init_date in code:
    code = code.replace(target_init_date, new_init_date)
    print("3. Updated targetDate resolution to prioritize global active term")

# -------------------------------------------------------------
# 2. ハーフマン未設定時のフォールバック加算の完全撤廃
# -------------------------------------------------------------
fallback_ha_pattern = r"""\s*// 未設定時のフォールバック\s*if \(!staffFound\) \{[\s\S]*?lifeHaDataMap\[def\.flId\]\[d\] \+= 0\.5;[\s\S]*?\}\s*\}"""

if re.search(fallback_ha_pattern, code):
    code = re.sub(fallback_ha_pattern, "\n            // ★ ユーザー指示: まだ組んでいない時は勝手なハーフマン加算を行わず正確に0にする（フォールバック加算完全撤廃）\n", code, count=1)
    print("4. Removed fallback hardcoded 0.5 for halfman in renderMasterIntegrationView")
else:
    print("4. Notice: fallback_ha_pattern not found directly, checking...")

# -------------------------------------------------------------
# 3. ⚡ 勤務表を自動生成する（solveBtn）時に前ターム実績未取込なら自動で直前タームから取込
# -------------------------------------------------------------
auto_sync_prev_logic = """
        // ★ ユーザー指示: ⚡ 勤務表を自動生成するを押したタイミングで前ターム最終5日間実績を読み込んでいない場合は自動で前ターム最終5日間実績を読み込んでから作業を開始
        const hasPrevHistory = staffList.some(s => !s.isUnused && s.prevDays && s.prevDays.some(p => p && p.trim() !== ''));
        if (!hasPrevHistory) {
            const curDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
            const prevTerm = findPreviousTerm(curDate);
            if (prevTerm) {
                const applied = applyPreviousTermHistory(prevTerm, false);
                if (applied) {
                    showToast('🔗 直前の前ターム最終5日間実績を自動取込しました');
                    renderInputTable();
                }
            }
        }
"""

solve_btn_click_target = "solveBtn.addEventListener('click', () => {"
if solve_btn_click_target in code:
    code = code.replace(solve_btn_click_target, solve_btn_click_target + auto_sync_prev_logic)
    print("5. Added auto-sync previous term history on solveBtn click")

# -------------------------------------------------------------
# 4. グラフの平日の色を緑 (#10b981) に変更
# -------------------------------------------------------------
old_bar_color = "let barColor = '#3b82f6'; // 平日: 青"
new_bar_color = "let barColor = '#10b981'; // 平日: 緑 (エメラルドグリーン) ★土曜・平日を明確識別"

if old_bar_color in code:
    code = code.replace(old_bar_color, new_bar_color)
    print("6. Changed chart weekday bar color to green (#10b981)")

# -------------------------------------------------------------
# 5. renderMasterIntegrationView でのタイトル・終了日バッジ更新の保証
# -------------------------------------------------------------
render_master_title_update = """        const checkTitle = document.getElementById('checkTitleDisplay');
        if (checkTitle) {
            checkTitle.textContent = `🏢 ${term.title}（全フロア統合サマリー＆勤務詳細集約）`;
        }
        const endDisplay = document.getElementById('termEndDateDisplay');
        if (endDisplay && term && term.last) {
            const lastY = term.last.dateObj.getFullYear();
            const lastM = String(term.last.m).padStart(2, '0');
            const lastD = String(term.last.day).padStart(2, '0');
            endDisplay.textContent = `${lastY}-${lastM}-${lastD}`;
        }
        const badge = document.getElementById('termTitleBadge');
        if (badge && term) badge.textContent = term.badgeText;
        const daysBadge = document.getElementById('termDaysBadge');
        if (daysBadge) daysBadge.textContent = `${numDays}日間`;
"""

old_title_code = """        const checkTitle = document.getElementById('checkTitleDisplay');
        if (checkTitle) {
            checkTitle.textContent = `🏢 全フロア統合（各階サマリー＆勤務詳細集約）`;
        }"""

if old_title_code in code:
    code = code.replace(old_title_code, render_master_title_update)
    print("7. Enhanced renderMasterIntegrationView title and badge dynamic update")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved app.js successfully.")
