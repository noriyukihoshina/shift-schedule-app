import sys
sys.stdout.reconfigure(encoding='utf-8')

# 1. solver.js の生活期土日休・日休トグル直結
with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_life_pattern = """            // ★ Group A（土日休み固定）: 訪問, 管理, Cl1 のみ（※ハ1, ハ2は業務トグルに従うため除外）
            const isPatternA = (sec === '訪問' || sec === '管理' || sec === 'Cl1');
            // ★ Group B（日曜休み固定＋平日分散公休）: 通所, Cl2 のみ（※ハ3, ハ南は業務トグルに従うため除外）
            const isPatternB = (sec === '通所' || sec === 'Cl2');"""

new_life_pattern = """            // ★ ユーザー指示: 生活期「土日休」「日休」トグル連動（トグルONで優先適用）
            // Group A（土日休み固定）: 土日休トグルON、または訪問, 管理, Cl1
            const isPatternA = !!staff.isSatSunOff || (sec === '訪問' || sec === '管理' || sec === 'Cl1');
            // Group B（日曜休み固定＋平日分散公休）: 日休トグルON、または通所, Cl2
            const isPatternB = !isPatternA && (!!staff.isSunOff || (sec === '通所' || sec === 'Cl2'));"""

if old_life_pattern in text:
    text = text.replace(old_life_pattern, new_life_pattern)
    print("SUCCESS: Linked isSatSunOff and isSunOff in solver.js for Life table")

# 2. patternBStaff の抽出部にも isSunOff を追加
old_b_extract = """            if (sec === '通所' || sec === 'Cl2') {
                patternBStaff.push(s);
            }"""

new_b_extract = """            const isPatA = !!staff.isSatSunOff || (sec === '訪問' || sec === '管理' || sec === 'Cl1');
            const isPatB = !isPatA && (!!staff.isSunOff || (sec === '通所' || sec === 'Cl2'));
            if (isPatB) {
                patternBStaff.push(s);
            }"""

if old_b_extract in text:
    text = text.replace(old_b_extract, new_b_extract)
    print("SUCCESS: Linked patternBStaff with isSunOff in solver.js")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

# 2. app.js のトーストメッセージ更新
with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

app_text = app_text.replace(
    "'✨ 南病棟の特殊勤務（早・遅・E各2名 / 南2・南3に各1名）を割り当て、「最終チェック&完成」を表示しました！'",
    "'✨ 南病棟の特殊勤務（早・遅・E各2名 / 8時1名）を割り当て、「最終チェック&完成」を表示しました！'"
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_text)

print("SUCCESS: solver.js and app.js updated successfully")
