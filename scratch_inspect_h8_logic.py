with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 5. 訪問スタッフから月〜金（平日）に毎日1名「8時」勤務を選出！')
print(text[idx:idx+1500])
