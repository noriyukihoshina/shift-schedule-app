with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('finalDate')
print(text[idx-500:idx+800])
