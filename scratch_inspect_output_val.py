with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function renderOutputTable(')
pos2 = text.find('const originalWish = (st.days', pos)
print(text[pos2-100:pos2+1000])
