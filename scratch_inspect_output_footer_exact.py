with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 1行目: 出勤人数合計（総出勤者数）')
print(text[idx-50:idx+2500])
