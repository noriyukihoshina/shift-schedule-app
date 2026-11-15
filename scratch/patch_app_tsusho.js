const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target = `        let totalSwaps = 0;
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
        }`;

const replacement = `        let totalSwaps = 0;
        // ★ フェーズ1: 週内スワップ（Intra-week Swap）
        // 各週スパンの中で月〜土の出勤実数を平準化！同一週内のため週休2日を絶対に壊さず土曜偏重を解消
        const weekSpans = (lastScheduler && lastScheduler.weekSpans) || term.weekSpans || [];
        for (let pass = 0; pass < 20; pass++) {
            let anySwapped = false;
            for (const span of weekSpans) {
                const workDaysInSpan = span.filter(d => {
                    const di = term.dates[d];
                    return di ? !di.isSun : ((d % 7) !== 6);
                });
                if (workDaysInSpan.length < 2) continue;

                for (let iter = 0; iter < 15; iter++) {
                    const loads = workDaysInSpan.map(d => ({ day: d, load: getTsushoDailyReal(d) }));
                    loads.sort((a, b) => b.load - a.load);

                    if (loads[0].load - loads[loads.length - 1].load <= 0.6) break;

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
                                    anySwapped = true;
                                    break;
                                }
                            }
                            if (swapped) break;
                        }
                        if (swapped) break;
                    }
                    if (!swapped) break;
                }
            }
            if (!anySwapped) break;
        }

        // ★ フェーズ2: 全体スワップ（Global Swap）
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
        }`;

code = code.replace(/\r\n/g, '\n');
const normT = target.replace(/\r\n/g, '\n');
const normR = replacement.replace(/\r\n/g, '\n');

if (code.includes(normT)) {
    code = code.replace(normT, normR);
    console.log('✅ Updated handleLifeBalanceTsusho in app.js');
} else {
    console.error('❌ Target not found in app.js');
}

fs.writeFileSync('app.js', code, 'utf8');
