# app.js および style.css の改修スクリプト

with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

# 1. 生活期 Cannot access 'currentGrid' before initialization の修正
# renderOutputTable 関数の冒頭で currentGrid を安全に定義
target1 = '''function renderOutputTable(grid, stats) {
        const thead = document.getElementById('outputTableHead');
        const tbody = document.getElementById('outputTableBody');
        const tfoot = document.getElementById('outputTableFoot');
        if (!thead || !tbody || !tfoot) return;'''

replacement1 = '''function renderOutputTable(grid, stats) {
        const thead = document.getElementById('outputTableHead');
        const tbody = document.getElementById('outputTableBody');
        const tfoot = document.getElementById('outputTableFoot');
        if (!thead || !tbody || !tfoot) return;

        // ★ TDZ防止: 関数の冒頭で currentGrid を最優先かつ安全に初期化
        const currentGrid = grid || (lastSolveResult && lastSolveResult.grid) || [];'''

if target1 in app_text:
    app_text = app_text.replace(target1, replacement1, 1)
    print("Fixed 1: currentGrid initialization in renderOutputTable")
else:
    print("Warning: target1 not found in app.js")

# 2. 後半にあった重複宣言 `const currentGrid = grid || (lastSolveResult && lastSolveResult.grid);` を `// const currentGrid ...` に変更
old_grid_decl = 'const currentGrid = grid || (lastSolveResult && lastSolveResult.grid);'
if old_grid_decl in app_text:
    app_text = app_text.replace(old_grid_decl, '// currentGrid は関数冒頭で宣言済み', 1)
    print("Fixed 2: replaced secondary currentGrid declaration")

# 3. コピペモード（Ctrl+V）の再集計＆再描画
target_copy = '''        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            if (activeCell && clipboardSymbol !== null) {
                const s = parseInt(activeCell.dataset.s, 10);
                const type = activeCell.dataset.type;
                pushHistory();
                let newSym = clipboardSymbol;
                if (!isNaN(s) && staffList[s]) {
                    if (type === 'day') {
                        const d = parseInt(activeCell.dataset.d, 10);
                        if (!isNaN(d)) staffList[s].days[d] = newSym;
                    } else if (type === 'prev') {
                        const p = parseInt(activeCell.dataset.p, 10);
                        if (!isNaN(p)) staffList[s].prevDays[p] = newSym;
                    }
                }
                activeCell.textContent = newSym;
                if (typeof renderStatsDashboard === 'function' && lastSolveResult && lastSolveResult.stats) {
                    // リアルタイム再計算
                }
                saveCurrentTermToStorage();
                showToast(`📋 【${newSym || '空欄'}】を貼り付けました (Ctrl+V)`);
                e.preventDefault();
            }
        }'''

replacement_copy = '''        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            if (activeCell && clipboardSymbol !== null) {
                const s = parseInt(activeCell.dataset.s, 10);
                const d = parseInt(activeCell.dataset.d, 10);
                const type = activeCell.dataset.type;
                pushHistory();
                let newSym = clipboardSymbol;

                // 1. 入力データ（staffList）の更新
                if (!isNaN(s) && staffList[s]) {
                    if (type === 'prev') {
                        const p = parseInt(activeCell.dataset.p, 10);
                        if (!isNaN(p)) staffList[s].prevDays[p] = newSym;
                    } else if (!isNaN(d)) {
                        staffList[s].days[d] = newSym;
                    }
                }

                // 2. 出力データ（lastSolveResult / lastScheduler）の更新
                let updatedOutput = false;
                if (!isNaN(s) && !isNaN(d)) {
                    if (lastSolveResult && lastSolveResult.grid && lastSolveResult.grid[s] && lastSolveResult.grid[s][d]) {
                        lastSolveResult.grid[s][d].symbol = newSym;
                        updatedOutput = true;
                    }
                    if (lastScheduler && lastScheduler.grid && lastScheduler.grid[s] && lastScheduler.grid[s][d]) {
                        lastScheduler.grid[s][d].symbol = newSym;
                        updatedOutput = true;
                    }
                }

                activeCell.textContent = newSym;

                // 3. リアルタイム再集計＆画面再描画（個人集計列＆フッター日別集計行の即時更新）
                if (updatedOutput && lastScheduler) {
                    const newStats = lastScheduler.calculateStats();
                    if (lastSolveResult) lastSolveResult.stats = newStats;
                    renderOutputTable(lastSolveResult.grid, newStats);
                    if (typeof renderStatsDashboard === 'function') renderStatsDashboard(newStats);
                } else if (document.getElementById('inputTab')?.classList.contains('active')) {
                    renderInputTable();
                }

                if (isMaster && typeof renderMasterIntegrationView === 'function') {
                    renderMasterIntegrationView();
                }

                // 貼り付け後もセルの選択表示（.copy-selected-cell）を維持
                if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                const newActiveCell = document.querySelector(`.day-cell[data-s="${s}"][data-d="${d}"]`) || activeCell;
                if (newActiveCell) {
                    newActiveCell.classList.add('copy-selected-cell');
                    selectedCopyCell = newActiveCell;
                }

                saveCurrentTermToStorage();
                showToast(`📋 【${newSym || '空欄'}】を貼り付けました (Ctrl+V)`);
                e.preventDefault();
            }
        }'''

if target_copy in app_text:
    app_text = app_text.replace(target_copy, replacement_copy, 1)
    print("Fixed 3: copy paste real-time recalculation")
else:
    print("Warning: target_copy not found in app.js")

# 4. 起動時のターム決定ロジック（グローバルアクティブタームを全テーブルで最優先にし、同一ターム同期）
target_init_term = '''    const defaultDate = '2026-04-01';
    const lastActiveDate = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
    const matchedTerm = findTermByStartDate(lastActiveDate || defaultDate);
    const targetDate = matchedTerm ? matchedTerm.startDate : (lastActiveDate || defaultDate);'''

replacement_init_term = '''    const defaultDate = '2026-04-01';
    // ★ ユーザー指示: どこかのテーブルでタームを指定したらすべてのテーブルが同一のタームを開く！
    const globalActiveDate = localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || localStorage.getItem('shift_schedule_current_start_date');
    const lastActiveDate = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
    const chosenDate = globalActiveDate || lastActiveDate || defaultDate;
    const matchedTerm = findTermByStartDate(chosenDate);
    const targetDate = matchedTerm ? matchedTerm.startDate : defaultDate;'''

if target_init_term in app_text:
    app_text = app_text.replace(target_init_term, replacement_init_term, 1)
    print("Fixed 4: global term synchronization at startup")
else:
    print("Warning: target_init_term not found in app.js")

# 5. initTermSelector 内でターム切り替え時のバッジ＆タイトル＆マスタービュー更新を強化
target_change = '''            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
            localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newDate);
            localStorage.setItem('shift_schedule_current_start_date', newDate);
            renderSavedTermsSelect();

            // 終了日・バッジ・タイトルの動的更新
            getTermInfo(newDate);

            if (isMaster) {'''

replacement_change = '''            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
            localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newDate);
            localStorage.setItem('shift_schedule_current_start_date', newDate);
            renderSavedTermsSelect();

            // 終了日・バッジ・タイトルの動的更新
            const termInfo = getTermInfo(newDate);
            const endDisplay = document.getElementById('termEndDateDisplay');
            if (endDisplay && termInfo.last) {
                const lastY = termInfo.last.dateObj.getFullYear();
                const lastM = String(termInfo.last.m).padStart(2, '0');
                const lastD = String(termInfo.last.day).padStart(2, '0');
                endDisplay.textContent = `${lastY}-${lastM}-${lastD}`;
            }
            const termBadge = document.getElementById('termTitleBadge') || document.getElementById('termLabelBadge');
            if (termBadge) termBadge.textContent = termInfo.badgeText;
            const daysBadge = document.getElementById('termDaysBadge');
            if (daysBadge) daysBadge.textContent = `${termInfo.dates.length}日間`;

            if (isMaster) {'''

if target_change in app_text:
    app_text = app_text.replace(target_change, replacement_change, 1)
    print("Fixed 5: term badge and dates update on change")
else:
    print("Warning: target_change not found in app.js")

# 6. マスターテーブルのタイトルが renderCheckTable で上書きされないように保護
target_title = "const checkTitle = document.getElementById('checkTitleDisplay');\n        if (checkTitle) checkTitle.textContent = `🔍 ${title}（最終チェック&完成）`;"
replacement_title = "const checkTitle = document.getElementById('checkTitleDisplay');\n        if (checkTitle && !isMaster) checkTitle.textContent = `🔍 ${title}（最終チェック&完成）`;"

if target_title in app_text:
    app_text = app_text.replace(target_title, replacement_title, 1)
    print("Fixed 6: protected master title from checkTitle override")
else:
    print("Warning: target_title not found in app.js")

# 7. 各フロアヘッダー行を最右端まで太線（border-top: 4px solid #334155 !important;）にする
target_floor_hdr = '''            // テーブルヘッダー1: 日付ヘッダー（全テーブル共通: 日付列幅52px完全均一固定・12/31等の二桁月日も1行で綺麗に収まり不要な左右スクロールを排除）
            html += `<tr style="background:${fc.headerBg}; font-weight:700; border-top: 3px solid ${fc.border};">
                <th class="sticky-col-1" style="background:${fc.headerBg}; color:${fc.badgeColor}; width:44px; min-width:44px; max-width:44px; text-align:center; padding:2px; border-right:1px solid ${fc.border};">階</th>
                <th class="sticky-col-2" style="background:${fc.headerBg}; color:#1e293b; width:95px; min-width:95px; max-width:105px; text-align:left; padding:2px 4px; border-right:2px solid #475569;">項目</th>`;
            for (let d = 0; d < numDays; d++) {
                const di = term.dates[d];
                const thickCls = getDayBorderClass(d);
                html += `<th class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${fc.headerBg}; font-size:0.78rem; padding:4px 2px; color:#1e293b; border-bottom:1px solid ${fc.border}; text-align:center; white-space:nowrap;">${di.m}/${di.day}</th>`;
            }
            html += `
                <th title="出勤日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">出勤</th>
                <th title="公休日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">公休</th>
                <th title="有給休暇日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; width:38px; min-width:38px; text-align:center; font-size:0.75rem; font-weight:800;">有休</th>
                <th title="リフレッシュ休暇日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">リフ</th>
                <th title="早番回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">早</th>
                <th title="遅番回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">遅</th>
                <th title="イブニング回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">E</th>
                <th title="8時開始回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">8時</th>
                <th style="background:${fc.headerBg}; color:${fc.badgeColor}; min-width:160px; max-width:260px; font-size:0.8rem; text-align:center; border-bottom:1px solid ${fc.border};">備考（メモ）</th>
            </tr>`;'''

replacement_floor_hdr = '''            // テーブルヘッダー1: 日付ヘッダー（最右端まで太い横罫線を引く: border-top: 4px solid #334155 !important;）
            html += `<tr class="floor-boundary-row" style="background:${fc.headerBg}; font-weight:700;">
                <th class="sticky-col-1" style="background:${fc.headerBg}; color:${fc.badgeColor}; width:44px; min-width:44px; max-width:44px; text-align:center; padding:2px; border-right:1px solid ${fc.border}; border-top: 4px solid #334155 !important;">階</th>
                <th class="sticky-col-2" style="background:${fc.headerBg}; color:#1e293b; width:95px; min-width:95px; max-width:105px; text-align:left; padding:2px 4px; border-right:2px solid #475569; border-top: 4px solid #334155 !important;">項目</th>`;
            for (let d = 0; d < numDays; d++) {
                const di = term.dates[d];
                const thickCls = getDayBorderClass(d);
                html += `<th class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${fc.headerBg}; font-size:0.78rem; padding:4px 2px; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; text-align:center; white-space:nowrap;">${di.m}/${di.day}</th>`;
            }
            html += `
                <th title="出勤日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">出勤</th>
                <th title="公休日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">公休</th>
                <th title="有給休暇日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem; font-weight:800;">有休</th>
                <th title="リフレッシュ休暇日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">リフ</th>
                <th title="早番回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">早</th>
                <th title="遅番回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">遅</th>
                <th title="イブニング回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">E</th>
                <th title="8時開始回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">8時</th>
                <th style="background:${fc.headerBg}; color:${fc.badgeColor}; min-width:160px; max-width:260px; font-size:0.8rem; text-align:center; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important;">備考（メモ）</th>
            </tr>`;'''

if target_floor_hdr in app_text:
    app_text = app_text.replace(target_floor_hdr, replacement_floor_hdr, 1)
    print("Fixed 7: full-width floor boundary row")
else:
    print("Warning: target_floor_hdr not found in app.js")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_text)
print("app.js updated successfully.")
