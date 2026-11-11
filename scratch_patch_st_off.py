# solver.js の assignHolidaysForST を修正するスクリプト

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''            floorStaff.forEach((s, idxInFloor) => {
                let currentOff = 0;
                // ★ ユーザー指示: リフレッシュ休暇は公休とは別枠！リフが入っても公休は必ず8日満額割り当てる！
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (isHolidaySymbol(sym)) currentOff += 1.0;
                    else if (isHalfDuty(sym)) currentOff += 0.5;
                }'''

replacement = '''            floorStaff.forEach((s, idxInFloor) => {
                let currentOff = 0;
                // ★ ユーザー指示: リフレッシュ休暇(上/下)や有休は公休とは別枠！純粋な公休「休」だけで必ず8日満額配置する！
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (sym === SYMBOLS.OFF) currentOff += 1.0;
                    else if (sym === '○/休' || sym === '休/○' || sym === '〇/休' || sym === '休/〇') currentOff += 0.5;
                }'''

if target in text:
    text = text.replace(target, replacement, 1)
    print("Replaced target in solver.js successfully.")
else:
    print("Warning: target not found in solver.js")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)
