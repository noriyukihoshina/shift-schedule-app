with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('select.addEventListener(\'change\', () => {')
print(text[idx+1200:idx+2500])
