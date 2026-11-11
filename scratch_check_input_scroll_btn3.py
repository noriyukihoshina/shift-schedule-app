with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('id="inputTab"')
idx2 = text.find('scroll-btn', idx)
print(text[idx2-100:idx2+600])
