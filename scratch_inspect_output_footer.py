with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = 253617
print(text[idx-200:idx+3500])
