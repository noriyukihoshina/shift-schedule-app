with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('autoAssignRefreshHolidaysCore(staffList, dates, options = {})')
pos2 = text.find('let freeDays = grp.dayIndices.filter', pos)
print(text[pos2:pos2+1000])
