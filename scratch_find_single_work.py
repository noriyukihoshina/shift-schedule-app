with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('単発勤務')
if idx != -1:
    print(text[idx-100:idx+2500])
else:
    print('単発勤務 not found')
