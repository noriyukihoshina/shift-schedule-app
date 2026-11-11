with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 8時（全館定数: 1〜3階各1 + 南0 = 計3名）')
if idx != -1:
    print(text[idx:idx+500])
