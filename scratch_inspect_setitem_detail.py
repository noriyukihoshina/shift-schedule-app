with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('window.localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, finalDate);')
print('=== finalDate match ===')
print(text[idx-300:idx+300])

idx2 = text.find('localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, startDate);')
print('=== startDate match ===')
print(text[idx2-300:idx2+300])
