# -*- coding: utf-8 -*-
with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    content = f.read()

old_sec = """- **未分類スタッフ（作成指示トグルのない一般スタッフ）の勤務作成**:
  - 業務トグル（訪問・通所・Cl1・Cl2・管理）の指示がないスタッフ（スタッフ24〜27等）は、通常のPOスタッフと同様に公休日数（標準8.0日、週休2日ベース、最大5連勤以下）を均等に割り振る。
  - 不必要な連勤を完全回避する。
  - 特殊勤務（早・遅・E・8時）は割り振らず、記号は「○」と「休」のみ（事前希望やリフレッシュ休暇等は除く）。8時可トグルがONでなければ特殊勤務は一切入らない。"""

new_sec = """- **未分類スタッフ（作成指示トグルのない一般スタッフ）の勤務作成**:
  - 業務トグル（訪問・通所・Cl1・Cl2・管理）の指示がないスタッフ（スタッフ24〜27等）は、通常のPOスタッフと同様に週単位組み合わせ探索エンジン（`solveStaffScheduleWeekly`）を適用し、公休日数（標準8.0日）、カレンダー週休2日要件、最大5連勤以下、および5連勤直後の2連休義務を100%厳格に満たす。
  - 事前希望で「○」が連続入力されている場合でも、ハード制約（最大5連勤以下・週休2日・5連勤後2連休）を最優先として自動調停し、制約違反エラーを物理的にゼロに抑える。
  - 不必要な連勤を完全回避する。
  - 特殊勤務（早・遅・E・8時）は割り振らず、記号は「○」と「休」のみ（事前希望やリフレッシュ休暇等は除く）。8時可トグルがONでなければ特殊勤務は一切入らない。"""

norm_content = content.replace('\r\n', '\n')
norm_content = norm_content.replace(old_sec.replace('\r\n', '\n'), new_sec.replace('\r\n', '\n'), 1)

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'w', encoding='utf-8', newline='\n') as f:
    f.write(norm_content)

print("SPEC_UPDATED")
