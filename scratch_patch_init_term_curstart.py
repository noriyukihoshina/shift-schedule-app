# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = "const curStart = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';"
replacement = """const curStart = localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || localStorage.getItem('shift_schedule_current_start_date') || document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        currentWorkingStartDate = curStart;
        const startDateInput = document.getElementById('termStartDate');
        if (startDateInput) startDateInput.value = curStart;
        getTermInfo(curStart);"""

if target in code:
    code = code.replace(target, replacement, 1)
    print("Updated curStart in initTermSelector to read global active term and sync badges")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved app.js")
