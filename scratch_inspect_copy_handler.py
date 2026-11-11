with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = 478376
print(text[idx-100:idx+2500])
