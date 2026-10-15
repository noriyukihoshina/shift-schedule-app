// update_app_features.js
// app.js の現場要望（0.5刻み増減、実数合計案B、係長・主任・副主任・0.5トグル、氏名キー照合、備考AG列、パスワード等）を一括反映するスクリプト

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

// 1. APP_CONFIG と STORAGE_KEY_PREFIX の動的化
const pStorageKey = /const STORAGE_KEY_PREFIX = 'shift_schedule_term_';\r?\n\s+const STORAGE_KEY_LAST_ACTIVE = 'shift_schedule_last_active_start_date';\r?\n\s+const STORAGE_KEY_SAVED_TERMS = 'shift_schedule_saved_terms';/;

const rStorageKey = `// ★ 部署別設定 (APP_CONFIG) に対応したストレージキー動的生成
    const appConfig = window.APP_CONFIG || { deptId: 'master', deptName: 'マスター統括', password: '77777' };
    const deptPrefix = appConfig.deptId ? \`\${appConfig.deptId}_\` : '';
    const STORAGE_KEY_PREFIX = \`shift_schedule_\${deptPrefix}term_\`;
    const STORAGE_KEY_LAST_ACTIVE = \`shift_schedule_\${deptPrefix}last_active_start_date\`;
    const STORAGE_KEY_SAVED_TERMS = \`shift_schedule_\${deptPrefix}saved_terms\`;
    const STORAGE_KEY_STAFF_MASTER = \`shift_schedule_\${deptPrefix}staff_master\`;`;

code = replaceRegex(code, pStorageKey, rStorageKey, 'storage keys');

// 2. initStaffData での新トグルプロパティ追加
const pInitStaff = /isRole: \(i <= 6\),\s+\/\/ ★ 役職[\s\S]*?days: new Array\(NUM_DAYS\)\.fill\(''\)\r?\n\s+\}\);/;

const rInitStaff = `isSectionChief: (i === 1),  // ★ 係長（平日5連勤、不在時主任出勤）
                isChief: (i === 2 || i === 3),       // ★ 主任（係長不在時に1名以上出勤）
                isSubChief: (i === 4 || i === 5),    // ★ 副主任（係長主任不在時A1名B1名出勤）
                isHalf: false,                       // ★ 0.5（出勤実数を0.5人換算）
                isFullTime: (i <= 10),               // ★ 専従
                allow6Consec: false,                 // ★ 6連勤可
                prevName: '',                        // ★ 旧姓（改姓時の引き継ぎ用）
                remarks: '',                         // ★ 備考メモ（AG列）
                prevDays: ['', '', '', '', ''],
                days: new Array(NUM_DAYS).fill('')
            });`;

code = replaceRegex(code, pInitStaff, rInitStaff, 'initStaffData');

// 3. saveCurrentTermToStorage / loadTermFromStorage でのプロパティ保存・復元
const pSaveStaffList = /isRole: s\.isRole,\r?\n\s+isFullTime: s\.isFullTime,/;
const rSaveStaffList = `isSectionChief: !!s.isSectionChief,
                    isChief: !!s.chief || !!s.isChief,
                    isSubChief: !!s.isSubChief,
                    isHalf: !!s.isHalf,
                    isFullTime: s.isFullTime,
                    prevName: s.prevName || '',
                    remarks: s.remarks || '',`;

code = replaceRegex(code, pSaveStaffList, rSaveStaffList, 'saveCurrentTermToStorage staffList');

const pLoadStaffList = /staffList\[idx\]\.isRole = s\.isRole;\r?\n\s+staffList\[idx\]\.isFullTime = s\.isFullTime;/;
const rLoadStaffList = `staffList[idx].isSectionChief = !!s.isSectionChief;
                    staffList[idx].isChief = !!s.isChief;
                    staffList[idx].isSubChief = !!s.isSubChief;
                    staffList[idx].isHalf = !!s.isHalf;
                    staffList[idx].isFullTime = s.isFullTime;
                    staffList[idx].prevName = s.prevName || '';
                    staffList[idx].remarks = s.remarks || '';`;

code = replaceRegex(code, pLoadStaffList, rLoadStaffList, 'loadTermFromStorage staffList');

// 4. saveCurrentTermToStorage の引数対応
const pSaveFunc = /function saveCurrentTermToStorage\(\) \{\r?\n\s+try \{\r?\n\s+const startDateInput = document\.getElementById\('termStartDate'\);\r?\n\s+const startDate = startDateInput \? startDateInput\.value : currentWorkingStartDate;/;

const rSaveFunc = `function saveCurrentTermToStorage(explicitDate) {
        try {
            const startDateInput = document.getElementById('termStartDate');
            const startDate = explicitDate || (startDateInput ? startDateInput.value : currentWorkingStartDate);`;

code = replaceRegex(code, pSaveFunc, rSaveFunc, 'saveCurrentTermToStorage signature');

// 5. termStartDateInput change イベントでの安全保存（直前の日付キーで保存）
const pTermChange = /termStartDateInput\.addEventListener\('change', \(\) => \{\r?\n\s+const newDate = termStartDateInput\.value;\r?\n\s+if \(!newDate \|\| newDate === currentWorkingStartDate\) return;\r?\n\s+\/\/ 1\.[\s\S]*?saveCurrentTermToStorage\(\);/;

const rTermChange = `termStartDateInput.addEventListener('change', () => {
            const newDate = termStartDateInput.value;
            if (!newDate || newDate === currentWorkingStartDate) return;

            // 1. 直前の期間データをその日付キーで安全に保存！
            saveCurrentTermToStorage(currentWorkingStartDate);`;

code = replaceRegex(code, pTermChange, rTermChange, 'termStartDate change event');

// 6. renderDayOffsetCtrl と setDayOffset の 0.5刻み化
const pOffsetCtrl = /function renderDayOffsetCtrl\(d\) \{\r?\n\s+const val = dayOffsets\[d\] \|\| 0;\r?\n\s+const valText = val > 0 \? `\+\$\{val\}` : \(val < 0 \? `\$\{val\}` : '±0'\);\r?\n\s+const cls = val > 0 \? 'offset-pos' : \(val < 0 \? 'offset-neg' : ''\);\r?\n\s+return `\r?\n\s+<div class="day-offset-ctrl"[\s\S]*?<\/div>\r?\n\s+`;\r?\n\s+\}/;

const rOffsetCtrl = `function renderDayOffsetCtrl(d) {
        const rawVal = dayOffsets[d] || 0;
        const val = Math.round(rawVal * 10) / 10;
        const valText = val > 0 ? \`+\${val}\` : (val < 0 ? \`\${val}\` : '±0');
        const cls = val > 0 ? 'offset-pos' : (val < 0 ? 'offset-neg' : '');
        return \`
            <div class="day-offset-ctrl" data-d="\${d}" title="この日の出勤加減枠（0.5刻み、例: 行事で+0.5、減員で-0.5）" style="display:inline-flex; align-items:center; gap:2px;">
                <button type="button" class="day-offset-btn offset-minus" data-d="\${d}" title="出勤人数を-0.5" style="width:16px; height:16px; font-size:10px; line-height:1; padding:0;">-</button>
                <span class="day-offset-val \${cls}" data-d="\${d}" style="min-width:28px; font-size:0.75rem; font-weight:700; text-align:center;">\${valText}</span>
                <button type="button" class="day-offset-btn offset-plus" data-d="\${d}" title="出勤人数を+0.5" style="width:16px; height:16px; font-size:10px; line-height:1; padding:0;">+</button>
            </div>
        \`;
    }`;

code = replaceRegex(code, pOffsetCtrl, rOffsetCtrl, 'renderDayOffsetCtrl');

const pSetOffset = /function setDayOffset\(d, delta\) \{\r?\n\s+if \(d < 0 \|\| d >= NUM_DAYS\) return;\r?\n\s+pushHistory\(\);\r?\n\s+const cur = dayOffsets\[d\] \|\| 0;\r?\n\s+dayOffsets\[d\] = Math\.max\(-10, Math\.min\(10, cur \+ delta\)\);/;

const rSetOffset = `function setDayOffset(d, delta) {
        if (d < 0 || d >= NUM_DAYS) return;
        pushHistory();
        const cur = dayOffsets[d] || 0;
        // 0.5刻みで加減算
        const nextVal = Math.round((cur + delta) * 10) / 10;
        dayOffsets[d] = Math.max(-10, Math.min(10, nextVal));`;

code = replaceRegex(code, pSetOffset, rSetOffset, 'setDayOffset');

// イベントでの delta を 0.5 に
code = code.replace(/setDayOffset\(d, -1\);/g, 'setDayOffset(d, -0.5);');
code = code.replace(/setDayOffset\(d, 1\);/g, 'setDayOffset(d, 0.5);');

// 7. applyPreviousTermHistory の氏名キー照合改修
const pApplyPrev = /for \(let s = 0; s < NUM_STAFF; s\+\+\) \{\r?\n\s+if \(!staffList\[s\]\) continue;\r?\n\s+let last5 = \['', '', '', '', ''\];\r?\n\s+\/\/ 優先1: 作成済み勤務表[\s\S]*?staffList\[s\]\.prevDays = \[\.\.\.last5\];\r?\n\s+if \(last5\.some\(v => v !== ''\)\) appliedCount\+\+;\r?\n\s+\}/;

const rApplyPrev = `// 前タームのスタッフを氏名（正規化）でマップ化
            const prevStaffByName = new Map();
            if (Array.isArray(prevData.staffList)) {
                prevData.staffList.forEach((pst, pIdx) => {
                    const normName = (pst.name || '').trim();
                    if (!normName) return;
                    let last5 = ['', '', '', '', ''];
                    if (prevData.outputGrid && prevData.outputGrid[pIdx] && prevData.outputGrid[pIdx].length >= NUM_DAYS) {
                        const row = prevData.outputGrid[pIdx];
                        last5 = [
                            row[NUM_DAYS - 5]?.symbol || '',
                            row[NUM_DAYS - 4]?.symbol || '',
                            row[NUM_DAYS - 3]?.symbol || '',
                            row[NUM_DAYS - 2]?.symbol || '',
                            row[NUM_DAYS - 1]?.symbol || ''
                        ];
                    } else if (Array.isArray(pst.days)) {
                        last5 = [
                            pst.days[NUM_DAYS - 5] || '',
                            pst.days[NUM_DAYS - 4] || '',
                            pst.days[NUM_DAYS - 3] || '',
                            pst.days[NUM_DAYS - 2] || '',
                            pst.days[NUM_DAYS - 1] || ''
                        ];
                    }
                    prevStaffByName.set(normName, last5);
                });
            }

            for (let s = 0; s < NUM_STAFF; s++) {
                if (!staffList[s]) continue;
                const curName = (staffList[s].name || '').trim();
                const prevName = (staffList[s].prevName || '').trim();

                // 照合優先: 1. 現在の氏名、2. 改姓・旧姓（prevName）
                let last5 = prevStaffByName.get(curName) || (prevName ? prevStaffByName.get(prevName) : null);
                if (last5) {
                    staffList[s].prevDays = [...last5];
                    if (last5.some(v => v !== '')) appliedCount++;
                } else {
                    // 過去に該当名がない新規中途採用等のスタッフ
                    staffList[s].prevDays = ['', '', '', '', ''];
                }
            }`;

code = replaceRegex(code, pApplyPrev, rApplyPrev, 'applyPreviousTermHistory name matching');

// 8. 空白勤務表ExcelダウンロードのAG列幅を 1300ピクセル（width="162"）に設定
const pColAG = /<col min="33" max="33" width="16" customWidth="1"\/>/;
const rColAG = `<col min="33" max="33" width="162" customWidth="1"/>`;
code = replaceRegex(code, pColAG, rColAG, 'downloadBlankXlsx AG column width');

// 9. parseXlsxBuffer での AG列（列33）備考の抽出
const pParseCol = /if \(isNewLayout\) \{\r?\n\s+\/\/ 新レイアウト: スタッフ行 4〜[\s\S]*?staffIdx = row - 4;\r?\n\s+dayIdx = col - 3;\r?\n\s+\}/;

const rParseCol = `if (isNewLayout) {
                // 新レイアウト: スタッフ行 4〜 (最大 4 + NUM_STAFF - 1), 日付列 C〜AD (列 3〜30)
                if (row >= 4 && row <= (3 + NUM_STAFF) && col >= 3 && col <= 30) {
                    staffIdx = row - 4;
                    dayIdx = col - 3;
                }
                // ★ 列33 (AG列) は備考欄！
                if (row >= 4 && row <= (3 + NUM_STAFF) && col === 33) {
                    const stIdx = row - 4;
                    let memoText = '';
                    const t = c.getAttribute('t');
                    if (t === 's') {
                        const vNode = c.getElementsByTagName('v')[0];
                        if (vNode) memoText = sharedStrings[parseInt(vNode.textContent, 10)] || '';
                    } else if (t === 'inlineStr') {
                        const isNode = c.getElementsByTagName('is')[0];
                        if (isNode) memoText = isNode.textContent || '';
                    } else {
                        const vNode = c.getElementsByTagName('v')[0];
                        if (vNode) memoText = vNode.textContent || '';
                    }
                    if (memoText && staffList[stIdx]) {
                        staffList[stIdx].remarks = memoText.trim();
                    }
                }
            }`;

code = replaceRegex(code, pParseCol, rParseCol, 'parseXlsxBuffer AG column parsing');

fs.writeFileSync(appPath, code, 'utf8');
console.log('SUCCESS: update_app_features.js finished phase 1!');
