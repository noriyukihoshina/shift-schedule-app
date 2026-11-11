with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('autoAssignRefreshHolidaysCore')
print(text[pos+7000:pos+10500])
