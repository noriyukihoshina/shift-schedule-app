with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('} else if (isLife) {')
idx2 = text.find('} else if (isLife) {', idx + 10) # 2番目の出現（tbody内）
if idx2 != -1:
    print(text[idx2:idx2+3000])
