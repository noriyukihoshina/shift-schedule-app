with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('let pSym = staff.prevDays')
print(text[pos-200:pos+300])
