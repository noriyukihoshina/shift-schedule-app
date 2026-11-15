const fs = require('fs');
let code = fs.readFileSync('solver.js', 'utf8');

const target = `        const proportionalTarget = Math.min(
            remainingUnobtained,
            Math.round(activeStaffCount * (daysInTerm / grp.totalMonthDays))
        );
        const prevDaysInMonth = Math.max(0, grp.totalMonthDays - daysInTerm);
        const expectedPrevAssigned = Math.round(activeStaffCount * (prevDaysInMonth / grp.totalMonthDays));
        const fallbackLastTermTarget = Math.min(remainingUnobtained, Math.max(0, activeStaffCount - expectedPrevAssigned));

        const targetCount = isLastTermOfMonth
            ? ((alreadyObtainedInPast > 0 || daysInTerm >= grp.totalMonthDays) ? remainingUnobtained : fallbackLastTermTarget)
            : proportionalTarget;`;

const repl = `        const proportionalTarget = Math.min(
            remainingUnobtained,
            Math.round(activeStaffCount * (daysInTerm / grp.totalMonthDays))
        );

        // ★ ユーザー指示: 月末締めターム（当該月の最終ターム）では、前ターム未取得の残り全員（remainingUnobtained）を100%必ず割り当てる！
        const targetCount = isLastTermOfMonth ? remainingUnobtained : proportionalTarget;`;

function normalize(str) { return str.replace(/\r\n/g, '\n'); }

code = normalize(code);
if (code.includes(normalize(target))) {
    code = code.replace(normalize(target), normalize(repl));
    console.log('Target replaced in autoAssignRefreshHolidaysCore!');
    fs.writeFileSync('solver.js', code, 'utf8');
} else {
    console.error('Target not found!');
}
