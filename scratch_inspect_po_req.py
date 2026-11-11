with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 1階・2階・3階病棟の通常ルール')
if idx == -1:
    idx = text.find('requirements = [')
    idx = text.find('requirements = [', idx+1)
print(text[idx:idx+3500])
