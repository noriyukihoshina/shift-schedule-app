import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    spec = f.read()

# 追記事項
add_spec = """
### 15.4 最新修正・不具合解消（2026-11-10 追加更新）
1. **カレンダー最終日（4/28）縦太罫線の強化**:
   - 4/28と出勤集計の間の縦罫線を `3.5px solid #1e293b` の超太線（`border-thickest-right`）として全テーブルで統一。
2. **STテーブル階別集計の横罫線最右端貫通**:
   - 1階・2階・3階・南の各階層集計の最終行（早の行）および全階合計の最終行において、左端セルから最右端セルまで一直線に太線（`3px solid #1e293b`）を貫通配置。
3. **係長の公休日数8日厳格化＆エラー警告表示**:
   - 係長（スタッフ01）に対する公休数の例外許容を撤廃し、規定の8日以外の公休配置（公休9日等）を防止。8日以外の場合はエラーバナー警告および薄いブルーの網掛けハイライト（`holiday-alert-cell`）を即座に表示。
4. **生活期画面の初期化フリーズ解消**:
   - 初期化関数のスコープを修正し、生活期テーブル選択時の画面フリーズ（緑色画面停止）を根絶。
5. **マスターテーブルでのターム選択連動修正**:
   - `masterTermSelect` の初期化と値読み出しを完全連携し、指定タームの全フロア統合勤務表を正常に切り替え表示。
6. **南病棟での8時勤務自動選出の完全開通**:
   - 南病棟における8時配置ガードを解除し、南2・南3病棟のスタッフから毎日1名8時勤務を確実に均等自動選出。
7. **コピペモードの全タブ連動・堅牢化**:
   - ボタンクリック時のON/OFF状態およびセル選択・コピー・ペーストを全画面で確実に動作するよう改修。
"""

if "### 15.4 最新修正・不具合解消" not in spec:
    spec += "\n" + add_spec
    with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'w', encoding='utf-8') as f:
        f.write(spec)
    print("SUCCESS: Appended 15.4 to SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md")
else:
    print("ALREADY APPENDED")
