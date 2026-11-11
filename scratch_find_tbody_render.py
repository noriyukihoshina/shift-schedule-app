with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('inputTableBody')
idx2 = text.find('bodyHtml +=', idx)
if idx2 != -1:
    print(text[idx2:idx2+2500])
