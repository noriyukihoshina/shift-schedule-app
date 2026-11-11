with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// 5. 8時勤務')
if pos == -1:
    pos = text.find('// 5. 訪問8時勤務')
print(text[pos:pos+1500])
