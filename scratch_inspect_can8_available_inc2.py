with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('can8Available')
print(text[idx+700:idx+1600])
