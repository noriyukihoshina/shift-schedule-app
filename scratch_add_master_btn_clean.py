files = ['master.html', 'マスターテーブル.html', 'マスター統括.html']

btn_html = """                        <button class="btn btn-success" id="masterBalanceWeekdaysBtn" style="background: #059669; border-color: #047857; color: white; font-weight: 700; font-size: 0.82rem; padding: 5px 12px; display: inline-flex; align-items: center; gap: 4px;" title="実務で発生する平日出勤人数・実数の上下ブレ（最大8.5名）を、各階の制約を守りながら各階の公休を自動微修正（スワップ）してブレ幅を最小化（平準化）します">
                            ⚡ 平日出勤ブレを最少化
                        </button>\n"""

target = '<button class="btn btn-primary" id="copyForExcelBtn"'

for fname in files:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'id="masterBalanceWeekdaysBtn"' in content:
        print(f'{fname} already has button')
        continue

    if target in content:
        content = content.replace(target, btn_html + '                        ' + target, 1)
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Correctly added masterBalanceWeekdaysBtn to {fname}')
    else:
        print(f'Target not found in {fname}')
