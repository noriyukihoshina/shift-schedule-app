with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    text = f.read()

append_text = '''
## 15.9 最新不具合解消とUI厳格化（2026-11-10夜 確定版）

### 1. 生活期テーブル自動生成時エラーの完全解消
- **TDZ（Temporal Dead Zone）エラーの根絶**:
  - `renderOutputTable` 関数の冒頭で `currentGrid` 変数を安全に初期化（`const currentGrid = grid || (lastSolveResult && lastSolveResult.grid) || [];`）。
  - 変数宣言前にアクセスされていたスコープ問題を解消し、生活期テーブルで「⚡ 勤務表を自動生成する」ボタンを押した際に発生していた `Cannot access 'currentGrid' before initialization` エラーモーダルを完全に解消。
  - スクリプト内の余分な波括弧（構文エラー）を撤去し、すべてのテーブルでJSパースエラーを完全にゼロ化。

### 2. コピペモード（Ctrl+V）の個人集計＆最下部集計リアルタイム完全連動
- **セル編集後の集計再計算・再描画パイプラインの開通**:
  - コピペモードで `Ctrl+V` を実行した際、セルDOMの文字を書き換えるだけでなく、`staffList`（入力シート）および `lastSolveResult.grid` / `lastScheduler.grid`（出力・チェックシート）を即時更新。
  - `lastScheduler.calculateStats()` による再集計、`renderOutputTable()`、`renderInputTable()`、`renderMasterIntegrationView()` を即時呼び出し。
  - 公休をコピーして「○」のセルに貼り付けた場合でも、該当スタッフの右側集計列（出勤、公休、有休、リフ、特殊勤務回数）および日付最下部の日別集計行（出勤人数合計、実数合計、特殊勤務合計）の数字がリアルタイムに即座に変化・再計算されるように改修。
  - 貼り付け完了後も選択中セルのブルー枠（`.copy-selected-cell`）が維持され、連続作業時の操作性を確保。

### 3. 全画面からの「2025年度」ターム完全排除
- **静的HTMLおよび生成ロジックの徹底クリーンアップ**:
  - 全HTMLファイル（`index.html`, `master.html`, `1f.html`, `2f.html`, `3f.html`, `south.html`, `life.html`, `ST.html`, 日本語名HTML等）に残存していた `<option value="2026-01-06">【2025年度 第11ターム】...` 3行を完全に一掃。
  - 2026年度（2026-04-01）および2027年度の正規タームのみを選択可能とし、誤操作や不整合を完全に防止。

### 4. マスターテーブルでのターム選択復旧 ＆ 全テーブル間同一ターム同期
- **グローバルアクティブターム（`shift_schedule_global_active_term_start_date`）の最優先化**:
  - ページ起動時の初期ターム決定ロジックにおいて、病棟個別の最終アクセス日よりもグローバル選択タームを最優先で取得。
  - マスターテーブルで第2ターム（4/29〜5/26）を選択した場合、他のテーブル（1F〜3F、南、ST、生活期）を開いてもすべて第2タームが開くように統一。
  - 他テーブルからマスターテーブルに戻った場合でも第2タームが確実に保持される。
  - マスターテーブルでタームを切り替えた際、終了日表示（例: 2026-05-26）、バッジ（例: 【2026年度 第2ターム】）、および全フロア統合テーブルの日付ヘッダー（例: 4/29〜5/26）が即座に最新タームへ同期・再描画される。
  - `checkTitleDisplay` が単一病棟用タイトルで上書きされる現象を防止。

### 5. 罫線の視認性極限強化
- **4/28と出勤集計の間の縦罫線（4.5px極太線）**:
  - 最終日列（4/28）の右ボーダー（`.border-thickest-right`）および出勤集計列の左ボーダーに `border-left: 4.5px solid #0f172a !important;` を指定し、期間内日付と集計列との境界を明確に区切る極太縦線を実装。
- **マスターテーブル各フロア間の横境界線（最右端まで太線貫通）**:
  - 各フロアのヘッダー行（`floor-boundary-row`）の階・項目・全日付セル・全集計セル・備考セルに至る全セルに `border-top: 4px solid #334155 !important;` を適用し、最左端から最右端まで一本の太い横罫線が完全に貫通するデザインを実現。

### 6. 勤務分析ダッシュボード: グラフの平日バー表示色
- **平日表示色の緑（`#10b981`）確実反映**:
  - 日祝（赤: `#ef4444`）、土曜日（水色: `#0ea5e9`）、平日（緑: `#10b981`）の色分けをキャッシュバスター更新により確実に全ブラウザへ即時反映。
'''

text += append_text

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md successfully.")
