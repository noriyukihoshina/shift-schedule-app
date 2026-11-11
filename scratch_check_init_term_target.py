with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.rfind('findTermByStartDate')
print(text[idx-200:idx+300])
