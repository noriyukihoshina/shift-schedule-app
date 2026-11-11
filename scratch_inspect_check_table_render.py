with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderCheckTable')
if pos != -1:
    pos2 = text.find('for (let d = 0; d < NUM_DAYS; d++) {', pos)
    print(text[pos2-100:pos2+1000])
else:
    print("renderCheckTable function not found!")
