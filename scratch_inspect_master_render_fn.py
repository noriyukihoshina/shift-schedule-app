with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderMasterIntegrationView()')
print(text[pos:pos+3000])
