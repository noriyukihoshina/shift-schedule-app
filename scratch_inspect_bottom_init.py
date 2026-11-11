with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.rfind('initTermSelector')
print(text[idx-300:idx+800])
