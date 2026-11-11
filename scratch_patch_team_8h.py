import sys
sys.stdout.reconfigure(encoding='utf-8')

# 1. solver.js の assign8ClockDuties をチーム均等選出＆上限厳格化に書き換え
with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_assign8_body = """            candidates.sort((a, b) => a.score - b.score);
            const chosen = candidates[0].staffIndex;
            this.setSymbol(chosen, d, SYMBOLS.H8, false);
            counts[chosen]++;
            lastAssignedDay[chosen] = d;"""

# チーム判定ヘルパーとチーム累積追跡を assign8ClockDuties に組み込む
# assign8ClockDuties の冒頭
old_assign8_start = """    assign8ClockDuties(options = {}) {
        // ★ 南病棟でも南2・南3スタッフから毎日1名8時を選出！
        const force = options && options.force === true;
        const counts = new Array(this.numStaff).fill(0);
        const lastAssignedDay = new Array(this.numStaff).fill(-10);"""

new_assign8_start = """    assign8ClockDuties(options = {}) {
        // ★ ユーザー指示: 全テーブルで共通でAチームとBチームの8時を完全均等（14回対14回）に配分！
        // かつ8時担当スタッフの8時回数は最大1〜2回（原則1回）に制限し、特殊勤務合計を2つに固定！
        const force = options && options.force === true;
        const counts = new Array(this.numStaff).fill(0);
        const lastAssignedDay = new Array(this.numStaff).fill(-10);

        // チーム判定ヘルパー (A or B)
        const getStaffTeam = (s) => {
            const st = this.staffList[s];
            if (!st) return 'A';
            if (this.isSouth) {
                const fl = st.subFloor || st.floor || '';
                return (fl === '南3' || fl.includes('南3')) ? 'B' : 'A';
            }
            const sec = st.section || '';
            if (sec.includes('B')) return 'B';
            if (sec.includes('A')) return 'A';
            return (s % 2 === 1) ? 'B' : 'A';
        };

        const team8Counts = { A: 0, B: 0 };"""

text = text.replace(old_assign8_start, new_assign8_start, 1)

# 候補者ループ内のスコア計算部
old_score_calc = """                // スコア: 割当回数が少ない順 + 直近に8時に入っていない順（適度にローテーション）
                let score = counts[s] * 20 - (d - lastAssignedDay[s]);
                candidates.push({ staffIndex: s, score });"""

new_score_calc = """                // ★ ユーザー指示: 8時の回数は1人最大1回（どうしても不足する場合のみ2回）！3回以上は絶対禁止！
                if (counts[s] >= 2) continue;

                const team = getStaffTeam(s);
                // チーム均等化ペナルティ: 8時回数が多いチームには強力なペナルティを付与して交互・均等選出
                const teamDiff = team8Counts[team] - (team === 'A' ? team8Counts.B : team8Counts.A);
                const teamPenalty = teamDiff * 5000;

                // 回数ペナルティ: 0回のスタッフを最優先（1回のスタッフは強く抑制）
                const countPenalty = counts[s] * 10000;

                // スコア: チーム均等 + 割当回数0回優先 + 直近ローテーション
                let score = countPenalty + teamPenalty - (d - lastAssignedDay[s]);
                candidates.push({ staffIndex: s, score, team });"""

text = text.replace(old_score_calc, new_score_calc, 1)

# 選出部
old_chosen_block = """            candidates.sort((a, b) => a.score - b.score);
            const chosen = candidates[0].staffIndex;
            this.setSymbol(chosen, d, SYMBOLS.H8, false);
            counts[chosen]++;
            lastAssignedDay[chosen] = d;"""

new_chosen_block = """            candidates.sort((a, b) => a.score - b.score);
            const chosen = candidates[0].staffIndex;
            const chosenTeam = candidates[0].team;
            this.setSymbol(chosen, d, SYMBOLS.H8, false);
            counts[chosen]++;
            team8Counts[chosenTeam]++;
            lastAssignedDay[chosen] = d;"""

text = text.replace(old_chosen_block, new_chosen_block, 1)

# 2. assignSpecialDuties で、8時が1回あるスタッフに早・遅・Eを「ぴったり1回」割り当てて【合計2回固定】にする！
old_special_penalty = """                    // 1. 合計回数ペナルティ（早+遅+E）
                    let totalCountPenalty = 0;
                    if (is8ClockStaff || counts.h8[s] > 0) {
                        // 8時担当スタッフ: 全特殊勤務の合計がちょうど2回になるように誘導
                        if (grandTotalSpecial === 1) {
                            totalCountPenalty = -1000; // 1回あれば2回目として配置可能
                        } else if (grandTotalSpecial === 0) {
                            totalCountPenalty = -3000; // 0回なら優先配置
                        } else {
                            totalCountPenalty = 200000; // 2回以上は配置不可
                        }"""

new_special_penalty = """                    // 1. 合計回数ペナルティ（早+遅+E）
                    let totalCountPenalty = 0;
                    if (is8ClockStaff || counts.h8[s] > 0) {
                        // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！
                        // 8時が1回ある人は、早・遅・Eのいずれかをもう1回割り当てて合計【ちょうど2回】に確定させる！
                        if (grandTotalSpecial === 1) {
                            totalCountPenalty = -20000; // 1回あるスタッフは2回目（合計2）の枠として強力に優先！
                        } else if (grandTotalSpecial === 0) {
                            totalCountPenalty = -5000;
                        } else {
                            totalCountPenalty = 300000; // 2回に達したら絶対にそれ以上割り当てない（2回固定）
                        }"""

text = text.replace(old_special_penalty, new_special_penalty, 1)

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Updated solver.js with team-balanced 8h duty and strict 2-duty lock!")
