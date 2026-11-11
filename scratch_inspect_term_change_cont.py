with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('select.addEventListener(\'change\', () => {')
if idx != -1:
    print(text[idx+1000:idx+3000])
