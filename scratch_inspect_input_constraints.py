with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('checkInputConstraints(')
if idx == -1:
    idx = text.find('checkInputConstraints')
print('checkInputConstraints pos in solver.js:', idx)
if idx != -1:
    print(text[idx:idx+2500])
