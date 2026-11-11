with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('solveLife(options = {}) {')
print(text[pos+9000:pos+13500])
