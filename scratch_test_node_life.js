const fs = require('fs');

// Mock DOM
const dom = {
    addEventListener: () => {},
    getElementById: (id) => {
        return {
            innerHTML: '',
            value: '2026-04-01',
            options: [{ value: '2026-04-01', text: 'term' }],
            selectedIndex: 0,
            appendChild: () => {},
            addEventListener: () => {},
            classList: { add: () => {}, remove: () => {}, contains: () => false },
            querySelectorAll: () => [],
            querySelector: () => null,
            setAttribute: () => {},
            getAttribute: () => null,
            style: {}
        };
    },
    querySelectorAll: () => [],
    querySelector: () => null
};

global.window = {
    APP_CONFIG: {
        deptId: 'life',
        deptName: '生活期',
        floor: '生活期',
        isLife: true,
        theme: 'theme-life'
    },
    addEventListener: () => {}
};
global.document = dom;
global.localStorage = {
    getItem: (k) => null,
    setItem: (k, v) => {}
};

try {
    const solverCode = fs.readFileSync('solver.js', 'utf8');
    eval(solverCode);
    console.log('solver.js evaluated successfully');

    const appCode = fs.readFileSync('app.js', 'utf8');
    eval(appCode);
    console.log('app.js evaluated successfully');
} catch (e) {
    console.error('CRASH DETECTED:', e);
}
