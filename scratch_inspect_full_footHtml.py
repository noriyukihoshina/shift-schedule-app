with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 1行目: 出勤人数合計（総出勤者数）')
idx2 = text.find('tfoot.innerHTML = footHtml;', idx)
if idx2 == -1:
    idx2 = text.find('.innerHTML = footHtml;', idx)
print(text[idx:idx2+50])
