with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('async function pullStateFromCloud(')
if idx == -1:
    idx = text.find('pullStateFromCloud =')
print(text[idx:idx+1500])
