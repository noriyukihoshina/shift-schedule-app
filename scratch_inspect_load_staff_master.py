with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function loadStaffMaster(')
if idx == -1:
    idx = text.find('loadStaffMaster =')
print('loadStaffMaster pos:', idx)
if idx != -1:
    print(text[idx:idx+2000])
