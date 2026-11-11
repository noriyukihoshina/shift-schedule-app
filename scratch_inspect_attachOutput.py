with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function attachOutputTableEvents(')
print(text[idx:idx+2500])
