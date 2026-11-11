const fs = require('fs');
const vm = require('vm');

const appJs = fs.readFileSync('app.js', 'utf-8');

const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    localStorage: {
        _d: {
            'shift_schedule_global_active_term_start_date': '2026-04-29',
            'shift_schedule_current_start_date': '2026-04-29'
        },
        getItem(k) { return this._d[k] || null; },
        setItem(k, v) { this._d[k] = String(v); },
        removeItem(k) { delete this._d[k]; }
    },
    window: {
        location: { protocol: 'https:' },
        APP_CONFIG: { deptId: 'master', deptName: 'マスター統括' }
    },
    document: {
        getElementById(id) {
            return {
                value: '',
                textContent: '',
                innerHTML: '',
                style: {},
                classList: { add() {}, remove() {}, contains() { return false; } },
                addEventListener() {}
            };
        },
        querySelectorAll() { return []; },
        createElement() {
            return {
                style: {},
                classList: { add() {}, remove() {} },
                appendChild() {}
            };
        },
        addEventListener() {}
    }
};

try {
    vm.createContext(sandbox);
    vm.runInContext(appJs, sandbox);
    console.log("SUCCESS: app.js master mode executed without error!");
} catch (e) {
    console.error("VM Master Error:", e);
}
