# -*- coding: utf-8 -*-
import re

master_files = ['master.html', 'index.html', 'マスターテーブル.html']

po_toolbar_html = """            <!-- ターム設定バー（期間・公休日数・自動保存切替） ★POテーブルと完全同一仕様 -->
            <div class="toolbar-card" style="margin-bottom: 0.75rem; background: #f8fafc; border-left: 4px solid #0284c7; padding: 10px 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.88rem; flex-wrap: wrap;">
                        <span style="font-weight: 700; color: #1e293b;">📅 対象期間（ターム固定）:</span>
                        <select id="termSelect" style="padding: 4px 8px; border: 1px solid #0284c7; background: #f0f9ff; border-radius: 4px; font-weight: 700; color: #0369a1; font-size: 0.88rem; cursor: pointer;" title="年度ごとの正規13ターム（第1〜12ターム:28日間、第13ターム:29日間）を選択します">
                        </select>
                        <input type="hidden" id="termStartDate" value="2026-04-01">
                        <span style="font-size: 0.85rem; color: #64748b;">〜</span>
                        <span id="termEndDateDisplay" style="font-weight: 700; color: #1e293b;">2026-04-28</span>
                        <span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.85rem;" id="termTitleBadge">第1ターム (4/1～4/28)</span>
                        <span id="termDaysBadge" style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.82rem;">28日間</span>
                    </div>
                </div>
            </div>"""

for fn in master_files:
    try:
        with open(fn, 'r', encoding='utf-8') as f:
            content = f.read()

        # checkTab 内の旧 toolbar-card (masterTermSelect を含むもの) を POテーブルと完全同一の toolbar に置換
        checktab_toolbar_pattern = r'<section id="checkTab" class="tab-panel active">\s*<!-- ターム設定バー[\s\S]*?</div>\s*</div>\s*</div>'
        if re.search(checktab_toolbar_pattern, content):
            content = re.sub(
                checktab_toolbar_pattern,
                '<section id="checkTab" class="tab-panel active">\n' + po_toolbar_html,
                content,
                count=1
            )
            print(f"Replaced checkTab toolbar in {fn}")
        else:
            # 別の形式の場合、masterTermSelect を含むブロックを探す
            fallback_pattern = r'<div class="toolbar-card"[\s\S]*?masterTermSelect[\s\S]*?</div>\s*</div>\s*</div>'
            if re.search(fallback_pattern, content):
                content = re.sub(fallback_pattern, po_toolbar_html, content, count=1)
                print(f"Replaced fallback toolbar in {fn}")

        # 非表示の inputTab 内にある重複した id="termSelect" を id="hiddenOldTermSelect" にリネームしてID重複を解消
        input_tab_pattern = r'(<section id="inputTab"[\s\S]*?<select id=")termSelect(")'
        content = re.sub(input_tab_pattern, r'\1hiddenOldTermSelect\2', content)

        with open(fn, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Processed {fn}")
    except Exception as e:
        print(f"Error {fn}: {e}")

# -------------------------------------------------------------
# app.js 内の initTermSelector を更新
# isMaster のときも termSelect の change イベントでマスターテーブルが100%確実に再描画されるようにする
# -------------------------------------------------------------
with open('app.js', 'r', encoding='utf-8') as f:
    app_code = f.read()

# renderMasterIntegrationView の冒頭で curStartDate を正確に取得
old_render_start = "const curStartDate = document.getElementById('masterTermSelect')?.value || document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';"
new_render_start = """const termSel = document.getElementById('termSelect') || document.getElementById('masterTermSelect');
        const curStartDate = (termSel && termSel.value) ? termSel.value : (document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01');
        const term = getTermInfo(curStartDate);"""

if old_render_start in app_code:
    # 既存の const term = getTermInfo(); も含めて置換
    app_code = app_code.replace("const term = getTermInfo();\n\n        const numDays = term.dates.length;\n        " + old_render_start, new_render_start + "\n        const numDays = term.dates.length;")
    print("Updated renderMasterIntegrationView to use exact curStartDate and term")

# initTermSelector の change イベント内で isMaster の再同期＆再描画を強化
target_change_tail = """if (isMaster) renderMasterIntegrationView();
            renderSavedTermsSelect();
        });"""

new_change_tail = """if (isMaster) {
                if (typeof pullStateFromCloud === 'function') {
                    pullStateFromCloud(true, false).then(() => {
                        if (typeof renderMasterIntegrationView === 'function') renderMasterIntegrationView();
                        if (typeof renderStatsDashboard === 'function' && lastSolveResult && lastSolveResult.stats) {
                            renderStatsDashboard(lastSolveResult.stats);
                        }
                    }).catch(() => {
                        if (typeof renderMasterIntegrationView === 'function') renderMasterIntegrationView();
                    });
                } else {
                    if (typeof renderMasterIntegrationView === 'function') renderMasterIntegrationView();
                }
            }
            renderSavedTermsSelect();
        });"""

if target_change_tail in app_code:
    app_code = app_code.replace(target_change_tail, new_change_tail)
    print("Enhanced initTermSelector change event for master integration")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_code)

print("Saved app.js successfully.")
