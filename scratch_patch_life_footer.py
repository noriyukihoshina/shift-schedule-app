# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = "// 1行目: 出勤人数合計（総出勤者数）\n        let footHtml = `;"
if target not in code:
    target = "// 1行目: 出勤人数合計（総出勤者数）\n        let footHtml = `"

life_footer_code = """        // ★ 生活期テーブル専用フッター集計行 (訪問出勤人数合計, 訪問実数合計, 通所出勤人数合計, 通所実数合計, 8時)
        if (isLife) {
            const lifeDates = term.dates || [];
            // 日別集計用
            const vWorkCounts = new Array(NUM_DAYS).fill(0);
            const vRealCounts = new Array(NUM_DAYS).fill(0);
            const tWorkCounts = new Array(NUM_DAYS).fill(0);
            const tRealCounts = new Array(NUM_DAYS).fill(0);
            const h8Counts = new Array(NUM_DAYS).fill(0);

            for (let d = 0; d < NUM_DAYS; d++) {
                for (let s = 0; s < staffList.length; s++) {
                    const st = staffList[s];
                    if (st.isUnused) continue;
                    const row = (currentGrid && currentGrid[s]) ? currentGrid[s] : (grid && grid[s] ? grid[s] : []);
                    const cell = row[d];
                    const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                    if (!sym || isHolidaySymbol(sym) || sym === 'ー') continue;

                    // 実数ウェイト
                    let weight = 1.0;
                    if (st.isZeroCount || sym === '出張') weight = 0.0;
                    else if (st.isHalf || sym.includes('/')) weight = 0.5;

                    const sec = st.lifeSection || '';
                    const isTsusho = (sec === '通所' || sec === 'Cl2');

                    if (isTsusho) {
                        tWorkCounts[d]++;
                        tRealCounts[d] += weight;
                    } else {
                        // 訪問（訪問、管理、Cl1等）
                        vWorkCounts[d]++;
                        vRealCounts[d] += weight;
                    }

                    if (sym === '8時') {
                        h8Counts[d]++;
                    }
                }
            }

            // 合計計算
            const vWorkSum = vWorkCounts.reduce((a, b) => a + b, 0);
            const vRealSum = vRealCounts.reduce((a, b) => a + b, 0);
            const tWorkSum = tWorkCounts.reduce((a, b) => a + b, 0);
            const tRealSum = tRealCounts.reduce((a, b) => a + b, 0);
            const h8Sum = h8Counts.reduce((a, b) => a + b, 0);

            let lifeFootHtml = '';

            // 1. 訪問出勤人数合計
            lifeFootHtml += `<tr style="background:#f8fafc; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="background:#f8fafc; color:#0369a1; font-weight:800;">訪問出勤人数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                lifeFootHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#0369a1;">${vWorkCounts[d]}</td>`;
            }
            lifeFootHtml += `<td style="font-weight:700; color:#0369a1;">${vWorkSum}</td><td colspan="7" style="color:#94a3b8;">-</td></tr>`;

            // 2. 訪問実数合計
            lifeFootHtml += `<tr style="background:#f0f9ff; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="background:#f0f9ff; color:#0284c7; font-weight:800;">訪問実数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                const disp = (vRealCounts[d] % 1 === 0) ? vRealCounts[d] : vRealCounts[d].toFixed(1);
                lifeFootHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#0284c7;">${disp}</td>`;
            }
            const dispVRealSum = (vRealSum % 1 === 0) ? vRealSum : vRealSum.toFixed(1);
            lifeFootHtml += `<td style="font-weight:700; color:#0284c7;">${dispVRealSum}</td><td colspan="7" style="color:#94a3b8;">-</td></tr>`;

            // 3. 通所出勤人数合計
            lifeFootHtml += `<tr style="background:#fefce8; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="background:#fefce8; color:#854d0e; font-weight:800;">通所出勤人数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                lifeFootHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#854d0e;">${tWorkCounts[d]}</td>`;
            }
            lifeFootHtml += `<td style="font-weight:700; color:#854d0e;">${tWorkSum}</td><td colspan="7" style="color:#94a3b8;">-</td></tr>`;

            // 4. 通所実数合計
            lifeFootHtml += `<tr style="background:#fffbeb; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="background:#fffbeb; color:#b45309; font-weight:800;">通所実数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                const disp = (tRealCounts[d] % 1 === 0) ? tRealCounts[d] : tRealCounts[d].toFixed(1);
                lifeFootHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#b45309;">${disp}</td>`;
            }
            const dispTRealSum = (tRealSum % 1 === 0) ? tRealSum : tRealSum.toFixed(1);
            lifeFootHtml += `<td style="font-weight:700; color:#b45309;">${dispTRealSum}</td><td colspan="7" style="color:#94a3b8;">-</td></tr>`;

            // 5. 8時勤務 (平日は定数1名、土日は0名。平日で0名または2名以上なら青網掛けエラー表示！)
            lifeFootHtml += `<tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1 border-thick-bottom" colspan="2" style="color:#334155;">8時</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const di = lifeDates[d];
                const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
                const thickCls = getDayBorderClass(d);
                const h8Val = h8Counts[d];
                const needH8 = isWeekend ? 0 : 1;
                const isH8Mismatch = (h8Val !== needH8);
                const h8Cls = isH8Mismatch ? 'conflict-highlight' : '';
                const h8Title = isH8Mismatch ? `8時人数不一致（現在: ${h8Val}名 / 基準: ${needH8}名）` : `8時: ${h8Val}名`;
                lifeFootHtml += `<td class="${thickCls} ${h8Cls} border-thick-bottom col-day-fixed" data-d="${d}" data-footer-stat="h8" title="${h8Title}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${h8Val}</td>`;
            }
            lifeFootHtml += `<td class="border-thick-bottom" style="font-weight:700; color:#334155;">${h8Sum}</td><td class="border-thick-bottom" colspan="7" style="color:#94a3b8;">-</td></tr>`;

            tfoot.innerHTML = lifeFootHtml;
            const checkTfoot = document.getElementById('checkTableFoot');
            if (checkTfoot && checkTfoot !== tfoot) checkTfoot.innerHTML = lifeFootHtml;
            attachOutputTableEvents();
            return;
        }

        // 1行目: 出勤人数合計（総出勤者数）
        let footHtml = `"""

if '// ★ 生活期テーブル専用フッター集計行' not in code:
    code = code.replace(target, life_footer_code)
    print("Replaced footer with lifeFooter logic")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
