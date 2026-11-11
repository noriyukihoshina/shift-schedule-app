with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// 5. 8時')
if pos == -1:
    pos = text.find('h8Counts')
print(text[pos:pos+2000])
