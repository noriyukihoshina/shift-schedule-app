with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function isRestrictedSpecial(')
if idx == -1:
    idx = text.find('isRestrictedSpecial =')
print('Pos in solver.js:', idx)
if idx != -1:
    print(text[idx:idx+500])
