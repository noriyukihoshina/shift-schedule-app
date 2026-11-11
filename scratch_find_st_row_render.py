with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('専従')
if idx != -1:
    print(text[idx-100:idx+800])
