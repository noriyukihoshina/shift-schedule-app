with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('id="checkTab"')
print(text[idx:idx+800])
