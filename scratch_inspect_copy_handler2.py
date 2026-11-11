with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = 478376
print(text[idx+2000:idx+4500])
