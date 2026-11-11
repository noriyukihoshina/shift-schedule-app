with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    const defaultDate = document.getElementById('termStartDate')?.value || '2026-04-01';
    const matchedTerm = findTermByStartDate(lastActiveDate || defaultDate);
    const targetDate = matchedTerm ? matchedTerm.startDate : (lastActiveDate || defaultDate);'''

replacement = '''    const defaultDate = document.getElementById('termStartDate')?.value || '2026-04-01';
    // ★ ユーザー指示: どこかのテーブルでタームを指定したらすべてのテーブルが同一のタームを開く！
    const globalActiveDate = localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || localStorage.getItem('shift_schedule_current_start_date');
    const chosenDate = globalActiveDate || lastActiveDate || defaultDate;
    const matchedTerm = findTermByStartDate(chosenDate);
    const targetDate = matchedTerm ? matchedTerm.startDate : defaultDate;'''

if target in text:
    text = text.replace(target, replacement, 1)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed targetDate logic successfully.")
else:
    print("Warning: target not found.")
