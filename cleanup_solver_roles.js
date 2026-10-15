// cleanup_solver_roles.js
const fs = require('fs');
const path = require('path');

const solverPath = path.join(__dirname, 'solver.js');
let code = fs.readFileSync(solverPath, 'utf8');

// 1. isGlobalAttributesValid 内の更新
code = code.replace(
    /if \(this\.staffList\[s\]\.isRole && isWorkSymbol\(sym\) && sym !== SYMBOLS\.TRIP\) roleWork\+\+;\r?\n/,
    `if ((this.staffList[s].isSectionChief || this.staffList[s].isChief) && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) roleWork++;\n`
);
code = code.replace(
    /const totalRole = this\.staffList\.filter\(s => !s\.isUnused && s\.isRole\)\.length;\r?\n\s+if \(totalRole >= 2 && roleWork < 2\) return false;/,
    `// 係長・主任のグローバル検証
            const scList = this.staffList.filter(s => !s.isUnused && s.isSectionChief);
            const chList = this.staffList.filter(s => !s.isUnused && s.isChief);
            const curD = (this.dates && this.dates[d]) ? this.dates[d] : null;
            const isWeekday = curD ? (curD.wIdx >= 0 && curD.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);
            if (scList.length > 0 && isWeekday) {
                let scWork = false;
                scList.forEach(sc => {
                    const sym = this.grid[this.staffList.indexOf(sc)][d].symbol;
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) scWork = true;
                });
                if (!scWork) {
                    let chWork = false;
                    chList.forEach(ch => {
                        const sym = this.grid[this.staffList.indexOf(ch)][d].symbol;
                        if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) chWork = true;
                    });
                    if (chList.length > 0 && !chWork) return false;
                }
            }`
);

// 2. 特殊勤務重み付け
code = code.replace(
    /const weightA = \(a\.staff\.isRole \? 2 : 0\)/g,
    'const weightA = ((a.staff.isSectionChief || a.staff.isChief) ? 2 : 0)'
);
code = code.replace(
    /const weightB = \(b\.staff\.isRole \? 2 : 0\)/g,
    'const weightB = ((b.staff.isSectionChief || b.staff.isChief) ? 2 : 0)'
);

// 3. スコアリング内の dailyRoleOffCounts
code = code.replace(
    /if \(this\.staffList\[otherS\]\.isRole\) dailyRoleOffCounts\[d\]\+\+;/g,
    'if (this.staffList[otherS].isSectionChief || this.staffList[otherS].isChief) dailyRoleOffCounts[d]++;'
);
code = code.replace(
    /if \(staff\.isRole\) score -= dailyRoleOffCounts\[d\] \* 30;/g,
    'if (staff.isSectionChief || staff.isChief) score -= dailyRoleOffCounts[d] * 30;'
);

// 4. 残りの isRole 参照を安全化
code = code.replace(/staff\.isRole/g, '(staff.isSectionChief || staff.isChief)');
code = code.replace(/this\.staffList\[s\]\.isRole/g, '(this.staffList[s].isSectionChief || this.staffList[s].isChief)');

fs.writeFileSync(solverPath, code, 'utf8');
console.log('SUCCESS: cleanup_solver_roles.js finished!');
