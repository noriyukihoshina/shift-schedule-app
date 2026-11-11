with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function initTermSelector()')
print(text[idx-100:idx+800])
