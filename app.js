/**
 * 勤務表作成システム - アプリケーションロジック (app.js)
 * 最新版:
 * - 8時可フラグ: 1〜9番目のスタッフのみON（現場の実態に完全一致）
 * - 8時勤務の優先割当＆8時可能スタッフの早遅Eからの温存保護
 * - Excel出力: 事前希望枠を「赤字の太字（Bold）」で確実にエクスポート
 * - 作業完了通知音「ポン♪」機能（Web Audio API）
 * - 障壁セルの薄いブルー網掛け＆解消時の自動クリア
 */

document.addEventListener('DOMContentLoaded', () => {
    const NUM_STAFF = 50;
    const NUM_DAYS = 28;
    const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

    let staffList = [];
    let currentSelectedSymbol = '休';
    let lastSolveResult = null;

    // ★ Web Audio API による心地よい短い「ポン♪」通知音の再生
    function playNotificationSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            // 主音（ポン）
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            const now = ctx.currentTime;
            osc.frequency.setValueAtTime(880, now); // ラ(A5)
            osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.15); // レ(D5)へスッと抜ける

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {
            // 音声非対応環境では静かにスキップ
        }
    }

    // スタッフデータの初期化
    function initStaffData() {
        staffList = [];
        for (let i = 1; i <= NUM_STAFF; i++) {
            staffList.push({
                id: i,
                name: `スタッフ ${String(i).padStart(2, '0')}`,
                can8: (i <= 9),      // ★ 1〜9番目のみ8時可能（現場の運用に完全一致）
                noEarly: false,     // 早番不可
                noLate: false,      // 遅番不可
                noEve: false,       // E不可
                prevDays: ['', '', '', '', ''],
                days: new Array(NUM_DAYS).fill('')
            });
        }
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
                can8: s.can8,
                noEarly: s.noEarly,
                noLate: s.noLate,
                noEve: s.noEve,
                prevDays: [...s.prevDays],
                days: [...s.days]
            })),
            startDate: document.getElementById('termStartDate')?.value || '2026-04-01'
        };
    }

    function pushHistory() {
        undoStack.push(getHistorySnapshot());
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        redoStack.length = 0; // 新規操作時はredoをクリア
        updateUndoRedoUI();
    }

    function undo() {
        if (undoStack.length === 0) return;
        redoStack.push(getHistorySnapshot());
        const prevState = undoStack.pop();
        restoreHistoryState(prevState);
        updateUndoRedoUI();
        showToast('↩ 直前の状態に戻しました');
    }

    function redo() {
        if (redoStack.length === 0) return;
        undoStack.push(getHistorySnapshot());
        const nextState = redoStack.pop();
        restoreHistoryState(nextState);
        updateUndoRedoUI();
        showToast('↪ やり直しました');
    }

    function restoreHistoryState(state) {
        if (!state || !state.staffList) return;
        state.staffList.forEach((s, idx) => {
            if (staffList[idx]) {
                staffList[idx].name = s.name;
                staffList[idx].can8 = s.can8;
                staffList[idx].noEarly = s.noEarly;
                staffList[idx].noLate = s.noLate;
                staffList[idx].noEve = s.noEve;
                staffList[idx].prevDays = [...s.prevDays];
                staffList[idx].days = [...s.days];
            }
        });
        if (state.startDate) {
            const startDateInput = document.getElementById('termStartDate');
            if (startDateInput && startDateInput.value !== state.startDate) {
                startDateInput.value = state.startDate;
                getTermInfo();
            }
        }
        clearConflictHighlights();
        renderInputTable();
    }

    function updateUndoRedoUI() {
        const undoDisabled = (undoStack.length === 0);
        const redoDisabled = (redoStack.length === 0);
        const undoBtns = [document.getElementById('undoBtn'), document.getElementById('headerUndoBtn')];
        const redoBtns = [document.getElementById('redoBtn')];

        undoBtns.forEach(btn => {
            if (btn) {
                btn.disabled = undoDisabled;
                btn.style.opacity = undoDisabled ? '0.5' : '1';
                btn.style.cursor = undoDisabled ? 'not-allowed' : 'pointer';
            }
        });
        redoBtns.forEach(btn => {
            if (btn) {
                btn.disabled = redoDisabled;
                btn.style.opacity = redoDisabled ? '0.5' : '1';
                btn.style.cursor = redoDisabled ? 'not-allowed' : 'pointer';
            }
        });
    }

    // サンプルデータの生成（現場の運用に合わせて1〜9番のみ8時可）
    function loadSampleData() {
        initStaffData();

        const names = [
            "佐藤 健一", "鈴木 美咲", "高橋 浩", "田中 優子", "伊藤 直樹",
            "渡辺 恵子", "山本 大介", "中村 陽子", "小林 誠", "加藤 真理",
            "吉田 拓也", "山田 綾子", "佐々木 亮", "山口 香織", "松本 健",
            "井上 裕子", "木村 剛", "林 由美", "斎藤 翔太", "清水 さやか",
            "山崎 達也", "森 千春", "池田 健二", "橋本 麻美", "阿部 孝",
            "石川 智子", "山下 勇気", "中島 瞳", "石井 秀樹", "小川 美緒",
            "前田 慎太郎", "岡田 菜々", "長谷川 徹", "藤田 美紀", "後藤 雅人",
            "近藤 智子", "村上 康平", "遠藤 涼子", "青木 悠", "坂本 由加",
            "斉藤 貴之", "福田 裕美", "三浦 健司", "藤井 留美", "岡本 俊樹",
            "松田 裕子", "中川 雄太", "中野 亜紀", "原田 隆", "小野 奈央"
        ];

        names.forEach((name, idx) => {
            if (staffList[idx]) staffList[idx].name = name;
        });

        // 8時可フラグ: 1〜9番目（佐藤さん〜小林さん）のみON！10番以降はOFF
        staffList.forEach((s, idx) => {
            s.can8 = (idx < 9);
        });

        // 個別不可フラグ（現場の実態画像に合わせて設定）
        staffList[12].noEarly = true; // 13番 佐々木さん（早・遅・E不可）
        staffList[12].noLate = true;
        staffList[12].noEve = true;
        staffList[14].noEve = true;   // 15番 松本さん（E不可）
        staffList[15].noEve = true;   // 16番 井上さん（E不可）

        // 前ターム実績（画像の通り設定）
        staffList[0].prevDays = ['○', '○', '休', '○', '○'];
        staffList[1].prevDays = ['休', '休', '○', '○', '○'];
        staffList[2].prevDays = ['○', '休', '○', '○', '休'];
        staffList[3].prevDays = ['○', '○', '○', '○', '休'];
        staffList[4].prevDays = ['休', '○', '○', '○', '○'];
        staffList[5].prevDays = ['○', '○', '休', '○', '○'];
        staffList[6].prevDays = ['休', '休', '○', '○', '○'];
        staffList[7].prevDays = ['○', '休', '○', '○', '休'];
        staffList[8].prevDays = ['○', '○', '○', '○', '休'];

        for (let i = 9; i < NUM_STAFF; i++) {
            const patterns = [
                ['休', '○', '○', '○', '○'],
                ['○', '○', '休', '○', '○'],
                ['休', '休', '○', '○', '○'],
                ['○', '休', '○', '○', '休'],
                ['○', '○', '○', '○', '休']
            ];
            staffList[i].prevDays = [...patterns[i % patterns.length]];
        }

        // 当タームの事前固定枠（画像の通り反映）
        staffList[0].days[3] = '休'; // 佐藤さん 4日目休
        staffList[1].days[4] = '有'; staffList[1].days[8] = '休'; // 鈴木さん
        staffList[2].days[13] = '休'; // 高橋さん 14日目休
        staffList[3].days[19] = '休'; // 田中さん 20日目休
        staffList[5].days[0] = '休'; // 渡辺さん 1日目休、10〜14日目夏リフ
        staffList[5].days[9] = '上1'; staffList[5].days[10] = '上2'; staffList[5].days[11] = '上3'; staffList[5].days[12] = '上4'; staffList[5].days[13] = '上5';
        staffList[6].days[6] = '休'; // 山本さん 7日目休
        staffList[7].days[12] = '休'; // 中村さん 13日目休
        staffList[8].days[17] = '休'; // 小林さん 18日目休
        staffList[9].days[15] = '有'; // 加藤さん 16日目有
        staffList[10].days[13] = '出'; staffList[10].days[14] = '出'; // 吉田さん 14,15日目出張
        staffList[11].days[4] = '休'; // 山田さん 5日目休
        staffList[12].days[9] = '休'; // 佐々木さん 10日目休
        staffList[13].days[14] = '休'; // 山口さん 15日目休
        staffList[14].days[20] = '休'; // 松本さん 21日目休

        // その他のスタッフの希望休（28日間に均等分散）
        for (let i = 15; i < NUM_STAFF; i++) {
            const d1 = (i * 3 + 2) % 27;
            staffList[i].days[d1] = (i % 6 === 0) ? '有' : '休';
        }

        clearConflictHighlights();
        renderInputTable();
    }

    // 矛盾（解なし）検証用データ
    function loadConflictSampleData() {
        initStaffData();
        loadSampleData();

        // 10日目に希望休・有休を集中させ、出勤可能人数を不足させる
        for (let s = 0; s < 45; s++) {
            staffList[s].days[9] = (s % 4 === 0) ? '有' : '休';
        }

        renderInputTable();
        alert('【エラーハンドリング検証用データ】を投入しました。\n「10日目」に希望休が集中しています。\n「⚡ 勤務表を自動生成する」を押すと、障壁となっている10日目の休みセルが【薄いブルーで網掛け】されます。');
    }

    // 入力テーブル描画
    function renderInputTable() {
        const thead = document.getElementById('inputTableHead');
        const tbody = document.getElementById('inputTableBody');
        if (!thead || !tbody) return;

        const term = getTermInfo();

        let headHtml = `
            <tr>
                <th class="sticky-col-1" rowspan="2">No</th>
                <th class="sticky-col-2" rowspan="2">氏名</th>
                <th class="flag-col" rowspan="2" title="8時開始可能か（1〜9番のみON）">8時<br>可</th>
                <th class="flag-col" rowspan="2" title="早番不可">早<br>不可</th>
                <th class="flag-col" rowspan="2" title="遅番不可">遅<br>不可</th>
                <th class="flag-col" rowspan="2" title="イブニング不可">E<br>不可</th>
                <th class="prev-col-header" colspan="5">前ターム最終5日間実績</th>
                <th colspan="${NUM_DAYS}">当ターム（${term.title}）希望休・事前固定枠（🔒手動以外は変更不可）</th>
            </tr>
            <tr>
                <th class="prev-col-header">前5</th>
                <th class="prev-col-header">前4</th>
                <th class="prev-col-header">前3</th>
                <th class="prev-col-header">前2</th>
                <th class="prev-col-header">前1</th>
        `;

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const cls = di.wIdx === 5 ? 'header-sat' : (di.wIdx === 6 ? 'header-sun' : '');
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            headHtml += `<th class="${cls} ${thickCls}" title="${di.label} (${di.weekday})">${di.label}<br><small>${di.weekday}</small></th>`;
        }
        headHtml += `</tr>`;
        thead.innerHTML = headHtml;

        let bodyHtml = '';
        staffList.forEach((staff, sIdx) => {
            bodyHtml += `<tr>`;
            bodyHtml += `<td class="sticky-col-1 font-mono">${staff.id}</td>`;
            bodyHtml += `<td class="sticky-col-2">
                <input type="text" class="staff-name-input" value="${staff.name}" data-s="${sIdx}" style="width:100%; border:none; background:transparent; font-weight:600; outline:none;">
            </td>`;

            bodyHtml += `
                <td class="flag-col">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.can8 ? 'checked' : ''} data-flag="can8" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.noEarly ? 'checked' : ''} data-flag="noEarly" data-s="${sIdx}">
                        <span class="toggle-slider danger-slider"></span>
                    </label>
                </td>
                <td class="flag-col">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.noLate ? 'checked' : ''} data-flag="noLate" data-s="${sIdx}">
                        <span class="toggle-slider danger-slider"></span>
                    </label>
                </td>
                <td class="flag-col">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.noEve ? 'checked' : ''} data-flag="noEve" data-s="${sIdx}">
                        <span class="toggle-slider danger-slider"></span>
                    </label>
                </td>
            `;

            for (let p = 0; p < 5; p++) {
                const val = staff.prevDays[p] || '';
                bodyHtml += `<td class="day-cell prev-col-cell" data-type="prev" data-s="${sIdx}" data-p="${p}">${val}</td>`;
            }

            for (let d = 0; d < NUM_DAYS; d++) {
                const val = staff.days[d] || '';
                const cls = val ? 'day-cell fixed-cell' : 'day-cell';
                const lockTitle = val ? `事前固定枠: ${val}（自動上書きロック中）` : 'クリックで記号入力';
                bodyHtml += `<td class="${cls}" data-type="day" data-s="${sIdx}" data-d="${d}" title="${lockTitle}">${val}</td>`;
            }

            bodyHtml += `</tr>`;
        });
        tbody.innerHTML = bodyHtml;

        attachInputTableEvents();
    }

    function attachInputTableEvents() {
        document.querySelectorAll('.staff-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                if (staffList[s].name !== e.target.value) {
                    pushHistory();
                    staffList[s].name = e.target.value;
                }
            });
        });

        document.querySelectorAll('input[type="checkbox"][data-flag]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const flag = e.target.dataset.flag;
                pushHistory();
                staffList[s][flag] = e.target.checked;
            });
        });

        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const s = parseInt(cell.dataset.s, 10);
                const type = cell.dataset.type;

                let newSym = currentSelectedSymbol;
                if (currentSelectedSymbol === 'CLEAR') {
                    newSym = '';
                }

                if (type === 'prev') {
                    const p = parseInt(cell.dataset.p, 10);
                    if (staffList[s].prevDays[p] !== newSym) {
                        pushHistory();
                        staffList[s].prevDays[p] = newSym;
                        cell.textContent = newSym;
                    }
                } else if (type === 'day') {
                    const d = parseInt(cell.dataset.d, 10);
                    if (staffList[s].days[d] !== newSym) {
                        pushHistory();
                        staffList[s].days[d] = newSym;
                        cell.textContent = newSym;

                        if (newSym) {
                            cell.classList.add('fixed-cell');
                            cell.title = `事前固定枠: ${newSym}（自動上書きロック中）`;
                        } else {
                            cell.classList.remove('fixed-cell');
                            cell.title = 'クリックで記号入力';
                        }

                        if (cell.classList.contains('conflict-highlight')) {
                            cell.classList.remove('conflict-highlight');
                            cell.removeAttribute('data-conflict-reason');

                            const remaining = document.querySelectorAll('.conflict-highlight');
                            if (remaining.length === 0) {
                                const banner = document.getElementById('conflictAlertBanner');
                                if (banner) banner.classList.remove('show');
                            }
                        }
                    }
                }
            });
        });
    }

    function applyConflictHighlights(conflictCells) {
        clearConflictHighlights();

        if (!conflictCells || conflictCells.length === 0) return;

        conflictCells.forEach(item => {
            const cell = document.querySelector(`td[data-type="day"][data-s="${item.staffIndex}"][data-d="${item.dayIndex}"]`);
            if (cell) {
                cell.classList.add('conflict-highlight');
                cell.setAttribute('data-conflict-reason', item.reason || '障壁箇所');
                cell.title = `⚠️ 【障壁箇所】${item.reason || '制約の衝突原因となっています'}`;
            }
        });

        const banner = document.getElementById('conflictAlertBanner');
        if (banner) {
            banner.classList.add('show');
            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.4rem;">ℹ️</span>
                    <div>
                        <strong style="color:#1e3a8a;">障壁となっている箇所（薄いブルーの網掛けセル: ${conflictCells.length}箇所）を特定しました</strong>
                        <div style="font-size:0.82rem; color:#2563eb; margin-top:2px;">
                            該当セルをクリックして希望休を出勤に変更するなど調整してください。解消すると網掛けが消えます。
                        </div>
                    </div>
                </div>
                <button class="btn btn-outline" style="font-size:0.75rem; padding:4px 10px;" onclick="document.getElementById('conflictAlertBanner').classList.remove('show');">閉じる</button>
            `;
        }

        switchTab('inputTab');
        const firstCell = document.querySelector('.conflict-highlight');
        if (firstCell) {
            firstCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    function clearConflictHighlights() {
        document.querySelectorAll('.conflict-highlight').forEach(cell => {
            cell.classList.remove('conflict-highlight');
            cell.removeAttribute('data-conflict-reason');
            const val = cell.textContent.trim();
            cell.title = val ? `事前固定枠: ${val}（自動上書きロック中）` : 'クリックで記号入力';
        });
        const banner = document.getElementById('conflictAlertBanner');
        if (banner) banner.classList.remove('show');
    }

    document.querySelectorAll('.palette-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentSelectedSymbol = btn.dataset.sym;
        });
    });

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(tabId) {
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === tabId);
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // ★ ターム期間・タイトル情報の取得（※/※※～※/※※勤務表）
    function getTermInfo() {
        const input = document.getElementById('termStartDate');
        const startStr = input && input.value ? input.value : '2026-04-01';
        const parts = startStr.split('-').map(Number);
        const startDate = new Date(parts[0], parts[1] - 1, parts[2]);

        const dates = [];
        for (let i = 0; i < NUM_DAYS; i++) {
            const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const wIdx = (d.getDay() + 6) % 7; // 月曜=0, 日曜=6
            dates.push({
                m,
                day,
                weekday: WEEKDAYS[wIdx],
                label: `${m}/${day}`,
                wIdx,
                dateObj: d
            });
        }
        const first = dates[0];
        const last = dates[NUM_DAYS - 1];
        const title = `${first.m}/${first.day}～${last.m}/${last.day}勤務表`;

        // UI表示の更新
        const endDisplay = document.getElementById('termEndDateDisplay');
        if (endDisplay) {
            const lastY = last.dateObj.getFullYear();
            const lastM = String(last.m).padStart(2, '0');
            const lastD = String(last.day).padStart(2, '0');
            endDisplay.textContent = `${lastY}-${lastM}-${lastD}`;
        }
        const badge = document.getElementById('termTitleBadge');
        if (badge) badge.textContent = title;
        const outTitle = document.getElementById('outputTitleDisplay');
        if (outTitle) outTitle.textContent = title;

        return { title, dates, first, last };
    }

    const termStartDateInput = document.getElementById('termStartDate');
    if (termStartDateInput) {
        termStartDateInput.addEventListener('change', () => {
            getTermInfo();
            renderInputTable();
            if (lastSolveResult) {
                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        });
    }

    // ソルバー実行ボタン
    const solveBtn = document.getElementById('solveBtn');
    solveBtn.addEventListener('click', () => {
        solveBtn.disabled = true;
        solveBtn.innerHTML = `
            <svg class="animate-spin" style="width:16px;height:16px;margin-right:6px;display:inline-block;animation:spin 1s linear infinite;" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity:0.25;"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            最適化計算中...
        `;

        setTimeout(() => {
            try {
                // ★ 公休日数設定（通常8.0日 / 3月公休調整8.5日）の取得
                const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                const scheduler = new ShiftScheduler(staffList, { standardHolidays: stdHolidayVal });
                const result = scheduler.solve();

                solveBtn.disabled = false;
                solveBtn.innerHTML = `⚡ 勤務表を自動生成する`;

                if (result.success) {
                    clearConflictHighlights();
                    lastSolveResult = result;
                    renderOutputTable(result.grid, result.stats);
                    renderStatsDashboard(result.stats);
                    switchTab('outputTab');
                    // （※勤務表作成完了の効果音はご要望により停止）
                } else {
                    applyConflictHighlights(result.conflictCells);
                    showErrorModal(result.errors);
                }
            } catch (err) {
                solveBtn.disabled = false;
                solveBtn.innerHTML = `⚡ 勤務表を自動生成する`;
                showErrorModal([`予期せぬエラーが発生しました: ${err.message}`]);
            }
        }, 80);
    });

    // 出力テーブル描画（画像3のメリハリある罫線と「※/※※～※/※※勤務表」タイトルを反映）
    function renderOutputTable(grid, stats) {
        const thead = document.getElementById('outputTableHead');
        const tbody = document.getElementById('outputTableBody');
        const tfoot = document.getElementById('outputTableFoot');
        if (!thead || !tbody || !tfoot) return;

        const term = getTermInfo();

        let headHtml = `
            <tr>
                <th class="sticky-col-1 border-thick-bottom" rowspan="2">No</th>
                <th class="sticky-col-2 border-thick-right border-thick-bottom" rowspan="2">氏名</th>
                <th colspan="${NUM_DAYS}" class="border-thick-right border-thick-bottom" style="font-size:0.95rem; font-weight:800; background:#f8fafc; color:#1e293b;">${term.title}</th>
                <th colspan="8" class="border-thick-bottom" style="background:#e0f2fe; color:#0369a1; font-weight:800;">勤務・休暇 集計</th>
            </tr>
            <tr>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dateInfo = term.dates[d];
            const cls = dateInfo.wIdx === 5 ? 'header-sat' : (dateInfo.wIdx === 6 ? 'header-sun' : '');
            // 7日ごと（週区切り）および28日目に太線
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            headHtml += `<th class="${cls} ${thickCls} border-thick-bottom">${dateInfo.label}<br><small>${dateInfo.weekday}</small></th>`;
        }
        headHtml += `
                <th title="出勤日数" class="border-thick-bottom" style="background:#f1f5f9;">出勤</th>
                <th title="公休日数" class="border-thick-bottom" style="background:#f1f5f9; color:#2563eb;">公休</th>
                <th title="有給休暇日数" class="border-thick-bottom" style="background:#fef3c7; color:#b45309; font-weight:800;">有休</th>
                <th title="リフレッシュ休暇日数" class="border-thick-bottom" style="background:#f1f5f9; color:#059669;">リフ</th>
                <th title="早番回数" class="border-thick-bottom" style="background:#f1f5f9;">早</th>
                <th title="遅番回数" class="border-thick-bottom" style="background:#f1f5f9;">遅</th>
                <th title="イブニング回数" class="border-thick-bottom" style="background:#f1f5f9;">E</th>
                <th title="8時開始回数" class="border-thick-bottom" style="background:#f1f5f9;">8時</th>
            </tr>
        `;
        thead.innerHTML = headHtml;

        let bodyHtml = '';
        for (let s = 0; s < NUM_STAFF; s++) {
            const staff = staffList[s];
            const staffStat = stats.staffStats[s];
            const isLastStaff = (s === NUM_STAFF - 1);
            const rowBottomCls = isLastStaff ? 'border-thick-bottom' : '';

            bodyHtml += `<tr>`;
            bodyHtml += `<td class="sticky-col-1 font-mono ${rowBottomCls}">${staff.id}</td>`;
            bodyHtml += `<td class="sticky-col-2 border-thick-right ${rowBottomCls}">${staff.name}</td>`;

            for (let d = 0; d < NUM_DAYS; d++) {
                const cell = grid[s][d];
                const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                // 事前入力希望枠は赤字・太字（網掛けなし！）
                const cls = cell.isFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';
                const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
                const titleText = cell.isFixed ? '🔒 事前固定希望枠（赤字・太字保持）' : 'システム自動配置';
                bodyHtml += `<td class="${cls} ${thickCls} ${rowBottomCls}" title="${titleText}">${displaySym}</td>`;
            }

            bodyHtml += `
                <td style="font-weight:700; background:#f8fafc;">${staffStat.workDays}</td>
                <td style="font-weight:700; color:#2563eb; background:#f8fafc;">${staffStat.offDays}</td>
                <td style="font-weight:800; color:#b45309; background:#fffbeb;">${staffStat.paidDays}</td>
                <td style="font-weight:600; color:#059669; background:#f8fafc;">${staffStat.refDays}</td>
                <td style="font-weight:600; color:#d97706; background:#f8fafc;">${staffStat.early}</td>
                <td style="font-weight:600; color:#0284c7; background:#f8fafc;">${staffStat.late}</td>
                <td style="font-weight:600; color:#7c3aed; background:#f8fafc;">${staffStat.eve}</td>
                <td style="font-weight:600; color:#0d9488; background:#f8fafc;">${staffStat.h8}</td>
            `;
            bodyHtml += `</tr>`;
        }
        tbody.innerHTML = bodyHtml;

        const totalWorkSum = stats.staffStats.reduce((acc, s) => acc + s.workDays, 0);
        const totalOffSum = stats.staffStats.reduce((acc, s) => acc + s.offDays, 0);
        const totalPaidSum = stats.staffStats.reduce((acc, s) => acc + s.paidDays, 0);
        const totalRefSum = stats.staffStats.reduce((acc, s) => acc + s.refDays, 0);
        const totalEarlySum = stats.staffStats.reduce((acc, s) => acc + s.early, 0);
        const totalLateSum = stats.staffStats.reduce((acc, s) => acc + s.late, 0);
        const totalEveSum = stats.staffStats.reduce((acc, s) => acc + s.eve, 0);
        const totalH8Sum = stats.staffStats.reduce((acc, s) => acc + s.h8, 0);

        let footHtml = `
            <tr style="background:#f8fafc; font-weight:bold;">
                <th class="sticky-col-1" colspan="2">出勤人数合計</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls}" style="font-weight:800; color:#1e293b;">${dStat.totalWork}</td>`;
        }
        footHtml += `
            <td style="font-weight:700;">${totalWorkSum}</td>
            <td style="font-weight:700; color:#2563eb;">${totalOffSum}</td>
            <td style="font-weight:800; color:#b45309; background:#fffbeb;">${totalPaidSum}</td>
            <td style="font-weight:600; color:#059669;">${totalRefSum}</td>
            <td style="font-weight:600;">${totalEarlySum}</td>
            <td style="font-weight:600;">${totalLateSum}</td>
            <td style="font-weight:600;">${totalEveSum}</td>
            <td style="font-weight:600;">${totalH8Sum}</td>
        </tr>`;

        // 早番
        footHtml += `
            <tr style="background:#fff7ed; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#c2410c;">早番</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls}" style="color:#c2410c; font-weight:700;">${dStat.early}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // 遅番
        footHtml += `
            <tr style="background:#f0f9ff; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#0369a1;">遅番</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls}" style="color:#0369a1; font-weight:700;">${dStat.late}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // E (イブニング)
        footHtml += `
            <tr style="background:#faf5ff; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#7e22ce;">E</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls}" style="color:#7e22ce; font-weight:700;">${dStat.eve}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // 8時勤務
        footHtml += `
            <tr style="background:#f0fdfa; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1 border-thick-bottom" colspan="2" style="color:#0f766e;">8時</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls} border-thick-bottom" style="color:#0f766e; font-weight:700;">${dStat.h8}</td>`;
        }
        footHtml += `<td class="border-thick-bottom" colspan="8" style="color:#94a3b8;">-</td></tr>`;

        tfoot.innerHTML = footHtml;
    }

    function renderStatsDashboard(stats) {
        const avgDailyWork = (stats.daily.reduce((sum, d) => sum + d.totalWork, 0) / NUM_DAYS).toFixed(1);
        const minWork = Math.min(...stats.daily.map(d => d.totalWork));
        const maxWork = Math.max(...stats.daily.map(d => d.totalWork));

        document.getElementById('statAvgWork').textContent = `${avgDailyWork} 名`;
        document.getElementById('statWorkRange').textContent = `${minWork} 〜 ${maxWork} 名 (ブレ幅: ${maxWork - minWork})`;

        const totalEarly = stats.staffStats.reduce((sum, s) => sum + s.early, 0);
        const totalLate = stats.staffStats.reduce((sum, s) => sum + s.late, 0);
        const totalEve = stats.staffStats.reduce((sum, s) => sum + s.eve, 0);
        const totalH8 = stats.staffStats.reduce((sum, s) => sum + s.h8, 0);
        document.getElementById('statSpecialCounts').textContent = `早: ${totalEarly}回 / 遅: ${totalLate}回 / E: ${totalEve}回 / 8時: ${totalH8}回`;

        const chartEl = document.getElementById('dailyWorkChart');
        if (chartEl) {
            let chartHtml = '';
            stats.daily.forEach(d => {
                const pct = Math.min(100, Math.max(10, (d.totalWork / 50) * 100));
                chartHtml += `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                        <span style="font-size:0.7rem; font-weight:700;">${d.totalWork}</span>
                        <div style="width:100%; background:#e2e8f0; height:120px; border-radius:4px; display:flex; align-items:flex-end;">
                            <div style="width:100%; background:#3b82f6; height:${pct}%; border-radius:4px; transition:height 0.3s;"></div>
                        </div>
                        <span style="font-size:0.7rem; color:#64748b;">${d.day}</span>
                    </div>
                `;
            });
            chartEl.innerHTML = chartHtml;
        }
    }

    const errorModal = document.getElementById('errorModal');
    const errorListEl = document.getElementById('errorList');
    const closeModalBtn = document.getElementById('closeModalBtn');

    function showErrorModal(errors) {
        if (!errorModal || !errorListEl) {
            alert(errors.join('\n'));
            return;
        }
        errorListEl.innerHTML = errors.map(err => `<li class="error-item">⚠️ ${err}</li>`).join('');
        errorModal.classList.add('open');
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            errorModal.classList.remove('open');
        });
    }

    document.getElementById('loadSampleBtn').addEventListener('click', () => {
        pushHistory();
        loadSampleData();
        showToast('🎲 サンプルデータを投入しました（「↩ 戻る」で元に戻せます）');
    });

    const conflictBtn = document.getElementById('loadConflictBtn');
    if (conflictBtn) {
        conflictBtn.addEventListener('click', () => {
            pushHistory();
            loadConflictSampleData();
        });
    }

    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if (confirm('すべての事前入力枠および設定をクリアしますか？')) {
            pushHistory();
            clearConflictHighlights();
            initStaffData();
            renderInputTable();
            showToast('🧹 全消去しました（「↩ 戻る」で元に戻せます）');
        }
    });

    // ★ 戻る（Undo） / やり直す（Redo） ボタンイベント
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.addEventListener('click', undo);

    const headerUndoBtn = document.getElementById('headerUndoBtn');
    if (headerUndoBtn) headerUndoBtn.addEventListener('click', undo);

    const redoBtn = document.getElementById('redoBtn');
    if (redoBtn) redoBtn.addEventListener('click', redo);

    // ★ キーボードショートカット (Ctrl+Z: 戻る / Ctrl+Y: やり直す)
    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            // テキスト入力欄にフォーカスがある時はブラウザ標準の文字Undoに委ねる
            return;
        }

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
            e.preventDefault();
            redo();
        }
    });

    // トースト通知関数
    function showToast(message, type = 'success') {
        let toast = document.getElementById('appToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'appToast';
            toast.className = 'app-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `app-toast show ${type}`;
        setTimeout(() => {
            toast.className = 'app-toast';
        }, 3500);
    }

    // 列インデックス (0 = A, 2 = C, 29 = AD, etc.) からExcel列名 (A, B, C, ..., AD) を取得
    function getExcelColName(colIdx) {
        let name = '';
        let num = colIdx + 1;
        while (num > 0) {
            let mod = (num - 1) % 26;
            name = String.fromCharCode(65 + mod) + name;
            num = Math.floor((num - mod) / 26);
        }
        return name;
    }

    // 1. ★ Excelへ一発貼り付け用コピー（書式・赤字太字・自動計算数式付き）
    const copyForExcelBtn = document.getElementById('copyForExcelBtn');
    if (copyForExcelBtn) {
        copyForExcelBtn.addEventListener('click', () => {
            if (!lastSolveResult) {
                alert('先に勤務表を自動生成してください。');
                return;
            }
            copyForExcel(lastSolveResult.grid, lastSolveResult.stats);
        });
    }

    function copyForExcel(grid, stats) {
        const term = getTermInfo();
        const startCol = 'C';
        const endCol = 'AD';

        // 罫線スタイル定義（画像3のメリハリある区切り）
        const fontMeiryo = "font-family:'Meiryo', 'Yu Gothic', 'MS PGothic', sans-serif;";
        const borderThin = 'border:0.5pt solid #cbd5e1;';
        const borderThickR = 'border-right:2pt solid #475569;';
        const borderMediumR = 'border-right:1.5pt solid #64748b;';
        const borderThickB = 'border-bottom:2pt solid #475569;';

        let html = `<table style="border-collapse:collapse; ${fontMeiryo} font-size:10pt; border:2pt solid #475569;">
<thead>
  <tr>
    <th rowspan="2" style="${fontMeiryo} background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickB}">No</th>
    <th rowspan="2" style="${fontMeiryo} background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickR} ${borderThickB}">氏名</th>
    <th colspan="${NUM_DAYS}" style="${fontMeiryo} background-color:#f8fafc; color:#1e293b; font-weight:bold; font-size:11pt; ${borderThin} ${borderThickR} ${borderThickB}">${term.title}</th>
    <th colspan="8" style="${fontMeiryo} background-color:#e0f2fe; color:#0369a1; font-weight:bold; ${borderThin} ${borderThickB}">勤務・休暇 集計（自動計算数式）</th>
  </tr>
  <tr>
`;

        for (let d = 0; d < NUM_DAYS; d++) {
            const dateInfo = term.dates[d];
            const bg = dateInfo.wIdx === 5 ? '#e0f2fe' : (dateInfo.wIdx === 6 ? '#ffe4e6' : '#f1f5f9');
            const col = dateInfo.wIdx === 5 ? '#0284c7' : (dateInfo.wIdx === 6 ? '#e11d48' : '#1e293b');
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            html += `    <th style="${fontMeiryo} background-color:${bg}; color:${col}; font-weight:bold; ${borderThin} ${rightBorder} ${borderThickB}">${dateInfo.label}<br><small>${dateInfo.weekday}</small></th>\n`;
        }

        html += `    <th style="${fontMeiryo} background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickB}">出勤</th>
    <th style="${fontMeiryo} background-color:#f1f5f9; color:#2563eb; font-weight:bold; ${borderThin} ${borderThickB}">公休</th>
    <th style="${fontMeiryo} background-color:#fef3c7; color:#b45309; font-weight:bold; ${borderThin} ${borderThickB}">有休</th>
    <th style="${fontMeiryo} background-color:#f1f5f9; color:#059669; font-weight:bold; ${borderThin} ${borderThickB}">リフ</th>
    <th style="${fontMeiryo} background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickB}">早</th>
    <th style="${fontMeiryo} background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickB}">遅</th>
    <th style="${fontMeiryo} background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickB}">E</th>
    <th style="${fontMeiryo} background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickB}">8時</th>
  </tr>
</thead>
<tbody>
`;

        let plainText = 'No\t氏名';
        for (let d = 0; d < NUM_DAYS; d++) plainText += `\t${term.dates[d].label}`;
        plainText += '\t出勤\t公休\t有休\tリフ\t早\t遅\tE\t8時\r\n';

        for (let s = 0; s < NUM_STAFF; s++) {
            const staff = staffList[s];
            const rowNum = s + 4; // Excel上の行番号 (4〜53)
            const isLastStaff = (s === NUM_STAFF - 1);
            const rowBottom = isLastStaff ? borderThickB : '';
            const rng = `${startCol}${rowNum}:${endCol}${rowNum}`;

            // 各種数式 (半日出勤・半日休の0.5加算を含む。○と〇の両方を完全集計！)
            const fWork = `=COUNTIF(${rng},"○")+COUNTIF(${rng},"〇")+COUNTIF(${rng},"◯")+COUNTIF(${rng},"出")+COUNTIF(${rng},"早")+COUNTIF(${rng},"遅")+COUNTIF(${rng},"E")+COUNTIF(${rng},"8時")+0.5*(COUNTIF(${rng},"○/休")+COUNTIF(${rng},"〇/休")+COUNTIF(${rng},"休/○")+COUNTIF(${rng},"休/〇")+COUNTIF(${rng},"○/有")+COUNTIF(${rng},"〇/有")+COUNTIF(${rng},"有/○")+COUNTIF(${rng},"有/〇"))`;
            const fOff = `=COUNTIF(${rng},"休")+0.5*(COUNTIF(${rng},"○/休")+COUNTIF(${rng},"〇/休")+COUNTIF(${rng},"休/○")+COUNTIF(${rng},"休/〇"))`;
            const fPaid = `=COUNTIF(${rng},"有")+0.5*(COUNTIF(${rng},"○/有")+COUNTIF(${rng},"〇/有")+COUNTIF(${rng},"有/○")+COUNTIF(${rng},"有/〇"))`;
            const fRef = `=COUNTIF(${rng},"上1")+COUNTIF(${rng},"上2")+COUNTIF(${rng},"上3")+COUNTIF(${rng},"上4")+COUNTIF(${rng},"上5")+COUNTIF(${rng},"下1")+COUNTIF(${rng},"下2")+COUNTIF(${rng},"下3")`;
            const fEarly = `=COUNTIF(${rng},"早")`;
            const fLate = `=COUNTIF(${rng},"遅")`;
            const fEve = `=COUNTIF(${rng},"E")`;
            const fH8 = `=COUNTIF(${rng},"8時")`;

            html += `  <tr>\n`;
            html += `    <td style="${fontMeiryo} font-weight:bold; ${borderThin} ${rowBottom} text-align:center;">${staff.id}</td>\n`;
            html += `    <td style="${fontMeiryo} font-weight:bold; ${borderThin} ${borderThickR} ${rowBottom} text-align:left;">${staff.name}</td>\n`;

            plainText += `${staff.id}\t${staff.name}`;

            for (let d = 0; d < NUM_DAYS; d++) {
                const cell = grid[s][d];
                let rawSym = cell.symbol || '';
                // Excel貼り付け時にArial環境でも確実に大きな丸「○」に見えるよう、漢数字ゼロ「〇」(U+3007)に統一
                let sym = rawSym.replace(/[◦•･◯○●]/g, '〇');
                plainText += `\t${sym}`;
                const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');

                // ★ 要望対応: 希望枠の網掛け（背景色）は完全除去！文字色のみ赤字・太字！
                if (cell.isFixed) {
                    html += `    <td style="${fontMeiryo} color:#DC2626 !important; font-weight:bold !important; ${borderThin} ${rightBorder} ${rowBottom} text-align:center;"><font face="Meiryo"><b style="color:#DC2626;">${sym}</b></font></td>\n`;
                } else {
                    html += `    <td style="${fontMeiryo} ${borderThin} ${rightBorder} ${rowBottom} text-align:center;"><font face="Meiryo">${sym}</font></td>\n`;
                }
            }

            const staffStat = (stats.staffStats && stats.staffStats[s]) ? stats.staffStats[s] : { workDays: 0, offDays: 0, paidDays: 0, refDays: 0, early: 0, late: 0, eve: 0, h8: 0 };

            html += `    <td style="${fontMeiryo} font-weight:bold; ${borderThin} ${rowBottom} text-align:center;">${fWork}</td>\n`;
            html += `    <td style="${fontMeiryo} font-weight:bold; color:#2563eb; ${borderThin} ${rowBottom} text-align:center;">${fOff}</td>\n`;
            html += `    <td style="${fontMeiryo} font-weight:bold; color:#b45309; background-color:#fef3c7; ${borderThin} ${rowBottom} text-align:center;">${fPaid}</td>\n`;
            html += `    <td style="${fontMeiryo} font-weight:bold; color:#059669; ${borderThin} ${rowBottom} text-align:center;">${fRef}</td>\n`;
            html += `    <td style="${fontMeiryo} ${borderThin} ${rowBottom} text-align:center;">${fEarly}</td>\n`;
            html += `    <td style="${fontMeiryo} ${borderThin} ${rowBottom} text-align:center;">${fLate}</td>\n`;
            html += `    <td style="${fontMeiryo} ${borderThin} ${rowBottom} text-align:center;">${fEve}</td>\n`;
            html += `    <td style="${fontMeiryo} ${borderThin} ${rowBottom} text-align:center;">${fH8}</td>\n`;
            html += `  </tr>\n`;

            plainText += `\t${fWork}\t${fOff}\t${fPaid}\t${fRef}\t${fEarly}\t${fLate}\t${fEve}\t${fH8}\r\n`;
        }

        // ==========================================
        // フッター行の定義 (54行目〜58行目を独立配置)
        // ==========================================
        html += `</tbody>\n<tfoot>\n`;

        const startRow = 4;
        const endRow = NUM_STAFF + 3; // 53行目

        // 1. 54行目: 出勤人数合計
        html += `  <tr style="background-color:#f8fafc; font-weight:bold;">\n`;
        html += `    <th colspan="2" style="${fontMeiryo} ${borderThin} ${borderThickR} border-bottom:1pt solid #64748b; text-align:center;">出勤人数合計</th>\n`;
        plainText += `出勤人数合計\t-`;

        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2); // 0日目 = C列
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayWork = `=COUNTIF(${colRng},"○")+COUNTIF(${colRng},"〇")+COUNTIF(${colRng},"◯")+COUNTIF(${colRng},"出")+COUNTIF(${colRng},"早")+COUNTIF(${colRng},"遅")+COUNTIF(${colRng},"E")+COUNTIF(${colRng},"8時")+0.5*(COUNTIF(${colRng},"○/休")+COUNTIF(${colRng},"〇/休")+COUNTIF(${colRng},"休/○")+COUNTIF(${colRng},"休/〇")+COUNTIF(${colRng},"○/有")+COUNTIF(${colRng},"〇/有")+COUNTIF(${colRng},"有/○")+COUNTIF(${colRng},"有/〇"))`;
            html += `    <td style="${fontMeiryo} font-weight:bold; ${borderThin} ${rightBorder} border-bottom:1pt solid #64748b; text-align:center;">${fDayWork}</td>\n`;
            plainText += `\t${fDayWork}`;
        }
        // AE〜AL列の足元（出勤〜8時の列合計数式）
        const sumWork = `=SUM(AE${startRow}:AE${endRow})`;
        const sumOff  = `=SUM(AF${startRow}:AF${endRow})`;
        const sumPaid = `=SUM(AG${startRow}:AG${endRow})`;
        const sumRef  = `=SUM(AH${startRow}:AH${endRow})`;
        const sumEarly = `=SUM(AI${startRow}:AI${endRow})`;
        const sumLate  = `=SUM(AJ${startRow}:AJ${endRow})`;
        const sumEve   = `=SUM(AK${startRow}:AK${endRow})`;
        const sumH8    = `=SUM(AL${startRow}:AL${endRow})`;

        html += `    <td style="${fontMeiryo} font-weight:bold; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">${sumWork}</td>\n`;
        html += `    <td style="${fontMeiryo} font-weight:bold; color:#2563eb; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">${sumOff}</td>\n`;
        html += `    <td style="${fontMeiryo} font-weight:bold; color:#b45309; background-color:#fef3c7; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">${sumPaid}</td>\n`;
        html += `    <td style="${fontMeiryo} font-weight:bold; color:#059669; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">${sumRef}</td>\n`;
        html += `    <td style="${fontMeiryo} ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">${sumEarly}</td>\n`;
        html += `    <td style="${fontMeiryo} ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">${sumLate}</td>\n`;
        html += `    <td style="${fontMeiryo} ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">${sumEve}</td>\n`;
        html += `    <td style="${fontMeiryo} ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">${sumH8}</td>\n`;
        html += `  </tr>\n`;
        plainText += `\t${sumWork}\t${sumOff}\t${sumPaid}\t${sumRef}\t${sumEarly}\t${sumLate}\t${sumEve}\t${sumH8}\r\n`;

        // 2. 55行目: 早番 (COUNTIF数式)
        html += `  <tr style="background-color:#fff7ed; font-weight:bold; font-size:9pt;">\n`;
        html += `    <th colspan="2" style="${fontMeiryo} color:#c2410c; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">早番</th>\n`;
        plainText += `早番\t-`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayEarly = `=COUNTIF(${colRng},"早")`;
            html += `    <td style="${fontMeiryo} color:#c2410c; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fDayEarly}</td>\n`;
            plainText += `\t${fDayEarly}`;
        }
        html += `    <td colspan="8" style="${fontMeiryo} ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>\n  </tr>\n`;
        plainText += '\t-\t-\t-\t-\t-\t-\t-\t-\r\n';

        // 3. 56行目: 遅番 (COUNTIF数式)
        html += `  <tr style="background-color:#f0f9ff; font-weight:bold; font-size:9pt;">\n`;
        html += `    <th colspan="2" style="${fontMeiryo} color:#0369a1; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">遅番</th>\n`;
        plainText += `遅番\t-`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayLate = `=COUNTIF(${colRng},"遅")`;
            html += `    <td style="${fontMeiryo} color:#0369a1; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fDayLate}</td>\n`;
            plainText += `\t${fDayLate}`;
        }
        html += `    <td colspan="8" style="${fontMeiryo} ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>\n  </tr>\n`;
        plainText += '\t-\t-\t-\t-\t-\t-\t-\t-\r\n';

        // 4. 57行目: E（イブニング） (COUNTIF数式)
        html += `  <tr style="background-color:#faf5ff; font-weight:bold; font-size:9pt;">\n`;
        html += `    <th colspan="2" style="${fontMeiryo} color:#7e22ce; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">E</th>\n`;
        plainText += `E\t-`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayEve = `=COUNTIF(${colRng},"E")`;
            html += `    <td style="${fontMeiryo} color:#7e22ce; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fDayEve}</td>\n`;
            plainText += `\t${fDayEve}`;
        }
        html += `    <td colspan="8" style="${fontMeiryo} ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>\n  </tr>\n`;
        plainText += '\t-\t-\t-\t-\t-\t-\t-\t-\r\n';

        // 5. 58行目: 8時勤務 (COUNTIF数式)
        html += `  <tr style="background-color:#f0fdfa; font-weight:bold; font-size:9pt;">\n`;
        html += `    <th colspan="2" style="${fontMeiryo} color:#0f766e; ${borderThin} ${borderThickR} ${borderThickB} text-align:center;">8時</th>\n`;
        plainText += `8時\t-`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayH8 = `=COUNTIF(${colRng},"8時")`;
            html += `    <td style="${fontMeiryo} color:#0f766e; ${borderThin} ${rightBorder} ${borderThickB} text-align:center;">${fDayH8}</td>\n`;
            plainText += `\t${fDayH8}`;
        }
        html += `    <td colspan="8" style="${fontMeiryo} ${borderThin} ${borderThickB} text-align:center; color:#94a3b8;">-</td>\n  </tr>\n</tfoot>\n</table>`;
        plainText += '\t-\t-\t-\t-\t-\t-\t-\t-\r\n';
        plainText += '\t-\t-\t-\t-\t-\t-\t-\t-\r\n';
        plainText += '\t-\t-\t-\t-\t-\t-\t-\t-\r\n';

        // クリップボードに格納 (HTML形式とテキスト形式の両方をセット)
        try {
            const blobHtml = new Blob([html], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const item = new ClipboardItem({
                'text/html': blobHtml,
                'text/plain': blobText
            });

            navigator.clipboard.write([item]).then(() => {
                showToast('📋 コピー完了！Excelを開いて Ctrl + V で貼り付けてください（赤字太字・自動再計算数式がそのまま反映されます）');
            }).catch(err => {
                fallbackCopyText(plainText);
            });
        } catch (e) {
            fallbackCopyText(plainText);
        }
    }

    function fallbackCopyText(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('📋 コピー完了！Excelを開いて Ctrl + V で貼り付けてください');
    }


    // ==========================================
    // 3. ★ スタッフ入力用 空白勤務表 (.xlsx) のダウンロード（プルダウン付き）
    // ==========================================
    // ZIPアーカイブ生成用 CRC32 テーブル
    const zipCrcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        zipCrcTable[n] = c;
    }
    function calcZipCrc32(buf) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < buf.length; i++) {
            crc = (crc >>> 8) ^ zipCrcTable[(crc ^ buf[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // 純粋なJavaScript（外部ライブラリゼロ）によるZIPアーカイブ（Store非圧縮）生成
    function createZipUint8Array(files) {
        const textEncoder = new TextEncoder();
        const fileEntries = files.map(f => {
            const nameBytes = textEncoder.encode(f.name);
            const dataBytes = (typeof f.data === 'string') ? textEncoder.encode(f.data) : f.data;
            return {
                name: f.name,
                nameBytes,
                dataBytes,
                crc: calcZipCrc32(dataBytes),
                size: dataBytes.length
            };
        });

        let localHeadersSize = 0;
        fileEntries.forEach(f => {
            f.offset = localHeadersSize;
            localHeadersSize += 30 + f.nameBytes.length + f.size;
        });

        let centralDirSize = 0;
        fileEntries.forEach(f => {
            centralDirSize += 46 + f.nameBytes.length;
        });

        const totalSize = localHeadersSize + centralDirSize + 22;
        const buf = new Uint8Array(totalSize);
        const view = new DataView(buf.buffer);
        let pos = 0;

        // Local headers & Data
        fileEntries.forEach(f => {
            view.setUint32(pos, 0x04034b50, true); pos += 4;
            view.setUint16(pos, 20, true); pos += 2;
            view.setUint16(pos, 0x0800, true); pos += 2; // UTF-8
            view.setUint16(pos, 0, true); pos += 2; // store (0)
            view.setUint16(pos, 0x4a21, true); pos += 2;
            view.setUint16(pos, 0x5894, true); pos += 2;
            view.setUint32(pos, f.crc, true); pos += 4;
            view.setUint32(pos, f.size, true); pos += 4;
            view.setUint32(pos, f.size, true); pos += 4;
            view.setUint16(pos, f.nameBytes.length, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            buf.set(f.nameBytes, pos); pos += f.nameBytes.length;
            buf.set(f.dataBytes, pos); pos += f.size;
        });

        // Central Directory
        const cdOffset = pos;
        fileEntries.forEach(f => {
            view.setUint32(pos, 0x02014b50, true); pos += 4;
            view.setUint16(pos, 20, true); pos += 2;
            view.setUint16(pos, 20, true); pos += 2;
            view.setUint16(pos, 0x0800, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint16(pos, 0x4a21, true); pos += 2;
            view.setUint16(pos, 0x5894, true); pos += 2;
            view.setUint32(pos, f.crc, true); pos += 4;
            view.setUint32(pos, f.size, true); pos += 4;
            view.setUint32(pos, f.size, true); pos += 4;
            view.setUint16(pos, f.nameBytes.length, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint32(pos, 0, true); pos += 4;
            view.setUint32(pos, f.offset, true); pos += 4;
            buf.set(f.nameBytes, pos); pos += f.nameBytes.length;
        });

        // End of Central Directory (EOCD)
        view.setUint32(pos, 0x06054b50, true); pos += 4;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, fileEntries.length, true); pos += 2;
        view.setUint16(pos, fileEntries.length, true); pos += 2;
        view.setUint32(pos, centralDirSize, true); pos += 4;
        view.setUint32(pos, cdOffset, true); pos += 4;
        view.setUint16(pos, 0, true); pos += 2;

        return buf;
    }

    // 列番号（1-based）からExcel列記号（A, B, ..., Z, AA, ..., AM）への変換
    function toColLetter(colIdx) {
        let temp = colIdx;
        let letter = '';
        while (temp > 0) {
            let rem = (temp - 1) % 26;
            letter = String.fromCharCode(65 + rem) + letter;
            temp = Math.floor((temp - 1) / 26);
        }
        return letter;
    }

    // スタッフ入力用 空白勤務表 (.xlsx) のダウンロード実行
    const downloadBlankTemplateBtn = document.getElementById('downloadBlankTemplateBtn');
    if (downloadBlankTemplateBtn) {
        downloadBlankTemplateBtn.addEventListener('click', () => {
            downloadBlankXlsx();
        });
    }

    function downloadBlankXlsx() {
        const term = getTermInfo();
        const title = `${term.first.m}月${term.first.day}日～${term.last.m}月${term.last.day}日 スタッフ希望勤務入力シート（希望勤務はプルダウンから選択してください）`;

        const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

        const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="希望入力シート" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

        const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

        const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="12"/><name val="游ゴシック"/><color rgb="1E293B"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/><color rgb="DC2626"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F1F5F9"/></patternFill></fill> <!-- 2: ヘッダーグレー -->
    <fill><patternFill patternType="solid"><fgColor rgb="EFF6FF"/></patternFill></fill> <!-- 3: 土曜薄青 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FEF2F2"/></patternFill></fill> <!-- 4: 日曜薄赤 -->
    <fill><patternFill patternType="solid"><fgColor rgb="F0FDF4"/></patternFill></fill> <!-- 5: 合計薄緑 -->
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="thin"><color rgb="CBD5E1"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="thin"><color rgb="CBD5E1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/> <!-- 0: default -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"><alignment horizontal="left" vertical="center"/></xf> <!-- 1: title -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 2: header gray -->
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 3: header sat -->
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 4: header sun -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 5: cell normal -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="left" vertical="center"/></xf> <!-- 6: cell staff name -->
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 7: cell sum -->
  </cellXfs>
</styleSheet>`;

        // sheet1.xml の組み立て
        // 列構成: A: No, B: 氏名, C〜AD: 28日間の各日, AE: 希望休数, AF: 希望有休数, AG: 備考
        let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="5" customWidth="1"/> <!-- A: No -->
    <col min="2" max="2" width="16" customWidth="1"/> <!-- B: 氏名 -->
    <col min="3" max="30" width="6" customWidth="1"/> <!-- C〜AD: 28日間 -->
    <col min="31" max="32" width="11" customWidth="1"/> <!-- AE〜AF: 希望休数, 希望有休数 -->
    <col min="33" max="33" width="16" customWidth="1"/> <!-- AG: 備考 -->
  </cols>
  <sheetData>
    <!-- 1行目: タイトル -->
    <row r="1" ht="24" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>${title}</t></is></c>
    </row>
    <!-- 2行目: 日付ヘッダー行（曜日なし！日付のみ） -->
    <row r="2" ht="22" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>No</t></is></c>
      <c r="B2" s="2" t="inlineStr"><is><t>氏名</t></is></c>`;

        // 日付ヘッダー (C2〜AD2: 列3〜30)
        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const colLetter = toColLetter(3 + d);
            const dateStr = `${di.m}/${di.day}`;
            sheet1 += `\n      <c r="${colLetter}2" s="2" t="inlineStr"><is><t>${dateStr}</t></is></c>`;
        }
        sheet1 += `\n      <c r="AE2" s="2" t="inlineStr"><is><t>希望休数</t></is></c>`;
        sheet1 += `\n      <c r="AF2" s="2" t="inlineStr"><is><t>希望有休数</t></is></c>`;
        sheet1 += `\n      <c r="AG2" s="2" t="inlineStr"><is><t>備考</t></is></c>`;
        sheet1 += `\n    </row>`;

        // 3行目: 曜日ヘッダー行（曜日のみを記載）
        sheet1 += `\n    <row r="3" ht="20" customHeight="1">
      <c r="A3" s="2"/>
      <c r="B3" s="2"/>`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const colLetter = toColLetter(3 + d);
            let sIdx = 2; // 平日
            if (di.weekday === '土') sIdx = 3;
            else if (di.weekday === '日' || di.isHoliday) sIdx = 4;
            sheet1 += `\n      <c r="${colLetter}3" s="${sIdx}" t="inlineStr"><is><t>${di.weekday}</t></is></c>`;
        }
        sheet1 += `\n      <c r="AE3" s="2"/>
      <c r="AF3" s="2"/>
      <c r="AG3" s="2"/>
    </row>`;

        // データ行（row 4〜53: スタッフ50名、希望枠は完全に空欄）
        for (let s = 0; s < NUM_STAFF; s++) {
            const staff = staffList[s];
            const r = s + 4;
            sheet1 += `\n    <row r="${r}" ht="20" customHeight="1">`;
            sheet1 += `\n      <c r="A${r}" s="5"><v>${staff.id}</v></c>`;
            sheet1 += `\n      <c r="B${r}" s="6" t="inlineStr"><is><t>${staff.name}</t></is></c>`;

            // 28日間の希望入力セル (C〜AD: 列3〜30) - ★ 完全な空欄として出力
            for (let d = 0; d < NUM_DAYS; d++) {
                const colLetter = toColLetter(3 + d);
                sheet1 += `\n      <c r="${colLetter}${r}" s="5"/>`;
            }

            // AE列: 希望休自動集計数式, AF列: 希望有休自動集計数式, AG列: 備考
            const fOff = `COUNTIF(C${r}:AD${r},&quot;休&quot;)+0.5*(COUNTIF(C${r}:AD${r},&quot;○/休&quot;)+COUNTIF(C${r}:AD${r},&quot;〇/休&quot;)+COUNTIF(C${r}:AD${r},&quot;休/○&quot;)+COUNTIF(C${r}:AD${r},&quot;休/〇&quot;))`;
            const fPaid = `COUNTIF(C${r}:AD${r},&quot;有&quot;)+0.5*(COUNTIF(C${r}:AD${r},&quot;○/有&quot;)+COUNTIF(C${r}:AD${r},&quot;〇/有&quot;)+COUNTIF(C${r}:AD${r},&quot;有/○&quot;)+COUNTIF(C${r}:AD${r},&quot;有/〇&quot;))`;
            sheet1 += `\n      <c r="AE${r}" s="7"><f>${fOff}</f><v>0</v></c>`;
            sheet1 += `\n      <c r="AF${r}" s="7"><f>${fPaid}</f><v>0</v></c>`;
            sheet1 += `\n      <c r="AG${r}" s="5"/>`;
            sheet1 += `\n    </row>`;
        }

        sheet1 += `\n  </sheetData>`;

        // ★ ドロップダウンリスト（プルダウンデータ入力規則）を C4:AD53 に適用
        sheet1 += `\n  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="C4:AD53" promptTitle="希望勤務の選択" prompt="プルダウンから希望勤務記号を選択してください。" errorTitle="入力値エラー" error="一覧（プルダウン）にある記号のみ入力できます。">
      <formula1>&quot;休,有,○,出,早,遅,E,8時,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3&quot;</formula1>
    </dataValidation>
  </dataValidations>`;
        sheet1 += `\n  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>\n</worksheet>`;

        const files = [
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rels },
            { name: 'xl/workbook.xml', data: workbook },
            { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
            { name: 'xl/styles.xml', data: styles },
            { name: 'xl/worksheets/sheet1.xml', data: sheet1 }
        ];

        const zipBuf = createZipUint8Array(files);
        const blob = new Blob([zipBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `スタッフ希望入力用_空白勤務表_${term.first.m}月${term.first.day}日～${term.last.m}月${term.last.day}日.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('📄 プルダウン付きのスタッフ希望入力用シート（.xlsx）をダウンロードしました！');
    }

    // ==========================================
    // 希望記号の正規化とバリデーション
    // ==========================================
    const ALLOWED_SYMBOLS = new Set([
        '休', '有', '○', '出', '早', '遅', 'E', '8時',
        '○/休', '休/○', '○/有', '有/○',
        '上1', '上2', '上3', '上4', '上5',
        '下1', '下2', '下3'
    ]);

    function normalizeSymbol(val) {
        if (!val) return null;
        let s = val.toString().trim();
        if (!s) return null;

        // 表記揺れの自動吸収
        if (s === '公休' || s === '公' || s === '休日') return '休';
        if (s === '有休' || s === '有給' || s === '年休') return '有';
        if (s === '〇' || s === '◯' || s === '◦' || s === '•' || s === '･' || s === '●' || s === '日勤' || s === '日' || s === 'O' || s === 'o' || s === '○') return '○';
        if (s === '出張') return '出';
        if (s === '早番') return '早';
        if (s === '遅番') return '遅';
        if (s === 'イブニング' || s === 'Ｅ' || s === 'e') return 'E';
        if (s === '8' || s === '８' || s === '8:00') return '8時';

        // 半日勤務の揺れ
        s = s.replace(/[〇◯◦•･●]/g, '○').replace(/公休/g, '休').replace(/有休/g, '有');
        if (s === '○/休' || s === '休/○' || s === '○/有' || s === '有/○') return s;

        // リフレッシュ休暇（全角数字を半角に変換）
        s = s.replace(/[１-５]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));
        if (/^[上下][1-5]$/.test(s)) return s;

        if (ALLOWED_SYMBOLS.has(s)) return s;
        return null;
    }

    // ==========================================
    // 希望勤務データのグリッド反映処理（赤字・太字・変更不可ロック）
    // ==========================================
    function applyScheduleImport(extractedItems, mode = 'merge') {
        // mode: 'replace' の場合は既存の入力希望を一度クリア
        if (mode === 'replace') {
            for (let s = 0; s < NUM_STAFF; s++) {
                for (let d = 0; d < NUM_DAYS; d++) {
                    staffList[s].days[d] = '';
                }
            }
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

        // テーブル再描画
        renderInputTable();
        const term = getTermInfo();
        const modeText = mode === 'replace' ? '（既存枠クリア済み）' : '';
        if (updatedCount === 0) {
            showToast(`📄 【${term.title}】事前希望枠を全クリア（白紙）にしました`);
        } else {
            showToast(`🎉 【${term.title}】${affectedStaff.size}名・計${updatedCount}件の希望勤務を取り込みました${modeText}`);
        }
    }

    // ==========================================
    // 純粋JSによる .xlsx 解凍＆パース処理
    // ==========================================
    async function parseXlsxBuffer(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(bytes.buffer);
        const textDecoder = new TextDecoder();
        const entries = {};

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

                let decompData = null;
                if (method === 0) {
                    decompData = compData;
                } else if (method === 8) {
                    if (typeof DecompressionStream !== 'undefined') {
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
                            decompData = new Uint8Array(totalLen);
                            let off = 0;
                            for (const c of chunks) {
                                decompData.set(c, off);
                                off += c.length;
                            }
                        } catch (e) {
                            console.warn('Decompress error for ' + name, e);
                        }
                    }
                }

                if (decompData) {
                    entries[name] = textDecoder.decode(decompData);
                }
                pos = dataStart + compSize;
            } else {
                pos++;
            }
        }

        // sharedStrings.xml の抽出
        const sharedStrings = [];
        if (entries['xl/sharedStrings.xml']) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(entries['xl/sharedStrings.xml'], 'text/xml');
            const siNodes = xmlDoc.getElementsByTagName('si');
            for (let i = 0; i < siNodes.length; i++) {
                const si = siNodes[i];
                const tNodes = si.getElementsByTagName('t');
                let str = '';
                for (let j = 0; j < tNodes.length; j++) str += tNodes[j].textContent;
                sharedStrings.push(str);
            }
        }

        // sheet1.xml の抽出とセルマッピング
        const items = [];
        let detectedStartDate = null;
        const sheetXml = entries['xl/worksheets/sheet1.xml'];
        if (!sheetXml) {
            throw new Error('Excelシート（sheet1.xml）が見つかりませんでした。');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(sheetXml, 'text/xml');
        const cNodes = xmlDoc.getElementsByTagName('c');

        // A. sharedStrings からタイトル（例: "4月29日～5月26日" や "2026/04/29"）を探索
        const titleRegex = /(?:(\d{4})[年\/-])?(\d{1,2})月(\d{1,2})日[～〜~-](\d{1,2})月(\d{1,2})日/;
        const currentYear = document.getElementById('termStartDate')?.value ? parseInt(document.getElementById('termStartDate').value.split('-')[0], 10) : 2026;

        for (const str of sharedStrings) {
            const m = str.match(titleRegex);
            if (m) {
                const y = m[1] ? parseInt(m[1], 10) : currentYear;
                const mon = String(parseInt(m[2], 10)).padStart(2, '0');
                const day = String(parseInt(m[3], 10)).padStart(2, '0');
                detectedStartDate = `${y}-${mon}-${day}`;
                break;
            }
        }

        // レイアウト判定: C列（C2〜C4）にセルが存在するかで新レイアウト（行4〜53, 列3〜30）かどうかを判定
        let isNewLayout = false;
        for (let i = 0; i < Math.min(200, cNodes.length); i++) {
            const ref = cNodes[i].getAttribute('r');
            if (ref && /^C[2-4]$/.test(ref)) {
                isNewLayout = true;
                break;
            }
        }

        for (let i = 0; i < cNodes.length; i++) {
            const c = cNodes[i];
            const ref = c.getAttribute('r');
            if (!ref) continue;

            const m = ref.match(/^([A-Z]+)([0-9]+)$/);
            if (!m) continue;

            const colStr = m[1];
            const row = parseInt(m[2], 10);

            // 列文字から1-based列番号へ変換
            let col = 0;
            for (let k = 0; k < colStr.length; k++) {
                col = col * 26 + (colStr.charCodeAt(k) - 64);
            }

            // B. もしタイトルから日付が取れていない場合、C2 セル（または L2 セル）から初日日付を取得
            if (!detectedStartDate && (ref === 'C2' || ref === 'L2')) {
                let cellVal = '';
                const t = c.getAttribute('t');
                if (t === 's') {
                    const v = c.getElementsByTagName('v')[0]?.textContent;
                    if (v !== undefined) cellVal = sharedStrings[parseInt(v, 10)] || '';
                } else if (t === 'inlineStr') {
                    cellVal = c.getElementsByTagName('t')[0]?.textContent || '';
                } else {
                    cellVal = c.getElementsByTagName('v')[0]?.textContent || '';
                }
                const mDate = cellVal.match(/(?:(\d{4})[年\/-])?(\d{1,2})[月\/-](\d{1,2})/);
                if (mDate) {
                    const y = mDate[1] ? parseInt(mDate[1], 10) : currentYear;
                    const mon = String(parseInt(mDate[2], 10)).padStart(2, '0');
                    const day = String(parseInt(mDate[3], 10)).padStart(2, '0');
                    detectedStartDate = `${y}-${mon}-${day}`;
                }
            }

            let staffIdx = -1;
            let dayIdx = -1;

            if (isNewLayout) {
                // 新レイアウト: スタッフ行 4〜53, 日付列 C〜AD (列 3〜30)
                // ※ 行3は曜日ヘッダーなので絶対にスタッフ行として扱わない！
                if (row >= 4 && row <= 53 && col >= 3 && col <= 30) {
                    staffIdx = row - 4;
                    dayIdx = col - 3;
                }
            } else {
                // 旧レイアウト互換: スタッフ行 3〜52, 日付列 L〜AM (列 12〜39)
                if (row >= 3 && row <= 52 && col >= 12 && col <= 39) {
                    staffIdx = row - 3;
                    dayIdx = col - 12;
                }
            }

            if (staffIdx >= 0 && staffIdx < NUM_STAFF && dayIdx >= 0 && dayIdx < NUM_DAYS) {
                const t = c.getAttribute('t');
                let val = '';
                if (t === 's') {
                    const vNode = c.getElementsByTagName('v')[0];
                    if (vNode) {
                        const idx = parseInt(vNode.textContent, 10);
                        val = sharedStrings[idx] || '';
                    }
                } else if (t === 'inlineStr') {
                    const isNode = c.getElementsByTagName('is')[0];
                    if (isNode) {
                        const tNodes = isNode.getElementsByTagName('t');
                        for (let j = 0; j < tNodes.length; j++) val += tNodes[j].textContent;
                    }
                } else {
                    const vNode = c.getElementsByTagName('v')[0];
                    if (vNode) val = vNode.textContent;
                }

                if (val && val.trim() !== '') {
                    items.push({
                        staffIdx,
                        dayIdx,
                        symbol: val.trim()
                    });
                }
            }
        }

        return { items, startDate: detectedStartDate };
    }

    // ==========================================
    // CSV / TSV テキストのパース処理
    // ==========================================
    function parseCsvOrTsvText(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];

        // タブかカンマかを自動判定
        const isTsv = lines[0].includes('\t');
        const sep = isTsv ? '\t' : ',';

        // 簡易CSVパース（引用符考慮）
        function parseLine(line) {
            if (isTsv) return line.split('\t').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
            const res = [];
            let cur = '';
            let inQ = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                    else { inQ = !inQ; }
                } else if (ch === ',' && !inQ) {
                    res.push(cur.trim());
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            res.push(cur.trim());
            return res;
        }

        const rows = lines.map(parseLine);
        const items = [];

        let detectedStartDate = null;
        const currentYear = document.getElementById('termStartDate')?.value ? parseInt(document.getElementById('termStartDate').value.split('-')[0], 10) : 2026;

        // ヘッダー行などから日付の探索
        for (let i = 0; i < Math.min(3, rows.length); i++) {
            const lineStr = rows[i].join(' ');
            const m = lineStr.match(/(?:(\d{4})[年\/-])?(\d{1,2})[月\/-](\d{1,2})/);
            if (m) {
                const y = m[1] ? parseInt(m[1], 10) : currentYear;
                const mon = String(parseInt(m[2], 10)).padStart(2, '0');
                const day = String(parseInt(m[3], 10)).padStart(2, '0');
                detectedStartDate = `${y}-${mon}-${day}`;
                break;
            }
        }

        // パターン1: 28列のみ（セル範囲のコピペ貼り付け）
        if (rows[0].length === NUM_DAYS && rows.length <= NUM_STAFF) {
            rows.forEach((rowVals, sIdx) => {
                rowVals.forEach((val, dIdx) => {
                    if (val && val.trim() !== '') {
                        items.push({ staffIdx: sIdx, dayIdx: dIdx, symbol: val.trim() });
                    }
                });
            });
            return { items, startDate: detectedStartDate };
        }

        // パターン2: 表全体（No, 氏名, ..., 各日）
        // ヘッダー行を探す（Noまたは氏名、または日付を含む行）
        let headerRowIdx = -1;
        let dayColStart = 11; // デフォルトはL列(0-based 11)

        for (let i = 0; i < Math.min(5, rows.length); i++) {
            const r = rows[i];
            if (r.some(cell => cell.includes('No') || cell.includes('氏名') || cell.includes('/'))) {
                headerRowIdx = i;
                // 日付らしき列を探す
                for (let c = 0; c < r.length; c++) {
                    if (/\d+[\/月]\d+/.test(r[c])) {
                        dayColStart = c;
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

            // スタッフ判定（1列目のNo、または2列目の氏名）
            let staffIdx = -1;
            const noVal = parseInt(rowVals[0], 10);
            if (!isNaN(noVal) && noVal >= 1 && noVal <= NUM_STAFF) {
                staffIdx = noVal - 1;
            } else {
                const nameVal = rowVals[1] || rowVals[0];
                if (nameVal && nameVal.trim() !== '') {
                    const found = staffList.findIndex(st => st.name === nameVal.trim());
                    if (found >= 0) staffIdx = found;
                }
            }

            if (staffIdx >= 0 && staffIdx < NUM_STAFF) {
                for (let d = 0; d < NUM_DAYS; d++) {
                    const col = dayColStart + d;
                    if (col < rowVals.length) {
                        const val = rowVals[col];
                        if (val && val.trim() !== '') {
                            items.push({ staffIdx, dayIdx: d, symbol: val.trim() });
                        }
                    }
                }
            }
        }

        return { items, startDate: detectedStartDate };
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
                if (file.name.endsWith('.xlsx')) {
                    const buf = await file.arrayBuffer();
                    parseResult = await parseXlsxBuffer(buf);
                } else {
                    const text = await file.text();
                    parseResult = parseCsvOrTsvText(text);
                }

                // ★ 白紙シート（希望入力なし）を取り込んだ場合でも、既存データを全クリア（白紙化）して正常に反映！
                if (!parseResult || !parseResult.items || parseResult.items.length === 0) {
                    pushHistory();
                    if (parseResult && parseResult.startDate) {
                        const startDateInput = document.getElementById('termStartDate');
                        if (startDateInput) {
                            startDateInput.value = parseResult.startDate;
                            getTermInfo();
                        }
                    }
                    applyScheduleImport([], 'replace');
                    showToast('📄 白紙の希望シートを取り込みました。事前希望枠を全クリア（白紙）にしました。');
                    return;
                }

                // ★ 取り込み前状態を履歴に保存（「↩ 戻る」で取り消し可能）
                pushHistory();

                // ★ 要望対応1: 取り込んだシートの期間に合わせて、indexの対象期間（開始日・終了日・ヘッダー日付）を自動同期！
                if (parseResult.startDate) {
                    const startDateInput = document.getElementById('termStartDate');
                    if (startDateInput) {
                        startDateInput.value = parseResult.startDate;
                        getTermInfo(); // 期間終了日やバッジ、タイトルを自動再計算
                    }
                }

                // ★ 要望対応2: 既存のサンプルデータを完全消去（replace）し、取り込んだ希望データのみをクリーンに反映！
                applyScheduleImport(parseResult.items, 'replace');

            } catch (err) {
                console.error(err);
                alert('ファイルの取り込みに失敗しました: ' + err.message);
            } finally {
                importScheduleFileInput.value = '';
            }
        });
    }


    // 4. スプレッドシート（.xls）エクスポート（UTF-8 BOM付き）
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            if (!lastSolveResult) {
                alert('先に勤務表を自動生成してください。');
                return;
            }
            exportExcelSpreadsheet(lastSolveResult.grid, lastSolveResult.stats);
        });
    }

    function exportExcelSpreadsheet(grid, stats) {
        const term = getTermInfo();
        const borderThin = 'border:0.5pt solid #cbd5e1;';
        const borderThickR = 'border-right:2pt solid #475569;';
        const borderMediumR = 'border-right:1.5pt solid #64748b;';
        const borderThickB = 'border-bottom:2pt solid #475569;';

        let html = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<style>
  body { font-family: "Meiryo", "Yu Gothic", sans-serif; font-size: 10pt; }
  table { border-collapse: collapse; border: 2pt solid #475569; }
  th, td { border: 0.5pt solid #cbd5e1; text-align: center; vertical-align: middle; padding: 4px; font-size: 10pt; }
  .header { background-color: #f1f5f9; font-weight: bold; }
  .header-sat { background-color: #e0f2fe; color: #0284c7; font-weight: bold; }
  .header-sun { background-color: #ffe4e6; color: #e11d48; font-weight: bold; }
  .header-stat { background-color: #e0f2fe; color: #0369a1; font-weight: bold; }
  .fixed-cell { color: #DC2626 !important; font-weight: bold !important; background-color: transparent !important; mso-number-format: "\\@"; }
  .auto-cell { color: #1E293B !important; font-weight: normal; mso-number-format: "\\@"; }
  .stat-paid { background-color: #fef3c7; color: #b45309; font-weight: bold; }
  .foot-total { background-color: #f8fafc; font-weight: bold; }
</style>
</head>
<body>
<table>
  <thead>
    <tr>
      <th rowspan="2" class="header" style="width:35px; ${borderThin} ${borderThickB}">No</th>
      <th rowspan="2" class="header" style="width:100px; ${borderThin} ${borderThickR} ${borderThickB}">氏名</th>
      <th colspan="${NUM_DAYS}" class="header" style="font-size:11pt; ${borderThin} ${borderThickR} ${borderThickB}">${term.title}</th>
      <th colspan="8" class="header-stat" style="${borderThin} ${borderThickB}">勤務・休暇 集計</th>
    </tr>
    <tr>
`;

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const cls = di.wIdx === 5 ? 'header-sat' : (di.wIdx === 6 ? 'header-sun' : 'header');
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            html += `      <th class="${cls}" style="width:32px; ${borderThin} ${rightBorder} ${borderThickB}">${di.label}<br><small>${di.weekday}</small></th>\n`;
        }

        html += `      <th class="header" style="width:36px; ${borderThin} ${borderThickB}">出勤</th>
      <th class="header" style="width:36px; ${borderThin} ${borderThickB}">公休</th>
      <th class="header stat-paid" style="width:36px; ${borderThin} ${borderThickB}">有休</th>
      <th class="header" style="width:36px; ${borderThin} ${borderThickB}">リフ</th>
      <th class="header" style="width:36px; ${borderThin} ${borderThickB}">早</th>
      <th class="header" style="width:36px; ${borderThin} ${borderThickB}">遅</th>
      <th class="header" style="width:36px; ${borderThin} ${borderThickB}">E</th>
      <th class="header" style="width:36px; ${borderThin} ${borderThickB}">8時</th>
    </tr>
  </thead>
  <tbody>
`;

        for (let s = 0; s < NUM_STAFF; s++) {
            const staff = staffList[s];
            const stat = stats.staffStats[s];
            const isLast = (s === NUM_STAFF - 1);
            const rowBottom = isLast ? borderThickB : '';

            html += `    <tr>\n`;
            html += `      <td style="font-weight:bold; ${borderThin} ${rowBottom}">${staff.id}</td>\n`;
            html += `      <td style="text-align:left; font-weight:bold; ${borderThin} ${borderThickR} ${rowBottom}">${staff.name}</td>\n`;

            for (let d = 0; d < NUM_DAYS; d++) {
                const cell = grid[s][d];
                let rawSym = cell.symbol || '';
                let sym = rawSym.replace(/[◦•･◯○●]/g, '〇');
                const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
                // 網掛け完全除去、文字色のみ赤字・太字
                if (cell.isFixed) {
                    html += `      <td class="fixed-cell" style="color:#DC2626 !important; font-weight:bold !important; ${borderThin} ${rightBorder} ${rowBottom}"><b style="color:#DC2626;">${sym}</b></td>\n`;
                } else {
                    html += `      <td class="auto-cell" style="${borderThin} ${rightBorder} ${rowBottom}">${sym}</td>\n`;
                }
            }

            const rowNum = s + 4; // Excel行番号 4〜53
            const startCol = 'C';
            const endCol = 'AD';
            const rng = `${startCol}${rowNum}:${endCol}${rowNum}`;

            const fWork = `=COUNTIF(${rng},"○")+COUNTIF(${rng},"〇")+COUNTIF(${rng},"◯")+COUNTIF(${rng},"出")+COUNTIF(${rng},"早")+COUNTIF(${rng},"遅")+COUNTIF(${rng},"E")+COUNTIF(${rng},"8時")+0.5*(COUNTIF(${rng},"○/休")+COUNTIF(${rng},"〇/休")+COUNTIF(${rng},"休/○")+COUNTIF(${rng},"休/〇")+COUNTIF(${rng},"○/有")+COUNTIF(${rng},"〇/有")+COUNTIF(${rng},"有/○")+COUNTIF(${rng},"有/〇"))`;
            const fOff = `=COUNTIF(${rng},"休")+0.5*(COUNTIF(${rng},"○/休")+COUNTIF(${rng},"〇/休")+COUNTIF(${rng},"休/○")+COUNTIF(${rng},"休/〇"))`;
            const fPaid = `=COUNTIF(${rng},"有")+0.5*(COUNTIF(${rng},"○/有")+COUNTIF(${rng},"〇/有")+COUNTIF(${rng},"有/○")+COUNTIF(${rng},"有/〇"))`;
            const fRef = `=COUNTIF(${rng},"上1")+COUNTIF(${rng},"上2")+COUNTIF(${rng},"上3")+COUNTIF(${rng},"上4")+COUNTIF(${rng},"上5")+COUNTIF(${rng},"下1")+COUNTIF(${rng},"下2")+COUNTIF(${rng},"下3")`;
            const fEarly = `=COUNTIF(${rng},"早")`;
            const fLate = `=COUNTIF(${rng},"遅")`;
            const fEve = `=COUNTIF(${rng},"E")`;
            const fH8 = `=COUNTIF(${rng},"8時")`;

            html += `      <td style="font-weight:bold; ${borderThin} ${rowBottom}">${fWork}</td>
      <td style="font-weight:bold; color:#2563eb; ${borderThin} ${rowBottom}">${fOff}</td>
      <td class="stat-paid" style="font-weight:bold; color:#b45309; ${borderThin} ${rowBottom}">${fPaid}</td>
      <td style="font-weight:bold; color:#059669; ${borderThin} ${rowBottom}">${fRef}</td>
      <td style="${borderThin} ${rowBottom}">${fEarly}</td>
      <td style="${borderThin} ${rowBottom}">${fLate}</td>
      <td style="${borderThin} ${rowBottom}">${fEve}</td>
      <td style="${borderThin} ${rowBottom}">${fH8}</td>
    </tr>
`;
        }

        html += `  </tbody>
  <tfoot>
`;
        const startRow = 4;
        const endRow = NUM_STAFF + 3; // 53行目

        // 1. 54行目: 出勤人数合計
        html += `    <tr class="foot-total">
      <th colspan="2" style="${borderThin} ${borderThickR} border-bottom:1pt solid #64748b;">出勤人数合計</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayWork = `=COUNTIF(${colRng},"○")+COUNTIF(${colRng},"〇")+COUNTIF(${colRng},"◯")+COUNTIF(${colRng},"出")+COUNTIF(${colRng},"早")+COUNTIF(${colRng},"遅")+COUNTIF(${colRng},"E")+COUNTIF(${colRng},"8時")+0.5*(COUNTIF(${colRng},"○/休")+COUNTIF(${colRng},"〇/休")+COUNTIF(${colRng},"休/○")+COUNTIF(${colRng},"休/〇")+COUNTIF(${colRng},"○/有")+COUNTIF(${colRng},"〇/有")+COUNTIF(${colRng},"有/○")+COUNTIF(${colRng},"有/〇"))`;
            html += `      <td style="font-weight:bold; ${borderThin} ${rightBorder} border-bottom:1pt solid #64748b;">${fDayWork}</td>\n`;
        }
        const sumWork = `=SUM(AE${startRow}:AE${endRow})`;
        const sumOff  = `=SUM(AF${startRow}:AF${endRow})`;
        const sumPaid = `=SUM(AG${startRow}:AG${endRow})`;
        const sumRef  = `=SUM(AH${startRow}:AH${endRow})`;
        const sumEarly = `=SUM(AI${startRow}:AI${endRow})`;
        const sumLate  = `=SUM(AJ${startRow}:AJ${endRow})`;
        const sumEve   = `=SUM(AK${startRow}:AK${endRow})`;
        const sumH8    = `=SUM(AL${startRow}:AL${endRow})`;

        html += `      <td style="font-weight:bold; ${borderThin} border-bottom:1pt solid #64748b;">${sumWork}</td>
      <td style="font-weight:bold; color:#2563eb; ${borderThin} border-bottom:1pt solid #64748b;">${sumOff}</td>
      <td style="font-weight:bold; color:#b45309; background-color:#fef3c7; ${borderThin} border-bottom:1pt solid #64748b;">${sumPaid}</td>
      <td style="font-weight:bold; color:#059669; ${borderThin} border-bottom:1pt solid #64748b;">${sumRef}</td>
      <td style="${borderThin} border-bottom:1pt solid #64748b;">${sumEarly}</td>
      <td style="${borderThin} border-bottom:1pt solid #64748b;">${sumLate}</td>
      <td style="${borderThin} border-bottom:1pt solid #64748b;">${sumEve}</td>
      <td style="${borderThin} border-bottom:1pt solid #64748b;">${sumH8}</td>
    </tr>
`;

        // 2. 55行目: 早番
        html += `    <tr class="foot-total" style="background-color:#fff7ed;">
      <th colspan="2" style="color:#c2410c; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1;">早番</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayEarly = `=COUNTIF(${colRng},"早")`;
            html += `      <td style="color:#c2410c; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1;">${fDayEarly}</td>\n`;
        }
        html += `      <td colspan="8" style="${borderThin} border-bottom:0.5pt solid #cbd5e1; color:#94a3b8;">-</td>\n    </tr>\n`;

        // 3. 56行目: 遅番
        html += `    <tr class="foot-total" style="background-color:#f0f9ff;">
      <th colspan="2" style="color:#0369a1; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1;">遅番</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayLate = `=COUNTIF(${colRng},"遅")`;
            html += `      <td style="color:#0369a1; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1;">${fDayLate}</td>\n`;
        }
        html += `      <td colspan="8" style="${borderThin} border-bottom:0.5pt solid #cbd5e1; color:#94a3b8;">-</td>\n    </tr>\n`;

        // 4. 57行目: E
        html += `    <tr class="foot-total" style="background-color:#faf5ff;">
      <th colspan="2" style="color:#7e22ce; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1;">E</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayEve = `=COUNTIF(${colRng},"E")`;
            html += `      <td style="color:#7e22ce; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1;">${fDayEve}</td>\n`;
        }
        html += `      <td colspan="8" style="${borderThin} border-bottom:0.5pt solid #cbd5e1; color:#94a3b8;">-</td>\n    </tr>\n`;

        // 5. 58行目: 8時
        html += `    <tr class="foot-total" style="background-color:#f0fdfa;">
      <th colspan="2" style="color:#0f766e; ${borderThin} ${borderThickR} ${borderThickB}">8時</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 2);
            const colRng = `${col}${startRow}:${col}${endRow}`;
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayH8 = `=COUNTIF(${colRng},"8時")`;
            html += `      <td style="color:#0f766e; ${borderThin} ${rightBorder} ${borderThickB}">${fDayH8}</td>\n`;
        }
        html += `      <td colspan="8" style="${borderThin} ${borderThickB}; color:#94a3b8;">-</td>\n    </tr>\n  </tfoot>
</table>
</body>
</html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${term.title}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('📊 Excelファイルをダウンロードしました！');
    }

    // 初期起動
    initStaffData();
    loadSampleData();
});
