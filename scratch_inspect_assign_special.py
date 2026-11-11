with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('assignSpecialDutiesToGrid')
print(text[pos:pos+3500])
