with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('id="inputTab"')
idx2 = text.find('左右スクロール', idx)
print(text[idx2-200:idx2+600])
