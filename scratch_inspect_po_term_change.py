with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = 6455
print(text[idx-50:idx+1500])
