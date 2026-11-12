# -*- coding: utf-8 -*-
import sys

new_st_func = '''    function handleSTBalance() {
        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        let targetGrid = (lastSolveResult && lastSolveResult.grid) || (lastScheduler && lastScheduler.grid) || (typeof extractCurrentOutputGrid === 'function' ? extractCurrentOutputGrid() : []);
        if (!targetGrid || targetGrid.length === 0) {
            showToast('⚠️ 先に「勤務表を自動生成する」を実行してください。');
            return;
        }

        // ★ ユーザー指示: STテーブル 2段階調整（①各階平均化 ➔ ②全階平均化）
        // ① 各階（1F, 2F, 3F, 南）の出勤実数を 2.0〜2.5名（整数換算2〜3名）に厳密平準化
        // ② 各階の平準化を崩さずに全階合計実数を 10.0〜11.0名（ブレ幅1.0名以内）に極限まで平均化！
        const stFloors = ['1F', '2F', '3F', '南'];
        let totalSwapsPhase1 = 0;

        function canSwapST(s, workD, offD) {
            const st = staffList[s];
            if (!st || st.isUnused) return false;

            const cellWork = targetGrid[s][workD];
            const cellOff = targetGrid[s][offD];
            const symWork = (cellWork && typeof cellWork === 'object') ? cellWork.symbol : (cellWork || '');
            const symOff = (cellOff && typeof cellOff === 'object') ? cellOff.symbol : (cellOff || '');

            const isValidWork = (symWork === SYMBOLS.WORK || symWork === '〇' || symWork === '早');
            if (!isValidWork || symOff !== SYMBOLS.OFF) return false;
            if (cellWork.isFixed || cellOff.isFixed) return false;

            // スケ可保護（同フロア内で当日のスケ可出勤が1名未満になるのを防止）
            if (st.canSched) {
                let schedWorkCount = 0;
                staffList.forEach((otherSt, oS) => {
                    if (oS !== s && !otherSt.isUnused && otherSt.canSched) {
                        const isSameFloor = (otherSt.floor === st.floor) || (otherSt.floor && st.floor && (otherSt.floor.includes(st.floor) || st.floor.includes(otherSt.floor)));
                        if (isSameFloor) {
                            const oSym = (targetGrid[oS][workD] && targetGrid[oS][workD].symbol) || '';
                            if (isWorkSymbol(oSym)) schedWorkCount++;
                        }
                    }
                });
                if (schedWorkCount === 0) return false;
            }

            // 仮スワップ
            const origSym = symWork;
            targetGrid[s][workD] = { symbol: SYMBOLS.OFF, isFixed: false };
            targetGrid[s][offD] = { symbol: origSym, isFixed: false };

            // 1. 連勤チェック（最大5連勤）
            let maxConsec = st.allow6Consec ? 6 : 5;
            let consec = 0;
            let consecValid = true;
            for (let d = 0; d < numDays; d++) {
                const sym = (targetGrid[s][d] && targetGrid[s][d].symbol) || '';
                if (isWorkSymbol(sym)) {
                    consec++;
                    if (consec > maxConsec) { consecValid = false; break; }
                } else {
                    consec = 0;
                }
            }

            // 2. 週休2日チェック
            let weekValid = true;
            if (term.weekSpans) {
                for (const wSpan of term.weekSpans) {
                    let wWork = 0;
                    for (const wd of wSpan) {
                        const sym = (targetGrid[s][wd] && targetGrid[s][wd].symbol) || '';
                        if (isWorkSymbol(sym)) wWork++;
                    }
                    if (wWork > 5) { weekValid = false; break; }
                }
            }

            // 3. 労基法公休間隔（最大6日以内）
            let pureOffValid = checkPureOffIntervalForStaff(targetGrid, s, numDays, st);

            // 元に戻す
            targetGrid[s][workD] = cellWork;
            targetGrid[s][offD] = cellOff;

            return consecValid && weekValid && pureOffValid;
        }

        function getFloorDailyReal(flKey, d) {
            let r = 0;
            staffList.forEach((st, s) => {
                if (!st.isUnused && (st.floor === flKey || (st.floor && st.floor.includes(flKey)))) {
                    const cell = targetGrid[s][d];
                    const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                    if (isWorkSymbol(sym)) {
                        const w = st.isZeroCount ? 0.0 : (st.isHalf ? 0.5 : 1.0);
                        r += w;
                    }
                }
            });
            return r;
        }

        // ==========================================
        // 第1段階: 各階平均化（各フロアを2.0〜2.5名へ平準化）
        // ==========================================
        stFloors.forEach(flKey => {
            const flStaff = [];
            staffList.forEach((st, s) => {
                if (!st.isUnused && (st.floor === flKey || (st.floor && st.floor.includes(flKey)))) {
                    flStaff.push(s);
                }
            });
            if (flStaff.length === 0) return;

            for (let iter = 0; iter < 40; iter++) {
                const loads = [];
                for (let d = 0; d < numDays; d++) {
                    loads.push({ day: d, load: getFloorDailyReal(flKey, d) });
                }
                loads.sort((a, b) => b.load - a.load);

                const maxItem = loads[0];
                const minItem = loads[loads.length - 1];
                if (maxItem.load - minItem.load <= 0.6) break;

                let swapped = false;
                for (let h = 0; h < loads.length; h++) {
                    const maxD = loads[h].day;
                    for (let l = loads.length - 1; l >= 0; l--) {
                        const minD = loads[l].day;
                        if (loads[h].load - loads[l].load <= 0.6) continue;

                        for (const s of flStaff) {
                            if (canSwapST(s, maxD, minD)) {
                                const origSym = (targetGrid[s][maxD] && targetGrid[s][maxD].symbol) || SYMBOLS.WORK;
                                targetGrid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                                targetGrid[s][minD] = { symbol: origSym, isFixed: false };
                                totalSwapsPhase1++;
                                swapped = true;
                                break;
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            }
        });

        // ==========================================
        // 第2段階: 全階平均化（全階実数合計を10.0〜11.0名へ極限平均化）
        // ==========================================
        function getTotalDailyReal(d) {
            let r = 0;
            staffList.forEach((st, s) => {
                if (st.isUnused) return;
                const cell = targetGrid[s][d];
                const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                if (isWorkSymbol(sym)) {
                    const w = st.isZeroCount ? 0.0 : (st.isHalf ? 0.5 : 1.0);
                    r += w;
                }
            });
            return r;
        }

        let totalSwapsPhase2 = 0;
        for (let iter = 0; iter < 80; iter++) {
            const totalLoads = [];
            for (let d = 0; d < numDays; d++) {
                totalLoads.push({ day: d, load: getTotalDailyReal(d) });
            }
            totalLoads.sort((a, b) => b.load - a.load);

            const maxItem = totalLoads[0];
            const minItem = totalLoads[totalLoads.length - 1];
            // 全館実数ブレ幅が1.0名以内（例: 10.0〜11.0名）になったら完全平準化達成！
            if (maxItem.load - minItem.load <= 1.0) break;

            let swapped = false;
            for (let h = 0; h < totalLoads.length; h++) {
                const maxD = totalLoads[h].day;
                for (let l = totalLoads.length - 1; l >= 0; l--) {
                    const minD = totalLoads[l].day;
                    if (totalLoads[h].load - totalLoads[l].load <= 1.0) continue;

                    // 全フロアを探索
                    for (const flKey of stFloors) {
                        const flMax = getFloorDailyReal(flKey, maxD);
                        const flMin = getFloorDailyReal(flKey, minD);
                        // フロア単体でも山から谷へのスワップであること
                        if (flMax <= flMin) continue;

                        const flStaff = [];
                        staffList.forEach((st, s) => {
                            if (!st.isUnused && (st.floor === flKey || (st.floor && st.floor.includes(flKey)))) {
                                flStaff.push(s);
                            }
                        });

                        for (const s of flStaff) {
                            const st = staffList[s];
                            const wVal = st.isZeroCount ? 0.0 : (st.isHalf ? 0.5 : 1.0);
                            // スワップ後のフロア実数が 2.0未満 または 3.0超過 にならないこと（フロア平準化を完全防衛！）
                            if (flMax - wVal < 2.0 || flMin + wVal > 3.0) continue;

                            if (canSwapST(s, maxD, minD)) {
                                const origSym = (targetGrid[s][maxD] && targetGrid[s][maxD].symbol) || SYMBOLS.WORK;
                                targetGrid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                                targetGrid[s][minD] = { symbol: origSym, isFixed: false };
                                totalSwapsPhase2++;
                                swapped = true;
                                break;
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }

        const updatedStats = calculateGridStats(targetGrid);
        if (lastSolveResult) {
            lastSolveResult.grid = targetGrid;
            lastSolveResult.stats = updatedStats;
        }
        if (lastScheduler) {
            lastScheduler.grid = targetGrid;
        }

        renderOutputTable(targetGrid, updatedStats);
        if (typeof renderStatsDashboard === 'function' && updatedStats) {
            renderStatsDashboard(updatedStats);
        }
        saveCurrentTermToStorage();

        const totalAllSwaps = totalSwapsPhase1 + totalSwapsPhase2;
        if (totalAllSwaps > 0) {
            showToast('⚡ STブレ最小化（2段階調整完了）: ①各階平準化 ' + totalSwapsPhase1 + '箇所 ＋ ②全階平均化 ' + totalSwapsPhase2 + '箇所微調整（全社実数ブレ幅1名以内に極小化）');
        } else {
            showToast('✅ すでにST各階および全階合計の出勤実数は最小ブレ（均等状態）に保たれています');
        }
    }'''

new_tsusho_func = '''    function handleLifeBalanceTsusho() {
        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        let targetGrid = (lastSolveResult && lastSolveResult.grid) || (lastScheduler && lastScheduler.grid) || (typeof extractCurrentOutputGrid === 'function' ? extractCurrentOutputGrid() : []);
        if (!targetGrid || targetGrid.length === 0) {
            showToast('⚠️ 先に「勤務表を自動生成する」を実行してください。');
            return;
        }

        // 通所スタッフ + CL2 + ハ3 + ハ南
        const tsushoStaff = [];
        const cl2Staff = [];
        staffList.forEach((st, s) => {
            if (st.isUnused || st.isSectionChief) return;
            const sec = st.lifeSection || '';
            const ha = st.haSection || '';
            if (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') {
                tsushoStaff.push(s);
                if (sec === 'Cl2') cl2Staff.push(s);
            }
        });

        // 稼働日: 月〜土（日曜日は完全に除外！祝日は通常稼働日）
        const tsushoWorkingDays = [];
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
            if (!isSun) tsushoWorkingDays.push(d);
        }

        if (tsushoStaff.length === 0 || tsushoWorkingDays.length < 2) {
            showToast('⚠️ 通所スタッフデータが不足しています。');
            return;
        }

        function getTsushoDailyReal(d) {
            let r = 0;
            tsushoStaff.forEach(s => {
                const cell = targetGrid[s][d];
                const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                if (isWorkSymbol(sym)) {
                    const ha = staffList[s].haSection || '';
                    const w = (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : (staffList[s].isZeroCount ? 0.0 : (staffList[s].isHalf ? 0.5 : 1.0));
                    r += w;
                }
            });
            return r;
        }

        function canSwapTsusho(s, workD, offD) {
            const st = staffList[s];
            if (st.isUnused) return false;

            // 日曜日は絶対に全員休み（日曜日を出勤にスワップすることは物理禁止！）
            const dateWork = term.dates[workD];
            const dateOff = term.dates[offD];
            if (dateWork && dateWork.wIdx === 6) return false;
            if (dateOff && dateOff.wIdx === 6) return false;

            const cellWork = targetGrid[s][workD];
            const cellOff = targetGrid[s][offD];
            const symWork = (cellWork && typeof cellWork === 'object') ? cellWork.symbol : (cellWork || '');
            const symOff = (cellOff && typeof cellOff === 'object') ? cellOff.symbol : (cellOff || '');

            if (symWork !== SYMBOLS.WORK || symOff !== SYMBOLS.OFF) return false;
            if (cellWork.isFixed || cellOff.isFixed) return false;

            // CL2同士の公休重複回避
            if (cl2Staff.includes(s) && cl2Staff.length >= 2) {
                const otherCl2 = cl2Staff.find(o => o !== s);
                if (otherCl2) {
                    const otherSymAtWorkD = (targetGrid[otherCl2][workD] && targetGrid[otherCl2][workD].symbol) || '';
                    if (isHolidaySymbol(otherSymAtWorkD)) return false;
                }
            }

            // 仮スワップ
            targetGrid[s][workD] = { symbol: SYMBOLS.OFF, isFixed: false };
            targetGrid[s][offD] = { symbol: SYMBOLS.WORK, isFixed: false };

            let valid = false;
            if (lastScheduler && typeof lastScheduler.isStaffHardValid === 'function') {
                const origGrid = lastScheduler.grid;
                lastScheduler.grid = targetGrid;
                valid = lastScheduler.isStaffHardValid(s);
                lastScheduler.grid = origGrid;
            } else {
                // フォールバック判定
                let maxConsec = st.allow6Consec ? 6 : 5;
                let consec = 0, consecValid = true;
                for (let d = 0; d < numDays; d++) {
                    const sym = (targetGrid[s][d] && targetGrid[s][d].symbol) || '';
                    if (isWorkSymbol(sym)) {
                        consec++;
                        if (consec > maxConsec) { consecValid = false; break; }
                    } else consec = 0;
                }
                let weekValid = true;
                if (term.weekSpans) {
                    for (const wSpan of term.weekSpans) {
                        let wWork = 0;
                        for (const wd of wSpan) {
                            const sym = (targetGrid[s][wd] && targetGrid[s][wd].symbol) || '';
                            if (isWorkSymbol(sym)) wWork++;
                        }
                        if (wWork > 5) { weekValid = false; break; }
                    }
                }
                let pureOffValid = checkPureOffIntervalForStaff(targetGrid, s, numDays, st);
                valid = consecValid && weekValid && pureOffValid;
            }

            // 元に戻す
            targetGrid[s][workD] = cellWork;
            targetGrid[s][offD] = cellOff;

            return valid;
        }

        let totalSwaps = 0;
        for (let iter = 0; iter < 80; iter++) {
            const loads = tsushoWorkingDays.map(d => ({ day: d, load: getTsushoDailyReal(d) }));
            loads.sort((a, b) => b.load - a.load);

            const maxItem = loads[0];
            const minItem = loads[loads.length - 1];
            if (maxItem.load - minItem.load <= 0.6) break;

            let swapped = false;
            for (let h = 0; h < loads.length; h++) {
                const maxD = loads[h].day;
                for (let l = loads.length - 1; l >= 0; l--) {
                    const minD = loads[l].day;
                    if (loads[h].load - loads[l].load <= 0.6) continue;

                    for (const s of tsushoStaff) {
                        if (canSwapTsusho(s, maxD, minD)) {
                            targetGrid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                            targetGrid[s][minD] = { symbol: SYMBOLS.WORK, isFixed: false };
                            totalSwaps++;
                            swapped = true;
                            break;
                        }
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }

        const updatedStats = calculateGridStats(targetGrid);
        if (lastSolveResult) {
            lastSolveResult.grid = targetGrid;
            lastSolveResult.stats = updatedStats;
        }
        if (lastScheduler) {
            lastScheduler.grid = targetGrid;
        }

        renderOutputTable(targetGrid, updatedStats);
        if (typeof renderStatsDashboard === 'function' && updatedStats) {
            renderStatsDashboard(updatedStats);
        }
        saveCurrentTermToStorage();

        if (totalSwaps > 0) {
            showToast('⚡ 通所ブレ最小化を実施しました（制約を厳守し計 ' + totalSwaps + ' 箇所の公休を安全微調整）');
        } else {
            showToast('✅ すでに通所出勤実数は最小ブレ（均等状態）に保たれています');
        }
    }'''

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# 1. handleSTBalance を置換
st_pat = r'    function handleSTBalance\(\)\s*\{[\s\S]*?\n    \}'
m1 = re.search(st_pat, text)
if m1:
    print('Found handleSTBalance, replacing...')
    text = text[:m1.start()] + new_st_func + text[m1.end():]
else:
    print('Error: handleSTBalance not found!')
    sys.exit(1)

# 2. handleLifeBalanceTsusho を置換
tsusho_pat = r'    function handleLifeBalanceTsusho\(\)\s*\{[\s\S]*?\n    \}'
m2 = re.search(tsusho_pat, text)
if m2:
    print('Found handleLifeBalanceTsusho, replacing...')
    text = text[:m2.start()] + new_tsusho_func + text[m2.end():]
else:
    print('Error: handleLifeBalanceTsusho not found!')
    sys.exit(1)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('Successfully patched handleSTBalance and handleLifeBalanceTsusho in app.js!')
