with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('lifeFootHtml')
print(text[pos-2500:pos])
