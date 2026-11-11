with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('assignSpecialDuties(options = {})')
if pos == -1:
    pos = text.find('assignSpecialDuties(')
print(text[pos:pos+3500])
