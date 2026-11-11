const fs = require('fs');
const vm = require('vm');

const solverCode = fs.readFileSync('solver.js', 'utf8');
const appCode = fs.readFileSync('app.js', 'utf8');

// モックDOM環境
const elements = {};
const createElem = (id, tag = 'div') => {
    return {
        id,
        tagName: tag.toUpperCase(),
        value: '',
        textContent: '',
        innerHTML: '',
        children: [],
        style: {},
        classList: {
            add: () => {},
            remove: () => {},
            contains: () => false
        },
        appendChild: function(c) { this.children.push(c); },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        getAttribute: () => '',
        setAttribute: () => {}
    };
};

const domIds = [
    'masterTermSelect', 'termStartDate', 'termEndDateDisplay', 'termLabelBadge', 'termDaysBadge',
    'checkTableHead', 'checkTableBody', 'checkTableFoot', 'checkTitleDisplay', 'manualCloudSyncBtn',
    'autoSaveStatusBadge', 'autoSaveStatusDot', 'autoSaveStatusText', 'checkTab', 'statsTab'
];
domIds.forEach(id => { elements[id] = createElem(id); });

let domLoadedCallback = null;
const mockDocument = {
    body: createElem('body'),
    head: createElem('head'),
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
        if (sel.startsWith('#')) return elements[sel.slice(1)] || null;
        return null;
    },
    querySelectorAll: (sel) => {
        if (sel.includes('masterTermSelect')) return [elements['masterTermSelect']];
        return [];
    },
    addEventListener: (event, cb) => {
        if (event === 'DOMContentLoaded') domLoadedCallback = cb;
    },
    createElement: (tag) => createElem('', tag)
};

const storage = {};
const mockLocalStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
};

const win = {
    document: mockDocument,
    localStorage: mockLocalStorage,
    location: { search: '', protocol: 'https:' },
    addEventListener: () => {},
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    Date: Date,
    Math: Math,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    RegExp: RegExp,
    Set: Set,
    Map: Map
};

const sandbox = {
    console,
    window: win,
    document: mockDocument,
    localStorage: mockLocalStorage,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    Date: Date,
    Math: Math,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    RegExp: RegExp,
    Set: Set,
    Map: Map,
    appConfig: { deptId: 'master', floor: '' }
};

vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);
vm.runInContext(appCode, sandbox);

// DOMContentLoaded 発火！
if (domLoadedCallback) domLoadedCallback();

console.log('--- Testing Master Term Selector Initialization ---');
const sel = elements['masterTermSelect'];
console.log('Options count:', sel.children.length);
console.log('First option:', sel.children[0]?.textContent);
console.log('Initial termStartDate:', elements['termStartDate']?.value);
console.log('End Date Display:', elements['termEndDateDisplay']?.textContent);
console.log('Label Badge:', elements['termLabelBadge']?.textContent);
console.log('Days Badge:', elements['termDaysBadge']?.textContent);

console.log('\n--- Simulating User Changing Term to 2026 Term 2 (2026-04-29) ---');
sel.value = '2026-04-29';
if (typeof sel.onchange === 'function') {
    sel.onchange({ target: sel });
} else {
    console.error('sel.onchange is not set!');
}

console.log('Updated Start Date in localStorage:', mockLocalStorage.getItem('shift_schedule_current_start_date'));
console.log('Updated termStartDate input value:', elements['termStartDate']?.value);
console.log('Updated End Date Display:', elements['termEndDateDisplay']?.textContent);
console.log('Updated Label Badge:', elements['termLabelBadge']?.textContent);
console.log('Updated Days Badge:', elements['termDaysBadge']?.textContent);
