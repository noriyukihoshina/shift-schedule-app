// test_generate_and_open_excel.js
// app.js のロジックを使って、空白勤務表と確定勤務表の xlsx を実際に生成するテストスクリプト

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appPath = path.join(__dirname, 'app.js');
let appCode = fs.readFileSync(appPath, 'utf8');

// テスト用にダウンロード処理をフックしてファイルに書き出す
let generatedFiles = {};

const customSandbox = {
    console,
    Math,
    Date,
    Array,
    Object,
    JSON,
    Uint8Array,
    DataView,
    TextEncoder,
    TextDecoder,
    document: {
        getElementById: (id) => {
            if (id === 'termStartDate') return { value: '2026-04-01' };
            if (id === 'standardHolidaySelect') return { value: '8.0' };
            return null;
        },
        querySelectorAll: () => [],
        body: { appendChild: () => {}, removeChild: () => {} },
        createElement: (tag) => {
            if (tag === 'a') {
                return {
                    setAttribute: (k, v) => {},
                    click: () => {}
                };
            }
            return {};
        }
    },
    Blob: class {
        constructor(parts, opts) {
            this.buffer = parts[0];
            this.type = opts ? opts.type : '';
        }
    },
    URL: {
        createObjectURL: (blob) => {
            return blob.buffer;
        }
    },
    localStorage: {
        getItem: () => null,
        setItem: () => {}
    },
    sessionStorage: {
        getItem: () => 'true',
        setItem: () => {}
    },
    window: {}
};
customSandbox.window = customSandbox;
customSandbox.globalThis = customSandbox;

// app.js から関数を抽出して実行可能にする
vm.createContext(customSandbox);
vm.runInContext(appCode, customSandbox);

console.log('DOM loaded in sandbox, checking functions...');
