with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('can8Available')
print(text[idx-500:idx+300])
