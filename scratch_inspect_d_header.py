with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// 特殊勤務人数チェック（早番3名, 遅番1名, E2名, 8時1名）')
pos_loop = text.rfind('for (let d = 0;', 0, pos)
print(text[pos_loop:pos_loop+400])
