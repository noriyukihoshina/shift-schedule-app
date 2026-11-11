with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('assignSpecialDutiesToGrid(options = {})')
print('Found at', idx)
print(text[idx-50:idx+300])
