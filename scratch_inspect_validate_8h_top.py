with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('if (totalH8 !== 1)')
print(text[pos-3000:pos-1500])
