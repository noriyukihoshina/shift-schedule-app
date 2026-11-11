with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 生活期専用フッター')
if idx == -1:
    idx = text.find('isLife')
    idx = text.find('tfoot', idx)
if idx != -1:
    print(text[idx-100:idx+2500])
