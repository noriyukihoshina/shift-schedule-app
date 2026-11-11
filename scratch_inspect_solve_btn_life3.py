with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('if (solveBtn) {')
print(text[idx+3200:idx+4800])
