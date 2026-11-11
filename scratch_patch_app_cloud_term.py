# app.js のターム同期バグ修正スクリプト

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

target_pull_term = '''                // 4. 表示中タームの再読込＆画面反映
                const targetTermDate = (isInitialBoot && cloud.lastActiveDate)
                    ? cloud.lastActiveDate
                    : (currentWorkingStartDate || cloud.lastActiveDate || '2026-04-01');'''

replacement_pull_term = '''                // 4. 表示中タームの再読込＆画面反映
                // ★ ユーザー指示: 他テーブルへ遷移した際にクラウドの古い日付でタームが進んだり戻ったりするのを完全遮断！
                const globalSyncDate = window.localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || window.localStorage.getItem('shift_schedule_current_start_date');
                const targetTermDate = globalSyncDate || currentWorkingStartDate || (isInitialBoot && cloud.lastActiveDate ? cloud.lastActiveDate : '2026-04-01');'''

if target_pull_term in text:
    text = text.replace(target_pull_term, replacement_pull_term, 1)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed pullStateFromCloud term synchronization bug.")
else:
    print("Warning: target_pull_term not found in app.js")
