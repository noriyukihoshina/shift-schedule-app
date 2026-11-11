with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// 特殊勤務人数チェック（早番3名, 遅番1名, E2名, 8時1名）※POテーブルのみ！STテーブルおよび生活期はスキップ')
print(text[pos:pos+1500])
