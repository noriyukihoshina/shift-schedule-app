with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// ★ 生活期テーブル専用フッター集計行')
print(text[pos+3000:pos+5500])
