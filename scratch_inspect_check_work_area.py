with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function checkWorkAreaConstraints(')
if idx == -1:
    idx = text.find('checkWorkAreaConstraints =')
print('checkWorkAreaConstraints pos:', idx)
if idx != -1:
    print(text[idx:idx+2500])
