# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# handleMasterBalanceWeekdays の強化
target_fn = """    function handleMasterBalanceWeekdays() {
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

            if (diff <= 1.5) break; // ブレ幅が1.5名以内なら平準化完了！"""

replacement_fn = """    function handleMasterBalanceWeekdays() {
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

        // STおよび生活期の固定出勤実数も加算ベースとして読み込み（全体の正確な波を検知）
        const stLifeBaseReal = new Array(numDays).fill(0);
        try {
            const rawSt = localStorage.getItem(`shift_schedule_st_term_${curStartDate}`);
            if (rawSt) {
                const parsedSt = JSON.parse(rawSt);
                const stList = parsedSt.staffList || [];
                const stGrid = parsedSt.outputGrid || parsedSt.intermediateGrid || [];
                for (let d = 0; d < numDays; d++) {
                    stList.forEach((st, s) => {
                        if (st.isUnused) return;
                        const sym = (stGrid[s] && stGrid[s][d]) ? (stGrid[s][d].symbol || stGrid[s][d]) : '';
                        if (isWorkSymbol(sym)) stLifeBaseReal[d] += (st.isHalf ? 0.5 : 1.0);
                    });
                }
            }
            const rawLife = localStorage.getItem(`shift_schedule_life_term_${curStartDate}`);
            if (rawLife) {
                const parsedLife = JSON.parse(rawLife);
                const lifeList = parsedLife.staffList || [];
                const lifeGrid = parsedLife.outputGrid || parsedLife.intermediateGrid || [];
                for (let d = 0; d < numDays; d++) {
                    lifeList.forEach((st, s) => {
                        if (st.isUnused) return;
                        const sym = (lifeGrid[s] && lifeGrid[s][d]) ? (lifeGrid[s][d].symbol || lifeGrid[s][d]) : '';
                        if (isWorkSymbol(sym)) lifeBaseReal[d] += (st.isHalf ? 0.5 : 1.0);
                    });
                }
            }
        } catch (e) {}

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

        // 最大150回の反復平準化
        for (let iter = 0; iter < 150; iter++) {
            // 平日の日別全フロア合算実数を集計
            const dailyGrandReal = {};
            weekdayIndices.forEach(d => {
                let dReal = stLifeBaseReal[d] || 0;
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

            if (diff <= 2.0) break; // ブレ幅が2.0名以内なら平準化完了！"""

if target_fn in content:
    content = content.replace(target_fn, replacement_fn, 1)
    print("handleMasterBalanceWeekdays logic updated.")
else:
    print("Warning: target_fn not found!")

# イベントリスナーの追加
target_listener = """    const masterBalanceWeekdaysBtn = document.getElementById('masterBalanceWeekdaysBtn');
    if (masterBalanceWeekdaysBtn) {
        masterBalanceWeekdaysBtn.addEventListener('click', handleMasterBalanceWeekdays);
    }"""

replacement_listener = """    const masterBalanceWeekdaysBtn = document.getElementById('masterBalanceWeekdaysBtn');
    if (masterBalanceWeekdaysBtn) {
        masterBalanceWeekdaysBtn.addEventListener('click', handleMasterBalanceWeekdays);
    }
    const masterBalanceWeekdaysBtnStats = document.getElementById('masterBalanceWeekdaysBtnStats');
    if (masterBalanceWeekdaysBtnStats) {
        masterBalanceWeekdaysBtnStats.addEventListener('click', handleMasterBalanceWeekdays);
    }"""

if target_listener in content:
    content = content.replace(target_listener, replacement_listener, 1)
    print("masterBalanceWeekdaysBtnStats listener added.")
else:
    print("Warning: target_listener not found!")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("app.js master balance updates completed.")
