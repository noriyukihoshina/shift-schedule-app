with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 不足分がある場合')
if idx != -1:
    print(text[idx:idx+2500])
