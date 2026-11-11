with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderMasterIntegrationView()')
if idx != -1:
    print(text[idx+7500:idx+10500])
