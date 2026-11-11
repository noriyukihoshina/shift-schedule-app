with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('checkTableHead')
if idx != -1:
    print(text[idx-1500:idx-500])
