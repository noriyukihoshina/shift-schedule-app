import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    text = f.read()

new_section = """
### 15.7 マスターテーブルにおけるターム選択・即時切替機能の完全開通（2026-11-10 最新更新）
1. **マスターテーブル画面への「対象期間（ターム固定）」常時設置**:
   - これまでマスターテーブル（`index.html`, `master.html`）では非表示タブ（`inputTab`）の中に閉じ込められ画面からアクセスできなかった「📅 対象期間（ターム固定）:」設定バーを、全フロア統合画面（`checkTab`）の最上部に堂々と常時配置。
   - 他病棟テーブル（1階・2階・3階・南・生活期・ST）と完全に統一されたデザイン・操作感を実現。
2. **全フロア統合テーブルの即時切替＆クラウド自動再同期**:
   - マスターテーブルのタームプルダウン（`masterTermSelect`）を変更した際、直ちに新タームの全病棟（1階・2階・3階・南・ST・生活期）クラウドデータを自動取得し、全フロア統合勤務表および勤務分析ダッシュボードを即座に新タームの内容へ完全再描画。
   - 終了日表示、タームラベルバッジ、日数バッジも新ターム情報へリアルタイム同期。
3. **2025年度タームの完全除去**:
   - ユーザー指示に基づき、「対象期間（ターム固定）」および「保存済み期間の呼出」から2025年度の選択肢を完全に排除し、2026年度（2026-04-01）以降の正規タームのみを明快に選択可能に改修。
"""

text += new_section

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md updated with 15.7!")
