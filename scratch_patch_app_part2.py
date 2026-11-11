import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. 生活期テーブルヘッダーに「土日休」「日休」列を追加
old_life_flags_head = """                <th class="flag-col" rowspan="2" title="6連勤例外許可" style="background:#fee2e2; color:#991b1b;">6連勤<br>可</th>"""
new_life_flags_head = """                <th class="flag-col" rowspan="2" title="土日休（事前希望がない限り土日休み固定）" style="background:#dbeafe; color:#1e40af; font-weight:800;">土日休</th>
                <th class="flag-col" rowspan="2" title="日休（日曜日固定公休＋平日分散配置）" style="background:#fef3c7; color:#92400e; font-weight:800;">日休</th>
                <th class="flag-col" rowspan="2" title="6連勤例外許可" style="background:#fee2e2; color:#991b1b;">6連勤<br>可</th>"""

if old_life_flags_head in text:
    text = text.replace(old_life_flags_head, new_life_flags_head, 1)
    print("SUCCESS: Added isSatSunOff and isSunOff headers to life table in app.js")

# 生活期テーブル行（renderInputTable内）に「土日休」「日休」チェックボックスを追加
old_life_row_flags = """                    bodyHtml += `
                        <td class="flag-cell" style="text-align:center;">
                            <label class="toggle-switch" title="6連勤例外許可">
                                <input type="checkbox" ${staff.can6Work ? 'checked' : ''} data-flag="can6Work" data-s="${sIdx}">
                                <span class="toggle-slider danger-slider"></span>
                            </label>
                        </td>"""

new_life_row_flags = """                    bodyHtml += `
                        <td class="flag-cell" style="text-align:center;">
                            <label class="toggle-switch" title="土日休（事前希望がない限り土日休み固定）">
                                <input type="checkbox" ${staff.isSatSunOff ? 'checked' : ''} data-flag="isSatSunOff" data-s="${sIdx}">
                                <span class="toggle-slider"></span>
                            </label>
                        </td>
                        <td class="flag-cell" style="text-align:center;">
                            <label class="toggle-switch" title="日休（日曜日固定公休＋平日分散配置）">
                                <input type="checkbox" ${staff.isSunOff ? 'checked' : ''} data-flag="isSunOff" data-s="${sIdx}">
                                <span class="toggle-slider"></span>
                            </label>
                        </td>
                        <td class="flag-cell" style="text-align:center;">
                            <label class="toggle-switch" title="6連勤例外許可">
                                <input type="checkbox" ${staff.can6Work ? 'checked' : ''} data-flag="can6Work" data-s="${sIdx}">
                                <span class="toggle-slider danger-slider"></span>
                            </label>
                        </td>"""

if old_life_row_flags in text:
    text = text.replace(old_life_row_flags, new_life_row_flags, 1)
    print("SUCCESS: Added isSatSunOff and isSunOff row checkboxes to life table in app.js")

# 2. 希望入力シートでのドラッグ＆ドロップ並び替え機能の実装
# renderInputTable での行に draggable="true" とドラッグハンドル ⠿ を追加
old_tr_start = "bodyHtml += `<tr class=\"${rowClass}\">`;"
new_tr_start = """bodyHtml += `<tr class="${rowClass}" draggable="true" data-s="${sIdx}" style="cursor:move;">`;"""
text = text.replace(old_tr_start, new_tr_start, 1)

old_no_cell = """${staff.isUnused ? 'checked' : ''} data-unused="true" data-s="${sIdx}">
                    <span class="toggle-slider danger-slider"></span>
                </label>
            </td>
            <td class="sticky-col-2 ${nameClass}" style="text-align:left; padding-left:8px; font-weight:700;">"""

new_no_cell = """${staff.isUnused ? 'checked' : ''} data-unused="true" data-s="${sIdx}">
                    <span class="toggle-slider danger-slider"></span>
                </label>
            </td>
            <td class="sticky-col-2 ${nameClass}" style="text-align:left; padding-left:8px; font-weight:700;">
                <span class="drag-handle" title="ドラッグして並び替え" style="cursor:grab; margin-right:4px; font-size:14px; color:#94a3b8;">⠿</span>"""

text = text.replace(old_no_cell, new_no_cell, 1)

# 3. getActivePaletteSymbol() ヘルパーの新設とセルクリック処理の統一
palette_helper_code = """
    // ★ ユーザー指示: 記号パレットバグ修正＆リアルタイムアクティブ記号の取得
    function getActivePaletteSymbol(isOutput = false) {
        const activeTabPanel = document.querySelector('.tab-panel.active');
        if (activeTabPanel) {
            const btn = activeTabPanel.querySelector('.palette-btn.selected');
            if (btn && btn.dataset.sym !== undefined) return btn.dataset.sym;
        }
        const anyBtn = document.querySelector('.palette-btn.selected');
        if (anyBtn && anyBtn.dataset.sym !== undefined) return anyBtn.dataset.sym;
        return isOutput ? currentOutputSelectedSymbol : currentSelectedSymbol;
    }

    // ★ ユーザー指示: コピペモード用状態変数
    let isCopyMode = false;
    let clipboardSymbol = null;
    let selectedCopyCell = null;
"""

if "function getActivePaletteSymbol" not in text:
    text = text.replace("let currentOutputSelectedSymbol = '休';", palette_helper_code + "\n    let currentOutputSelectedSymbol = '休';")

# 4. セルクリック処理で getActivePaletteSymbol を確実に適用
text = text.replace("let newSym = currentSelectedSymbol;", "let newSym = getActivePaletteSymbol(false);")
text = text.replace("let newSym = currentOutputSelectedSymbol;", "let newSym = getActivePaletteSymbol(true);")

# 5. 公休が8以外のスタッフ集計セルの網掛け（holiday-alert-cell）
# outputTable の各スタッフ行での offDays
old_off_stat = """<td class="stat-cell" data-s="${s}" data-stat="off" style="font-weight:700; color:#1e293b; background:transparent; ${rowBorderB}">${staffStat.offDays}</td>"""
new_off_stat = """<td class="stat-cell ${(!staff.isUnused && staffStat.offDays !== 8) ? 'holiday-alert-cell' : ''}" data-s="${s}" data-stat="off" title="${staffStat.offDays !== 8 ? '公休が8日ではありません（現在:' + staffStat.offDays + '日）' : '公休8日'}" style="font-weight:700; color:#1e293b; ${rowBorderB}">${staffStat.offDays}</td>"""
text = text.replace(old_off_stat, new_off_stat)

# 普通の行（non-ST）の offDays も置換
old_off_stat_normal = """<td class="stat-cell" data-s="${s}" data-stat="off" style="font-weight:700; color:#1e293b; background:transparent;">${staffStat.offDays}</td>"""
new_off_stat_normal = """<td class="stat-cell ${(!staff.isUnused && staffStat.offDays !== 8) ? 'holiday-alert-cell' : ''}" data-s="${s}" data-stat="off" title="${staffStat.offDays !== 8 ? '公休が8日ではありません（現在:' + staffStat.offDays + '日）' : '公休8日'}" style="font-weight:700; color:#1e293b;">${staffStat.offDays}</td>"""
text = text.replace(old_off_stat_normal, new_off_stat_normal)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Part 2 of app.js updated (life flags, drag-and-drop markup, getActivePaletteSymbol, holiday-alert)")
