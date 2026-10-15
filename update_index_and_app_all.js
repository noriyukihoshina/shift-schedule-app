// update_index_and_app_all.js
// index.html と app.js を現場要望に完全適合させる総合更新スクリプト

const fs = require('fs');
const path = require('path');

// ========================================================
// 1. index.html の更新
// ========================================================
const indexPath = path.join(__dirname, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// 1-1. 期間設定部の input date を select termSelect + hidden input に更新
const pPeriod = /<span style="font-weight: 700; color: #1e293b;">📅 対象期間:<\/span>\r?\n\s+<label style="color: #64748b;">開始日:<\/label>\r?\n\s+<input type="date" id="termStartDate" value="2026-04-01"[\s\S]*?<\/span>/;

const rPeriod = `<span style="font-weight: 700; color: #1e293b;">📅 対象期間（ターム固定）:</span>
                        <select id="termSelect" style="padding: 4px 8px; border: 1px solid #0284c7; background: #f0f9ff; border-radius: 4px; font-weight: 700; color: #0369a1; font-size: 0.88rem; cursor: pointer;" title="年度ごとの正規13ターム（第1〜12ターム:28日間、第13ターム:29日間）を選択します">
                            <!-- JSで自動投入されます -->
                        </select>
                        <input type="hidden" id="termStartDate" value="2026-04-01">
                        <span style="color: #64748b;">〜 終了日:</span>
                        <span id="termEndDateDisplay" style="font-weight: 700; color: #1e293b;">2026-04-28</span>
                        <span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.85rem;" id="termTitleBadge">第1ターム (4/1～4/28)</span>
                        <span id="termDaysBadge" style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.82rem;">28日間</span>`;

if (pPeriod.test(indexHtml)) {
    indexHtml = indexHtml.replace(pPeriod, rPeriod);
    console.log('index.html: Updated term period controls to termSelect');
} else {
    console.log('index.html: termSelect already present or pattern matched differently');
}

// 1-2. 全3箇所のパレットに「ー」ボタンを追加
const paletteExcludeBtn = `<button class="palette-btn" data-sym="ー" title="勤務対象外（異動・退職等。出勤・公休カウントから完全除外）" style="background:#f1f5f9; border-color:#cbd5e1; color:#64748b; font-weight:800;">ー</button>`;

// 各パレットの <button class="palette-btn selected" data-sym="休" の直前、または <button class="palette-btn" data-sym="CLEAR" の直前に配置
if (!indexHtml.includes('data-sym="ー"')) {
    // 3箇所すべてで <button class="palette-btn selected" data-sym="休" または data-sym="○" の後に挿入
    indexHtml = indexHtml.replace(/(<button class="palette-btn[^"]*" data-sym="○"[^>]*>○<\/button>)/g, `$1\n                    ${paletteExcludeBtn}`);
    console.log('index.html: Added 「ー」 buttons to all palettes');
}

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('index.html: Saved successfully!');

// ========================================================
// 2. app.js の更新
// ========================================================
const appPath = path.join(__dirname, 'app.js');
let appCode = fs.readFileSync(appPath, 'utf8');

// 2-1. normalizeSymbol での「ー」記号の正規化
if (!appCode.includes("['ー', '－', '―', '-', '—'].includes(val)")) {
    const pNorm = /function normalizeSymbol\(val\) \{\r?\n\s+if \(!val\) return '';\r?\n\s+val = val\.toString\(\)\.trim\(\);/;
    const rNorm = `function normalizeSymbol(val) {
        if (!val) return '';
        val = val.toString().trim();
        if (['ー', '－', '―', '-', '—'].includes(val)) return 'ー';`;
    if (pNorm.test(appCode)) {
        appCode = appCode.replace(pNorm, rNorm);
        console.log('app.js: Added ー normalization to normalizeSymbol');
    }
}

// 2-2. タームマスター定義と termSelect 制御関数の追加
if (!appCode.includes('function initTermSelector()')) {
    const termHelperCode = `
    // ==========================================
    // ★ 正規13ターム定義 ＆ セレクター制御
    // ==========================================
    function generateAllTerms() {
        const years = [2025, 2026, 2027];
        const allTerms = [];

        years.forEach(year => {
            let cur = new Date(year, 3, 1); // 4月1日
            for (let t = 1; t <= 12; t++) {
                const sDate = new Date(cur);
                const eDate = new Date(cur);
                eDate.setDate(cur.getDate() + 27);

                const sStr = \`\${sDate.getFullYear()}-\${String(sDate.getMonth() + 1).padStart(2, '0')}-\${String(sDate.getDate()).padStart(2, '0')}\`;
                const eStr = \`\${eDate.getFullYear()}-\${String(eDate.getMonth() + 1).padStart(2, '0')}-\${String(eDate.getDate()).padStart(2, '0')}\`;

                allTerms.push({
                    year,
                    termNo: t,
                    startDate: sStr,
                    endDate: eStr,
                    numDays: 28,
                    isTerm13: false,
                    label: \`【\${year}年度 第\${t}ターム】 \${sDate.getMonth() + 1}/\${sDate.getDate()} 〜 \${eDate.getMonth() + 1}/\${eDate.getDate()} (28日間)\`
                });

                cur.setDate(cur.getDate() + 28);
            }

            // 第13ターム: 3月3日(平年) 〜 3月31日 (29日間・年度末)
            const t13Start = new Date(cur);
            const t13End = new Date(year + 1, 2, 31);
            const diffDays = Math.round((t13End - t13Start) / (1000 * 60 * 60 * 24)) + 1;

            const s13Str = \`\${t13Start.getFullYear()}-\${String(t13Start.getMonth() + 1).padStart(2, '0')}-\${String(t13Start.getDate()).padStart(2, '0')}\`;
            const e13Str = \`\${t13End.getFullYear()}-\${String(t13End.getMonth() + 1).padStart(2, '0')}-\${String(t13End.getDate()).padStart(2, '0')}\`;

            allTerms.push({
                year,
                termNo: 13,
                startDate: s13Str,
                endDate: e13Str,
                numDays: diffDays,
                isTerm13: true,
                label: \`【\${year}年度 第13ターム】 \${t13Start.getMonth() + 1}/\${t13Start.getDate()} 〜 \${t13End.getMonth() + 1}/\${t13End.getDate()} (\${diffDays}日間・年度末調整)\`
            });
        });

        return allTerms;
    }

    const GLOBAL_TERMS = generateAllTerms();

    function findTermByStartDate(startDate) {
        if (!startDate) return GLOBAL_TERMS.find(t => t.startDate === '2026-04-01') || GLOBAL_TERMS[0];
        const match = GLOBAL_TERMS.find(t => t.startDate === startDate);
        if (match) return match;

        // もし一致しない日付の場合、最も近いターム、または自前計算
        const d = new Date(startDate);
        const y = (d.getMonth() + 1 >= 4) ? d.getFullYear() : d.getFullYear() - 1;
        return GLOBAL_TERMS.find(t => t.year === y && t.startDate === startDate) || GLOBAL_TERMS.find(t => t.startDate === '2026-04-01') || GLOBAL_TERMS[0];
    }

    function initTermSelector() {
        const select = document.getElementById('termSelect');
        if (!select) return;

        select.innerHTML = '';
        GLOBAL_TERMS.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.startDate;
            opt.textContent = t.label;
            if (t.startDate === currentWorkingStartDate) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', () => {
            const newDate = select.value;
            if (!newDate || newDate === currentWorkingStartDate) return;

            // 直前の期間データを保存
            saveCurrentTermToStorage(currentWorkingStartDate);

            // 切り替え
            currentWorkingStartDate = newDate;
            const startDateInput = document.getElementById('termStartDate');
            if (startDateInput) startDateInput.value = newDate;

            const term = findTermByStartDate(newDate);
            const stdHolidaySelect = document.getElementById('standardHolidaySelect');
            if (term && term.isTerm13) {
                if (stdHolidaySelect) stdHolidaySelect.value = '8.5';
                showToast(\`📅 \${term.year}年度 第13ターム（年度末 \${term.numDays}日間）を選択しました。公休枠を 8.5日に設定しました。\`);
            } else {
                if (stdHolidaySelect) stdHolidaySelect.value = '8.0';
            }

            if (localStorage.getItem(\`\${STORAGE_KEY_PREFIX}\${newDate}\`)) {
                loadTermFromStorage(newDate);
                showToast(\`📁 期間「\${term.label}」の保存データを読み込みました\`);
            } else {
                resetTermDataKeepStaffSettings();
                showToast(\`🆕 新規期間「\${term.label}」の編集を開始しました\`);
            }
            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
            renderSavedTermsSelect();
        });
    }
`;
    // DOMContentLoaded 内の最初の方に挿入
    appCode = appCode.replace("document.addEventListener('DOMContentLoaded', () => {", "document.addEventListener('DOMContentLoaded', () => {\n" + termHelperCode);
    console.log('app.js: Added initTermSelector and GLOBAL_TERMS');
}

// 2-3. getTermInfo の動的日数（28日 vs 29日）化
const pGetTerm = /function getTermInfo\(explicitStartDate\) \{\r?\n\s+const startDateInput = document\.getElementById\('termStartDate'\);\r?\n\s+const startVal = explicitStartDate \|\| \(startDateInput \? startDateInput\.value : currentWorkingStartDate\);\r?\n\s+const dates = \[\];\r?\n\s+let curDate = parseDateString\(startVal\);\r?\n\s+for \(let i = 0; i < NUM_DAYS; i\+\+\) \{/;

const rGetTerm = `function getTermInfo(explicitStartDate) {
        const startDateInput = document.getElementById('termStartDate');
        const startVal = explicitStartDate || (startDateInput ? startDateInput.value : currentWorkingStartDate);
        const termDef = findTermByStartDate(startVal);
        const numDays = termDef ? termDef.numDays : 28;

        const dates = [];
        let curDate = parseDateString(startVal);
        for (let i = 0; i < numDays; i++) {`;

if (pGetTerm.test(appCode)) {
    appCode = appCode.replace(pGetTerm, rGetTerm);
    console.log('app.js: Updated getTermInfo to use dynamic numDays (28 or 29)');
}

// 2-4. getTermInfo 末尾の return に numDays, isTerm13 を追加
const pGetTermRet = /return \{\r?\n\s+first: dates\[0\],\r?\n\s+last: dates\[NUM_DAYS - 1\],\r?\n\s+title: `\$\{m1\}\/\$\{d1\}～\$\{m2\}\/\$\{d2\}勤務表`,\r?\n\s+badgeText: `\$\{m1\}\/\$\{d1\}～\$\{m2\}\/\$\{d2\}勤務表`,\r?\n\s+dates,\r?\n\s+isRefreshTerm\r?\n\s+\};/;

const rGetTermRet = `return {
            first: dates[0],
            last: dates[dates.length - 1],
            numDays: dates.length,
            isTerm13: (termDef && termDef.isTerm13) || dates.length > 28,
            title: \`\${m1}/\${d1}～\${m2}/\${d2}勤務表\`,
            badgeText: termDef ? \`第\${termDef.termNo}ターム (\${m1}/\${d1}～\${m2}/\${d2})\` : \`\${m1}/\${d1}～\${m2}/\${d2}勤務表\`,
            dates,
            isRefreshTerm
        };`;

if (pGetTermRet.test(appCode)) {
    appCode = appCode.replace(pGetTermRet, rGetTermRet);
    console.log('app.js: Updated getTermInfo return structure');
}

// 2-5. updateTermDisplay に termDaysBadge と termSelect 同期を追加
const pUpdTermDisp = /if \(termTitleBadge\) termTitleBadge\.textContent = term\.badgeText;\r?\n\s+if \(refreshTermBadge\) refreshTermBadge\.style\.display = term\.isRefreshTerm \? 'inline-block' : 'none';/;

const rUpdTermDisp = `if (termTitleBadge) termTitleBadge.textContent = term.badgeText;
        if (refreshTermBadge) refreshTermBadge.style.display = term.isRefreshTerm ? 'inline-block' : 'none';
        const daysBadge = document.getElementById('termDaysBadge');
        if (daysBadge) daysBadge.textContent = \`\${term.numDays}日間\`;
        const termSelect = document.getElementById('termSelect');
        if (termSelect && termSelect.value !== currentWorkingStartDate) {
            termSelect.value = currentWorkingStartDate;
        }`;

if (pUpdTermDisp.test(appCode)) {
    appCode = appCode.replace(pUpdTermDisp, rUpdTermDisp);
    console.log('app.js: Updated updateTermDisplay');
}

// 2-6. downloadBlankXlsx に「ー」追加 ＆ sqref動的化 ＆ 遅延解放
if (!appCode.includes('上5,下1,下2,下3,ー&quot;')) {
    appCode = appCode.replace(
        '&quot;休,有,○,出,早,遅,E,8時,ハヤ,オソ,イブ,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3&quot;',
        '&quot;休,有,○,出,早,遅,E,8時,ハヤ,オソ,イブ,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3,ー&quot;'
    );
    console.log('app.js: Added ー to downloadBlankXlsx dataValidation list');
}

// sqref 動的化
const pSqref = /sqref="C4:AD\$\{maxRow\}"/;
if (pSqref.test(appCode)) {
    appCode = appCode.replace(pSqref, 'sqref=`C4:${toColLetter(2 + term.dates.length)}${maxRow}`');
    console.log('app.js: Updated sqref in downloadBlankXlsx to dynamic col');
}

// downloadBlankXlsx の遅延解放
const pBlankDownload = /document\.body\.appendChild\(link\);\r?\n\s+link\.click\(\);\r?\n\s+document\.body\.removeChild\(link\);/;
const rBlankDownload = `document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 2000);`;

if (pBlankDownload.test(appCode)) {
    appCode = appCode.replace(pBlankDownload, rBlankDownload);
    console.log('app.js: Added delayed cleanup to downloadBlankXlsx');
}

// 2-7. exportExcelSpreadsheet の遅延解放
const pExportDownload = /document\.body\.appendChild\(link\);\r?\n\s+link\.click\(\);\r?\n\s+document\.body\.removeChild\(link\);\r?\n\s+showToast\('📊 本物のExcelファイル/;
const rExportDownload = `document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 2000);
        showToast('📊 本物のExcelファイル`;

if (pExportDownload.test(appCode)) {
    appCode = appCode.replace(pExportDownload, rExportDownload);
    console.log('app.js: Added delayed cleanup to exportExcelSpreadsheet');
}

// 2-8. 初期起動時の initTermSelector 呼び出し
if (!appCode.includes('initTermSelector();')) {
    appCode = appCode.replace('initStaffData();', 'initTermSelector();\n    initStaffData();');
    console.log('app.js: Added initTermSelector() call in startup');
}

fs.writeFileSync(appPath, appCode, 'utf8');
console.log('app.js: Saved successfully!');
