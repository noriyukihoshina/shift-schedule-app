import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 早番の過不足判定＆網掛けクラス付与
old_early_td = """footHtml += `<td class="${thickCls} col-day-fixed" data-d="${d}" data-footer-stat="early" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${earlyVal}</td>`;"""
new_early_td = """
            const needEarly = isSouth ? 2 : (isST || isLife ? null : 3);
            const isEarlyMismatch = (needEarly !== null && earlyVal !== needEarly);
            const earlyCls = isEarlyMismatch ? 'conflict-highlight' : '';
            const earlyTitle = isEarlyMismatch ? `早番人数不一致（現在: ${earlyVal}名 / 基準: ${needEarly}名）` : `早番: ${earlyVal}名`;
            footHtml += `<td class="${thickCls} ${earlyCls} col-day-fixed" data-d="${d}" data-footer-stat="early" title="${earlyTitle}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${earlyVal}</td>`;"""

text = text.replace(old_early_td, new_early_td, 1)

# 遅番の過不足判定＆網掛けクラス付与
old_late_td = """footHtml += `<td class="${thickCls} col-day-fixed" data-d="${d}" data-footer-stat="late" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${lateVal}</td>`;"""
new_late_td = """
            const needLate = isSouth ? 2 : (isST || isLife ? null : 1);
            const isLateMismatch = (needLate !== null && lateVal !== needLate);
            const lateCls = isLateMismatch ? 'conflict-highlight' : '';
            const lateTitle = isLateMismatch ? `遅番人数不一致（現在: ${lateVal}名 / 基準: ${needLate}名）` : `遅番: ${lateVal}名`;
            footHtml += `<td class="${thickCls} ${lateCls} col-day-fixed" data-d="${d}" data-footer-stat="late" title="${lateTitle}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${lateVal}</td>`;"""

text = text.replace(old_late_td, new_late_td, 1)

# イブニング(E)の過不足判定＆網掛けクラス付与
old_eve_td = """footHtml += `<td class="${thickCls} col-day-fixed" data-d="${d}" data-footer-stat="eve" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${eveVal}</td>`;"""
new_eve_td = """
            const needEve = isSouth ? 2 : (isST || isLife ? null : 2);
            const isEveMismatch = (needEve !== null && eveVal !== needEve);
            const eveCls = isEveMismatch ? 'conflict-highlight' : '';
            const eveTitle = isEveMismatch ? `イブニング人数不一致（現在: ${eveVal}名 / 基準: ${needEve}名）` : `イブニング: ${eveVal}名`;
            footHtml += `<td class="${thickCls} ${eveCls} col-day-fixed" data-d="${d}" data-footer-stat="eve" title="${eveTitle}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${eveVal}</td>`;"""

text = text.replace(old_eve_td, new_eve_td, 1)

# 8時勤務の過不足判定＆網掛けクラス付与
old_h8_td = """footHtml += `<td class="${thickCls} border-thick-bottom col-day-fixed" data-d="${d}" data-footer-stat="h8" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${dStat.h8}</td>`;"""
new_h8_td = """
            const h8Val = dStat.h8;
            const needH8 = (!isST) ? 1 : null;
            const isH8Mismatch = (needH8 !== null && h8Val !== needH8);
            const h8Cls = isH8Mismatch ? 'conflict-highlight' : '';
            const h8Title = isH8Mismatch ? `8時人数不一致（現在: ${h8Val}名 / 基準: ${needH8}名）` : `8時: ${h8Val}名`;
            footHtml += `<td class="${thickCls} ${h8Cls} border-thick-bottom col-day-fixed" data-d="${d}" data-footer-stat="h8" title="${h8Title}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${h8Val}</td>`;"""

text = text.replace(old_h8_td, new_h8_td, 1)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Added conflict-highlight mismatch styling to all special duty footer rows (Early, Late, Eve, 8h).")
