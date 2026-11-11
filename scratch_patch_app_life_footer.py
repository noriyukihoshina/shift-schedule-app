with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 生活期フッター集計ルールの更新
target_old_counts_loop = """                    const sec = st.lifeSection || '';
                    const isTsusho = (sec === '通所' || sec === 'Cl2');

                    if (isTsusho) {
                        tWorkCounts[d]++;
                        tRealCounts[d] += weight;
                    } else {
                        // 訪問（訪問、管理、Cl1等）
                        vWorkCounts[d]++;
                        vRealCounts[d] += weight;
                    }"""

target_new_counts_loop = """                    const sec = st.lifeSection || '';
                    const ha = st.haSection || '';

                    // ★ ユーザー指示による生活期集計ルール4点:
                    // ① 訪問出勤人数合計 ＝ 訪問トグルONの〇の合計
                    // ② 訪問実数合計 ＝ 訪問トグルONの出勤者の実数（0.5トグルがONなら0.5で計算）
                    // ③ 通所出勤人数合計 ＝ 通所トグルONの出勤者数 ＋ CLトグルONの出勤者数 ＋ ハ3およびハ南のトグルONの出勤者数合計
                    // ④ 通所実数合計 ＝ 通所トグルONの出勤者実数 ＋ CLトグルONの出勤者実数 ＋ ハ3およびハ南のトグルONの出勤者実数の合計（0.5トグルがONなら0.5で計算）
                    const isVisit = (sec === '訪問');
                    const isTsusho = (sec === '通所') || (sec === 'Cl1' || sec === 'Cl2') || (ha === 'ハ3' || ha === 'ハ南');

                    if (isVisit) {
                        vWorkCounts[d]++;
                        vRealCounts[d] += weight;
                    }
                    if (isTsusho) {
                        tWorkCounts[d]++;
                        tRealCounts[d] += weight;
                    }"""

if target_old_counts_loop in content:
    content = content.replace(target_old_counts_loop, target_new_counts_loop)
    print("Replaced life counts loop")
else:
    print("life counts loop NOT found!")

# 2. 8時行のヘッダー名を「訪問8時」に変更
target_old_h8_header = """            // 5. 8時勤務 (平日は定数1名、土日は0名。平日で0名または2名以上なら青網掛けエラー表示！)
            lifeFootHtml += `<tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1 border-thick-bottom" colspan="2" style="color:#334155;">8時</th>`;"""

target_new_h8_header = """            // 5. 訪問8時勤務 (平日は定数1名、土日は0名。平日で0名または2名以上なら青網掛けエラー表示！)
            lifeFootHtml += `<tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1 border-thick-bottom" colspan="2" style="color:#334155;">訪問8時</th>`;"""

if target_old_h8_header in content:
    content = content.replace(target_old_h8_header, target_new_h8_header)
    print("Replaced life h8 header")
else:
    print("life h8 header NOT found!")

# 3. 自動生成完了時に生活期の場合 renderCheckTable にも即座に同期描画
target_old_solve_sync = """                        renderOutputTable(result.grid, result.stats);
                        renderStatsDashboard(result.stats);
                        switchTab('outputTab');"""

target_new_solve_sync = """                        renderOutputTable(result.grid, result.stats);
                        if (isLife) {
                            renderCheckTable(result.grid, result.stats);
                        }
                        renderStatsDashboard(result.stats);
                        switchTab('outputTab');"""

if target_old_solve_sync in content:
    content = content.replace(target_old_solve_sync, target_new_solve_sync)
    print("Replaced solve sync for life")
else:
    print("solve sync for life NOT found!")

# 4. 強制生成時も同様に同期
target_old_force_sync = """                                renderOutputTable(forceResult.grid, forceResult.stats);
                                renderStatsDashboard(forceResult.stats);
                                switchTab('outputTab');"""

target_new_force_sync = """                                renderOutputTable(forceResult.grid, forceResult.stats);
                                if (isLife) {
                                    renderCheckTable(forceResult.grid, forceResult.stats);
                                }
                                renderStatsDashboard(forceResult.stats);
                                switchTab('outputTab');"""

if target_old_force_sync in content:
    content = content.replace(target_old_force_sync, target_new_force_sync)
    print("Replaced force solve sync for life")
else:
    print("force solve sync for life NOT found!")

# 5. switchTab('checkTab') で生活期の場合に outputGrid から checkTable を自動同期描画
target_old_switchtab = """        if (isMaster && (tabId === 'checkTab' || tabId === 'statsTab')) {
            renderMasterIntegrationView();
        }"""

target_new_switchtab = """        if (isMaster && (tabId === 'checkTab' || tabId === 'statsTab')) {
            renderMasterIntegrationView();
        }
        if (isLife && tabId === 'checkTab') {
            // 生活期は基本勤務表がそのまま完成版のため、checkTableに自動同期描画！
            if (lastSolveResult && lastSolveResult.grid) {
                renderCheckTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        }"""

if target_old_switchtab in content:
    content = content.replace(target_old_switchtab, target_new_switchtab)
    print("Replaced switchTab for life")
else:
    print("switchTab for life NOT found!")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated app.js successfully!")
