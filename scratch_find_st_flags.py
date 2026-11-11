with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('土日休（事前希望がない限り土日休み固定）')
print(text[idx:idx+1500])
