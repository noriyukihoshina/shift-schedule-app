with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('Excelへ一発貼り付け用コピー')
print(text[pos-200:pos+800])
