with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = 255233
print(text[idx-500:idx+2500])
