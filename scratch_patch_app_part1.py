import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. generateAllTerms: 2025年度を削除し 2026, 2027 のみに
text = text.replace("const years = [2025, 2026, 2027];", "const years = [2026, 2027];")
text = text.replace("GLOBAL_TERMS.find(t => t.startDate === '2025-04-01')", "GLOBAL_TERMS.find(t => t.startDate === '2026-04-01')")

# 2. isSaturdayCol ヘルパー関数の定義を先頭付近（DOMロード直後）に配置
sat_helper_def = """
    // ★ ユーザー指示: 罫線の縦太線が火曜日と水曜日の間に引かれているが、土曜日と日曜日の間に引いて。
    // カレンダー日付が土曜日（wIdx === 5）の列の右側に border-thick-right を付与するヘルパー
    function isSaturdayCol(d) {
        try {
            const t = (typeof currentTerm !== 'undefined' && currentTerm && currentTerm.dates) ? currentTerm : getTermInfo();
            if (t && t.dates && t.dates[d]) {
                return t.dates[d].wIdx === 5;
            }
        } catch (e) {}
        // フォールバック: 2026年4月開始（4/1水曜=wIdx2）の場合、d=3, 10, 17, 24が土曜日
        return ((d + 1) % 7 === 4);
    }
"""

if "function isSaturdayCol(d)" not in text:
    text = text.replace("document.addEventListener('DOMContentLoaded', () => {", "document.addEventListener('DOMContentLoaded', () => {\n" + sat_helper_def)

# 3. 全40箇所の ((d + 1) % 7 === 0) ? 'border-thick-right' : '' を isSaturdayCol(d) ? 'border-thick-right' : '' に置換
text = text.replace("((d + 1) % 7 === 0) ? 'border-thick-right' : ''", "isSaturdayCol(d) ? 'border-thick-right' : ''")

# 4. 見出しの全病棟統一
# 【○F 所属 STスタッフ】
text = re.sub(r'【\$\{currentFloor\}\s*所属\s*STスタッフ[^】]*】', '【${currentFloor} 所属 STスタッフ】', text)
text = re.sub(r'【1F\s*所属\s*STスタッフ[^】]*】', '【1F 所属 STスタッフ】', text)
text = re.sub(r'【2F\s*所属\s*STスタッフ[^】]*】', '【2F 所属 STスタッフ】', text)
text = re.sub(r'【3F\s*所属\s*STスタッフ[^】]*】', '【3F 所属 STスタッフ】', text)
text = re.sub(r'【南\s*所属\s*STスタッフ[^】]*】', '【南 所属 STスタッフ】', text)

# 【○F 応援 ハーフマン】
text = re.sub(r'【\$\{currentFloor\}\s*応援】ハーフマン[^<]*', '【${currentFloor} 応援 ハーフマン】', text)
text = re.sub(r'【1F\s*応援】ハーフマン[^<]*', '【1F 応援 ハーフマン】', text)
text = re.sub(r'【2F\s*応援】ハーフマン[^<]*', '【2F 応援 ハーフマン】', text)
text = re.sub(r'【3F\s*応援】ハーフマン[^<]*', '【3F 応援 ハーフマン】', text)
text = re.sub(r'【南\s*応援】ハーフマン[^<]*', '【南 応援 ハーフマン】', text)

# 5. STスタッフ01および0.5トグル使用者の集計出勤日数（実日数＝頭数20を表示）
text = text.replace("else if (sym === '早') { stEarlyCount++; stWorkCount += (st.isHalf ? 0.5 : 1); }",
                    "else if (sym === '早') { stEarlyCount++; stWorkCount += 1; }")
text = text.replace("else if (isWorkSymbol(sym)) { stWorkCount += (st.isHalf ? 0.5 : 1); }",
                    "else if (isWorkSymbol(sym)) { stWorkCount += 1; }")

# 6. STテーブル罫線統一: 最も太い横罫線＝スタッフ勤務と集計の間、中太横線＝階と階の間
# 階と階の間: 2px solid #94a3b8 (中太横線)
text = text.replace("const rowBorderB = isLastInFloor ? 'border-bottom: 3px solid #1e293b !important;' : '';",
                    "const rowBorderB = isLastInFloor ? 'border-bottom: 2px solid #94a3b8 !important;' : '';")
# スタッフ勤務と集計の間: 3.5px solid #1e293b (最も太い横罫線)
text = text.replace('class="table-footer-summary"', 'class="table-footer-summary st-summary-divider"')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Part 1 of app.js updated (isSaturdayCol, terms, headers, ST counts, ST borders)")
