with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function validateScheduleGrid')
print(text[pos:pos+500])
