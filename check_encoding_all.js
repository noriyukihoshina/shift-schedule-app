const fs = require('fs');
const files = ['index.html', 'app.js', 'solver.js', 'style.css', '1階病棟.html', '2階病棟.html', '3階病棟.html', '南病棟.html', 'ST.html', '生活期_管理者.html', 'マスター統括.html'];

for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const buf = fs.readFileSync(f);
    const str = buf.toString('utf8');
    // Check UTF-8 roundtrip
    if (Buffer.from(str, 'utf8').compare(buf) !== 0) {
        console.log('NON-UTF8 BYTES IN:', f);
    }
    if (str.includes('\uFFFD')) {
        console.log('REPLACEMENT CHAR IN:', f);
    }
    // Check for suspicious mojibake patterns
    const lines = str.split(/\r?\n/);
    lines.forEach((l, idx) => {
        if (/[文字化け]|_x000/.test(l)) {
            console.log(f, idx + 1, l.trim());
        }
    });
}
console.log('Encoding check complete.');
