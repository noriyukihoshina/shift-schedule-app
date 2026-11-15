const fs = require('fs');
let text = fs.readFileSync('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'utf8');

text = text.replace('# 勤務予定表 自動作成システム 全制約・要件定義マスター仕様書 (ver.29)', '# 勤務予定表 自動作成システム 全制約・要件定義マスター仕様書 (ver.30)');

const addition = `
---

## 23. 通所出勤実数ブレ極小化＆各病棟テーブルSTリフ集計表示の是正（ver.30新設）
1. **通所出勤実数の週内平準化スワップ（Intra-week Swap）**:
   * **背景**: 通所スタッフ・Cl2スタッフは日曜日が固定休のため、週休2日を満たすための平日公休が火〜金曜日に偏り、土曜日に全員が出勤（実数7〜8名）して月〜土の出勤実数ブレ（差3.0名）が生じる課題があった。
   * **改修内容**:
     * \`solver.js\` の \`balanceLifeWorkforceDirectly\` および \`app.js\` の \`handleLifeBalanceTsusho\` において、**各週（日〜土）の中で月〜土の稼働日実数を平準化する週内スワップ（フェーズ1）**を導入。
     * 同一週内の公休移動のため「週休2日（各週最大5日出勤）」を100%厳格保持しながら、土曜日に集中していた出勤を月〜金の少ない日へ安全にスワップ。
     * これにより、通所の出勤実数ブレを極小化（ブレ幅1.0名以内）に抑制。
2. **各病棟テーブルSTスタッフ集計行におけるリフ判定の是正**:
   * **背景**: 1階〜3階および南病棟のテーブル下部に表示される「所属 STスタッフ」行において、リフ取得数集計が \`sym.includes('リフ')\` で判定されていたため、「上1」「上2」「下1」等の正規記号がカウントされず「0」と表示される不具合があった。
   * **改修内容**: \`app.js\` の集計判定を \`isRefreshHolidaySymbol(sym)\` に改修し、セル内に配置された「上1〜下3」のリフ取得数を正確に集計・表示するよう是正。
`;

text = text.trim() + '\n' + addition.trim() + '\n';
fs.writeFileSync('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', text, 'utf8');
console.log('Updated SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md to ver.30');
