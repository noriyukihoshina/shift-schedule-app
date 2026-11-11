with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('autoAssignRefreshHolidaysCore')
print(text[pos+3500:pos+7000])
