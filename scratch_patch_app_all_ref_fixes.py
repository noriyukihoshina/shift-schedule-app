# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. renderCheckTable の削除・置換
t1 = """        if (isLife && tabId === 'checkTab') {
            // 生活期は基本勤務表がそのまま完成版のため、checkTableに自動同期描画！
            if (lastSolveResult && lastSolveResult.grid) {
                renderCheckTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        }"""
r1 = """        if (isLife && tabId === 'checkTab') {
            // 生活期は基本勤務表がそのまま完成版のため、checkTableに自動同期描画！
            if (lastSolveResult && lastSolveResult.grid) {
                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        }"""
content = content.replace(t1, r1, 1)

t2 = """                        renderOutputTable(result.grid, result.stats);
                        if (isLife) {
                            renderCheckTable(result.grid, result.stats);
                        }"""
r2 = """                        renderOutputTable(result.grid, result.stats);"""
content = content.replace(t2, r2, 1)

t3 = """                                renderOutputTable(forceResult.grid, forceResult.stats);
                                if (isLife) {
                                    renderCheckTable(forceResult.grid, forceResult.stats);
                                }"""
r3 = """                                renderOutputTable(forceResult.grid, forceResult.stats);"""
content = content.replace(t3, r3, 1)

print("1. renderCheckTable calls cleaned up.")

# 2. リフレッシュ休暇判定ヘルパー関数の追加（app.jsの先頭付近または記号判定関数の近く）
# isRefreshHolidaySymbol を定義
ref_fn = """// ★ リフレッシュ休暇記号判定（上1〜5、下1〜3。これらはいかなる場合も赤字固定にせず通常黒字！）
function isRefreshHolidaySymbol(sym) {
    if (!sym || typeof sym !== 'string') return false;
    const cleanSym = sym.trim();
    if (['上1', '上2', '上3', '上4', '上5', '下1', '下2', '下3'].includes(cleanSym)) return true;
    if (cleanSym.startsWith('上') || cleanSym.startsWith('下') || cleanSym.includes('リフ')) return true;
    return false;
}
"""

if 'function isRefreshHolidaySymbol' not in content:
    content = ref_fn + "\n" + content
    print("2. isRefreshHolidaySymbol helper added.")

# 3. renderInputTable (行 2085 付近) でのリフレッシュ休暇黒字化
# const val = staff.days[d] || '';
# const isAutoRef = autoAssignedRefKeys.has(`${curStartDate}:${sIdx},${d}`);
# const isFixed = val ? (!isAutoRef) : false;
# const cls = isFixed ? 'day-cell fixed-cell' : (val ? 'day-cell auto-ref-cell' : 'day-cell');
t_input = """            for (let d = 0; d < NUM_DAYS; d++) {
                const val = staff.days[d] || '';
                const isAutoRef = autoAssignedRefKeys.has(`${curStartDate}:${sIdx},${d}`);
                // ★ ユーザー指示: 自動配分されたリフ「上1」は赤字固定ではなく通常黒字（編集自由）！
                const isFixed = val ? (!isAutoRef) : false;
                const cls = isFixed ? 'day-cell fixed-cell' : (val ? 'day-cell auto-ref-cell' : 'day-cell');"""

r_input = """            for (let d = 0; d < NUM_DAYS; d++) {
                const val = staff.days[d] || '';
                const isRef = isRefreshHolidaySymbol(val);
                // ★ ユーザー指示: リフレッシュ休暇「上1〜5」「下1〜3」はいかなる場合も赤字固定にせず通常黒字（編集自由）！
                const isFixed = (val && !isRef) ? true : false;
                const cls = isFixed ? 'day-cell fixed-cell' : (val ? 'day-cell auto-ref-cell' : 'day-cell');"""

content = content.replace(t_input, r_input, 1)
print("3. renderInputTable updated for black ref cells.")

# 4. renderOutputTable (行 4825 付近) でのリフレッシュ休暇黒字化
t_output = """                for (let d = 0; d < NUM_DAYS; d++) {
                    const cell = grid[s][d];
                    const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                    const isAutoRef = cell.isAutoAssignedRef || autoAssignedRefKeys.has(`${curStartDate}:${s},${d}`);
                    const isCellFixed = cell.isFixed && !isAutoRef;
                    const cls = isCellFixed ? 'day-cell fixed-cell' : (isAutoRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');"""

r_output = """                for (let d = 0; d < NUM_DAYS; d++) {
                    const cell = grid[s][d];
                    const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                    const isRef = isRefreshHolidaySymbol(displaySym) || isRefreshHolidaySymbol(cell.symbol);
                    // ★ ユーザー指示: リフレッシュ休暇「上1」等は希望と同じ赤字にせず、通常黒字（auto-ref-cell）！
                    const isCellFixed = cell.isFixed && !isRef;
                    const cls = isCellFixed ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');"""

content = content.replace(t_output, r_output, 1)
print("4. renderOutputTable updated for black ref cells.")

# 5. renderTable (行 4760 付近と 4794 付近) での黒字化
t_tbl1 = """                    for (let d = 0; d < NUM_DAYS; d++) {
                        const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '' };
                        const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                        const cls = cell.isFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';"""

r_tbl1 = """                    for (let d = 0; d < NUM_DAYS; d++) {
                        const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '' };
                        const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                        const isRef = isRefreshHolidaySymbol(displaySym) || isRefreshHolidaySymbol(cell.symbol);
                        const isFixedCell = cell.isFixed && !isRef;
                        const cls = isFixedCell ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');"""

content = content.replace(t_tbl1, r_tbl1, 1)

t_tbl2 = """                    for (let d = 0; d < NUM_DAYS; d++) {
                        const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '' };
                        const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                        const cls = cell.isFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';
                        const thickCls = getDayBorderClass(d);
                        bodyHtml += `<td class="${cls} ${thickCls}" data-s="${s}" data-d="${d}">${displaySym}</td>`;
                    }"""

r_tbl2 = """                    for (let d = 0; d < NUM_DAYS; d++) {
                        const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '' };
                        const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                        const isRef = isRefreshHolidaySymbol(displaySym) || isRefreshHolidaySymbol(cell.symbol);
                        const isFixedCell = cell.isFixed && !isRef;
                        const cls = isFixedCell ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');
                        const thickCls = getDayBorderClass(d);
                        bodyHtml += `<td class="${cls} ${thickCls}" data-s="${s}" data-d="${d}">${displaySym}</td>`;
                    }"""

content = content.replace(t_tbl2, r_tbl2, 1)
print("5. renderTable updated for black ref cells.")

# 6. ST連携行 (行 2450 付近と 4895 付近) での黒字化
t_st1 = """                    const originalWish = (st.days && st.days[d]) ? st.days[d] : '';
                    const isCellFixed = !!(
                        (originalWish !== '' && originalWish === sym) ||
                        (c && c.isFixed && originalWish !== '')
                    );
                    const cellCls = isCellFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';"""

r_st1 = """                    const originalWish = (st.days && st.days[d]) ? st.days[d] : '';
                    const isRef = isRefreshHolidaySymbol(sym) || isRefreshHolidaySymbol(originalWish);
                    const isCellFixed = !isRef && !!(
                        (originalWish !== '' && originalWish === sym) ||
                        (c && c.isFixed && originalWish !== '')
                    );
                    const cellCls = isCellFixed ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');"""

content = content.replace(t_st1, r_st1, 2) # 2箇所
print("6. ST rows updated for black ref cells.")

# 7. ハーフマン行 (行 4968 付近) での黒字化
t_ha = """                    const isCellFixed = (c && typeof c === 'object') ? !!c.isFixed : false;
                    const cellCls = isCellFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';"""

r_ha = """                    const isRef = isRefreshHolidaySymbol(sym);
                    const isCellFixed = !isRef && ((c && typeof c === 'object') ? !!c.isFixed : false);
                    const cellCls = isCellFixed ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');"""

content = content.replace(t_ha, r_ha, 1)
print("7. Halfman row updated for black ref cells.")

# 8. マスターテーブル (行 6281 付近) での黒字化
t_master = """                    const isCellFixed = !!(
                        (originalWish !== '' && originalWish === sym) ||
                        (cell && typeof cell === 'object' && cell.isFixed && originalWish !== '')
                    );

                    const color = isCellFixed ? '#dc2626' : '#334155';
                    const bg = '#ffffff';

                    const fixedCls = isCellFixed ? 'fixed-cell' : 'auto-cell';"""

r_master = """                    const isRef = isRefreshHolidaySymbol(sym) || isRefreshHolidaySymbol(originalWish);
                    const isCellFixed = !isRef && !!(
                        (originalWish !== '' && originalWish === sym) ||
                        (cell && typeof cell === 'object' && cell.isFixed && originalWish !== '')
                    );

                    const color = isCellFixed ? '#dc2626' : (isRef ? '#0f172a' : '#334155');
                    const bg = '#ffffff';

                    const fixedCls = isCellFixed ? 'fixed-cell' : (isRef ? 'auto-ref-cell' : 'auto-cell');"""

content = content.replace(t_master, r_master, 1)
print("8. Master table updated for black ref cells.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("All app.js patches applied successfully.")
