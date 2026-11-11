with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function saveStaffMaster(')
if idx == -1:
    idx = text.find('saveStaffMaster =')
print('saveStaffMaster pos:', idx)
if idx != -1:
    print(text[idx:idx+1500])
