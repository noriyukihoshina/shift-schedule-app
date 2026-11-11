with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('lifeFootHtml')
if pos != -1:
    print(text[pos-200:pos+2500])
