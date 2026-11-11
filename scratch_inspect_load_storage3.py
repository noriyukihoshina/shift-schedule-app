with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function loadTermFromStorage(')
if idx != -1:
    print(text[idx+5500:idx+8500])
