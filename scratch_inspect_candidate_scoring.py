with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 候補者のスコアリング')
if idx == -1:
    idx = text.find('candidates.push({')
print(text[idx-200:idx+3500])
