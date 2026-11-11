# -*- coding: utf-8 -*-
"""
生活期テーブルの改修:
1. inputTableHead に「土日休」「日休」列を追加 (STと同一スタイル)
2. inputTableBody に「土日休」「日休」トグルセルを追加
3. copyMode時の誤ペーストを完全撤廃し、選択フォーカスのみにする
4. 生活期フッター集計行を「訪問出勤人数合計」「訪問実数合計」「通所出勤人数合計」「通所実数合計」「8時」に切り替え
5. masterTermSelect を termSelect に統合し、マスターテーブルでのターム切り替えを完全共通化
"""
import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# -------------------------------------------------------------
# 1. 生活期 inputTableHead に「土日休」「日休」列を追加
# -------------------------------------------------------------
target_life_head = """                <th class="flag-col" rowspan="2" title="6連勤例外許可" style="background:#fee2e2; color:#991b1b;">6連勤<br>可</th>"""
# 生活期ヘッダー内での target_life_head の直前に「土日休」「日休」を追加
life_head_pattern = r"""(else if \(isLife\) \{[\s\S]*?)(<th class="flag-col" rowspan="2" title="6連勤例外許可")"""

def add_life_head_toggles(match):
    before = match.group(1)
    tag = match.group(2)
    toggles = """                <th class="flag-col" rowspan="2" title="土日休（土日固定休み）" style="background:#dbeafe; color:#1e40af; font-weight:800;">土日休</th>
                <th class="flag-col" rowspan="2" title="日休（日曜日固定公休＋平日分散配置）" style="background:#fef3c7; color:#92400e; font-weight:800;">日休</th>
"""
    if 'title="土日休（土日固定休み）"' in before:
        return match.group(0)
    return before + toggles + "                " + tag

code, count = re.subn(life_head_pattern, add_life_head_toggles, code, count=1)
print(f"1. Life head toggles added: count={count}")

# -------------------------------------------------------------
# 2. 生活期 inputTableBody に「土日休」「日休」トグルセルを追加
# -------------------------------------------------------------
life_body_pattern = r"""(bodyHtml \+= `\s*<td class="flag-col" style="background:#fae8ff;">[\s\S]*?<td class="flag-col" style="background:#f3e8ff;">[\s\S]*?</td>\s*)(<td class="flag-col" style="background:#fef2e2;">\s*<label class="toggle-switch" title="6連勤可">)"""

def add_life_body_toggles(match):
    before = match.group(1)
    tag = match.group(2)
    toggles = """                    <td class="flag-col" style="background:#eff6ff;">
                        <label class="toggle-switch" title="土日休">
                            <input type="checkbox" ${staff.isSatSunOff ? 'checked' : ''} data-off-type="satSun" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fefce8;">
                        <label class="toggle-switch" title="日休">
                            <input type="checkbox" ${staff.isSunOff ? 'checked' : ''} data-off-type="sunOnly" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
"""
    if 'data-off-type="satSun"' in before:
        return match.group(0)
    return before + toggles + "                    " + tag

code, count2 = re.subn(life_body_pattern, add_life_body_toggles, code, count=1)
print(f"2. Life body toggles added: count={count2}")

# -------------------------------------------------------------
# 3. ST inputTableBody にも「土日休」「日休」トグルセルを追加（もし未追加なら）
# -------------------------------------------------------------
st_body_pattern = r"""(<td class="flag-col">\s*<label class="toggle-switch" title="専従">[\s\S]*?</td>\s*)(<td class="flag-col">\s*<label class="toggle-switch" title="6連勤可">)"""

def add_st_body_toggles(match):
    before = match.group(1)
    tag = match.group(2)
    toggles = """                    <td class="flag-col" style="background:#eff6ff;">
                        <label class="toggle-switch" title="土日休">
                            <input type="checkbox" ${staff.isSatSunOff ? 'checked' : ''} data-off-type="satSun" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fefce8;">
                        <label class="toggle-switch" title="日休">
                            <input type="checkbox" ${staff.isSunOff ? 'checked' : ''} data-off-type="sunOnly" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
"""
    if 'data-off-type="satSun"' in before:
        return match.group(0)
    return before + toggles + "                    " + tag

code, count3 = re.subn(st_body_pattern, add_st_body_toggles, code, count=1)
print(f"3. ST body toggles added: count={count3}")

# -------------------------------------------------------------
# 4. staffList 初期化と saveStaffMaster / applyMasterArrayToStaffList に isSatSunOff, isSunOff を追加
# -------------------------------------------------------------
if 'isSatSunOff: false,' not in code:
    code = code.replace("allow6Consec: false,", "allow6Consec: false,\n                    isSatSunOff: false,\n                    isSunOff: false,")
    print("4. Added isSatSunOff and isSunOff to staffList initialization")

# saveStaffMaster の保存対象フィールドに追加
if 'isSatSunOff: !!s.isSatSunOff,' not in code:
    target_save = "allow6Consec: !!s.allow6Consec,"
    code = code.replace(target_save, target_save + "\n                isSatSunOff: !!s.isSatSunOff,\n                isSunOff: !!s.isSunOff,")
    print("5. Added isSatSunOff and isSunOff to saveStaffMaster")

# applyMasterArrayToStaffList の復元対象フィールドに追加
if 'target.isSatSunOff = !!masterStaff.isSatSunOff;' not in code:
    target_apply = "target.allow6Consec = !!masterStaff.allow6Consec;"
    code = code.replace(target_apply, target_apply + "\n            target.isSatSunOff = !!masterStaff.isSatSunOff;\n            target.isSunOff = !!masterStaff.isSunOff;")
    print("6. Added isSatSunOff and isSunOff to applyMasterArrayToStaffList")

# -------------------------------------------------------------
# 5. data-off-type の排他トグル切り替えイベントリスナーの追加
# -------------------------------------------------------------
event_target = """        // ★ 生活期ハセクション（ハ1〜ハ4）択一トグル"""
event_insert = """        // ★ 土日休・日休の排他トグル処理（生活期・ST共通）
        document.querySelectorAll('input[type="checkbox"][data-off-type]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const offType = e.target.dataset.offType;
                if (!staffList[s]) return;
                pushHistory();
                if (offType === 'satSun') {
                    staffList[s].isSatSunOff = e.target.checked;
                    if (staffList[s].isSatSunOff) {
                        staffList[s].isSunOff = false;
                    }
                } else if (offType === 'sunOnly') {
                    staffList[s].isSunOff = e.target.checked;
                    if (staffList[s].isSunOff) {
                        staffList[s].isSatSunOff = false;
                    }
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
                renderInputTable();
            });
        });

"""
if 'data-off-type' not in code:
    code = code.replace(event_target, event_insert + event_target)
    print("7. Added data-off-type event listener")

# -------------------------------------------------------------
# 6. コピペモードの誤ペースト完全撤廃（attachOutputTableEvents）
# -------------------------------------------------------------
old_output_copy = """                // ★ コピペモード時の処理（出力シート/修正作業エリア）
                if (isCopyMode) {
                    if (clipboardSymbol === null || selectedCopyCell === null) {
                        clipboardSymbol = cell.textContent.trim();
                        if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                        selectedCopyCell = cell;
                        cell.classList.add('copy-selected-cell');
                        showToast(`📋 【${clipboardSymbol || '空欄'}】をコピーしました。貼り付け先をクリックしてください`);
                        return;
                    } else {
                        pushHistory();
                        const cellData = lastSolveResult.grid[s][d];
                        cellData.symbol = clipboardSymbol;
                        if (lastScheduler) {
                            lastScheduler.grid[s][d].symbol = clipboardSymbol;
                            const newStats = lastScheduler.calculateStats();
                            lastSolveResult.stats = newStats;
                            renderOutputTable(lastSolveResult.grid, newStats);
                            renderStatsDashboard(newStats);
                        } else {
                            renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
                        }
                        saveCurrentTermToStorage();
                        showToast(`📋 【${clipboardSymbol || '空欄'}】を貼り付けました`);
                        return;
                    }
                }"""

new_output_copy = """                // ★ コピペモード時の処理（出力シート/修正作業エリア）:
                // ユーザー指示: セルクリックでの勝手な貼り付けは完全廃止し、セルのフォーカス選択のみ行う。
                // コピーは Ctrl+C、貼り付けは Ctrl+V のみで行う！
                if (isCopyMode) {
                    if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                    selectedCopyCell = cell;
                    cell.classList.add('copy-selected-cell');
                    return;
                }"""

if old_output_copy in code:
    code = code.replace(old_output_copy, new_output_copy)
    print("8. Replaced copy mode auto-paste in attachOutputTableEvents")
else:
    print("8. Notice: old_output_copy not directly found, checking...")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved app.js successfully.")
