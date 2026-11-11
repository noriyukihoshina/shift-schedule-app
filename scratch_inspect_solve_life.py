with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('solveLife(')
if idx == -1:
    idx = text.find('solveLife')
print('solveLife pos:', idx)
if idx != -1:
    print(text[idx:idx+2500])
