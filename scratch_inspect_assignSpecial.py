with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('assignSpecialDutiesToGrid(')
if idx == -1:
    idx = text.find('assignSpecialDuties')
print(text[idx:idx+2500])
