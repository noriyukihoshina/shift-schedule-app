const fs = require('fs');
let code = fs.readFileSync('solver.js', 'utf8');

// 1. assignAutoRefreshHolidaysToGrid 内の targetCount
const target1 = `            const remainingUnobtained = Math.max(0, activeStaffCount - alreadyObtainedInPast);
            const proportionalTarget = Math.min(
                remainingUnobtained,
                Math.round(activeStaffCount * (daysInTerm / grp.totalMonthDays))
            );
            const prevDaysInMonth = Math.max(0, grp.totalMonthDays - daysInTerm);
            const expectedPrevAssigned = Math.round(activeStaffCount * (prevDaysInMonth / grp.totalMonthDays));
            const fallbackLastTermTarget = Math.min(remainingUnobtained, Math.max(0, activeStaffCount - expectedPrevAssigned));

            const targetCount = isLastTermOfMonth
                ? ((alreadyObtainedInPast > 0 || daysInTerm >= grp.totalMonthDays) ? remainingUnobtained : fallbackLastTermTarget)
                : proportionalTarget;`;

const repl1 = `            const remainingUnobtained = Math.max(0, activeStaffCount - alreadyObtainedInPast);
            const proportionalTarget = Math.min(
                remainingUnobtained,
                Math.round(activeStaffCount * (daysInTerm / grp.totalMonthDays))
            );

            // ★ ユーザー指示: 月末締めターム（当該月の最終ターム）では、前ターム未取得の残り全員（remainingUnobtained）を100%必ず割り当てる！
            const targetCount = isLastTermOfMonth ? remainingUnobtained : proportionalTarget;`;

// 2. assignAutoRefreshHolidaysToGrid 内のソート順（同一ターム複数リフ許容）
const target2 = `            // 候補者ソート（未取得者最優先、1人1ターム1リフ優先、役職分散）
            candidates.sort((a, b) => {
                if (a.hasInFuture !== b.hasInFuture) return a.hasInFuture - b.hasInFuture;
                const hasOtherRefA = staffWithRefInTerm.has(a.sIdx) ? 1 : 0;
                const hasOtherRefB = staffWithRefInTerm.has(b.sIdx) ? 1 : 0;
                if (hasOtherRefA !== hasOtherRefB) return hasOtherRefA - hasOtherRefB;
                const weightA = ((a.staff.isSectionChief || a.staff.isChief) ? 2 : 0) + (a.staff.isFullTime ? 2 : 0) + (a.staff.canSched ? 1 : 0);
                const weightB = ((b.staff.isSectionChief || b.staff.isChief) ? 2 : 0) + (b.staff.isFullTime ? 2 : 0) + (b.staff.canSched ? 1 : 0);
                if (weightA !== weightB) return weightA - weightB;
                return a.staff.id - b.staff.id;
            });`;

const repl2 = `            // 候補者ソート:
            // ★ ユーザー指示: 同一ターム内での複数リフ取得（例: 第4タームで上1と上2の両方取得）は完全想定内！
            // hasOtherRef による後回し・排除を行わず、未取得者を最優先し、役職分散・ID順で公平配分する。
            candidates.sort((a, b) => {
                if (a.hasInFuture !== b.hasInFuture) return a.hasInFuture - b.hasInFuture;
                const weightA = ((a.staff.isSectionChief || a.staff.isChief) ? 2 : 0) + (a.staff.isFullTime ? 2 : 0) + (a.staff.canSched ? 1 : 0);
                const weightB = ((b.staff.isSectionChief || b.staff.isChief) ? 2 : 0) + (b.staff.isFullTime ? 2 : 0) + (b.staff.canSched ? 1 : 0);
                if (weightA !== weightB) return weightA - weightB;
                return a.staff.id - b.staff.id;
            });`;

// 3. autoAssignRefreshHolidaysCore 内の targetCount
const target3 = `        const remainingUnobtained = Math.max(0, activeStaffCount - alreadyObtainedInPast);
        const proportionalTarget = Math.min(
            remainingUnobtained,
            Math.round(activeStaffCount * (daysInTerm / grp.totalMonthDays))
        );
        const prevDaysInMonth = Math.max(0, grp.totalMonthDays - daysInTerm);
        const expectedPrevAssigned = Math.round(activeStaffCount * (prevDaysInMonth / grp.totalMonthDays));
        const fallbackLastTermTarget = Math.min(remainingUnobtained, Math.max(0, activeStaffCount - expectedPrevAssigned));

        const targetCount = isLastTermOfMonth
            ? ((alreadyObtainedInPast > 0 || daysInTerm >= grp.totalMonthDays) ? remainingUnobtained : fallbackLastTermTarget)
            : proportionalTarget;`;

const repl3 = `        const remainingUnobtained = Math.max(0, activeStaffCount - alreadyObtainedInPast);
        const proportionalTarget = Math.min(
            remainingUnobtained,
            Math.round(activeStaffCount * (daysInTerm / grp.totalMonthDays))
        );

        // ★ ユーザー指示: 月末締めターム（当該月の最終ターム）では、前ターム未取得の残り全員（remainingUnobtained）を100%必ず割り当てる！
        const targetCount = isLastTermOfMonth ? remainingUnobtained : proportionalTarget;`;

// 4. autoAssignRefreshHolidaysCore 内のソート順
const target4 = `        candidates.sort((a, b) => {
            if (a.hasInFuture !== b.hasInFuture) return a.hasInFuture - b.hasInFuture;
            const hasOtherRefA = staffWithRefInCurrentTerm.has(a.sIdx) ? 1 : 0;
            const hasOtherRefB = staffWithRefInCurrentTerm.has(b.sIdx) ? 1 : 0;
            if (hasOtherRefA !== hasOtherRefB) return hasOtherRefA - hasOtherRefB;
            const weightA = ((a.staff.isSectionChief || a.staff.isChief) ? 2 : 0) + (a.staff.isFullTime ? 2 : 0) + (a.staff.canSched ? 1 : 0);
            const weightB = ((b.staff.isSectionChief || b.staff.isChief) ? 2 : 0) + (b.staff.isFullTime ? 2 : 0) + (b.staff.canSched ? 1 : 0);
            if (weightA !== weightB) return weightA - weightB;
            return a.staff.id - b.staff.id;
        });`;

const repl4 = `        candidates.sort((a, b) => {
            if (a.hasInFuture !== b.hasInFuture) return a.hasInFuture - b.hasInFuture;
            const weightA = ((a.staff.isSectionChief || a.staff.isChief) ? 2 : 0) + (a.staff.isFullTime ? 2 : 0) + (a.staff.canSched ? 1 : 0);
            const weightB = ((b.staff.isSectionChief || b.staff.isChief) ? 2 : 0) + (b.staff.isFullTime ? 2 : 0) + (b.staff.canSched ? 1 : 0);
            if (weightA !== weightB) return weightA - weightB;
            return a.staff.id - b.staff.id;
        });`;

// 正規化して置換
function normalize(str) { return str.replace(/\r\n/g, '\n'); }

code = normalize(code);

if (code.includes(normalize(target1))) {
    code = code.replace(normalize(target1), normalize(repl1));
    console.log('Target 1 replaced!');
} else {
    console.error('Target 1 NOT found');
}

if (code.includes(normalize(target2))) {
    code = code.replace(normalize(target2), normalize(repl2));
    console.log('Target 2 replaced!');
} else {
    console.error('Target 2 NOT found');
}

if (code.includes(normalize(target3))) {
    code = code.replace(normalize(target3), normalize(repl3));
    console.log('Target 3 replaced!');
} else {
    console.error('Target 3 NOT found');
}

if (code.includes(normalize(target4))) {
    code = code.replace(normalize(target4), normalize(repl4));
    console.log('Target 4 replaced!');
} else {
    console.error('Target 4 NOT found');
}

fs.writeFileSync('solver.js', code, 'utf8');
console.log('solver.js updated successfully!');
