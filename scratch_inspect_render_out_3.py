with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderOutputTable')
# 後半
pos2 = text.find('tbody.innerHTML = bodyHtml;', pos)
print(text[pos2:pos2+3000])
