with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderInputTable() {')
print(text[pos+2000:pos+3500])
