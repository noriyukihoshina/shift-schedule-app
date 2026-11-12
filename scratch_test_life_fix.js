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
        getElementById: (id) => {
            if (id === 'termStartDate') return { value: '2026-04-01' };
            if (id === 'termSelect' || id === 'masterTermSelect') return { value: '2026-04-01' };
            return null;
        },
        addEventListener: () => {},
        querySelectorAll: () => []
    }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

vm.runInContext(solverCode, sandbox);
vm.runInContext(appCode, sandbox);

// 生活期スタッフを構築
const lifeStaff = [];
for (let i = 1; i <= 45; i++) {
    const isUnused = (i > 30);
    const lifeSec = (i <= 15) ? '訪問' : ((i <= 25) ? '通所' : ((i <= 27) ? 'Cl1' : 'Cl2'));
    const can8 = (i <= 5);
    lifeStaff.push({
        id: i,
        name: `生活期スタッフ ${i}`,
        isUnused: isUnused,
        lifeSection: lifeSec,
        section: lifeSec,
        can8: can8,
        isHalf: false,
        isZeroCount: false,
        isFirstYear: false,
        allow6Consec: false,
        isSatSunOff: (lifeSec === '訪問' || lifeSec === 'Cl1'),
        isSunOff: (lifeSec === '通所' || lifeSec === 'Cl2'),
        days: new Array(28).fill('')
    });
}

const scheduler = new sandbox.ShiftScheduler(lifeStaff, { isLife: true, standardHolidays: 8, numDays: 28 });
const res = scheduler.solve({ force: true });
console.log('Life Solve Success:', res.success);

// renderOutputTable を実行して isAutoRef などの未定義エラーが発生しないか検証
try {
    // mock DOM elements needed by renderOutputTable
    const mockEl = { innerHTML: '', style: {} };
    sandbox.document.getElementById = (id) => {
        if (id === 'termStartDate') return { value: '2026-04-01' };
        if (id === 'termSelect' || id === 'masterTermSelect') return { value: '2026-04-01' };
        if (id === 'outputTableHead' || id === 'outputTableBody' || id === 'outputTableFoot') return mockEl;
        if (id === 'checkTableHead' || id === 'checkTableBody' || id === 'checkTableFoot') return mockEl;
        return mockEl;
    };
    sandbox.renderOutputTable(res.grid, res.stats);
    console.log('renderOutputTable executed successfully without any errors!');
} catch (err) {
    console.error('Error in renderOutputTable:', err);
}
