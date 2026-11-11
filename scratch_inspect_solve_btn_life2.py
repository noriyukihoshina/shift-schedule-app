with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('if (solveBtn) {')
print(text[idx+1800:idx+3500])
