with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderStatsDashboard(stats)')
print(text[idx+2500:idx+5500])
