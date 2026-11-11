with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find("document.querySelectorAll('.day-cell')")
if idx == -1:
    idx = text.find(".day-cell")
print(text[idx:idx+2500])
