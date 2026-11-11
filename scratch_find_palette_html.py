with open('1f.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('記号パレット:')
if idx != -1:
    print(text[idx-50:idx+600])
