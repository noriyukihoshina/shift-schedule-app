with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = 104373
print(text[idx:idx+3500])
