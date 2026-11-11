with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('const totalCan8 = staffList.filter')
print(text[idx-1000:idx+200])
