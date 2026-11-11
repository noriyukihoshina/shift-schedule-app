with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// 1階〜3階: PT+OT+ST合算で早3, 遅1, E2, 8時1')
print(text[pos-400:pos+1000])
