with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('allPatB.forEach((s, pIdx) => {')
print(text[pos:pos+600])
