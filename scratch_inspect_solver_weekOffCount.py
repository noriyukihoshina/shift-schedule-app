with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('if (weekOffCount < 2) {')
print(text[idx:idx+2500])
