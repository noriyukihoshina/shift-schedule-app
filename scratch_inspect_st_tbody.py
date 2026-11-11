with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('if (isST) {')
idx = text.find('if (isST) {', idx+1)
print(text[idx:idx+2500])
