# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. getHistorySnapshot & restoreHistoryState の改修
old_snapshot_block = """    function getHistorySnapshot() {
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
            outputGrid: (lastSolveResult && lastSolveResult.grid) ? lastSolveResult.grid.map(row => row.map(c => ({ ...c }))) : null,
            stTermJson: localStorage.getItem(`shift_schedule_st_term_${document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01'}`),
            lifeTermJson: localStorage.getItem(`shift_schedule_life_term_${document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01'}`)
        };
    }"""

new_snapshot_block = """    function getHistorySnapshot() {
        return {
            staffList: staffList.map(s => ({
                id: s.id,
                name: s.name,
                isUnused: !!s.isUnused,
                floor: s.floor || '',
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
                isZeroCount: !!s.isZeroCount,
                isFirstYear: !!s.isFirstYear,
                lifeSection: s.lifeSection || '',
                haSection: s.haSection || '',
                jobTitle: s.jobTitle || '',
                isFullTime: !!s.isFullTime,
                allow6Consec: !!s.allow6Consec,
                prevName: s.prevName || '',
                remarks: s.remarks || '',
                prevDays: [...s.prevDays],
                days: [...s.days]
            })),
            startDate: document.getElementById('termStartDate')?.value || currentWorkingStartDate,
            outputGrid: (lastSolveResult && lastSolveResult.grid) ? lastSolveResult.grid.map(row => row.map(c => ({ ...c }))) : null,
            outputStats: (lastSolveResult && lastSolveResult.stats) ? JSON.parse(JSON.stringify(lastSolveResult.stats)) : null,
            stTermJson: localStorage.getItem(`shift_schedule_st_term_${document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01'}`),
            lifeTermJson: localStorage.getItem(`shift_schedule_life_term_${document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01'}`)
        };
    }"""

old_restore_block = """        // 出力シートの復元
        if (state.outputGrid && lastSolveResult) {
            lastSolveResult.grid = state.outputGrid.map(row => row.map(c => ({ ...c })));
            if (lastScheduler) {
                lastScheduler.grid = lastSolveResult.grid;
                if (typeof getLinkedSTDailyWork === 'function') lastScheduler.stDailyWork = getLinkedSTDailyWork();
                if (typeof getLinkedSTDailyEarly === 'function') lastScheduler.stDailyEarly = getLinkedSTDailyEarly();
                if (typeof getLinkedSTDailyLate === 'function') lastScheduler.stDailyLate = getLinkedSTDailyLate();
                if (typeof getLinkedSTDailyEve === 'function') lastScheduler.stDailyEve = getLinkedSTDailyEve();
                if (typeof getLinkedLifeDailyWork === 'function') lastScheduler.lifeDailyWork = getLinkedLifeDailyWork();
                const newStats = lastScheduler.calculateStats();
                lastSolveResult.stats = newStats;
                renderOutputTable(lastSolveResult.grid, newStats);
                renderStatsDashboard(newStats);
            } else {
                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        }
        renderInputTable();"""

new_restore_block = """        // 出力シートの復元
        if (state.outputGrid) {
            const restoredGrid = state.outputGrid.map(row => row.map(c => ({ ...c })));
            if (!lastSolveResult) {
                lastSolveResult = { grid: restoredGrid, stats: state.outputStats || null };
            } else {
                lastSolveResult.grid = restoredGrid;
                if (state.outputStats) lastSolveResult.stats = state.outputStats;
            }
            if (lastScheduler) {
                lastScheduler.grid = lastSolveResult.grid;
                if (typeof getLinkedSTDailyWork === 'function') lastScheduler.stDailyWork = getLinkedSTDailyWork();
                if (typeof getLinkedSTDailyEarly === 'function') lastScheduler.stDailyEarly = getLinkedSTDailyEarly();
                if (typeof getLinkedSTDailyLate === 'function') lastScheduler.stDailyLate = getLinkedSTDailyLate();
                if (typeof getLinkedSTDailyEve === 'function') lastScheduler.stDailyEve = getLinkedSTDailyEve();
                if (typeof getLinkedLifeDailyWork === 'function') lastScheduler.lifeDailyWork = getLinkedLifeDailyWork();
                const newStats = lastScheduler.calculateStats();
                lastSolveResult.stats = newStats;
                renderOutputTable(lastSolveResult.grid, newStats);
                renderStatsDashboard(newStats);
            } else {
                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        } else {
            // 自動生成前の状態へ復元
            lastSolveResult = null;
            resetOutputTable();
        }
        renderInputTable();"""

old_staff_restore = """                    staffList[idx].isSubChief = !!s.isSubChief;
                    staffList[idx].isHalf = !!s.isHalf;
                    staffList[idx].isFullTime = !!s.isFullTime;
                    staffList[idx].allow6Consec = !!s.allow6Consec;
                    staffList[idx].prevName = cleanTextValue(s.prevName || '');
                    staffList[idx].remarks = cleanTextValue(s.remarks || '');"""

new_staff_restore = """                    staffList[idx].isSubChief = !!s.isSubChief;
                    staffList[idx].isHalf = !!s.isHalf;
                    staffList[idx].isZeroCount = !!s.isZeroCount;
                    staffList[idx].isFirstYear = !!s.isFirstYear;
                    staffList[idx].lifeSection = s.lifeSection || '';
                    staffList[idx].haSection = s.haSection || '';
                    staffList[idx].jobTitle = s.jobTitle || '';
                    staffList[idx].isFullTime = !!s.isFullTime;
                    staffList[idx].allow6Consec = !!s.allow6Consec;
                    staffList[idx].prevName = cleanTextValue(s.prevName || '');
                    staffList[idx].remarks = cleanTextValue(s.remarks || '');"""

# 2. solveBtn クリック時の pushHistory() 追加
old_solve_click = """    if (solveBtn) {
        solveBtn.addEventListener('click', () => {"""

new_solve_click = """    if (solveBtn) {
        solveBtn.addEventListener('click', () => {
            pushHistory(); // ★ 勤務表生成前の状態を記録し、「↩ 戻る」で元に戻せるようにする"""

# 3. handleAssignSpecialDuties クリック時の pushHistory() 追加
old_special_click = """    function handleAssignSpecialDuties() {
        const btns = [document.getElementById('assignSpecialBtn'), document.getElementById('outputAssignSpecialBtn')];"""

new_special_click = """    function handleAssignSpecialDuties() {
        pushHistory(); // ★ 特殊勤務割り当て前の状態を記録し、「↩ 戻る」で元に戻せるようにする
        const btns = [document.getElementById('assignSpecialBtn'), document.getElementById('outputAssignSpecialBtn')];"""

norm_content = content.replace('\r\n', '\n')

replacements = [
    (old_snapshot_block.replace('\r\n', '\n'), new_snapshot_block.replace('\r\n', '\n'), 'SNAPSHOT'),
    (old_staff_restore.replace('\r\n', '\n'), new_staff_restore.replace('\r\n', '\n'), 'STAFF_RESTORE'),
    (old_restore_block.replace('\r\n', '\n'), new_restore_block.replace('\r\n', '\n'), 'OUTPUT_RESTORE'),
    (old_solve_click.replace('\r\n', '\n'), new_solve_click.replace('\r\n', '\n'), 'SOLVE_PUSH'),
    (old_special_click.replace('\r\n', '\n'), new_special_click.replace('\r\n', '\n'), 'SPECIAL_PUSH')
]

for old, new, label in replacements:
    if old in norm_content:
        norm_content = norm_content.replace(old, new, 1)
        print(f"SUCCESS: {label}")
    else:
        print(f"FAILED: {label}")

with open('app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(norm_content)
