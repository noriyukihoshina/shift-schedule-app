import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 添付4: STフッター階別集計で、各階の最終行（早の行）の全td・thに border-bottom: 3px solid #1e293b !important; を付与
old_early_row = """                // 添付3: 早
                footHtml += `<tr style="background:${fl.bg}; font-weight:bold; border-bottom: 2px solid #1e293b;">
                    <th class="sticky-col-2" style="background:${fl.bg}; border-right:2px solid #475569; text-align:center; color:#c2410c; padding:4px 8px;">早</th>`;
                for (let d = 0; d < NUM_DAYS; d++) {
                    const thickCls = getDayBorderClass(d);
                    footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#c2410c; text-align:center;">${dEarly[d]}</td>`;
                }
                footHtml += `<td style="font-weight:700; color:#c2410c; text-align:center;">${sumEarly}</td><td colspan="8"></td></tr>`;"""

new_early_row = """                // ★ 添付4: 各階の最終行（早の行）は最右端まで太い横罫線（3px solid #1e293b）を貫通！
                footHtml += `<tr style="background:${fl.bg}; font-weight:bold;">
                    <th class="sticky-col-2" style="background:${fl.bg}; border-right:2px solid #475569; border-bottom: 3px solid #1e293b !important; text-align:center; color:#c2410c; padding:4px 8px;">早</th>`;
                for (let d = 0; d < NUM_DAYS; d++) {
                    const thickCls = getDayBorderClass(d);
                    footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#c2410c; text-align:center; border-bottom: 3px solid #1e293b !important;">${dEarly[d]}</td>`;
                }
                footHtml += `<td style="font-weight:700; color:#c2410c; text-align:center; border-bottom: 3px solid #1e293b !important;">${sumEarly}</td><td colspan="8" style="border-bottom: 3px solid #1e293b !important;"></td></tr>`;"""

if old_early_row in text:
    text = text.replace(old_early_row, new_early_row)
    print("SUCCESS: Fixed ST floor footer early row to have full-width bottom border")
else:
    print("WARNING: old_early_row not matched directly")

# 左端セルの border-bottom も 3px solid #1e293b !important に更新
old_fl_label = "border-bottom:2px solid #1e293b;"
new_fl_label = "border-bottom:3px solid #1e293b !important;"
text = text.replace(old_fl_label, new_fl_label)

# 全階合計の最後の行（早合計）も最右端まで border-bottom: 3.5px solid #1e293b !important;
old_sum_early_row = """            footHtml += `<tr style="background:#f1f5f9; font-weight:800; border-bottom: 3px solid #475569;">
                <th class="sticky-col-2" style="background:#f1f5f9; border-right:2px solid #475569; text-align:center; color:#c2410c; padding:4px 8px;">早合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:900; color:#c2410c; text-align:center; font-size:0.95rem;">${allFloorsEarly[d]}</td>`;
            }
            footHtml += `<td style="font-weight:900; color:#c2410c; text-align:center;">${totalEarlyAll}</td><td colspan="8"></td></tr>`;"""

new_sum_early_row = """            footHtml += `<tr style="background:#f1f5f9; font-weight:800;">
                <th class="sticky-col-2" style="background:#f1f5f9; border-right:2px solid #475569; border-bottom: 3.5px solid #1e293b !important; text-align:center; color:#c2410c; padding:4px 8px;">早合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:900; color:#c2410c; text-align:center; font-size:0.95rem; border-bottom: 3.5px solid #1e293b !important;">${allFloorsEarly[d]}</td>`;
            }
            footHtml += `<td style="font-weight:900; color:#c2410c; text-align:center; border-bottom: 3.5px solid #1e293b !important;">${totalEarlyAll}</td><td colspan="8" style="border-bottom: 3.5px solid #1e293b !important;"></td></tr>`;"""

if old_sum_early_row in text:
    text = text.replace(old_sum_early_row, new_sum_early_row)
    print("SUCCESS: Fixed total ST early row to have full-width bottom border")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("app.js update complete.")
