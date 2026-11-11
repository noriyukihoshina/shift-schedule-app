with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('土日休（事前希望がない限り土日休み固定）')
print(text[idx-50:idx+500])
idx2 = text.find('土日休', idx+500)
print('--- second occurrence ---')
print(text[idx2-100:idx2+400])
