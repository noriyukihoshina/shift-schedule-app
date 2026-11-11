with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function validateScheduleGrid(')
if idx == -1:
    idx = text.find('validateScheduleGrid =')
print('Pos:', idx)
if idx != -1:
    print(text[idx:idx+2000])
