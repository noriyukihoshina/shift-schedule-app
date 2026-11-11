with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('if (solveBtn) {')
print(text[idx:idx+1000])
