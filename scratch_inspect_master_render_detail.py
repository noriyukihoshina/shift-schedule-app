with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderMasterIntegrationView()')
if idx != -1:
    print(text[idx+1800:idx+4500])
