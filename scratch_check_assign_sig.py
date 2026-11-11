with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('assignSpecialDutiesToGrid')
print(text[idx-50:idx+200])
