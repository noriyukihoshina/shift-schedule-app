with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('input[data-flag]')
if idx == -1:
    idx = text.find('dataset.flag')
print('Pos in app.js:', idx)
if idx != -1:
    print(text[idx-200:idx+1500])
