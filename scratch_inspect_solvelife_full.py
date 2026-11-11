with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('solveLife(options = {}) {')
pos_end = text.find('/**\n     * 第1段階: 基本勤務表の自動生成', pos)
print(text[pos:pos+4000])
