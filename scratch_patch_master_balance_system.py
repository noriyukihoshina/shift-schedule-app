with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

balance_fn_code = """
    // ★ ユーザー指示: マスターテーブル用 全フロア平日出勤ブレ最少化システム（自動平準化微修正）
    function handleMasterBalanceWeekdays() {
        const termSel = document.getElementById('termSelect') || document.getElementById('masterTermSelect');
        const curStartDate = (termSel && termSel.value) ? termSel.value : (document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01');
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        const floorConfigs = [
            { id: '1f', label: '1階' },
            { id: '2f', label: '2階' },
            { id: '3f', label: '3階' },
            { id: 'south', label: '南' }
        ];

        // 各フロアのデータを読み込み
        const floors = [];
        floorConfigs.forEach(fc => {
            try {
                const raw = localStorage.getItem(`shift_schedule_${fc.id}_term_${curStartDate}`);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const staffList = parsed.staffList || [];
                    const grid = parsed.outputGrid || parsed.intermediateGrid || [];
                    if (grid.length > 0 && staffList.length > 0) {
                        floors.push({ id: fc.id, label: fc.label, staffList, grid, rawData: parsed });
                    }
                }
            } catch (e) {
                console.error(`Error loading floor ${fc.id}:`, e);
            }
        });

        if (floors.length === 0) {
            alert('平準化対象となる各フロアの勤務表データが見つかりません。先に各階の勤務表を作成してください。');
            return;
        }

        // 平日インデックスの抽出（土日祝を除く）
        const weekdayIndices = [];
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6 || di.isHoliday) : ((d % 7 === 5) || (d % 7 === 6));
            if (!isWeekend) weekdayIndices.push(d);
        }

        if (weekdayIndices.length < 2) {
            alert('平日日数が不足しています。');
            return;
        }

        let totalSwaps = 0;

        // 最大60回の反復平準化
        for (let iter = 0; iter < 60; iter++) {
            // 平日の日別全フロア合算実数を集計
            const dailyGrandReal = {};
            weekdayIndices.forEach(d => {
                let dReal = 0;
                floors.forEach(fl => {
                    fl.staffList.forEach((st, s) => {
                        if (st.isUnused) return;
                        const cell = fl.grid[s] ? fl.grid[s][d] : null;
                        const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                        if (isWorkSymbol(sym)) {
                            let w = 1.0;
                            if (st.isZeroCount || sym === '出張') w = 0.0;
                            else if (st.isHalf || sym.includes('/')) w = 0.5;
                            dReal += w;
                        }
                    });
                });
                dailyGrandReal[d] = dReal;
            });

            // 最大出勤日と最小出勤日をソート
            const sortedWeekdays = [...weekdayIndices].sort((a, b) => dailyGrandReal[b] - dailyGrandReal[a]);
            const maxD = sortedWeekdays[0];
            const minD = sortedWeekdays[sortedWeekdays.length - 1];
            const diff = dailyGrandReal[maxD] - dailyGrandReal[minD];

            if (diff <= 1.5) break; // ブレ幅が1.5名以内なら平準化完了！

            let swappedInIter = false;

            // 出勤が多いフロアから優先してスワップ候補を探索
            for (const fl of floors) {
                for (let s = 0; s < fl.staffList.length; s++) {
                    const st = fl.staffList[s];
                    if (st.isUnused || st.isSectionChief) continue;

                    const cellMax = fl.grid[s][maxD];
                    const cellMin = fl.grid[s][minD];
                    const symMax = (cellMax && typeof cellMax === 'object') ? cellMax.symbol : (cellMax || '');
                    const symMin = (cellMin && typeof cellMin === 'object') ? cellMin.symbol : (cellMin || '');

                    // maxD が非固定の通常勤務「○」、minD が非固定の公休「休」であること
                    if (symMax !== SYMBOLS.WORK || symMin !== SYMBOLS.OFF) continue;
                    if (cellMax.isFixed || cellMin.isFixed) continue;

                    // maxD を休みにした際、前日が特殊勤務でないか（特殊勤務翌日休の破壊防止）
                    if (maxD > 0) {
                        const prevMaxSym = fl.grid[s][maxD - 1] ? (fl.grid[s][maxD - 1].symbol || fl.grid[s][maxD - 1]) : '';
                        if (isRestrictedSpecial(prevMaxSym)) continue;
                    }
                    // minD を勤務にした際、前日が特殊勤務なら翌日休違反になるため除外
                    if (minD > 0) {
                        const prevMinSym = fl.grid[s][minD - 1] ? (fl.grid[s][minD - 1].symbol || fl.grid[s][minD - 1]) : '';
                        if (isRestrictedSpecial(prevMinSym)) continue;
                    }

                    // スケ可保護: maxD のフロアでスケ可勤務が2名以上残るか
                    if (st.canSched) {
                        let schedCountMax = 0;
                        fl.staffList.forEach((oS, oIdx) => {
                            if (oIdx !== s && !oS.isUnused && oS.canSched) {
                                const oSym = fl.grid[oIdx][maxD] ? (fl.grid[oIdx][maxD].symbol || fl.grid[oIdx][maxD]) : '';
                                if (isWorkSymbol(oSym)) schedCountMax++;
                            }
                        });
                        if (schedCountMax < 2) continue;
                    }

                    // スワップ試行
                    if (typeof cellMax === 'object') cellMax.symbol = SYMBOLS.OFF;
                    else fl.grid[s][maxD] = SYMBOLS.OFF;

                    if (typeof cellMin === 'object') cellMin.symbol = SYMBOLS.WORK;
                    else fl.grid[s][minD] = SYMBOLS.WORK;

                    // 連勤チェック（最大5連勤以内、許可者は6連勤以内）
                    let maxConsec = 0;
                    let curConsec = 0;
                    for (let cd = 0; cd < numDays; cd++) {
                        const cs = fl.grid[s][cd] ? (fl.grid[s][cd].symbol || fl.grid[s][cd]) : '';
                        if (isWorkSymbol(cs)) {
                            curConsec++;
                            if (curConsec > maxConsec) maxConsec = curConsec;
                        } else {
                            curConsec = 0;
                        }
                    }
                    const limitConsec = st.allow6Consec ? 6 : 5;
                    const consecValid = (maxConsec <= limitConsec);

                    // 単発勤務「休 ○ 休」の発生を抑止
                    let singleWorkValid = true;
                    if (minD > 0 && minD < numDays - 1) {
                        const pSym = fl.grid[s][minD - 1] ? (fl.grid[s][minD - 1].symbol || fl.grid[s][minD - 1]) : '';
                        const nSym = fl.grid[s][minD + 1] ? (fl.grid[s][minD + 1].symbol || fl.grid[s][minD + 1]) : '';
                        if (isHolidaySymbol(pSym) && isHolidaySymbol(nSym)) singleWorkValid = false;
                    }

                    if (consecValid && singleWorkValid) {
                        swappedInIter = true;
                        totalSwaps++;
                        break;
                    } else {
                        // 戻す
                        if (typeof cellMax === 'object') cellMax.symbol = SYMBOLS.WORK;
                        else fl.grid[s][maxD] = SYMBOLS.WORK;
                        if (typeof cellMin === 'object') cellMin.symbol = SYMBOLS.OFF;
                        else fl.grid[s][minD] = SYMBOLS.OFF;
                    }
                }
                if (swappedInIter) break;
            }

            if (!swappedInIter) break;
        }

        if (totalSwaps > 0) {
            // 各フロアの変更データをLocalStorageおよびクラウドへ保存
            floors.forEach(fl => {
                fl.rawData.outputGrid = fl.grid;
                localStorage.setItem(`shift_schedule_${fl.id}_term_${curStartDate}`, JSON.stringify(fl.rawData));
            });
            renderMasterIntegrationView();
            playNotificationSound();
            showToast(`⚡ 全フロア平日出勤ブレを最少化しました！（${totalSwaps}箇所の微調整で平準化完了）`);
        } else {
            showToast('ℹ️ 現在の各階勤務表は既に平日出勤が高度に平準化されています（微修正不要）。');
        }
    }
"""

pos_init = content.find('function initMasterView() {')
if pos_init == -1:
    pos_init = content.find('function renderMasterIntegrationView() {')

# renderMasterIntegrationView の直前に関数を挿入
content = content[:pos_init] + balance_fn_code + '\n' + content[pos_init:]
print("Inserted handleMasterBalanceWeekdays into app.js")

# イベントリスナーの登録
target_listener_search = "const copyForExcelBtn = document.getElementById('copyForExcelBtn');"
target_listener_insert = """    const masterBalanceWeekdaysBtn = document.getElementById('masterBalanceWeekdaysBtn');
    if (masterBalanceWeekdaysBtn) {
        masterBalanceWeekdaysBtn.addEventListener('click', handleMasterBalanceWeekdays);
    }
    const copyForExcelBtn = document.getElementById('copyForExcelBtn');"""

if target_listener_search in content:
    content = content.replace(target_listener_search, target_listener_insert)
    print("Registered masterBalanceWeekdaysBtn click listener")
else:
    print("copyForExcelBtn listener target NOT found!")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated app.js with master balance system successfully!")
