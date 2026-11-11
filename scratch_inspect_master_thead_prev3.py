with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('checkTableHead')
if idx != -1:
    print(text[idx-4000:idx-2500])
