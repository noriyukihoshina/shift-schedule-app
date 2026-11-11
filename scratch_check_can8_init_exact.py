with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('can8: (isSouth ?')
print(text[idx-50:idx+300])
