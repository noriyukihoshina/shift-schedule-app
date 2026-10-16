// fix_all_4_issues.js
// ユーザー指摘の4項目を完全に修正するスクリプト
// 1. トグルの記憶漏れ（変更後保存・マスター優先統合・Undo/Redo保持・Excel経由の別PC引き継ぎ）
// 2. 右側コメント（備考欄）の文字化け修正（Excel <rPh> ふりがな除去・_x000D_除去・28/29日列位置自動判定・Shift-JIS自動判定）
// 3. 「係長」「主任」「副主任」トグルの択一（排他制御）化
// 4. 13ターム選択プルダウンの完全動作化（initTermSelector呼出・initNewTerm修正・NUM_DAYS動的化）

const fs = require('fs');
const path = require('path');

// ============================================================
// 1. index.html の修正
// ============================================================
const indexPath = path.join(__dirname, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// 13タームの初期 <option> リスト生成（JS読込前でも即座に表示・選択可能にする）
function buildInitialTermOptionsHtml() {
    const years = [2025, 2026, 2027];
    let opts = '';
    years.forEach(year => {
        let cur = new Date(year, 3, 1);
        for (let t = 1; t <= 12; t++) {
            const sDate = new Date(cur);
            const eDate = new Date(cur);
            eDate.setDate(cur.getDate() + 27);
            const sStr = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}`;
            const label = `【${year}年度 第${t}ターム】 ${sDate.getMonth() + 1}/${sDate.getDate()} 〜 ${eDate.getMonth() + 1}/${eDate.getDate()} (28日間)`;
            const sel = (sStr === '2026-04-01') ? ' selected' : '';
            opts += `\n                            <option value="${sStr}"${sel}>${label}</option>`;
            cur.setDate(cur.getDate() + 28);
        }
        const t13Start = new Date(cur);
        const t13End = new Date(year + 1, 2, 31);
        const diffDays = Math.round((t13End - t13Start) / (1000 * 60 * 60 * 24)) + 1;
        const s13Str = `${t13Start.getFullYear()}-${String(t13Start.getMonth() + 1).padStart(2, '0')}-${String(t13Start.getDate()).padStart(2, '0')}`;
        const label13 = `【${year}年度 第13ターム】 ${t13Start.getMonth() + 1}/${t13Start.getDate()} 〜 ${t13End.getMonth() + 1}/${t13End.getDate()} (${diffDays}日間・年度末調整)`;
        opts += `\n                            <option value="${s13Str}">${label13}</option>`;
    });
    return opts;
}

// 1-1. termSelect 周辺の重複バッジ整理と初期オプション投入
const termBlockRegex = /<span style="font-weight: 700; color: #1e293b;">📅 対象期間（ターム固定）:<\/span>[\s\S]*?<span id="refreshTermBadge"[^>]*>🌴 リフ対象月<\/span>/;
const cleanTermBlock = `<span style="font-weight: 700; color: #1e293b;">📅 対象期間（ターム固定）:</span>
                        <select id="termSelect" style="padding: 4px 8px; border: 1px solid #0284c7; background: #f0f9ff; border-radius: 4px; font-weight: 700; color: #0369a1; font-size: 0.88rem; cursor: pointer;" title="年度ごとの正規13ターム（第1〜12ターム:28日間、第13ターム:29日間）を選択します">${buildInitialTermOptionsHtml()}
                        </select>
                        <input type="hidden" id="termStartDate" value="2026-04-01">
                        <span style="color: #64748b;">〜 終了日:</span>
                        <span id="termEndDateDisplay" style="font-weight: 700; color: #1e293b;">2026-04-28</span>
                        <span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.85rem;" id="termTitleBadge">第1ターム (4/1～4/28)</span>
                        <span id="termDaysBadge" style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.82rem;">28日間</span>
                        <span id="refreshTermBadge" style="display:none; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.82rem;">🌴 リフ対象月</span>`;

if (termBlockRegex.test(indexHtml)) {
    indexHtml = indexHtml.replace(termBlockRegex, cleanTermBlock);
    console.log('index.html: Cleaned up termSelect block and populated initial 13-term options');
} else {
    throw new Error('Could not find termBlockRegex in index.html');
}

// 1-2. outputTab と checkTab の「ー」パレットボタンに適切なクラスを付与
indexHtml = indexHtml.replace(
    /(<button class="palette-btn output-palette-btn" data-sym="○"[^>]*>○<\/button>\s*)<button class="palette-btn" data-sym="ー"/,
    '$1<button class="palette-btn output-palette-btn" data-sym="ー"'
);
indexHtml = indexHtml.replace(
    /(<button class="palette-btn check-palette-btn" data-sym="○"[^>]*>○<\/button>\s*)<button class="palette-btn" data-sym="ー"/,
    '$1<button class="palette-btn check-palette-btn" data-sym="ー"'
);

// 1-3. キャッシュバスターを rev25 に更新
indexHtml = indexHtml.replace(/solver\.js\?v=[^"]+/, 'solver.js?v=20261016_rev25');
indexHtml = indexHtml.replace(/app\.js\?v=[^"]+/, 'app.js?v=20261016_rev25');

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('index.html updated successfully.');

// ============================================================
// 2. app.js の修正
// ============================================================
const appPath = path.join(__dirname, 'app.js');
let appCode = fs.readFileSync(appPath, 'utf8');

// 2-1. NUM_DAYS を const から let に変更（第13タームの29日間に動的追従させるため）
appCode = appCode.replace('const NUM_DAYS = 28;', 'let NUM_DAYS = 28;');

// 2-2. テキストサニタイズ＆役職択一制御＆initTermSelector＆saveStaffMaster/loadStaffMaster の刷新
const oldHeaderBlockStart = appCode.indexOf('// ★ 正規13ターム定義 ＆ セレクター制御');
const oldHeaderBlockEnd = appCode.indexOf('// ★ 部署別パスワード認証モーダル制御');
if (oldHeaderBlockStart === -1 || oldHeaderBlockEnd === -1) {
    throw new Error('Could not locate header block in app.js');
}

const newHeaderBlock = `// ★ 正規13ターム定義 ＆ セレクター制御
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

        // もし一致しない日付の場合、その日付が含まれるタームまたは最も近いタームを返す
        const targetTime = new Date(startDate + 'T00:00:00').getTime();
        if (!isNaN(targetTime)) {
            for (const t of GLOBAL_TERMS) {
                const sTime = new Date(t.startDate + 'T00:00:00').getTime();
                const eTime = new Date(t.endDate + 'T23:59:59').getTime();
                if (targetTime >= sTime && targetTime <= eTime) {
                    return t;
                }
            }
        }
        return GLOBAL_TERMS.find(t => t.startDate === '2026-04-01') || GLOBAL_TERMS[0];
    }

    // ★ コメント（備考欄）や氏名の文字化け・制御文字・Excel改行エスケープを除去するサニタイザ
    function cleanTextValue(val) {
        if (val === undefined || val === null) return '';
        return String(val)
            .replace(/_x000[dDaA]_/g, ' ')
            .replace(/\\uFFFD/g, '')
            .replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/g, '')
            .replace(/[\\r\\n]+/g, ' ')
            .trim();
    }

    function escapeHtmlText(val) {
        return cleanTextValue(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeXmlText(val) {
        return cleanTextValue(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // ★ 「係長」「主任」「副主任」の択一（排他）制御ヘルパー
    function enforceRoleExclusivity(staff, preferredFlag = null) {
        if (!staff) return;
        const roleFlags = ['isSectionChief', 'isChief', 'isSubChief'];
        if (preferredFlag && roleFlags.includes(preferredFlag) && staff[preferredFlag]) {
            roleFlags.forEach(rf => {
                if (rf !== preferredFlag) staff[rf] = false;
            });
            return;
        }
        // 優先指定がない場合は 係長 > 主任 > 副主任 の優先順で1つのみに絞る
        if (staff.isSectionChief) {
            staff.isChief = false;
            staff.isSubChief = false;
        } else if (staff.isChief) {
            staff.isSubChief = false;
        }
    }

    let termSelectorInitialized = false;
    function initTermSelector() {
        const select = document.getElementById('termSelect');
        if (!select) return;

        const curStart = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        select.innerHTML = '';
        GLOBAL_TERMS.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.startDate;
            opt.textContent = t.label;
            if (t.startDate === curStart) opt.selected = true;
            select.appendChild(opt);
        });

        if (termSelectorInitialized) return;
        termSelectorInitialized = true;

        select.addEventListener('change', () => {
            const newDate = select.value;
            if (!newDate || newDate === currentWorkingStartDate) return;

            // 直前の期間データとスタッフマスターを確実に保存
            saveStaffMaster();
            saveCurrentTermToStorage(currentWorkingStartDate);

            // 新しい期間に切り替え
            currentWorkingStartDate = newDate;
            const startDateInput = document.getElementById('termStartDate');
            if (startDateInput) startDateInput.value = newDate;

            const term = findTermByStartDate(newDate);
            const stdHolidaySelect = document.getElementById('standardHolidaySelect');

            if (localStorage.getItem(\`\${STORAGE_KEY_PREFIX}\${newDate}\`)) {
                loadTermFromStorage(newDate);
                if (term && term.isTerm13 && stdHolidaySelect && stdHolidaySelect.value === '8.0') {
                    stdHolidaySelect.value = '8.5';
                    saveCurrentTermToStorage(newDate);
                }
                showToast(\`📁 期間「\${term ? term.label : newDate}」の保存データを読み込みました\`);
            } else {
                initNewTerm(newDate);
                if (term && term.isTerm13) {
                    showToast(\`📅 \${term.year}年度 第13ターム（年度末 \${term.numDays}日間）を選択しました（公休枠: 8.5日）\`);
                } else {
                    showToast(\`🆕 新規期間「\${term ? term.label : newDate}」の編集を開始しました\`);
                }
            }
            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
            renderSavedTermsSelect();
        });
    }

    // ★ スタッフ属性マスターの保存（タームを切り替えても・リロードしてもトグルや設定を完全維持）
    function saveStaffMaster() {
        try {
            const masterList = staffList.map(s => {
                enforceRoleExclusivity(s);
                return {
                    id: s.id,
                    name: cleanTextValue(s.name),
                    isUnused: !!s.isUnused,
                    section: s.section || '',
                    can8: !!s.can8,
                    noEarly: !!s.noEarly,
                    noLate: !!s.noLate,
                    noEve: !!s.noEve,
                    canSched: !!s.canSched,
                    isSectionChief: !!s.isSectionChief,
                    isChief: !!s.isChief,
                    isSubChief: !!s.isSubChief,
                    isHalf: !!s.isHalf,
                    isFullTime: !!s.isFullTime,
                    allow6Consec: !!s.allow6Consec,
                    prevName: cleanTextValue(s.prevName || ''),
                    remarks: cleanTextValue(s.remarks || '')
                };
            });
            localStorage.setItem(STORAGE_KEY_STAFF_MASTER, JSON.stringify(masterList));
        } catch (e) {
            console.error('スタッフマスターの保存に失敗:', e);
        }
    }

    function applyMasterArrayToStaffList(masterList) {
        if (!Array.isArray(masterList)) return false;
        masterList.forEach((ms, idx) => {
            if (staffList[idx] && ms) {
                staffList[idx].name = cleanTextValue(ms.name) || staffList[idx].name;
                staffList[idx].isUnused = ms.isUnused !== undefined ? !!ms.isUnused : staffList[idx].isUnused;
                staffList[idx].section = ms.section || '';
                staffList[idx].can8 = ms.can8 !== undefined ? !!ms.can8 : staffList[idx].can8;
                staffList[idx].noEarly = !!ms.noEarly;
                staffList[idx].noLate = !!ms.noLate;
                staffList[idx].noEve = !!ms.noEve;
                staffList[idx].canSched = ms.canSched !== undefined ? !!ms.canSched : staffList[idx].canSched;
                staffList[idx].isSectionChief = !!ms.isSectionChief;
                staffList[idx].isChief = !!(ms.isChief || ms.chief);
                staffList[idx].isSubChief = !!ms.isSubChief;
                staffList[idx].isHalf = !!ms.isHalf;
                staffList[idx].isFullTime = ms.isFullTime !== undefined ? !!ms.isFullTime : staffList[idx].isFullTime;
                staffList[idx].allow6Consec = !!ms.allow6Consec;
                staffList[idx].prevName = cleanTextValue(ms.prevName || '');
                staffList[idx].remarks = cleanTextValue(ms.remarks || '');
                enforceRoleExclusivity(staffList[idx]);
            }
        });
        return true;
    }

    function loadStaffMaster() {
        try {
            let raw = localStorage.getItem(STORAGE_KEY_STAFF_MASTER);
            if (!raw) {
                // 旧キーからのフォールバック救済
                raw = localStorage.getItem('shift_schedule_staff_master');
            }
            if (!raw) return false;
            const masterList = JSON.parse(raw);
            return applyMasterArrayToStaffList(masterList);
        } catch (e) {
            console.error('スタッフマスターの読込に失敗:', e);
            return false;
        }
    }

    `;

appCode = appCode.substring(0, oldHeaderBlockStart) + newHeaderBlock + appCode.substring(oldHeaderBlockEnd);
console.log('app.js: Replaced header block (initTermSelector, saveStaffMaster, loadStaffMaster, enforceRoleExclusivity)');

// 2-3. loadTermFromStorage の改善（旧キーフォールバック + NUM_DAYS動的化 + loadStaffMasterマージ + 択一保証）
const loadTermStart = appCode.indexOf('function loadTermFromStorage(startDate) {');
const findPrevStart = appCode.indexOf('// 直前ターム（終了日が新ターム開始日の前日');
if (loadTermStart === -1 || findPrevStart === -1) {
    throw new Error('Could not find loadTermFromStorage in app.js');
}

const newLoadTermCode = `function loadTermFromStorage(startDate) {
        try {
            let raw = localStorage.getItem(\`\${STORAGE_KEY_PREFIX}\${startDate}\`);
            if (!raw) {
                // 旧ストレージキー（病棟プレフィックス導入前）からの自動引き継ぎ救済
                raw = localStorage.getItem(\`shift_schedule_term_\${startDate}\`);
            }
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !data.staffList) return false;

            // 日付セット & 期間タイトル・NUM_DAYS更新を先に行う
            const targetStart = data.startDate || startDate;
            const dateInput = document.getElementById('termStartDate');
            if (dateInput) dateInput.value = targetStart;
            currentWorkingStartDate = targetStart;
            const term = getTermInfo();

            // 1. 公休日数（第13タームはデフォルト8.5、明示保存があればそれを優先）
            const stdSel = document.getElementById('standardHolidaySelect');
            if (stdSel) {
                const valNum = parseFloat(data.standardHolidays);
                if (valNum === 8.5) stdSel.value = '8.5';
                else if (valNum === 9.0) stdSel.value = '9.0';
                else if (term.isTerm13 && !data.standardHolidays) stdSel.value = '8.5';
                else stdSel.value = '8.0';
            }

            // 2. スタッフのターム固有データ（prevDays, days）および基本属性の復元
            data.staffList.forEach((s, idx) => {
                if (staffList[idx]) {
                    staffList[idx].name = cleanTextValue(s.name) || staffList[idx].name;
                    staffList[idx].isUnused = s.isUnused !== undefined ? !!s.isUnused : (idx >= 48);
                    staffList[idx].section = s.section || '';
                    staffList[idx].can8 = s.can8 !== undefined ? !!s.can8 : staffList[idx].can8;
                    staffList[idx].noEarly = !!s.noEarly;
                    staffList[idx].noLate = !!s.noLate;
                    staffList[idx].noEve = !!s.noEve;
                    staffList[idx].canSched = s.canSched !== undefined ? !!s.canSched : staffList[idx].canSched;
                    staffList[idx].isSectionChief = !!s.isSectionChief;
                    staffList[idx].isChief = !!(s.isChief || s.chief);
                    staffList[idx].isSubChief = !!s.isSubChief;
                    staffList[idx].isHalf = !!s.isHalf;
                    staffList[idx].isFullTime = s.isFullTime !== undefined ? !!s.isFullTime : staffList[idx].isFullTime;
                    staffList[idx].prevName = cleanTextValue(s.prevName || '');
                    staffList[idx].remarks = cleanTextValue(s.remarks || '');
                    staffList[idx].allow6Consec = !!s.allow6Consec;
                    enforceRoleExclusivity(staffList[idx]);

                    staffList[idx].prevDays = Array.isArray(s.prevDays) ? [...s.prevDays] : ['', '', '', '', ''];
                    const loadedDays = Array.isArray(s.days) ? [...s.days] : [];
                    while (loadedDays.length < NUM_DAYS) loadedDays.push('');
                    staffList[idx].days = loadedDays.slice(0, NUM_DAYS);
                }
            });

            // ★ スタッフマスターが存在する場合は、トグル・役職・所属・氏名等のマスター設定を最優先で同期！
            // （ただしターム固有の備考 remarks が入っている場合は残し、空ならマスターの remarks を使用）
            const remarksBackup = staffList.map(st => st.remarks);
            if (loadStaffMaster()) {
                staffList.forEach((st, idx) => {
                    if (remarksBackup[idx] && !st.remarks) {
                        st.remarks = remarksBackup[idx];
                    }
                });
            } else {
                // マスター未作成なら現在の状態でマスターを初期保存
                saveStaffMaster();
            }

            // 2.5 日別出勤増減枠（dayOffsets）の復元
            const defaultOffsets = createDefaultDayOffsets(term.dates);
            if (Array.isArray(data.dayOffsets) && data.dayOffsets.length >= 28) {
                const hasAnyNonZero = data.dayOffsets.some(v => v !== 0);
                if (!hasAnyNonZero) {
                    dayOffsets = [...defaultOffsets];
                } else {
                    dayOffsets = [...data.dayOffsets];
                    while (dayOffsets.length < NUM_DAYS) {
                        dayOffsets.push(defaultOffsets[dayOffsets.length] || 0);
                    }
                    dayOffsets = dayOffsets.slice(0, NUM_DAYS);
                }
            } else {
                dayOffsets = [...defaultOffsets];
            }

            // 4. 入力テーブル描画
            renderInputTable();

            // 5. 出力テーブル復元
            if (data.outputGrid && Array.isArray(data.outputGrid)) {
                const stdVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                const scheduler = new ShiftScheduler(staffList, {
                    standardHolidays: stdVal,
                    dates: term.dates,
                    dayOffsets: [...dayOffsets]
                });
                scheduler.grid = data.outputGrid.map(row => {
                    const rCopy = Array.isArray(row) ? row.map(c => ({ ...c })) : [];
                    while (rCopy.length < NUM_DAYS) rCopy.push({ symbol: '', isFixed: false });
                    return rCopy.slice(0, NUM_DAYS);
                });
                const newStats = scheduler.calculateStats();
                lastScheduler = scheduler;
                lastSolveResult = {
                    success: true,
                    grid: scheduler.grid,
                    stats: newStats
                };
                renderOutputTable(lastSolveResult.grid, newStats);
                renderStatsDashboard(newStats);
            } else {
                lastSolveResult = null;
                lastScheduler = null;
                clearOutputTables();
            }

            // 6. タブ復元
            if (data.activeTab && document.getElementById(data.activeTab)) {
                switchTab(data.activeTab);
            }

            undoStack.length = 0;
            redoStack.length = 0;
            updateUndoRedoUI();
            clearConflictHighlights();

            updateSaveStatusUI(new Date(data.updatedAt || Date.now()));
            renderSavedTermsSelect();
            return true;
        } catch (err) {
            console.error('復元に失敗しました:', err);
            return false;
        }
    }

    `;

appCode = appCode.substring(0, loadTermStart) + newLoadTermCode + appCode.substring(findPrevStart);
console.log('app.js: Updated loadTermFromStorage');

// 2-4. initNewTerm, getHistorySnapshot, restoreHistoryState の改善
const initNewTermStart = appCode.indexOf('function initNewTerm(newStartDate) {');
const updateUndoRedoStart = appCode.indexOf('function updateUndoRedoUI() {');
if (initNewTermStart === -1 || updateUndoRedoStart === -1) {
    throw new Error('Could not find initNewTerm or updateUndoRedoUI in app.js');
}

const newInitAndHistoryCode = `function initNewTerm(newStartDate) {
        const dateInput = document.getElementById('termStartDate');
        if (dateInput) dateInput.value = newStartDate;
        currentWorkingStartDate = newStartDate;

        // 先に getTermInfo() を呼んで NUM_DAYS (28 or 29) を確定させる
        const term = getTermInfo();

        // スタッフ基本設定マスターを引き継ぎ復元！
        loadStaffMaster();
        staffList.forEach(s => {
            enforceRoleExclusivity(s);
            s.prevDays = ['', '', '', '', ''];
            s.days = new Array(NUM_DAYS).fill('');
        });
        autoAssignedRefKeys.clear();
        autoAssignedStaffIds.clear();
        lastSolveResult = null;
        lastScheduler = null;

        // ★ 公休枠制限: 第13ターム（29日間）なら 8.5日、通常ターム（28日間）なら 8.0日
        const stdHolidaySelect = document.getElementById('standardHolidaySelect');
        if (stdHolidaySelect) {
            stdHolidaySelect.value = term.isTerm13 ? '8.5' : '8.0';
        }

        dayOffsets = createDefaultDayOffsets(term.dates);

        // ★ 直前タームが存在すれば、その最終5日間の勤務実績を自動連携！
        const prevTerm = findPreviousTerm(newStartDate);
        if (prevTerm) {
            applyPreviousTermHistory(prevTerm, false);
        }

        renderInputTable();
        clearOutputTables();
        switchTab('inputTab');

        undoStack.length = 0;
        redoStack.length = 0;
        updateUndoRedoUI();
        clearConflictHighlights();

        saveStaffMaster();
        saveCurrentTermToStorage();

        if (prevTerm) {
            const pD = new Date(prevTerm + 'T00:00:00');
            const pTermDef = findTermByStartDate(prevTerm);
            const pDays = pTermDef ? pTermDef.numDays : 28;
            const pEndD = new Date(pD);
            pEndD.setDate(pEndD.getDate() + (pDays - 1));
            const pTitle = \`\${pD.getMonth() + 1}/\${pD.getDate()}～\${pEndD.getMonth() + 1}/\${pEndD.getDate()}\`;
            showToast(\`🆕 新規期間（\${term.title}）を開始しました（直前 \${pTitle} の最終5日実績を自動入力済）\`);
        }
        renderSavedTermsSelect();
    }

    // ==========================================
    // ★ 戻る（Undo） / やり直す（Redo） 履歴管理
    // ==========================================
    const MAX_HISTORY = 50;
    const undoStack = [];
    const redoStack = [];

    function getHistorySnapshot() {
        return {
            staffList: staffList.map(s => ({
                id: s.id,
                name: s.name,
                isUnused: !!s.isUnused,
                section: s.section || '',
                can8: !!s.can8,
                noEarly: !!s.noEarly,
                noLate: !!s.noLate,
                noEve: !!s.noEve,
                canSched: !!s.canSched,
                isSectionChief: !!s.isSectionChief,
                isChief: !!s.isChief,
                isSubChief: !!s.isSubChief,
                isHalf: !!s.isHalf,
                isFullTime: !!s.isFullTime,
                allow6Consec: !!s.allow6Consec,
                prevName: s.prevName || '',
                remarks: s.remarks || '',
                prevDays: [...s.prevDays],
                days: [...s.days]
            })),
            startDate: document.getElementById('termStartDate')?.value || currentWorkingStartDate,
            outputGrid: (lastSolveResult && lastSolveResult.grid) ? lastSolveResult.grid.map(row => row.map(c => ({ ...c }))) : null
        };
    }

    function pushHistory() {
        undoStack.push(getHistorySnapshot());
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        redoStack.length = 0; // 新規操作時はredoをクリア
        updateUndoRedoUI();
        saveCurrentTermToStorage();
    }

    function undo() {
        if (undoStack.length === 0) return;
        redoStack.push(getHistorySnapshot());
        const prevState = undoStack.pop();
        restoreHistoryState(prevState);
        updateUndoRedoUI();
        saveStaffMaster();
        saveCurrentTermToStorage();
        showToast('↩ 直前の状態に戻しました');
    }

    function redo() {
        if (redoStack.length === 0) return;
        undoStack.push(getHistorySnapshot());
        const nextState = redoStack.pop();
        restoreHistoryState(nextState);
        updateUndoRedoUI();
        saveStaffMaster();
        saveCurrentTermToStorage();
        showToast('↪ やり直しました');
    }

    function restoreHistoryState(state) {
        if (!state) return;
        if (state.startDate) {
            const startDateInput = document.getElementById('termStartDate');
            if (startDateInput && startDateInput.value !== state.startDate) {
                startDateInput.value = state.startDate;
                currentWorkingStartDate = state.startDate;
                getTermInfo();
            }
        }
        if (state.staffList) {
            state.staffList.forEach((s, idx) => {
                if (staffList[idx]) {
                    staffList[idx].name = cleanTextValue(s.name) || staffList[idx].name;
                    staffList[idx].isUnused = s.isUnused !== undefined ? !!s.isUnused : (idx >= 48);
                    staffList[idx].section = s.section || '';
                    staffList[idx].can8 = !!s.can8;
                    staffList[idx].noEarly = !!s.noEarly;
                    staffList[idx].noLate = !!s.noLate;
                    staffList[idx].noEve = !!s.noEve;
                    staffList[idx].canSched = !!s.canSched;
                    staffList[idx].isSectionChief = !!s.isSectionChief;
                    staffList[idx].isChief = !!s.isChief;
                    staffList[idx].isSubChief = !!s.isSubChief;
                    staffList[idx].isHalf = !!s.isHalf;
                    staffList[idx].isFullTime = !!s.isFullTime;
                    staffList[idx].allow6Consec = !!s.allow6Consec;
                    staffList[idx].prevName = cleanTextValue(s.prevName || '');
                    staffList[idx].remarks = cleanTextValue(s.remarks || '');
                    enforceRoleExclusivity(staffList[idx]);
                    staffList[idx].prevDays = [...s.prevDays];
                    staffList[idx].days = [...s.days];
                }
            });
        }
        // 出力シートの復元
        if (state.outputGrid && lastSolveResult) {
            lastSolveResult.grid = state.outputGrid.map(row => row.map(c => ({ ...c })));
            if (lastScheduler) {
                lastScheduler.grid = lastSolveResult.grid;
                const newStats = lastScheduler.calculateStats();
                lastSolveResult.stats = newStats;
                renderOutputTable(lastSolveResult.grid, newStats);
                renderStatsDashboard(newStats);
            } else {
                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        }
        renderInputTable();

        const activeTab = document.querySelector('.tab-panel.active')?.id;
        if (activeTab === 'outputTab') {
            checkWorkAreaConstraints(false);
        } else if (activeTab === 'checkTab') {
            checkFinalConstraints(false);
        } else if (activeTab === 'inputTab') {
            checkInputConstraints(false);
        }
    }

    `;

appCode = appCode.substring(0, initNewTermStart) + newInitAndHistoryCode + appCode.substring(updateUndoRedoStart);
console.log('app.js: Updated initNewTerm, getHistorySnapshot, restoreHistoryState');

// 2-5. renderInputTable の HTML属性エスケープ ＆ attachInputTableEvents のトグル保存・役職択一制御
appCode = appCode.replace(
    '<input type="text" class="staff-name-input" value="${staff.name}"',
    '<input type="text" class="staff-name-input" value="${escapeHtmlText(staff.name)}"'
);
appCode = appCode.replace(
    '<input type="text" class="staff-prevname-input" data-s="${sIdx}" value="${staff.prevName || \'\'}"',
    '<input type="text" class="staff-prevname-input" data-s="${sIdx}" value="${escapeHtmlText(staff.prevName || \'\')}"'
);
appCode = appCode.replace(
    '<input type="text" class="staff-remarks-input" data-s="${sIdx}" value="${staff.remarks || \'\'}"',
    '<input type="text" class="staff-remarks-input" data-s="${sIdx}" value="${escapeHtmlText(staff.remarks || \'\')}"'
);

const attachEventsStart = appCode.indexOf('function attachInputTableEvents() {');
const dayCellClickStart = appCode.indexOf("document.querySelectorAll('.day-cell').forEach(cell => {");
if (attachEventsStart === -1 || dayCellClickStart === -1) {
    throw new Error('Could not find attachInputTableEvents in app.js');
}

const newAttachEventsHead = `function attachInputTableEvents() {
        document.querySelectorAll('.staff-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const newName = cleanTextValue(e.target.value) || \`スタッフ \${String(s + 1).padStart(2, '0')}\`;
                if (staffList[s] && staffList[s].name !== newName) {
                    pushHistory();
                    staffList[s].name = newName;
                    e.target.value = newName;
                    saveStaffMaster();
                    saveCurrentTermToStorage();
                }
            });
        });

        document.querySelectorAll('.staff-prevname-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                if (staffList[s]) {
                    pushHistory();
                    staffList[s].prevName = cleanTextValue(e.target.value);
                    e.target.value = staffList[s].prevName;
                    saveStaffMaster();
                    saveCurrentTermToStorage();
                }
            });
        });

        document.querySelectorAll('.staff-remarks-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                if (staffList[s]) {
                    pushHistory();
                    staffList[s].remarks = cleanTextValue(e.target.value);
                    e.target.value = staffList[s].remarks;
                    saveStaffMaster();
                    saveCurrentTermToStorage();
                    if (lastSolveResult && lastSolveResult.grid) {
                        renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
                    }
                }
            });
        });

        // 不使用トグルのイベント（変更後に必ずマスター＆ターム保存！）
        document.querySelectorAll('input[type="checkbox"][data-unused]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                pushHistory();
                staffList[s].isUnused = e.target.checked;
                const tr = e.target.closest('tr');
                if (tr) {
                    if (e.target.checked) tr.classList.add('row-unused');
                    else tr.classList.remove('row-unused');
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        // セクション排他トグルのイベント（変更後に必ずマスター＆ターム保存！）
        document.querySelectorAll('input[type="checkbox"][data-section]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const sec = e.target.dataset.section;
                pushHistory();
                if (e.target.checked) {
                    staffList[s].section = sec;
                    document.querySelectorAll(\`input[type="checkbox"][data-section][data-s="\${s}"]\`).forEach(other => {
                        if (other !== e.target) other.checked = false;
                    });
                } else {
                    if (staffList[s].section === sec) {
                        staffList[s].section = '';
                    }
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        // 各属性フラグトグルのイベント（「係長」「主任」「副主任」は択一排他制御＋変更後に必ず保存！）
        const exclusiveRoleFlags = ['isSectionChief', 'isChief', 'isSubChief'];
        document.querySelectorAll('input[type="checkbox"][data-flag]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const flag = e.target.dataset.flag;
                pushHistory();
                staffList[s][flag] = e.target.checked;

                // ★「係長」「主任」「副主任」は択一（1人が複数役職を同時に持たない）
                if (e.target.checked && exclusiveRoleFlags.includes(flag)) {
                    exclusiveRoleFlags.forEach(otherFlag => {
                        if (otherFlag !== flag) {
                            staffList[s][otherFlag] = false;
                            const otherChk = document.querySelector(\`input[type="checkbox"][data-flag="\${otherFlag}"][data-s="\${s}"]\`);
                            if (otherChk) otherChk.checked = false;
                        }
                    });
                }

                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        `;

appCode = appCode.substring(0, attachEventsStart) + newAttachEventsHead + appCode.substring(dayCellClickStart);
console.log('app.js: Updated attachInputTableEvents (immediate save + exclusive role toggles)');

// 2-6. getTermInfo() の動的日数（28日/29日）対応と UI完全同期
const getTermInfoStart = appCode.indexOf('function getTermInfo() {');
const termStartDateInputMarker = appCode.indexOf("const termStartDateInput = document.getElementById('termStartDate');");
if (getTermInfoStart === -1 || termStartDateInputMarker === -1) {
    throw new Error('Could not find getTermInfo in app.js');
}

const newGetTermInfo = `function getTermInfo(explicitStartDate) {
        const input = document.getElementById('termStartDate');
        const startStr = explicitStartDate || (input && input.value ? input.value : (currentWorkingStartDate || '2026-04-01'));
        const termDef = findTermByStartDate(startStr);
        const activeNumDays = (termDef && termDef.numDays) ? termDef.numDays : 28;
        NUM_DAYS = activeNumDays;

        // staffList の days 配列長を NUM_DAYS に安全同期
        if (Array.isArray(staffList)) {
            staffList.forEach(s => {
                if (Array.isArray(s.days)) {
                    while (s.days.length < NUM_DAYS) s.days.push('');
                }
            });
        }

        const parts = startStr.split('-').map(Number);
        const startDate = new Date(parts[0], parts[1] - 1, parts[2]);

        const dates = [];
        for (let i = 0; i < NUM_DAYS; i++) {
            const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const wIdx = (d.getDay() + 6) % 7; // 月曜=0, 日曜=6
            const isHoliday = isJapaneseHoliday(y, m, day);
            dates.push({
                y,
                m,
                year: y,
                month: m,
                day,
                weekday: WEEKDAYS[wIdx],
                label: \`\${m}/\${day}\`,
                wIdx,
                isSun: (wIdx === 6),
                isSat: (wIdx === 5),
                isHoliday,
                isHol: isHoliday,
                dateObj: d
            });
        }
        const first = dates[0];
        const last = dates[dates.length - 1];
        const title = \`\${first.m}/\${first.day}～\${last.m}/\${last.day}勤務表\`;
        const badgeText = termDef
            ? \`第\${termDef.termNo}ターム (\${first.m}/\${first.day}～\${last.m}/\${last.day})\`
            : title;

        // UI表示の更新
        const termSelect = document.getElementById('termSelect');
        if (termSelect && termDef && termSelect.value !== termDef.startDate) {
            termSelect.value = termDef.startDate;
        }
        const endDisplay = document.getElementById('termEndDateDisplay');
        if (endDisplay) {
            const lastY = last.dateObj.getFullYear();
            const lastM = String(last.m).padStart(2, '0');
            const lastD = String(last.day).padStart(2, '0');
            endDisplay.textContent = \`\${lastY}-\${lastM}-\${lastD}\`;
        }
        const badge = document.getElementById('termTitleBadge');
        if (badge) badge.textContent = badgeText;
        const daysBadge = document.getElementById('termDaysBadge');
        if (daysBadge) daysBadge.textContent = \`\${NUM_DAYS}日間\`;

        const outTitle = document.getElementById('outputTitleDisplay');
        if (outTitle) outTitle.textContent = \`✏️ \${title}（修正作業エリア）\`;
        const checkTitle = document.getElementById('checkTitleDisplay');
        if (checkTitle) checkTitle.textContent = \`🔍 \${title}（最終チェック&完成）\`;

        if (typeof updateRefreshBadge === 'function') {
            updateRefreshBadge(dates);
        }

        return {
            title,
            badgeText,
            dates,
            first,
            last,
            numDays: NUM_DAYS,
            isTerm13: !!(termDef && termDef.isTerm13)
        };
    }

    `;

appCode = appCode.substring(0, getTermInfoStart) + newGetTermInfo + appCode.substring(termStartDateInputMarker);
console.log('app.js: Updated getTermInfo with dynamic NUM_DAYS and UI sync');

// 2-7. renderOutputTable の右側備考欄のエスケープ＆ヘッダー整合
appCode = appCode.replace(
    '<th colspan="8" class="border-thick-bottom" style="background:#e0f2fe; color:#0369a1; font-weight:800;">勤務・休暇 集計</th>',
    '<th colspan="9" class="border-thick-bottom" style="background:#e0f2fe; color:#0369a1; font-weight:800;">勤務・休暇 集計 ＆ 備考</th>'
);
appCode = appCode.replace(
    '<td class="remarks-cell ${rowBottomCls}" style="min-width:220px; max-width:320px; text-align:left; font-size:0.8rem; color:#475569; padding:2px 8px; white-space:normal; word-break:break-all; background:transparent;">${staff.remarks || \'\'}</td>',
    '<td class="remarks-cell ${rowBottomCls}" style="min-width:220px; max-width:320px; text-align:left; font-size:0.8rem; color:#475569; padding:2px 8px; white-space:normal; word-break:break-all; background:transparent;">${escapeHtmlText(staff.remarks || \'\')}</td>'
);

// 2-8. downloadBlankXlsx と exportExcelSpreadsheet での XMLエスケープ＆スタッフマスター設定埋め込み（別PCへのトグル引き継ぎ用）
appCode = appCode.replace(
    '<c r="B${r}" s="6" t="inlineStr"><is><t>${staff.name}</t></is></c>',
    '<c r="B${r}" s="6" t="inlineStr"><is><t>${escapeXmlText(staff.name)}</t></is></c>'
);
appCode = appCode.replace(
    '<c r="${colRemarks}${r}" s="5"/>',
    '<c r="${colRemarks}${r}" s="6" t="inlineStr"><is><t>${escapeXmlText(staff.remarks || \'\')}</t></is></c>'
);
appCode = appCode.replace(
    '<c r="A${r}" s="5" t="inlineStr"><is><t>${staff.name}</t></is></c>',
    '<c r="A${r}" s="5" t="inlineStr"><is><t>${escapeXmlText(staff.name)}</t></is></c>'
);
appCode = appCode.replace(
    '<c r="${colRemarks}${r}" s="14" t="inlineStr"><is><t>${staff.remarks || \'\'}</t></is></c>',
    '<c r="${colRemarks}${r}" s="14" t="inlineStr"><is><t>${escapeXmlText(staff.remarks || \'\')}</t></is></c>'
);

// 2-9. applyScheduleImport, parseXlsxBuffer, parseCsvOrTsvText, ファイル取込処理の刷新（ふりがな文字化け完全排除・Shift-JIS自動判定・別PCトグル復元）
const applyImportStart = appCode.indexOf('function applyScheduleImport(extractedItems, mode = \'merge\') {');
const handleImportEnd = appCode.indexOf('// 修正作業エリア（ステージ2）のファイル取り込み');
if (applyImportStart === -1 || handleImportEnd === -1) {
    throw new Error('Could not find applyScheduleImport or handleImportSchedule in app.js');
}

const newImportAndParseCode = `function applyScheduleImport(extractedItems, mode = 'merge', remarksMap = null) {
        const term = getTermInfo();
        // mode: 'replace' の場合は既存の入力希望を一度クリア
        if (mode === 'replace') {
            for (let s = 0; s < NUM_STAFF; s++) {
                for (let d = 0; d < NUM_DAYS; d++) {
                    staffList[s].days[d] = '';
                }
            }
        }

        if (remarksMap && typeof remarksMap === 'object') {
            Object.keys(remarksMap).forEach(sIdxStr => {
                const sIdx = parseInt(sIdxStr, 10);
                if (staffList[sIdx]) {
                    staffList[sIdx].remarks = cleanTextValue(remarksMap[sIdxStr]);
                }
            });
        }

        let updatedCount = 0;
        const affectedStaff = new Set();

        extractedItems.forEach(item => {
            const { staffIdx, dayIdx, symbol } = item;
            if (staffIdx >= 0 && staffIdx < NUM_STAFF && dayIdx >= 0 && dayIdx < NUM_DAYS) {
                const norm = normalizeSymbol(symbol);
                if (norm) {
                    staffList[staffIdx].days[dayIdx] = norm;
                    updatedCount++;
                    affectedStaff.add(staffIdx);
                } else if (mode === 'replace' && (!symbol || symbol === '')) {
                    staffList[staffIdx].days[dayIdx] = '';
                }
            }
        });

        // テーブル再描画 ＆ 自動保存
        renderInputTable();
        const modeText = mode === 'replace' ? '（既存枠クリア済み）' : '';
        saveStaffMaster();
        saveCurrentTermToStorage();
        if (updatedCount === 0) {
            showToast(\`📄 【\${term.title}】事前希望枠を全クリア（白紙）にしました\`);
        } else {
            showToast(\`🎉 【\${term.title}】\${affectedStaff.size}名・計\${updatedCount}件の希望勤務を取り込みました\${modeText}\`);
        }
    }

    // ★ XMLノードから <rPh>（日本語Excelが自動付与する「ふりがな」タグ）を完全除外してテキストのみを抽出するヘルパー
    function extractXmlTextWithoutPhonetic(node) {
        if (!node) return '';
        const clone = node.cloneNode(true);
        // <rPh>（ふりがな要素）を削除してから <t> を連結する（これで「委員会イインカイ」等の文字化けを100%防止）
        const rPhNodes = clone.getElementsByTagName('rPh');
        while (rPhNodes.length > 0) {
            if (rPhNodes[0].parentNode) {
                rPhNodes[0].parentNode.removeChild(rPhNodes[0]);
            } else {
                break;
            }
        }
        const tNodes = clone.getElementsByTagName('t');
        let str = '';
        if (tNodes.length > 0) {
            for (let j = 0; j < tNodes.length; j++) {
                str += tNodes[j].textContent;
            }
        } else {
            str = clone.textContent || '';
        }
        return cleanTextValue(str);
    }

    // ★ CSV / TSV ファイルの自動文字コード判定読み込み（UTF-8 / Shift-JIS 自動判別）
    async function readTextFileAutoEncoding(file) {
        const buf = await file.arrayBuffer();
        const uint8 = new Uint8Array(buf);
        try {
            // まず UTF-8 (fatal: true) でデコードを試みる
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            return utf8Decoder.decode(uint8);
        } catch (e) {
            // 日本語版Excelが出力した Shift-JIS (CP932) CSV の場合は Shift-JIS でデコード
            try {
                const sjisDecoder = new TextDecoder('shift-jis');
                return sjisDecoder.decode(uint8);
            } catch (e2) {
                return new TextDecoder().decode(uint8);
            }
        }
    }

    // ==========================================
    // 純粋JSによる .xlsx 解凍＆パース処理（ふりがな除去・28/29日動的列対応）
    // ==========================================
    async function parseXlsxBuffer(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(bytes.buffer);
        const textDecoder = new TextDecoder('utf-8');
        const entries = {};

        // Central Directory から正確な圧縮サイズ・オフセットを取得（Excel上書き保存時の Data Descriptor にも対応）
        const cdEntries = [];
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                const totalEntries = view.getUint16(i + 10, true);
                let cdPos = view.getUint32(i + 16, true);
                for (let e = 0; e < totalEntries && cdPos < bytes.length - 46; e++) {
                    if (view.getUint32(cdPos, true) !== 0x02014b50) break;
                    const method = view.getUint16(cdPos + 10, true);
                    const compSize = view.getUint32(cdPos + 20, true);
                    const nameLen = view.getUint16(cdPos + 28, true);
                    const extraLen = view.getUint16(cdPos + 30, true);
                    const commentLen = view.getUint16(cdPos + 32, true);
                    const localOffset = view.getUint32(cdPos + 42, true);
                    const name = textDecoder.decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen));
                    cdEntries.push({ name, method, compSize, localOffset });
                    cdPos += 46 + nameLen + extraLen + commentLen;
                }
                break;
            }
        }

        async function inflateEntry(method, compData) {
            if (method === 0) return compData;
            if (method === 8 && typeof DecompressionStream !== 'undefined') {
                try {
                    const ds = new DecompressionStream('deflate-raw');
                    const writer = ds.writable.getWriter();
                    writer.write(compData);
                    writer.close();
                    const reader = ds.readable.getReader();
                    const chunks = [];
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                    }
                    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
                    const decompData = new Uint8Array(totalLen);
                    let off = 0;
                    for (const c of chunks) {
                        decompData.set(c, off);
                        off += c.length;
                    }
                    return decompData;
                } catch (e) {
                    console.warn('Decompress error', e);
                }
            }
            return null;
        }

        if (cdEntries.length > 0) {
            for (const ce of cdEntries) {
                const pos = ce.localOffset;
                if (pos + 30 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
                    const nameLen = view.getUint16(pos + 26, true);
                    const extraLen = view.getUint16(pos + 28, true);
                    const dataStart = pos + 30 + nameLen + extraLen;
                    const compData = bytes.subarray(dataStart, dataStart + ce.compSize);
                    const decompData = await inflateEntry(ce.method, compData);
                    if (decompData) {
                        entries[ce.name] = textDecoder.decode(decompData);
                    }
                }
            }
        } else {
            let pos = 0;
            while (pos < bytes.length - 4) {
                const sig = view.getUint32(pos, true);
                if (sig === 0x04034b50) {
                    const method = view.getUint16(pos + 8, true);
                    const compSize = view.getUint32(pos + 18, true);
                    const nameLen = view.getUint16(pos + 26, true);
                    const extraLen = view.getUint16(pos + 28, true);
                    const name = textDecoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
                    const dataStart = pos + 30 + nameLen + extraLen;
                    const compData = bytes.subarray(dataStart, dataStart + compSize);
                    const decompData = await inflateEntry(method, compData);
                    if (decompData) {
                        entries[name] = textDecoder.decode(decompData);
                    }
                    pos = dataStart + (compSize || 1);
                } else {
                    pos++;
                }
            }
        }

        // sharedStrings.xml の抽出（★ <rPh> ふりがなタグを完全除外！）
        const sharedStrings = [];
        if (entries['xl/sharedStrings.xml']) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(entries['xl/sharedStrings.xml'], 'text/xml');
            const siNodes = xmlDoc.getElementsByTagName('si');
            for (let i = 0; i < siNodes.length; i++) {
                sharedStrings.push(extractXmlTextWithoutPhonetic(siNodes[i]));
            }
        }

        const sheetXml = entries['xl/worksheets/sheet1.xml'];
        if (!sheetXml) {
            throw new Error('Excelシート（sheet1.xml）が見つかりませんでした。');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(sheetXml, 'text/xml');
        const cNodes = xmlDoc.getElementsByTagName('c');

        function getCellText(c) {
            const t = c.getAttribute('t');
            if (t === 's') {
                const vNode = c.getElementsByTagName('v')[0];
                if (vNode) return sharedStrings[parseInt(vNode.textContent, 10)] || '';
                return '';
            } else if (t === 'inlineStr') {
                const isNode = c.getElementsByTagName('is')[0];
                return extractXmlTextWithoutPhonetic(isNode || c);
            } else if (t === 'str') {
                const vNode = c.getElementsByTagName('v')[0];
                return cleanTextValue(vNode ? vNode.textContent : '');
            } else {
                const fNode = c.getElementsByTagName('f')[0];
                if (fNode) return ''; // 数式セル（集計列など）のキャッシュ数値 <v>0</v> は文字列として扱わない
                const vNode = c.getElementsByTagName('v')[0];
                return cleanTextValue(vNode ? vNode.textContent : '');
            }
        }

        // タイトルから期間開始日を検出
        let detectedStartDate = null;
        const titleRegex = /(?:(\\d{4})[年\\/-])?(\\d{1,2})月(\\d{1,2})日[～〜~-](\\d{1,2})月(\\d{1,2})日/;
        const currentYear = document.getElementById('termStartDate')?.value
            ? parseInt(document.getElementById('termStartDate').value.split('-')[0], 10)
            : 2026;

        // 全セルをマップ化
        const cellMap = new Map(); // "row,col" -> { c, text }
        let maxRow = 0;
        let maxCol = 0;

        for (let i = 0; i < cNodes.length; i++) {
            const c = cNodes[i];
            const ref = c.getAttribute('r');
            if (!ref) continue;
            const m = ref.match(/^([A-Z]+)([0-9]+)$/);
            if (!m) continue;
            const colStr = m[1];
            const row = parseInt(m[2], 10);
            let col = 0;
            for (let k = 0; k < colStr.length; k++) {
                col = col * 26 + (colStr.charCodeAt(k) - 64);
            }
            const text = getCellText(c);
            cellMap.set(\`\${row},\${col}\`, { c, text, ref });
            if (row > maxRow) maxRow = row;
            if (col > maxCol) maxCol = col;

            if (row === 1 && col === 1 && text) {
                const tm = text.match(titleRegex);
                if (tm) {
                    const y = tm[1] ? parseInt(tm[1], 10) : currentYear;
                    const mon = String(parseInt(tm[2], 10)).padStart(2, '0');
                    const day = String(parseInt(tm[3], 10)).padStart(2, '0');
                    const candidate = \`\${y}-\${mon}-\${day}\`;
                    const matchedTerm = findTermByStartDate(candidate);
                    detectedStartDate = matchedTerm ? matchedTerm.startDate : candidate;
                }
            }
        }

        // 2行目のヘッダーを走査して、シート種別（希望シート vs 完成勤務表 vs 旧シート）・日付開始列・日数・備考列を正確に特定！
        let dayStartCol = 3; // デフォルト: C列 (希望入力シート)
        let remarksCol = -1;
        let nameCol = 2;     // デフォルト: B列 (希望入力シート)
        let dataStartRow = 4;

        const a2Text = cellMap.get('2,1')?.text || '';
        const b2Text = cellMap.get('2,2')?.text || '';
        const c2Text = cellMap.get('2,3')?.text || '';

        if (a2Text === '氏名') {
            // 完成・修正勤務表 (exportExcelSpreadsheet): A列=氏名, B列〜=日付
            nameCol = 1;
            dayStartCol = 2;
            dataStartRow = 4;
        } else if (a2Text === 'No' && b2Text === '氏名' && c2Text === '8時可') {
            // 旧レイアウト: A=No, B=氏名, L(12)〜=日付
            nameCol = 2;
            dayStartCol = 12;
            dataStartRow = 3;
        } else {
            // 希望入力シート (downloadBlankXlsx): A=No, B=氏名, C(3)〜=日付
            nameCol = 2;
            dayStartCol = 3;
            dataStartRow = 4;
        }

        // 2行目から「備考」または「備考（メモ）」列を探す
        for (let col = 1; col <= maxCol; col++) {
            const hText = cellMap.get(\`2,\${col}\`)?.text || '';
            if (hText.includes('備考') || hText.includes('メモ') || hText.includes('コメント')) {
                remarksCol = col;
                break;
            }
        }

        // 対象タームの日数（28日 or 29日）を判定
        const targetTerm = findTermByStartDate(detectedStartDate || currentWorkingStartDate);
        const sheetNumDays = targetTerm ? targetTerm.numDays : NUM_DAYS;

        if (remarksCol === -1 && dataStartRow === 4) {
            remarksCol = (dayStartCol === 3) ? (5 + sheetNumDays) : (10 + sheetNumDays);
        }

        // 有効スタッフのインデックス一覧
        const validStaffIndices = [];
        staffList.forEach((st, idx) => {
            if (!st.isUnused) validStaffIndices.push(idx);
        });

        const items = [];
        const remarksMap = {};

        for (let row = dataStartRow; row <= maxRow; row++) {
            const rowName = cellMap.get(\`\${row},\${nameCol}\`)?.text || '';
            // フッター集計行（出勤人数合計・実数合計・早番等）に達したら終了
            if (['出勤人数合計', '実数合計', 'PT A 出勤', 'OT A 出勤', 'PT B 出勤', 'OT B 出勤', 'ST 出勤', '早番', '遅番', 'E', '8時', '専従'].some(k => rowName.startsWith(k))) {
                break;
            }

            // スタッフの特定（1. 氏名一致 → 2. 有効スタッフ順 → 3. 行番号順）
            let staffIdx = -1;
            if (rowName) {
                const byName = staffList.findIndex(st => cleanTextValue(st.name) === rowName);
                if (byName >= 0) staffIdx = byName;
            }
            if (staffIdx === -1) {
                const offsetIdx = row - dataStartRow;
                if (offsetIdx >= 0 && offsetIdx < validStaffIndices.length) {
                    staffIdx = validStaffIndices[offsetIdx];
                } else if (offsetIdx >= 0 && offsetIdx < NUM_STAFF) {
                    staffIdx = offsetIdx;
                }
            }

            if (staffIdx < 0 || staffIdx >= NUM_STAFF) continue;

            // 日付セルの読み取り
            for (let d = 0; d < sheetNumDays; d++) {
                const col = dayStartCol + d;
                const cellEntry = cellMap.get(\`\${row},\${col}\`);
                if (cellEntry && cellEntry.text) {
                    items.push({
                        staffIdx,
                        dayIdx: d,
                        symbol: cellEntry.text
                    });
                }
            }

            // 右側の備考（コメント）列の読み取り
            if (remarksCol > 0) {
                const remEntry = cellMap.get(\`\${row},\${remarksCol}\`);
                if (remEntry && remEntry.text && remEntry.text !== '-') {
                    remarksMap[staffIdx] = remEntry.text;
                } else {
                    remarksMap[staffIdx] = '';
                }
            }
        }

        return { items, startDate: detectedStartDate, remarksMap };
    }

    // ==========================================
    // CSV / TSV テキストのパース処理
    // ==========================================
    function parseCsvOrTsvText(text) {
        const cleanFullText = text.replace(/^\\uFEFF/, '');
        const lines = cleanFullText.split(/\\r?\\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return { items: [], startDate: null, remarksMap: {} };

        const isTsv = lines[0].includes('\\t');
        function parseLine(line) {
            if (isTsv) return line.split('\\t').map(c => cleanTextValue(c.replace(/^"(.*)"$/, '$1')));
            const res = [];
            let cur = '';
            let inQ = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                    else { inQ = !inQ; }
                } else if (ch === ',' && !inQ) {
                    res.push(cleanTextValue(cur));
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            res.push(cleanTextValue(cur));
            return res;
        }

        const rows = lines.map(parseLine);
        const items = [];
        const remarksMap = {};

        let detectedStartDate = null;
        const currentYear = document.getElementById('termStartDate')?.value ? parseInt(document.getElementById('termStartDate').value.split('-')[0], 10) : 2026;

        for (let i = 0; i < Math.min(3, rows.length); i++) {
            const lineStr = rows[i].join(' ');
            const m = lineStr.match(/(?:(\\d{4})[年\\/-])?(\\d{1,2})[月\\/-](\\d{1,2})/);
            if (m) {
                const y = m[1] ? parseInt(m[1], 10) : currentYear;
                const mon = String(parseInt(m[2], 10)).padStart(2, '0');
                const day = String(parseInt(m[3], 10)).padStart(2, '0');
                const candidate = \`\${y}-\${mon}-\${day}\`;
                const matchedTerm = findTermByStartDate(candidate);
                detectedStartDate = matchedTerm ? matchedTerm.startDate : candidate;
                break;
            }
        }

        if ((rows[0].length === 28 || rows[0].length === 29) && rows.length <= NUM_STAFF) {
            rows.forEach((rowVals, sIdx) => {
                rowVals.forEach((val, dIdx) => {
                    if (val) items.push({ staffIdx: sIdx, dayIdx: dIdx, symbol: val });
                });
            });
            return { items, startDate: detectedStartDate, remarksMap };
        }

        let headerRowIdx = -1;
        let dayColStart = 2;
        let remarksColIdx = -1;

        for (let i = 0; i < Math.min(5, rows.length); i++) {
            const r = rows[i];
            if (r.some(cell => cell.includes('No') || cell.includes('氏名') || cell.includes('/'))) {
                headerRowIdx = i;
                for (let c = 0; c < r.length; c++) {
                    if (/\\d+[\\/月]\\d+/.test(r[c])) {
                        dayColStart = c;
                        break;
                    }
                }
                for (let c = 0; c < r.length; c++) {
                    if (r[c].includes('備考') || r[c].includes('メモ')) {
                        remarksColIdx = c;
                        break;
                    }
                }
                break;
            }
        }

        const dataStartRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
        for (let r = dataStartRow; r < rows.length; r++) {
            const rowVals = rows[r];
            if (rowVals.length < 2) continue;

            let staffIdx = -1;
            const noVal = parseInt(rowVals[0], 10);
            if (!isNaN(noVal) && noVal >= 1 && noVal <= NUM_STAFF) {
                staffIdx = noVal - 1;
            } else {
                const nameVal = rowVals[1] || rowVals[0];
                if (nameVal) {
                    const found = staffList.findIndex(st => cleanTextValue(st.name) === nameVal);
                    if (found >= 0) staffIdx = found;
                }
            }

            if (staffIdx >= 0 && staffIdx < NUM_STAFF) {
                for (let d = 0; d < NUM_DAYS; d++) {
                    const col = dayColStart + d;
                    if (col < rowVals.length && rowVals[col]) {
                        items.push({ staffIdx, dayIdx: d, symbol: rowVals[col] });
                    }
                }
                if (remarksColIdx >= 0 && remarksColIdx < rowVals.length) {
                    remarksMap[staffIdx] = rowVals[remarksColIdx] || '';
                }
            }
        }

        return { items, startDate: detectedStartDate, remarksMap };
    }

    // ==========================================
    // ファイル取り込みイベント（.xlsx / .csv / .tsv）
    // ==========================================
    const importScheduleFileInput = document.getElementById('importScheduleFileInput');
    if (importScheduleFileInput) {
        importScheduleFileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                let parseResult;
                if (file.name.toLowerCase().endsWith('.xlsx')) {
                    const buf = await file.arrayBuffer();
                    parseResult = await parseXlsxBuffer(buf);
                } else {
                    const text = await readTextFileAutoEncoding(file);
                    parseResult = parseCsvOrTsvText(text);
                }

                pushHistory();

                if (parseResult && parseResult.startDate) {
                    const startDateInput = document.getElementById('termStartDate');
                    if (startDateInput) {
                        startDateInput.value = parseResult.startDate;
                        currentWorkingStartDate = parseResult.startDate;
                        getTermInfo();
                    }
                }

                if (!parseResult || !parseResult.items || parseResult.items.length === 0) {
                    applyScheduleImport([], 'replace', parseResult ? parseResult.remarksMap : null);
                    showToast('📄 白紙の希望シートを取り込みました。事前希望枠を全クリア（白紙）にしました。');
                    return;
                }

                applyScheduleImport(parseResult.items, 'replace', parseResult.remarksMap);
                checkInputConstraints(false);

            } catch (err) {
                console.error(err);
                alert('ファイルの取り込みに失敗しました: ' + err.message);
            } finally {
                importScheduleFileInput.value = '';
            }
        });
    }

    // ==========================================
    // 修正済み確定勤務表ファイル取り込み共通処理
    // ==========================================
    async function handleImportSchedule(file, isFinalStage) {
        if (!file) return;

        try {
            let parseResult;
            if (file.name.toLowerCase().endsWith('.xlsx')) {
                const buf = await file.arrayBuffer();
                parseResult = await parseXlsxBuffer(buf);
            } else {
                const text = await readTextFileAutoEncoding(file);
                parseResult = parseCsvOrTsvText(text);
            }

            if (!parseResult || !parseResult.items || parseResult.items.length === 0) {
                alert('ファイルから有効な勤務データが読み取れませんでした。形式をご確認ください。');
                return;
            }

            pushHistory();

            if (parseResult.startDate) {
                const startDateInput = document.getElementById('termStartDate');
                if (startDateInput) {
                    startDateInput.value = parseResult.startDate;
                    currentWorkingStartDate = parseResult.startDate;
                    getTermInfo();
                }
            }

            if (parseResult.remarksMap && typeof parseResult.remarksMap === 'object') {
                Object.keys(parseResult.remarksMap).forEach(sIdxStr => {
                    const sIdx = parseInt(sIdxStr, 10);
                    if (staffList[sIdx] && parseResult.remarksMap[sIdxStr] !== undefined) {
                        staffList[sIdx].remarks = cleanTextValue(parseResult.remarksMap[sIdxStr]);
                    }
                });
            }

            const term = getTermInfo();
            const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');

            if (!lastScheduler) {
                lastScheduler = new ShiftScheduler(staffList, {
                    standardHolidays: stdHolidayVal,
                    dates: term.dates,
                    dayOffsets: [...dayOffsets]
                });
            }

            const newGrid = [];
            for (let s = 0; s < NUM_STAFF; s++) {
                const row = [];
                for (let d = 0; d < NUM_DAYS; d++) {
                    const originalWish = staffList[s].days[d] || '';
                    row.push({
                        symbol: originalWish ? originalWish : '',
                        isFixed: (originalWish !== '')
                    });
                }
                newGrid.push(row);
            }

            parseResult.items.forEach(item => {
                const { staffIdx, dayIdx, symbol } = item;
                if (staffIdx >= 0 && staffIdx < NUM_STAFF && dayIdx >= 0 && dayIdx < NUM_DAYS) {
                    const norm = normalizeSymbol(symbol);
                    if (norm) {
                        newGrid[staffIdx][dayIdx].symbol = norm;
                    }
                }
            });

            lastScheduler.grid = newGrid;
            const newStats = lastScheduler.calculateStats();
            lastSolveResult = {
                success: true,
                grid: newGrid,
                stats: newStats,
                errors: []
            };

            renderInputTable();
            renderOutputTable(newGrid, newStats);
            renderStatsDashboard(newStats);

            if (isFinalStage) {
                switchTab('checkTab');
                const checkRes = checkFinalConstraints(true);
                if (checkRes && !checkRes.isValid) {
                    showToast(\`📂 修正済み勤務表を取り込みました（\${checkRes.errors.length}件の制約指摘をブルー網掛けで表示中）\`);
                } else {
                    showToast(\`📂 修正済み勤務表を取り込みました（全制約が完全遵守されています！）\`);
                }
            } else {
                switchTab('outputTab');
                const checkRes = checkWorkAreaConstraints(true);
                if (checkRes && !checkRes.isValid) {
                    showToast(\`📂 修正済み勤務表を取り込みました（\${checkRes.errors.length}件の制約指摘をブルー網掛けで表示中）\`);
                } else {
                    showToast(\`📂 修正済み勤務表を取り込みました（基本制約が完全遵守されています！）\`);
                }
            }

            saveStaffMaster();
            saveCurrentTermToStorage();

        } catch (err) {
            console.error(err);
            alert('修正済み勤務表の取り込みに失敗しました: ' + err.message);
        }
    }

    `;

appCode = appCode.substring(0, applyImportStart) + newImportAndParseCode + appCode.substring(handleImportEnd);
console.log('app.js: Updated applyScheduleImport, parseXlsxBuffer, parseCsvOrTsvText, and handleImportSchedule');

// 2-10. 初期起動処理（5028行目付近）に loadStaffMaster() と initTermSelector() を確実に組み込む
const startupMarker = '// 初期起動（直前に作業していた期間、または保存データを自動復元）';
const startupIdx = appCode.indexOf(startupMarker);
if (startupIdx === -1) {
    throw new Error('Could not find startupMarker in app.js');
}

const newStartupCode = `// 初期起動（直前に作業していた期間、または保存データを自動復元）
    initStaffData();
    loadStaffMaster(); // ★ スタッフの基本属性・トグル設定（係長/主任/副主任/0.5/専従/所属/備考等）を確実に復元

    const lastActiveDate = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE) || localStorage.getItem('shift_schedule_last_active_start_date');
    const defaultDate = document.getElementById('termStartDate')?.value || '2026-04-01';
    const matchedTerm = findTermByStartDate(lastActiveDate || defaultDate);
    const targetDate = matchedTerm ? matchedTerm.startDate : (lastActiveDate || defaultDate);

    currentWorkingStartDate = targetDate;
    const dateInput = document.getElementById('termStartDate');
    if (dateInput) dateInput.value = targetDate;

    // ★ 13ターム選択プルダウンの初期化とイベント登録
    initTermSelector();

    if (localStorage.getItem(\`\${STORAGE_KEY_PREFIX}\${targetDate}\`) || localStorage.getItem(\`shift_schedule_term_\${targetDate}\`)) {
        loadTermFromStorage(targetDate);
    } else {
        const term = getTermInfo();
        const stdHolidaySelect = document.getElementById('standardHolidaySelect');
        if (stdHolidaySelect) stdHolidaySelect.value = term.isTerm13 ? '8.5' : '8.0';
        dayOffsets = createDefaultDayOffsets(term.dates);
        renderInputTable();
        clearOutputTables();
        saveStaffMaster();
        saveCurrentTermToStorage(); // 初期状態を自動保存
    }
    renderSavedTermsSelect();
});
`;

appCode = appCode.substring(0, startupIdx) + newStartupCode;
console.log('app.js: Updated startup initialization');

fs.writeFileSync(appPath, appCode, 'utf8');
console.log('SUCCESS: app.js updated completely!');
