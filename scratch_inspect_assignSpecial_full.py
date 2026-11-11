with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('assignSpecialDuties(options = {}) {')
print(text[idx:idx+3500])
