with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('土日休（事前希望がない限り土日休み固定）')
# tbody内でこの文字列または対応する属性を探す
idx2 = text.find('if (isST) {', idx)
print(text[idx2:idx2+2500])
