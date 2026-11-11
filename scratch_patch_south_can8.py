import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 南病棟での can8 初期値: 南2(i <= 9) に加え、南3(23 <= i && i <= 31) にも can8 を設定
old_can8_init = "can8: (i <= 9),      // 1〜9番目のみ8時可能（現場の運用に完全一致）"
new_can8_init = """can8: (isSouth ? ((i >= 5 && i <= 9) || (i >= 27 && i <= 31)) : (i <= 9)), // 南病棟は南2・南3双方に8時可能スタッフを均等配置"""

text = text.replace(old_can8_init, new_can8_init)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

# solver.js でも南病棟で can8 の有無に関わらず南2・南3双方から必ず選出できるようにガードを強化
with open('solver.js', 'r', encoding='utf-8') as f:
    sol_text = f.read()

old_cands_check = """                // 南病棟では can8 がONのスタッフを最優先。もし該当者がいなければ南2/南3の一般スタッフも候補に含める
                if (this.isSouth) {
                    const hasAnyCan8 = this.staffList.some(st => !st.isUnused && !st.isSectionChief && st.can8);
                    if (hasAnyCan8 && !this.staffList[s].can8) continue;
                } else {
                    if (!this.staffList[s].can8) continue;
                }"""

new_cands_check = """                // ★ ユーザー指示: 全テーブルでAチーム・Bチーム（南病棟なら南2・南3）から完全均等選出
                if (this.isSouth) {
                    const staffTeam = getStaffTeam(s);
                    // 該当チーム（南2または南3）に can8 スタッフがいるか確認
                    const teamHasCan8 = this.staffList.some(st => !st.isUnused && !st.isSectionChief && st.can8 && getStaffTeam(this.staffList.indexOf(st)) === staffTeam);
                    if (teamHasCan8 && !this.staffList[s].can8) continue;
                } else {
                    if (!this.staffList[s].can8) continue;
                }"""

sol_text = sol_text.replace(old_cands_check, new_cands_check)

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(sol_text)

print("SUCCESS: Updated app.js and solver.js for South ward 8h team balance!")
