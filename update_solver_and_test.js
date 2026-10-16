const fs = require('fs');
const path = require('path');

// 1. app.js の renderStatsDashboard を実数合計(realWork)ベースに更新
const appPath = path.join(__dirname, 'app.js');
let appCode = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');

const dashStart = appCode.indexOf('    function renderStatsDashboard(stats) {');
const dashEnd = appCode.indexOf('    const errorModal = document.getElementById(\'errorModal\');', dashStart);

if (dashStart !== -1 && dashEnd !== -1) {
    const newDash = `    function renderStatsDashboard(stats) {
        if (!stats || !stats.daily || stats.daily.length === 0) {
            resetStatsDashboard();
            return;
        }

        const term = getTermInfo();
        const dates = term.dates;

        // 1. 「平日」と「土日祝（その他）」に完全に2区分（★実数合計 realWork を基準に表示）
        const weekdayDaily = [];
        const holidayDaily = []; // 土日祝

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = dates[d];
            const totalWork = stats.daily[d].totalWork;
            const realWork = stats.daily[d].realWork !== undefined ? stats.daily[d].realWork : totalWork;
            const item = { d, totalWork, realWork, label: di.label, weekday: di.weekday, isHoliday: di.isHoliday };

            // 土曜(wIdx=5), 日曜(wIdx=6), 国民の祝日(isHoliday)
            const isWeekendOrHoliday = (di.wIdx === 5 || di.wIdx === 6 || di.isHoliday);
            if (isWeekendOrHoliday) {
                holidayDaily.push(item);
            } else {
                weekdayDaily.push(item);
            }
        }

        // --- 平日の集計（最小・最大・平均：実数合計ベース） ---
        const weekdayBadgeEl = document.getElementById('statWeekdayBadge');
        const weekdayRangeEl = document.getElementById('statWeekdayWorkRange');
        const weekdayAvgEl = document.getElementById('statWeekdayAvgWork');

        if (weekdayDaily.length > 0) {
            const realWorks = weekdayDaily.map(item => item.realWork);
            const rMin = Math.min(...realWorks);
            const rMax = Math.max(...realWorks);
            const rSum = realWorks.reduce((a, b) => a + b, 0);
            const rAvg = (rSum / weekdayDaily.length).toFixed(1);

            const totalWorks = weekdayDaily.map(item => item.totalWork);
            const wSum = totalWorks.reduce((a, b) => a + b, 0);
            const wAvg = (wSum / weekdayDaily.length).toFixed(1);

            if (weekdayBadgeEl) weekdayBadgeEl.textContent = \`\${weekdayDaily.length} 日間\`;
            if (weekdayRangeEl) weekdayRangeEl.textContent = \`実数 \${rMin} 〜 \${rMax} 名 (ブレ幅: \${Number((rMax - rMin).toFixed(2))})\`;
            if (weekdayAvgEl) {
                weekdayAvgEl.innerHTML = \`実数 \${rAvg} 名 <span style="font-size:0.78rem; color:#64748b; font-weight:normal;">(出勤計: \${wAvg}名)</span>\`;
            }
        } else {
            if (weekdayBadgeEl) weekdayBadgeEl.textContent = '0 日間';
            if (weekdayRangeEl) weekdayRangeEl.textContent = '- 名';
            if (weekdayAvgEl) weekdayAvgEl.textContent = '- 名';
        }

        // --- 土日祝（その他）の集計（最小・最大・平均：実数合計ベース） ---
        const holidayBadgeEl = document.getElementById('statHolidayBadge');
        const holidayRangeEl = document.getElementById('statHolidayWorkRange');
        const holidayAvgEl = document.getElementById('statHolidayAvgWork');
        const sunHolSubInfoEl = document.getElementById('statSunHolSubInfo');

        if (holidayDaily.length > 0) {
            const realWorks = holidayDaily.map(item => item.realWork);
            const rMin = Math.min(...realWorks);
            const rMax = Math.max(...realWorks);
            const rSum = realWorks.reduce((a, b) => a + b, 0);
            const rAvg = (rSum / holidayDaily.length).toFixed(1);

            const totalWorks = holidayDaily.map(item => item.totalWork);
            const hSum = totalWorks.reduce((a, b) => a + b, 0);
            const hAvg = (hSum / holidayDaily.length).toFixed(1);

            if (holidayBadgeEl) holidayBadgeEl.textContent = \`\${holidayDaily.length} 日間\`;
            if (holidayRangeEl) holidayRangeEl.textContent = \`実数 \${rMin} 〜 \${rMax} 名 (ブレ幅: \${Number((rMax - rMin).toFixed(2))})\`;
            if (holidayAvgEl) {
                holidayAvgEl.innerHTML = \`実数 \${rAvg} 名 <span style="font-size:0.78rem; color:#64748b; font-weight:normal;">(出勤計: \${hAvg}名)</span>\`;
            }
            if (sunHolSubInfoEl) sunHolSubInfoEl.textContent = \`土曜日・日曜日・国民の祝日（計\${holidayDaily.length}日間）\`;
        } else {
            if (holidayBadgeEl) holidayBadgeEl.textContent = '0 日間';
            if (holidayRangeEl) holidayRangeEl.textContent = '- 名';
            if (holidayAvgEl) holidayAvgEl.textContent = '- 名';
        }

        // --- 有休取得合計数 ---
        const validStaffStats = stats.staffStats.filter(s => !s.isUnused);
        const totalPaidDays = validStaffStats.reduce((sum, s) => sum + s.paidDays, 0);
        const paidStaffCount = validStaffStats.filter(s => s.paidDays > 0).length;

        const totalPaidEl = document.getElementById('statTotalPaidDays');
        const paidStaffEl = document.getElementById('statPaidStaffCount');
        if (totalPaidEl) {
            const formattedPaid = (totalPaidDays % 1 === 0) ? totalPaidDays.toFixed(0) : totalPaidDays.toFixed(1);
            totalPaidEl.textContent = \`\${formattedPaid} 日\`;
        }
        if (paidStaffEl) {
            paidStaffEl.textContent = \`\${paidStaffCount} 名\`;
        }

        // --- 全日（期間内）の実数合計 ---
        const allDailyReal = stats.daily.map(d => d.realWork !== undefined ? d.realWork : d.totalWork);
        const allMin = Math.min(...allDailyReal);
        const allMax = Math.max(...allDailyReal);
        const allAvg = (allDailyReal.reduce((a, b) => a + b, 0) / NUM_DAYS).toFixed(1);

        const workRangeEl = document.getElementById('statWorkRange');
        const avgWorkEl = document.getElementById('statAvgWork');
        if (workRangeEl) workRangeEl.textContent = \`実数 \${allMin} 〜 \${allMax} 名 (ブレ幅: \${Number((allMax - allMin).toFixed(2))})\`;
        if (avgWorkEl) avgWorkEl.textContent = \`実数 \${allAvg} 名\`;

        // --- 特殊勤務（早・遅・E・8時）の配置累計 ---
        const totalEarly = validStaffStats.reduce((sum, s) => sum + s.early, 0);
        const totalLate = validStaffStats.reduce((sum, s) => sum + s.late, 0);
        const totalEve = validStaffStats.reduce((sum, s) => sum + s.eve, 0);
        const totalH8 = validStaffStats.reduce((sum, s) => sum + s.h8, 0);
        const specEl = document.getElementById('statSpecialCounts');
        if (specEl) {
            specEl.textContent = \`早: \${totalEarly}回 / 遅: \${totalLate}回 / E: \${totalEve}回 / 8時: \${totalH8}回\`;
        }

        // --- 日別実数合計グラフ（平日・土曜・祝日で色分け） ---
        const chartEl = document.getElementById('dailyWorkChart');
        if (chartEl) {
            let chartHtml = '';
            stats.daily.forEach((d, idx) => {
                const di = dates[idx];
                const dispReal = d.realWork !== undefined ? d.realWork : d.totalWork;
                const pct = Math.min(100, Math.max(10, (dispReal / 60) * 100));

                let barColor = '#3b82f6'; // 平日: 青
                let dayLabelColor = '#64748b';
                if (di.isHoliday || di.wIdx === 6) {
                    barColor = '#ef4444'; // 祝日・日曜: 赤
                    dayLabelColor = '#dc2626';
                } else if (di.wIdx === 5) {
                    barColor = '#0ea5e9'; // 土曜: 水色
                    dayLabelColor = '#0284c7';
                }

                const dayBadge = di.isHoliday ? '祝' : di.weekday;
                chartHtml += \`
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;" title="\${di.label} (\${di.weekday})\${di.isHoliday ? ' 祝日' : ''}: 実数合計 \${dispReal}名 (出勤人数合計 \${d.totalWork}名)">
                        <span style="font-size:0.68rem; font-weight:700; color:#1e293b;">\${dispReal}</span>
                        <div style="width:100%; background:#f1f5f9; height:110px; border-radius:4px; display:flex; align-items:flex-end;">
                            <div style="width:100%; background:\${barColor}; height:\${pct}%; border-radius:4px; transition:height 0.3s;"></div>
                        </div>
                        <span style="font-size:0.68rem; font-weight:600; color:\${dayLabelColor};">\${d.day}</span>
                        <span style="font-size:0.62rem; color:\${dayLabelColor};">\${dayBadge}</span>
                    </div>
                \`;
            });
            chartEl.innerHTML = chartHtml;
        }
    }

`;
    appCode = appCode.slice(0, dashStart) + newDash + appCode.slice(dashEnd);
    fs.writeFileSync(appPath, appCode, 'utf8');
    console.log('✅ Updated renderStatsDashboard in app.js');
}

// 2. index.html のキャッシュバスターを rev35 に更新
const indexPath = path.join(__dirname, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace(/v=rev\d+/g, 'v=rev35');
fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('✅ Updated index.html cache buster to rev35');
