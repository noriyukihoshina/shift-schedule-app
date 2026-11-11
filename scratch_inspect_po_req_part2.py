with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 1階・2階・3階: PT早＋OT早＋ST早の合計が3つ')
print(text[idx:idx+3500])
