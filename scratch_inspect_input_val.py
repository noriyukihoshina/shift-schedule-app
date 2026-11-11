with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderInputTable() {')
pos2 = text.find('const val = staff.days[d]', pos)
print(text[pos2-100:pos2+1000])
