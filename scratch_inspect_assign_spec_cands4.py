with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('assignSpecialDuties(options = {})')
print(text[pos+14000:pos+17500])
