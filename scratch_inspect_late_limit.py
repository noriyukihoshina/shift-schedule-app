with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// ★ 遅番は全スタッフ「最大1回」絶対厳守！')
print(text[pos:pos+2500])
