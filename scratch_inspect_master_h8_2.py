with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderMasterIntegrationView()')
idx2 = text.find('8時', idx + 3000)
print(text[idx2-200:idx2+1500])
