with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('initGrid(')
if idx == -1:
    idx = text.find('initGrid')
print('initGrid pos:', idx)
print(text[idx:idx+1500])
