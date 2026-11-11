with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderMasterIntegrationView()')
idx2 = text.find('html += `<tr', idx)
print(text[idx2+11500:idx2+14500])
