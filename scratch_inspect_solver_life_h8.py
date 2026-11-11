with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('5. 訪問スタッフから月〜金')
print(text[pos:pos+3000])
