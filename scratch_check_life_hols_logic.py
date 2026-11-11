import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 生活期の公休割当ロジックを確認
pos = text.find('// 3. Pattern B（通所, Cl2, ハ3, ハ4）の平日公休分散配置')
print(text[pos:pos+2500])
