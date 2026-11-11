with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderOutputTable(grid, stats) {')
idx2 = text.find('const currentGrid = grid ||', idx)
print(text[idx2-800:idx2+600])
