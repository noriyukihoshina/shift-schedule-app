with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('💡 勤務表がまだ完成していません')
if pos != -1:
    print(text[pos-400:pos+800])
