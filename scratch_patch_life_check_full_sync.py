with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_life_check = """            tfoot.innerHTML = lifeFootHtml;
            const checkTfoot = document.getElementById('checkTableFoot');
            if (checkTfoot && checkTfoot !== tfoot) checkTfoot.innerHTML = lifeFootHtml;
            attachOutputTableEvents();
            return;"""

target_new_life_check = """            tfoot.innerHTML = lifeFootHtml;
            // ★ 生活期は基本勤務表がそのまま完成版のため、checkTableHead / checkTableBody / checkTableFoot 全てに即時完全同期描画！
            const checkThead = document.getElementById('checkTableHead');
            const checkTbody = document.getElementById('checkTableBody');
            const checkTfoot = document.getElementById('checkTableFoot');
            if (checkThead) checkThead.innerHTML = headHtml;
            if (checkTbody) checkTbody.innerHTML = bodyHtml;
            if (checkTfoot) checkTfoot.innerHTML = lifeFootHtml;
            attachOutputTableEvents();
            return;"""

if target_old_life_check in content:
    content = content.replace(target_old_life_check, target_new_life_check)
    print("Replaced life check table sync")
else:
    print("life check table sync target NOT found!")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated app.js successfully!")
