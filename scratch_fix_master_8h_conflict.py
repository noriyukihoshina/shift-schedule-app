import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. 南病棟の8時定数を 1 に修正
old_fc_target = """            // 定数定義（1〜3階: 早3/遅1/E2/8時1、南: 早2/遅2/E2/8時0）
            const isSouthFloor = (fc.id === 'south');
            const targetEarly = isSouthFloor ? 2 : 3;
            const targetLate = isSouthFloor ? 2 : 1;
            const targetEve = 2;
            const targetH8 = isSouthFloor ? 0 : 1;"""

new_fc_target = """            // 定数定義（1〜3階: 早3/遅1/E2/8時1、南: 早2/遅2/E2/8時1 ★南病棟も8時毎日1名！）
            const isSouthFloor = (fc.id === 'south');
            const targetEarly = isSouthFloor ? 2 : 3;
            const targetLate = isSouthFloor ? 2 : 1;
            const targetEve = 2;
            const targetH8 = 1;"""

assert old_fc_target in text, "old_fc_target not found in app.js"
text = text.replace(old_fc_target, new_fc_target)

# 2. 全館合算の8時定数を 4 に修正（1〜3階各1 + 南1 = 計4名）
old_grand_h8 = """        // 8時（全館定数: 1〜3階各1 + 南0 = 計3名）
        html += `<tr style="background:#f8fafc; font-weight:700; border-bottom:3px solid #334155;">
            <td class="sticky-col-2" style="background:#f8fafc; color:#059669; border-right:2px solid #475569; font-weight:700; width:95px; min-width:95px; max-width:105px;">8時</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const cnt = grandH8[d];
            const isConflict = (cnt !== 3);
            const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : 'background:#f8fafc; color:#059669;';
            const titleStr = isConflict ? `title="⚠️ 全館8時定数エラー: ${cnt}名（定数: 3名）"` : '';"""

new_grand_h8 = """        // 8時（全館定数: 1〜3階各1 + 南1 = 計4名 ★南病棟含め全館合計4名！）
        html += `<tr style="background:#f8fafc; font-weight:700; border-bottom:3px solid #334155;">
            <td class="sticky-col-2" style="background:#f8fafc; color:#059669; border-right:2px solid #475569; font-weight:700; width:95px; min-width:95px; max-width:105px;">8時</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const cnt = grandH8[d];
            const isConflict = (cnt !== 4);
            const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : 'background:#f8fafc; color:#059669;';
            const titleStr = isConflict ? `title="⚠️ 全館8時定数エラー: ${cnt}名（定数: 4名）"` : '';"""

assert old_grand_h8 in text, "old_grand_h8 not found in app.js"
text = text.replace(old_grand_h8, new_grand_h8)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: app.js updated for Master Table South 8h=1, All Floors 8h=4!")
