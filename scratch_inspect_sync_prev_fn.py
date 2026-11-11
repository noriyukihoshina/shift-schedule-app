with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('const syncPrevTermHistoryBtn = document.getElementById(\'syncPrevTermHistoryBtn\');')
print(text[idx:idx+1500])
