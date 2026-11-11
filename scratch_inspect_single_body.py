with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('eliminateSingleDayWork() {')
print(text[pos:pos+2500])
