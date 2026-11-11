with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('solveLife(options = {}) {')
if idx != -1:
    print(text[idx:idx+3500])
