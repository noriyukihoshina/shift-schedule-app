with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('requirements = [')
# 2つ目（一般病棟のrequirements）を探す
idx2 = text.find('requirements = [', idx + 20)
if idx2 != -1:
    print(text[idx2:idx2+2500])
