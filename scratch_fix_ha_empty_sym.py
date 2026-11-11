# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = """                for (let d = 0; d < numDays; d++) {
                    const c = gridRow ? gridRow[d] : null;
                    let sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || (st.days ? st.days[d] : ''));
                    if (!sym) {
                        const dInfo = (term && term.dates && term.dates[d]) ? term.dates[d] : null;
                        const wDay = dInfo ? dInfo.weekday : (d % 7 === 5 ? '土' : (d % 7 === 6 ? '日' : '月'));
                        if (def.isWeekendOff) {
                            sym = (wDay === '土' || wDay === '日') ? '休' : '○';
                        } else {
                            sym = (wDay === '日') ? '休' : '○';
                        }
                    }"""

replacement = """                for (let d = 0; d < numDays; d++) {
                    const c = gridRow ? gridRow[d] : null;
                    // ★ ユーザー指示: まだ組んでいない時（gridRowが空、またはセルが空欄）は出勤とみなさず加算しない！
                    // 実際に生活期テーブルで自動生成・確定された出勤記号がある場合のみ加算！
                    let sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');"""

if target in code:
    code = code.replace(target, replacement)
    print("Fixed ha empty sym fallback in renderMasterIntegrationView")
else:
    print("Target not found directly, checking...")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved app.js")
