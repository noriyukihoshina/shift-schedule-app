with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderOutputTable')
print(text[pos+2500:pos+5500])
