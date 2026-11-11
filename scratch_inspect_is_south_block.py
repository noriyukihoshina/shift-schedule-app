with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('if (isSouth) {')
print(text[pos-200:pos+1500])
