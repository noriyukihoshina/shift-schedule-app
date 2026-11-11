const fs = require('fs');
const vm = require('vm');

const solverJs = fs.readFileSync('solver.js', 'utf-8');

const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(solverJs, sandbox);

// なぜ while ループが回らなかったのか検証
const idx = solverJs.find('// まだ足りない場合の安全配置');
console.log(solverJs.substring(idx, idx + 800));
