with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

print('DOMContentLoaded found?:', 'DOMContentLoaded' in text)
idx = text.find('DOMContentLoaded')
if idx != -1:
    print(text[idx-50:idx+300])
