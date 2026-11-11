with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderOutputTable(')
pos2 = text.find('if (isST) {', pos)
pos3 = text.find('} else {', pos2)
print(text[pos3:pos3+2500])
