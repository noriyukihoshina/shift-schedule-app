with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 3. Pattern B（通所, Cl2, ハ3, ハ4）の平日公休分散配置')
if idx != -1:
    print(text[idx:idx+3500])
