// update_app_ui_and_excel.js
// app.js の UI（トグル新設、備考列表示、実数計算案B）を適用するスクリプト

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let code = fs.readFileSync(appPath, 'utf8');

function replaceRegex(str, pattern, replacement, label) {
    if (!pattern.test(str)) {
        console.error('ERROR: Pattern not found for ' + label);
        process.exit(1);
    }
    return str.replace(pattern, replacement);
}

// 1. renderInputTable の thead (役職削除 -> 係長、主任、副主任、0.5、専従、備考列追加)
const pHeadRoles = /<th class="flag-col" rowspan="2" title="役職（毎日2名以上必要・出張除く）" style="background:#fef3c7; color:#92400e;">役職<\/th>\r?\n\s+<th class="flag-col" rowspan="2" title="専従（毎日3名以上必要・出張除く）" style="background:#dcfce7; color:#166534;">専従<\/th>\r?\n\s+<th class="flag-col" rowspan="2" title="6連勤例外許可（週6勤務＆6連勤を許容）" style="background:#fee2e2; color:#991b1b;">6連勤<br>可<\/th>/;

const rHeadRoles = `<th class="flag-col" rowspan="2" title="係長（基本平日5連勤、不在時主任1名以上出勤）" style="background:#fef3c7; color:#92400e;">係長</th>
                <th class="flag-col" rowspan="2" title="主任（係長不在時に1名以上出勤）" style="background:#fef9c3; color:#854d0e;">主任</th>
                <th class="flag-col" rowspan="2" title="副主任（係長主任不在時A1名B1名出勤）" style="background:#e0f2fe; color:#0369a1;">副主任</th>
                <th class="flag-col" rowspan="2" title="0.5（実数合計計算時に0.5人で計算）" style="background:#f3e8ff; color:#6b21a8; font-weight:800;">0.5</th>
                <th class="flag-col" rowspan="2" title="専従（毎日3名以上必要・出張除く）" style="background:#dcfce7; color:#166534;">専従</th>
                <th class="flag-col" rowspan="2" title="6連勤例外許可（週6勤務＆6連勤を許容）" style="background:#fee2e2; color:#991b1b;">6連勤<br>可</th>
                <th class="flag-col" rowspan="2" title="改姓・旧姓（前タームの氏名）" style="background:#f1f5f9; color:#475569; min-width:80px;">旧姓</th>
                <th class="remarks-col" rowspan="2" title="委員会等のメモ（ExcelのAG列と自動連携）" style="background:#f8fafc; color:#1e293b; min-width:220px; max-width:320px;">備考（メモ）</th>`;

code = replaceRegex(code, pHeadRoles, rHeadRoles, 'renderInputTable thead roles');

// 2. renderInputTable の tbody (トグルスイッチ群 + 備考入力欄)
const pBodyRoles = /<td class="flag-col" style="background:#fefce8;">[\s\S]*?data-flag="allow6Consec"[\s\S]*?<\/td>/;

const rBodyRoles = `<td class="flag-col" style="background:#fefce8;">
                    <label class="toggle-switch" title="係長">
                        <input type="checkbox" \${staff.isSectionChief ? 'checked' : ''} data-flag="isSectionChief" data-s="\${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#fef9c3;">
                    <label class="toggle-switch" title="主任">
                        <input type="checkbox" \${staff.isChief ? 'checked' : ''} data-flag="isChief" data-s="\${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#e0f2fe;">
                    <label class="toggle-switch" title="副主任">
                        <input type="checkbox" \${staff.isSubChief ? 'checked' : ''} data-flag="isSubChief" data-s="\${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#f3e8ff;">
                    <label class="toggle-switch" title="0.5（実数計算で0.5人換算）">
                        <input type="checkbox" \${staff.isHalf ? 'checked' : ''} data-flag="isHalf" data-s="\${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#f0fdf4;">
                    <label class="toggle-switch" title="専従">
                        <input type="checkbox" \${staff.isFullTime ? 'checked' : ''} data-flag="isFullTime" data-s="\${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#fef2e2;">
                    <label class="toggle-switch" title="6連勤可">
                        <input type="checkbox" \${staff.allow6Consec ? 'checked' : ''} data-flag="allow6Consec" data-s="\${sIdx}">
                        <span class="toggle-slider danger-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#f8fafc; padding:2px;">
                    <input type="text" class="staff-prevname-input" data-s="\${sIdx}" value="\${staff.prevName || ''}" placeholder="旧姓" title="改姓前の前ターム氏名を入力すると過去履歴が引き継がれます" style="width:100%; border:1px solid #cbd5e1; border-radius:3px; padding:2px 4px; font-size:0.75rem; text-align:center;">
                </td>
                <td class="remarks-col" style="padding:2px 4px;">
                    <input type="text" class="staff-remarks-input" data-s="\${sIdx}" value="\${staff.remarks || ''}" placeholder="委員会・用事等のメモ" style="width:100%; border:1px solid #cbd5e1; border-radius:3px; padding:2px 6px; font-size:0.78rem; background:white;">
                </td>`;

code = replaceRegex(code, pBodyRoles, rBodyRoles, 'renderInputTable tbody roles');

// 3. attachInputTableEvents に staff-prevname-input と staff-remarks-input のイベントリスナーを追加
const pAttachEvents = /document\.querySelectorAll\('\.staff-name-input'\)\.forEach\(input => \{\r?\n[\s\S]*?\}\);\r?\n\s+\}\);/;

const rAttachEvents = `document.querySelectorAll('.staff-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                if (staffList[s] && staffList[s].name !== e.target.value) {
                    pushHistory();
                    staffList[s].name = e.target.value.trim() || \`スタッフ \${String(s + 1).padStart(2, '0')}\`;
                    saveCurrentTermToStorage();
                }
            });
        });

        document.querySelectorAll('.staff-prevname-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                if (staffList[s]) {
                    pushHistory();
                    staffList[s].prevName = e.target.value.trim();
                    saveCurrentTermToStorage();
                }
            });
        });

        document.querySelectorAll('.staff-remarks-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                if (staffList[s]) {
                    pushHistory();
                    staffList[s].remarks = e.target.value.trim();
                    saveCurrentTermToStorage();
                    if (lastSolveResult && lastSolveResult.grid) {
                        renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
                    }
                }
            });
        });`;

code = replaceRegex(code, pAttachEvents, rAttachEvents, 'attachInputTableEvents prevname and remarks');

// 4. renderOutputTable のヘッダーと各行に「備考（メモ）」列を追加
const pOutHead8 = /<th title="8時開始回数" class="border-thick-bottom" style="background:#f1f5f9;">8時<\/th>\r?\n\s+<\/tr>/;
const rOutHead8 = `<th title="8時開始回数" class="border-thick-bottom" style="background:#f1f5f9;">8時</th>
                <th title="委員会・用事等の備考メモ" class="border-thick-bottom" style="background:#f8fafc; color:#1e293b; min-width:220px; max-width:320px;">備考（メモ）</th>
            </tr>`;
code = replaceRegex(code, pOutHead8, rOutHead8, 'renderOutputTable thead remarks');

const pOutBody8 = /<td class="stat-cell \$\{rowBottomCls\}" data-s="\$\{s\}" data-stat="h8" style="font-weight:600; color:#334155; background:transparent;">\$\{staffStat\.h8\}<\/td>\r?\n\s+`;/;
const rOutBody8 = `<td class="stat-cell \${rowBottomCls}" data-s="\${s}" data-stat="h8" style="font-weight:600; color:#334155; background:transparent;">\${staffStat.h8}</td>
                <td class="remarks-cell \${rowBottomCls}" style="min-width:220px; max-width:320px; text-align:left; font-size:0.8rem; color:#475569; padding:2px 8px; white-space:normal; word-break:break-all; background:transparent;">\${staff.remarks || ''}</td>
            \`;`;
code = replaceRegex(code, pOutBody8, rOutBody8, 'renderOutputTable tbody remarks');

// 5. renderOutputTable フッター実数合計の案B計算式
const pOutFootReal = /const totalRealSum = stats\.daily\.reduce\(\(sum, dStat, d\) => sum \+ \(dStat\.totalWork - \(\(dayOffsets && dayOffsets\[d\]\) \|\| 0\)\), 0\);\r?\n\s+footHtml \+= `\r?\n\s+<tr style="background:#f8fafc; font-weight:bold;">\r?\n\s+<th class="sticky-col-1" colspan="2" style="color:#1e293b;" title="[\s\S]*?<\/tr>`;/;

const rOutFootReal = `// 2行目: 実数合計（案B: 出勤実働 - 増員分。減員時は実数変更なし）
        const totalRealSum = stats.daily.reduce((sum, dStat) => sum + (dStat.realWork !== undefined ? dStat.realWork : dStat.totalWork), 0);
        footHtml += \`
            <tr style="background:#f8fafc; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="color:#1e293b;" title="行事等の出勤加減枠を除いた実際のリハビリ業務稼働人数（案B: 増員分のみ減算、減員時は変更なし）">実数合計</th>
        \`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            const real = dStat.realWork !== undefined ? dStat.realWork : dStat.totalWork;
            footHtml += \`<td class="\${thickCls}" style="vertical-align:middle; font-weight:800; color:#1e293b; font-size:0.95rem;">\${real}</td>\`;
        }
        footHtml += \`<td style="font-weight:700; color:#1e293b;">\${totalRealSum}</td><td colspan="8" style="color:#94a3b8;">-</td></tr>\`;`;

code = replaceRegex(code, pOutFootReal, rOutFootReal, 'renderOutputTable foot realWork');

// 出勤人数合計フッター末尾の colspan も調整（8 -> 9）
code = code.replace(/<td colspan="7" style="color:#94a3b8;">-<\/td><\/tr>`/g, '<td colspan="8" style="color:#94a3b8;">-</td></tr>`');

// 6. generateExcelTableHtml (HTMLコピー) の実数計算式 (案B: offset > 0 のみ減算)
const pCopyReal = /const fReal = offset === 0 \? `=INDIRECT\("\$\{col\}"&\(ROW\(\)-1\)\)` : `=INDIRECT\("\$\{col\}"&\(ROW\(\)-1\)\)-\(\$\{offset\}\)`;/;
const rCopyReal = `const fReal = (offset > 0) ? \`=INDIRECT("\${col}"&(ROW()-1))-(\${offset})\` : \`=INDIRECT("\${col}"&(ROW()-1))\`;`;
code = replaceRegex(code, pCopyReal, rCopyReal, 'generateExcelTableHtml fReal');

// 7. exportExcelSpreadsheet (OpenXML) の実数計算式 (案B: offset > 0 のみ減算)
const pXmlReal = /const fReal = offset === 0 \? `\$\{col\}\$\{rWork\}` : `\$\{col\}\$\{rWork\}-\(\$\{offset\}\)`;/;
const rXmlReal = `const fReal = (offset > 0) ? \`\${col}\${rWork}-(\${offset})\` : \`\${col}\${rWork}\`;`;
code = replaceRegex(code, pXmlReal, rXmlReal, 'exportExcelSpreadsheet fReal');

fs.writeFileSync(appPath, code, 'utf8');
console.log('SUCCESS: update_app_ui_and_excel.js finished phase 2!');
