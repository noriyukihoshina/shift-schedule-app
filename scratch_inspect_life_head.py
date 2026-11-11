with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('生活期テーブル専用ヘッダー')
print(text[pos:pos+2000])
