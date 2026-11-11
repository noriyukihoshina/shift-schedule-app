with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.rfind('initTermSelector')
print(text[idx+700:idx+2000])
