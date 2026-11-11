with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderOutputTable(grid, stats) {')
idx2 = text.find('vWorkCounts', idx)
print(text[idx2-200:idx2+1200])
