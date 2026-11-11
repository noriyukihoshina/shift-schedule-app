with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderMasterIntegrationView()')
if idx != -1:
    print(text[idx+11000:idx+14000])
