with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderOutputTable(')
pos2 = text.find('validStaffIndices.forEach((s) => {', pos)
print(text[pos2:pos2+2000])
