with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('GLOBAL_TERMS')
if idx != -1:
    print(text[idx:idx+2500])
