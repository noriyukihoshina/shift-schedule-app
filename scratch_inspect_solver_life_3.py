with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('solveLife')
print(text[pos+7000:pos+11000])
