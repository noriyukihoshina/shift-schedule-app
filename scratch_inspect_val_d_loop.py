with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// 特殊勤務人数チェック（早番3名, 遅番1名, E2名, 8時1名）')
print(text[pos-800:pos])
