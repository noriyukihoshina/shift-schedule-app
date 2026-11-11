with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 4. Pattern B以外の一般スタッフ・空き枠の確定')
if idx == -1:
    idx = text.find('// 4.')
if idx != -1:
    print(text[idx:idx+3500])
