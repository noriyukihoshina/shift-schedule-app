with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// Pattern B 全体の平日公休分散配置')
print(text[pos:pos+2500])
