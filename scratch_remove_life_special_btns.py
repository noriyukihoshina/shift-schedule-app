import re

files = ['life.html', '生活期.html', '生活期_管理者.html']

for fname in files:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. outputAssignSpecialBtn の削除
    content = re.sub(r'\s*<button class="btn btn-success" id="outputAssignSpecialBtn"[\s\S]*?</button>', '', content)
    # 2. forceAssignSpecialBtn の削除
    content = re.sub(r'\s*<button class="btn btn-success" id="forceAssignSpecialBtn"[\s\S]*?</button>', '', content)
    # 3. 説明文の調整
    content = content.replace('💡 仮自動生成された基本勤務表です。Excelに貼り付けて手動微修正、またはUI上で直接編集できます（※この段階では特殊勤務が入っていなくてもエラーになりません）。完了したら「✨ 特殊勤務を入れる」を押してください。',
                              '💡 自動生成された生活期勤務表です。Excelに貼り付けて手動微修正、またはUI上で直接編集・確認が可能です。')
    content = content.replace('💡 特殊勤務（早・遅・E・8時）が割り当てられた完成勤務表です。',
                              '💡 生活期の完成勤務表です。')

    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {fname}')
