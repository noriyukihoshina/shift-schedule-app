import sys
sys.stdout.reconfigure(encoding='utf-8')

toolbar_card_html = """            <!-- ターム設定バー（期間・公休日数・自動保存切替） ★マスターテーブル用最重要ツールバー -->
            <div class="toolbar-card" style="margin-bottom: 0.75rem; background: #f8fafc; border-left: 4px solid #0284c7; padding: 10px 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.88rem; flex-wrap: wrap;">
                        <span style="font-weight: 700; color: #1e293b;">📅 対象期間（ターム固定）:</span>
                        <select id="masterTermSelect" class="master-term-select" style="padding: 6px 12px; border: 2px solid #0284c7; background: #f0f9ff; border-radius: 6px; font-weight: 700; color: #0369a1; font-size: 0.95rem; cursor: pointer; min-width: 330px;" title="年度ごとの正規13ターム（第1〜12ターム:28日間、第13ターム:29日間）を選択します">
                            <option value="2026-04-01" selected>【2026年度 第1ターム】 4/1 〜 4/28 (28日間)</option>
                            <option value="2026-04-29">【2026年度 第2ターム】 4/29 〜 5/26 (28日間)</option>
                            <option value="2026-05-27">【2026年度 第3ターム】 5/27 〜 6/23 (28日間)</option>
                            <option value="2026-06-24">【2026年度 第4ターム】 6/24 〜 7/21 (28日間)</option>
                            <option value="2026-07-22">【2026年度 第5ターム】 7/22 〜 8/18 (28日間)</option>
                            <option value="2026-08-19">【2026年度 第6ターム】 8/19 〜 9/15 (28日間)</option>
                            <option value="2026-09-16">【2026年度 第7ターム】 9/16 〜 10/13 (28日間)</option>
                            <option value="2026-10-14">【2026年度 第8ターム】 10/14 〜 11/10 (28日間)</option>
                            <option value="2026-11-11">【2026年度 第9ターム】 11/11 〜 12/8 (28日間)</option>
                            <option value="2026-12-09">【2026年度 第10ターム】 12/9 〜 1/5 (28日間)</option>
                            <option value="2027-01-06">【2026年度 第11ターム】 1/6 〜 2/2 (28日間)</option>
                            <option value="2027-02-03">【2026年度 第12ターム】 2/3 〜 3/2 (28日間)</option>
                            <option value="2027-03-03">【2026年度 第13ターム】 3/3 〜 3/31 (29日間・年度末調整)</option>
                            <option value="2027-04-01">【2027年度 第1ターム】 4/1 〜 4/28 (28日間)</option>
                            <option value="2027-04-29">【2027年度 第2ターム】 4/29 〜 5/26 (28日間)</option>
                            <option value="2027-05-27">【2027年度 第3ターム】 5/27 〜 6/23 (28日間)</option>
                            <option value="2027-06-24">【2027年度 第4ターム】 6/24 〜 7/21 (28日間)</option>
                            <option value="2027-07-22">【2027年度 第5ターム】 7/22 〜 8/18 (28日間)</option>
                            <option value="2027-08-19">【2027年度 第6ターム】 8/19 〜 9/15 (28日間)</option>
                            <option value="2027-09-16">【2027年度 第7ターム】 9/16 〜 10/13 (28日間)</option>
                            <option value="2027-10-14">【2027年度 第8ターム】 10/14 〜 11/10 (28日間)</option>
                            <option value="2027-11-11">【2027年度 第9ターム】 11/11 〜 12/8 (28日間)</option>
                            <option value="2027-12-09">【2027年度 第10ターム】 12/9 〜 1/5 (28日間)</option>
                            <option value="2028-01-06">【2027年度 第11ターム】 1/6 〜 2/2 (28日間)</option>
                            <option value="2028-02-03">【2027年度 第12ターム】 2/3 〜 3/1 (28日間)</option>
                            <option value="2028-03-02">【2027年度 第13ターム】 3/2 〜 3/31 (30日間・年度末調整)</option>
                        </select>
                        <span style="color: #64748b;">〜 終了日:</span>
                        <span id="termEndDateDisplay" style="font-weight: 700; color: #1e293b;">2026-04-28</span>
                        <span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.78rem;" id="termLabelBadge">【2026年度 第1ターム】</span>
                        <span id="termDaysBadge" style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">28日間</span>
                    </div>
                </div>
            </div>
"""

target_needle = """        <!-- 3. チェックシートタブ（制約検証・修正取込） -->
        <section id="checkTab" class="tab-panel active">"""

for fname in ['index.html', 'master.html', 'マスターテーブル.html']:
    try:
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()

        if 'masterTermSelect' in content:
            print(f"{fname}: already has masterTermSelect")
            continue

        if target_needle in content:
            replacement = target_needle + "\n" + toolbar_card_html
            content = content.replace(target_needle, replacement)
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"SUCCESS: Injected masterTermSelect toolbar into {fname}")
        else:
            print(f"WARNING: target_needle not found in {fname}")
    except Exception as e:
        print(f"Error in {fname}: {e}")
