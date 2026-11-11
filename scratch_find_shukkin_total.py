with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('出勤人数合計')
while idx != -1:
    print('--- 出勤人数合計 at', idx)
    print(text[max(0, idx-50):min(len(text), idx+300)])
    idx = text.find('出勤人数合計', idx+1)
