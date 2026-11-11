const fs = require('fs');
const vm = require('vm');

const solverCode = fs.readFileSync('solver.js', 'utf-8');
const appCode = fs.readFileSync('app.js', 'utf-8');

const sandbox = {
    console,
    require,
    module: {},
    exports: {},
    window: {},
    document: {
        getElementById: () => null,
        addEventListener: () => {},
        querySelectorAll: () => []
    }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

vm.runInContext(solverCode, sandbox);
vm.runInContext(appCode, sandbox);

console.log('=== TEST 1: Refresh Holiday Black Font Helper ===');
console.log('isRefreshHolidaySymbol("上1"):', sandbox.isRefreshHolidaySymbol('上1') === true);
console.log('isRefreshHolidaySymbol("上5"):', sandbox.isRefreshHolidaySymbol('上5') === true);
console.log('isRefreshHolidaySymbol("下2"):', sandbox.isRefreshHolidaySymbol('下2') === true);
console.log('isRefreshHolidaySymbol("休"):', sandbox.isRefreshHolidaySymbol('休') === false);
console.log('isRefreshHolidaySymbol("○"):', sandbox.isRefreshHolidaySymbol('○') === false);
console.log('isRefreshHolidaySymbol("有"):', sandbox.isRefreshHolidaySymbol('有') === false);

console.log('=== TEST 2: Attachment 3 (Public Holiday Interval > 6 Days) ===');
const staffTest = {
    id: 1,
    name: 'テストスタッフ',
    isUnused: false,
    allow6Consec: true,
    days: new Array(28).fill('')
};
staffTest.days[0] = '休';
staffTest.days[1] = '○';
staffTest.days[2] = '○';
staffTest.days[3] = '有';
staffTest.days[4] = '○';
staffTest.days[5] = '上1';
staffTest.days[6] = '○';
staffTest.days[7] = '○';
staffTest.days[8] = '休';

const valRes = sandbox.validateInitialState([staffTest], { numDays: 28 });
const hasConsecError = valRes.errors.some(e => e.includes('公休のない連続期間が7日'));
console.log('Has consec error for 7 days without pure public off:', hasConsecError);

console.log('=== TEST 3: Pure Public Off Symbol ===');
console.log('isPurePublicOffSymbol("休"):', sandbox.isPurePublicOffSymbol('休') === true);
console.log('isPurePublicOffSymbol("上1"):', sandbox.isPurePublicOffSymbol('上1') === false);
console.log('isPurePublicOffSymbol("有"):', sandbox.isPurePublicOffSymbol('有') === false);
console.log('isPurePublicOffSymbol("○"):', sandbox.isPurePublicOffSymbol('○') === false);

console.log('=== TEST 4: ST Real Work Balancing ===');
const stStaff = [];
for (let i = 1; i <= 36; i++) {
    const floor = (i <= 4) ? '1F' : ((i <= 8) ? '2F' : ((i <= 12) ? '3F' : ((i <= 16) ? '南' : '')));
    const canSched = (i === 1 || i === 2 || i === 5 || i === 6 || i === 9 || i === 10 || i === 13 || i === 14);
    const isSectionChief = (i === 1);
    const isSubChief = (i === 5 || i === 9 || i === 13);
    const isFullTime = (i === 3 || i === 8 || i === 12 || i === 16);
    const isHalf = (i === 2);
    stStaff.push({
        id: i,
        name: 'ST ' + String(i).padStart(2, '0'),
        isUnused: (i > 16),
        floor: floor,
        section: '',
        can8: false,
        noEarly: false,
        noLate: true,
        noEve: true,
        canSched: canSched,
        isSectionChief: isSectionChief,
        isChief: false,
        isSubChief: isSubChief,
        isHalf: isHalf,
        isZeroCount: false,
        isFirstYear: false,
        lifeSection: '',
        haSection: '',
        jobTitle: '',
        isFullTime: isFullTime,
        allow6Consec: false,
        isSatSunOff: false,
        isSunOff: false,
        prevName: '',
        remarks: '',
        prevDays: ['', '', '', '', ''],
        days: new Array(28).fill('')
    });
}
const stScheduler = new sandbox.ShiftScheduler(stStaff, { isST: true, deptId: 'st', standardHolidays: 8, numDays: 28 });
const stRes = stScheduler.solveST({ assignSpecial: true });
console.log('ST Solve success:', stRes.success);

const getSTRealWork = (s, d) => {
    const sym = stScheduler.grid[s][d].symbol;
    if (!sandbox.isWorkSymbol(sym)) return 0.0;
    if (stStaff[s].isZeroCount) return 0.0;
    if (stStaff[s].isHalf || sym.includes('/')) return 0.5;
    return 1.0;
};

const f1Real = [];
for (let d = 0; d < 28; d++) {
    let r = 0;
    for (let s = 0; s < 4; s++) r += getSTRealWork(s, d);
    f1Real.push(r);
}
const minF1 = Math.min(...f1Real);
const maxF1 = Math.max(...f1Real);
console.log('1F Min Real:', minF1, 'Max Real:', maxF1, 'Spread:', maxF1 - minF1);
console.log('1F Has 1.5 Real?:', f1Real.includes(1.5));
console.log('ALL TESTS COMPLETED!');
