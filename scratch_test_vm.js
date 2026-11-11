const fs = require('fs');
const vm = require('vm');

const appJs = fs.readFileSync('app.js', 'utf-8');

// 基本的なモック環境
const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    localStorage: {
        _d: {},
        getItem(k) { return this._d[k] || null; },
        setItem(k, v) { this._d[k] = String(v); },
        removeItem(k) { delete this._d[k]; }
    },
    window: {
        location: { protocol: 'https:' },
        APP_CONFIG: { deptId: 'life', deptName: '生活期', isLife: true }
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
    // スクリプトのパース＆実行テスト
    vm.runInContext(appJs, sandbox);
    console.log("SUCCESS: app.js parsed and executed in mock VM without error!");
} catch (e) {
    console.error("VM Execution Error:", e);
}
