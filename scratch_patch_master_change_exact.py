# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = """            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
            localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newDate);
            localStorage.setItem('shift_schedule_current_start_date', newDate);
            renderSavedTermsSelect();
            if (isMaster) renderMasterIntegrationView();
        });"""

replacement = """            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
            localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newDate);
            localStorage.setItem('shift_schedule_current_start_date', newDate);
            renderSavedTermsSelect();

            // 終了日・バッジ・タイトルの動的更新
            getTermInfo(newDate);

            if (isMaster) {
                // マスターテーブルの場合: クラウドから最新データを同期して統合テーブルを即時再描画！
                if (typeof pullStateFromCloud === 'function') {
                    pullStateFromCloud(true, false).then(() => {
                        if (typeof renderMasterIntegrationView === 'function') renderMasterIntegrationView();
                        if (typeof renderStatsDashboard === 'function' && lastSolveResult && lastSolveResult.stats) {
                            renderStatsDashboard(lastSolveResult.stats);
                        }
                    }).catch(() => {
                        if (typeof renderMasterIntegrationView === 'function') renderMasterIntegrationView();
                    });
                } else {
                    if (typeof renderMasterIntegrationView === 'function') renderMasterIntegrationView();
                }
            }
        });"""

if target in code:
    code = code.replace(target, replacement)
    print("Enhanced termSelect change handler with getTermInfo(newDate) and master cloud sync")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved app.js successfully.")
