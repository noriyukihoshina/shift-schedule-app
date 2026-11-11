import sys
sys.stdout.reconfigure(encoding='utf-8')

# 1. style.css に border-thickest-right と太線強化を追加
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

extra_css_rules = """
/* ★ 添付1: 4/28と出勤集計の間にはさらに太い線が必要 */
.border-thickest-right {
    border-right: 3.5px solid #1e293b !important;
}

/* ★ 添付3: 公休9等の網掛け警告 */
.holiday-alert-cell {
    background: #e0f2fe !important;
    color: #0369a1 !important;
    font-weight: 800 !important;
    box-shadow: inset 0 0 0 2px #0284c7 !important;
    border: 2px solid #0284c7 !important;
}

/* ★ 添付4: STテーブル階層区切りの太線を最右端まで貫通 */
tr.st-floor-last-row td,
td.st-floor-divider-cell {
    border-bottom: 3.5px solid #1e293b !important;
}
"""

if ".border-thickest-right" not in css:
    css += extra_css_rules
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("SUCCESS: Updated style.css with border-thickest-right and st-floor-divider-cell")

# 2. app.js の修正
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 末尾のコードを切り離す
copy_idx = text.find("// ★ ユーザー指示: コピペモード（セル選択 Ctrl+C / Ctrl+V またはクリック貼付）")
if copy_idx != -1:
    tail_code = text[copy_idx:]
    text = text[:copy_idx].rstrip()

    # DOMContentLoaded の閉じ括弧 }); を探す
    dom_close_idx = text.rfind("});")
    if dom_close_idx != -1:
        # 閉じ括弧の内側に tail_code を挿入
        text = text[:dom_close_idx] + "\n\n" + tail_code + "\n\n});\n"
        print("SUCCESS: Moved tail code into DOMContentLoaded scope in app.js")

# 3. getDayBorderClass ヘルパーの追加と置換
# 4/28 (d === NUM_DAYS - 1) は border-thickest-right, 土曜日は border-thick-right
day_border_helper = """
    // ★ 添付1: 4/28と出勤集計の間にはさらに太い線（border-thickest-right）、土曜日は太線（border-thick-right）
    function getDayBorderClass(d) {
        if (d === NUM_DAYS - 1) return 'border-thickest-right';
        if (isSaturdayCol(d)) return 'border-thick-right';
        return '';
    }
"""

if "function getDayBorderClass" not in text:
    text = text.replace("function isSaturdayCol(d) {", day_border_helper + "\n    function isSaturdayCol(d) {")

# isSaturdayCol(d) ? 'border-thick-right' : '' を getDayBorderClass(d) に一括置換
text = text.replace("isSaturdayCol(d) ? 'border-thick-right' : ''", "getDayBorderClass(d)")

# 4. 添付4: STテーブルで階層区切りの太線を最右端まで貫通させる
# flStaffIndices.forEach 内で isLastInFloor の場合のスタイル
old_st_row = "bodyHtml += `<tr style=\"${rowBorderB}\">`;"
new_st_row = "bodyHtml += `<tr class=\"${isLastInFloor ? 'st-floor-last-row' : ''}\" style=\"${rowBorderB}\">`;"
text = text.replace(old_st_row, new_st_row)

old_st_row_border = "const rowBorderB = isLastInFloor ? 'border-bottom: 2px solid #94a3b8 !important;' : '';"
new_st_row_border = "const rowBorderB = isLastInFloor ? 'border-bottom: 3.5px solid #1e293b !important;' : '';"
text = text.replace(old_st_row_border, new_st_row_border)

# 5. 添付3: 公休不一致のエラーバナー警告追加
# checkWorkAreaConstraints または制約チェック関数で公休日数 !== standardHolidays の検知
old_check_hol = """                    if (staffStat.offDays !== 8) {"""
new_check_hol = """                    if (staffStat.offDays !== 8 && !staff.isUnused) {
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】公休日数が${staffStat.offDays}日です（規定要件: 8日）。`);"""

# checkFinalConstraints または checkWorkAreaConstraints 内のエラーチェックを確認して追加
hol_check_code = """
        // ★ 添付3: 全スタッフの公休日数8日（規定）チェック
        staffList.forEach((st, sIdx) => {
            if (st.isUnused) return;
            const staffStat = (stats && stats.staffStats && stats.staffStats[sIdx]) || null;
            if (staffStat && Math.abs(staffStat.offDays - 8) > 0.01) {
                errors.push(`【スタッフ No.${st.id} ${st.name}】公休日数が${staffStat.offDays}日です（規定要件: 8日）。`);
            }
        });
"""

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Updated app.js with scope fix, border-thickest-right, ST table border贯通")
