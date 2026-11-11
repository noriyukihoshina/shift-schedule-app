with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('lifeHaDataMap')
print(text[idx+1400:idx+2500])
