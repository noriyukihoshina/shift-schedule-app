import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    spec = f.read()

add_spec = """
### 15.5 A/Bチーム8時均等配分＆特殊勤務2回固定・生活期復旧（2026-11-10 追加更新）
1. **生活期画面（life.html）の完全復旧**:
   - `life.html` において欠落していたテーブル構造・タブ・コントロール群を完全同期復旧し、画面フリーズを解消。
2. **全テーブル共通: Aチーム・Bチームでの8時完全均等配分（50%:50%）**:
   - 1階・2階・3階病棟（PT A/OT A ⇔ PT B/OT B）および南病棟（南2 ⇔ 南3）において、8時勤務の割り当て回数をチーム間で追跡し、14回対14回の均等配分を達成。
3. **8時担当スタッフの特殊勤務「厳格2回固定」**:
   - 8時の割り当て回数は1人最大1〜2回に厳格制限。
   - 8時が1回割り当てられたスタッフには、早・遅・Eのいずれかを1回のみ配分して「合計ぴったり2回」に固定。
   - 8時担当スタッフの特殊勤務が3回以上になることを物理的に完全排除。一般スタッフは早・遅・Eを極力4回均等配分。
4. **📋 コピペモードの操作性・UIガイドの整備**:
   - セルクリックによるワンクリックコピー＆連続貼り付け、およびキーボードの `Ctrl+C` / `Ctrl+V` ショートカット操作を確立。
"""

if "### 15.5 A/Bチーム8時均等配分" not in spec:
    spec += "\n" + add_spec
    with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'w', encoding='utf-8') as f:
        f.write(spec)
    print("SUCCESS: Updated spec with 15.5")
