const fs = require('fs');
const path = require('path');

// test_export_generated.xlsx をZIP解凍して中身を取り出す
const buf = fs.readFileSync('test_export_generated.xlsx');

const entries = {};
let pos = 0;
while (pos < buf.length - 4) {
    const sig = buf.readUInt32LE(pos);
    if (sig === 0x04034b50) {
        const nameLen = buf.readUInt16LE(pos + 26);
        const extraLen = buf.readUInt16LE(pos + 28);
        const compSize = buf.readUInt32LE(pos + 18);
        const name = buf.toString('utf8', pos + 30, pos + 30 + nameLen);
        const dataStart = pos + 30 + nameLen + extraLen;
        entries[name] = buf.toString('utf8', dataStart, dataStart + compSize);
        pos = dataStart + compSize;
    } else {
        break;
    }
}

console.log('Extracted entries:', Object.keys(entries));

// 各XMLをチェック
for (const [name, content] of Object.entries(entries)) {
    console.log(`\n=== Checking ${name} (length: ${content.length}) ===`);
    // タグ不一致チェック
    const tagRegex = /<(\/?[a-zA-Z0-9_:]+)([^>]*?)(\/?)>/g;
    let match;
    const stack = [];
    let errs = 0;
    while ((match = tagRegex.exec(content)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const isSelfClosing = match[3] === '/' || fullTag.endsWith('/>');
        const isClosing = tagName.startsWith('/');
        
        if (tagName.startsWith('?') || tagName.startsWith('!--')) continue;
        
        if (isClosing) {
            const actualName = tagName.substring(1);
            const expected = stack.pop();
            if (expected !== actualName) {
                console.error(`  MISMATCH in ${name}: closing </${actualName}> but expected </${expected}> at index ${match.index}`);
                errs++;
                if (errs > 3) break;
            }
        } else if (!isSelfClosing) {
            stack.push(tagName);
        }
    }
    if (stack.length > 0) {
        console.error(`  UNCLOSED TAGS in ${name}:`, stack);
    } else if (errs === 0) {
        console.log(`  ${name} XML tag structure is perfectly balanced!`);
    }
}
