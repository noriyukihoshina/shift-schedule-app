const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target1 = `                    // ★ ユーザー指示 (ver.28): 骨格生成後の最適日勤○からリフ昇格配置
                    const pastHistory = (typeof collectPastRefreshHolidayHistory === 'function') ? collectPastRefreshHolidayHistory(curStartDate) : {};
                    const futureHistory = (typeof collectFutureRefreshHolidayHistory === 'function') ? collectFutureRefreshHolidayHistory(curStartDate) : {};
                    const result = scheduler.solveBaseSchedule({
                        obtainedHistory: pastHistory,
                        futureHistory: futureHistory
                    });`;

const replacement1 = `                    // ★ ユーザー指示 (ver.28): 骨格生成後の最適日勤○からリフ昇格配置
                    const { pastHistory, futureHistory } = (typeof getObtainedRefreshHistory === 'function') ? getObtainedRefreshHistory(curStartDate) : { pastHistory: {}, futureHistory: {} };
                    const result = scheduler.solveBaseSchedule({
                        obtainedHistory: pastHistory,
                        futureHistory: futureHistory
                    });`;

const target2 = `const forceResult = freshScheduler.solveBaseSchedule({ force: true });`;
const replacement2 = `const { pastHistory: fPast, futureHistory: fFuture } = (typeof getObtainedRefreshHistory === 'function') ? getObtainedRefreshHistory(curStartDate) : { pastHistory: {}, futureHistory: {} };
                                    const forceResult = freshScheduler.solveBaseSchedule({ force: true, obtainedHistory: fPast, futureHistory: fFuture });`;

// CRLF/LFの正規化
code = code.replace(/\r\n/g, '\n');
const normT1 = target1.replace(/\r\n/g, '\n');
const normR1 = replacement1.replace(/\r\n/g, '\n');
const normT2 = target2.replace(/\r\n/g, '\n');
const normR2 = replacement2.replace(/\r\n/g, '\n');

if (code.includes(normT1)) {
    code = code.replace(normT1, normR1);
    console.log('✅ Replaced target1 in app.js');
} else {
    console.error('❌ Failed to find target1');
}

if (code.includes(normT2)) {
    code = code.replace(normT2, normR2);
    console.log('✅ Replaced target2 in app.js');
} else {
    console.error('❌ Failed to find target2');
}

fs.writeFileSync('app.js', code, 'utf8');
console.log('Saved app.js');
