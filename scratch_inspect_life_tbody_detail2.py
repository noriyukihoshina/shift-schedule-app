with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = 104373 + 3000
print(text[idx:idx+2500])
