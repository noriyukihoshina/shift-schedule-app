# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = "document.querySelectorAll('input[type=\"checkbox\"][data-unused]').forEach(chk => {"
listener = """        // ★ 土日休・日休の排他トグル処理（生活期・ST共通）
        document.querySelectorAll('input[type="checkbox"][data-off-type]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const offType = e.target.dataset.offType;
                if (!staffList[s]) return;
                pushHistory();
                if (offType === 'satSun') {
                    staffList[s].isSatSunOff = e.target.checked;
                    if (staffList[s].isSatSunOff) {
                        staffList[s].isSunOff = false;
                    }
                } else if (offType === 'sunOnly') {
                    staffList[s].isSunOff = e.target.checked;
                    if (staffList[s].isSunOff) {
                        staffList[s].isSatSunOff = false;
                    }
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
                renderInputTable();
            });
        });

        """

if listener not in code:
    code = code.replace(target, listener + target)
    print("Added data-off-type listener to attachInputTableEvents")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)
