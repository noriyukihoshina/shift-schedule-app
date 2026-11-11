with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('solveLife(options = {}) {')
print(text[pos+4000:pos+9000])
