with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('if (checkTfoot && checkTfoot !== tfoot)')
print(text[pos:pos+500])
