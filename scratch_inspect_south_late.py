with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('南病棟特殊ルール:')
print(text[pos:pos+3000])
