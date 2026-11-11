# -*- coding: utf-8 -*-
import re

life_files = ['life.html', '生活期.html', '生活期_管理者.html']

for fn in life_files:
    try:
        with open(fn, 'r', encoding='utf-8') as f:
            content = f.read()

        # assignSpecialDutiesBtn を非表示 (style="display:none;") にする
        # またはボタン全体を display:none にする
        content = re.sub(
            r'<button class="btn btn-primary" id="assignSpecialDutiesBtn"[^>]*>[\s\S]*?✨ 特殊勤務を入れる[\s\S]*?</button>',
            '<!-- 生活期は特殊勤務を入れるボタン不要 -->',
            content
        )
        with open(fn, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {fn}")
    except Exception as e:
        print(f"Error {fn}: {e}")

# app.js 内でも isLife のときは assignSpecialDutiesBtn を非表示にする
with open('app.js', 'r', encoding='utf-8') as f:
    app_code = f.read()

hide_code = """    // ★ 生活期テーブルでは「✨ 特殊勤務を入れる」ボタンは不要のため完全非表示化
    if (isLife) {
        const specBtn = document.getElementById('assignSpecialDutiesBtn');
        if (specBtn) specBtn.style.display = 'none';
        const fSpecBtn = document.getElementById('forceAssignSpecialBtn');
        if (fSpecBtn) fSpecBtn.style.display = 'none';
    }
"""

if '★ 生活期テーブルでは「✨ 特殊勤務を入れる」ボタンは不要' not in app_code:
    app_code = app_code.replace("initTermSelector();", "initTermSelector();\n" + hide_code)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(app_code)
    print("Added isLife special button hiding logic to app.js")
