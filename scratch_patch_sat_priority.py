with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_sat = "// 土曜日は日曜日と合わせて土日2連休になるため連勤防止に有効\n                            if (di && di.wIdx === 5) score -= 25;"
target_new_sat = "// 土曜日は日曜日と合わせて土日2連休になるため5連勤後2連休要件に極めて有効\n                            if (di && di.wIdx === 5) score -= 80;"

if target_old_sat in content:
    content = content.replace(target_old_sat, target_new_sat)
    print("Replaced sat priority")
else:
    print("sat priority not found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js")
