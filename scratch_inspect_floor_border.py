with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('border-top: 3px solid')
if idx != -1:
    print(text[idx-200:idx+600])
