with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. renderInputTable での自動配分リフの黒字化
target_old_input_td = """            // 当ターム 1日〜28日
            for (let d = 0; d < NUM_DAYS; d++) {
                const val = staff.days[d] || '';
                const cls = val ? 'day-cell fixed-cell' : 'day-cell';
                const thickCls = getDayBorderClass(d);
                const lockTitle = val ? `事前固定枠: ${val}（自動上書きロック中）` : 'クリックで記号入力';
                bodyHtml += `<td class="${cls} ${thickCls}" data-type="day" data-s="${sIdx}" data-d="${d}" title="${lockTitle}">${val}</td>`;
            }"""

target_new_input_td = """            // 当ターム 1日〜28日
            const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
            for (let d = 0; d < NUM_DAYS; d++) {
                const val = staff.days[d] || '';
                const isAutoRef = autoAssignedRefKeys.has(`${curStartDate}:${sIdx},${d}`);
                // ★ ユーザー指示: 自動配分されたリフ「上1」は赤字固定ではなく通常黒字（編集自由）！
                const isFixed = val ? (!isAutoRef) : false;
                const cls = isFixed ? 'day-cell fixed-cell' : (val ? 'day-cell auto-ref-cell' : 'day-cell');
                const thickCls = getDayBorderClass(d);
                const lockTitle = isFixed ? `事前固定枠: ${val}（自動上書きロック中）` : (val ? `自動配分リフ: ${val}（編集・変更自由）` : 'クリックで記号入力');
                bodyHtml += `<td class="${cls} ${thickCls}" data-type="day" data-s="${sIdx}" data-d="${d}" title="${lockTitle}">${val}</td>`;
            }"""

if target_old_input_td in content:
    content = content.replace(target_old_input_td, target_new_input_td)
    print("Replaced renderInputTable cell styling for auto ref")
else:
    print("renderInputTable cell styling target NOT found!")

# 2. renderOutputTable での自動配分リフの黒字化
target_old_output_td = """                for (let d = 0; d < NUM_DAYS; d++) {
                    const cell = grid[s][d];
                    const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                    const cls = cell.isFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';
                    const thickCls = getDayBorderClass(d);
                    const titleText = cell.isFixed ? '🔒 事前固定希望枠（赤字・太字保持）' : 'システム自動配置';
                    bodyHtml += `<td class="${cls} ${thickCls} ${rowBottomCls}" data-s="${s}" data-d="${d}" title="${titleText}">${displaySym}</td>`;
                }"""

target_new_output_td = """                const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
                for (let d = 0; d < NUM_DAYS; d++) {
                    const cell = grid[s][d];
                    const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                    const isAutoRef = cell.isAutoAssignedRef || autoAssignedRefKeys.has(`${curStartDate}:${s},${d}`);
                    const isCellFixed = cell.isFixed && !isAutoRef;
                    const cls = isCellFixed ? 'day-cell fixed-cell' : (isAutoRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');
                    const thickCls = getDayBorderClass(d);
                    const titleText = isCellFixed ? '🔒 事前固定希望枠（赤字・太字保持）' : (isAutoRef ? '🌴 自動配分リフ（通常編集自由）' : 'システム自動配置');
                    bodyHtml += `<td class="${cls} ${thickCls} ${rowBottomCls}" data-s="${s}" data-d="${d}" title="${titleText}">${displaySym}</td>`;
                }"""

if target_old_output_td in content:
    content = content.replace(target_old_output_td, target_new_output_td)
    print("Replaced renderOutputTable cell styling for auto ref")
else:
    print("renderOutputTable cell styling target NOT found!")

# 3. renderCheckTable でも同様に対応
target_old_check_td = """                for (let d = 0; d < NUM_DAYS; d++) {
                    const cell = grid[s][d];
                    const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                    const cls = cell.isFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';
                    const thickCls = getDayBorderClass(d);
                    const titleText = cell.isFixed ? '🔒 事前固定希望枠（赤字・太字保持）' : 'システム自動配置';
                    bodyHtml += `<td class="${cls} ${thickCls} ${rowBottomCls}" data-s="${s}" data-d="${d}" title="${titleText}">${displaySym}</td>`;
                }"""

# renderCheckTable の該当箇所を探す
pos_check = content.find('function renderCheckTable')
if pos_check != -1:
    pos_check_loop = content.find('for (let d = 0; d < NUM_DAYS; d++) {', pos_check)
    print("Found renderCheckTable loop at", pos_check_loop)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated app.js successfully!")
