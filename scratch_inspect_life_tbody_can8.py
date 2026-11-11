with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 1. 生活期専用フラグ（PT, OT, ST, 係長, 主任, 副主任, 8時可')
if idx == -1:
    idx = text.find('data-flag="can8"')
print('Pos in app.js:', idx)
print(text[idx-200:idx+1500])
