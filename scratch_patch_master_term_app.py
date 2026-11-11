import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_init_block = """    // ★ ユーザー指示: マスターテーブルでもPOテーブルのようにタームを指定可能にする
    function initMasterTermSelect() {
        const masterSel = document.getElementById('masterTermSelect');
        if (!masterSel) return;
        masterSel.innerHTML = '';
        GLOBAL_TERMS.forEach(term => {
            const opt = document.createElement('option');
            opt.value = term.startDate;
            opt.textContent = term.label;
            if (term.startDate === currentWorkingStartDate) opt.selected = true;
            masterSel.appendChild(opt);
        });

        masterSel.addEventListener('change', (e) => {
            const newStart = e.target.value;
            currentWorkingStartDate = newStart;
            localStorage.setItem('shift_schedule_current_start_date', newStart);
            showToast(`📅 マスターテーブル: ${masterSel.options[masterSel.selectedIndex].text} に切り替えました`);
            // マスター統合再描画
            if (typeof renderMasterIntegrationView === 'function') {
                renderMasterIntegrationView();
            }
        });
    }
    // DOM初期化時に呼び出し
    setTimeout(initMasterTermSelect, 100);"""

new_init_block = """    // ★ ユーザー指示: マスターテーブルでも他テーブル（PO/各病棟）と同様に確実にタームを選択・即時切替可能にする！
    function initMasterTermSelect() {
        const masterSel = document.getElementById('masterTermSelect');
        if (!masterSel) return;

        const curStart = currentWorkingStartDate || localStorage.getItem('shift_schedule_current_start_date') || '2026-04-01';

        masterSel.innerHTML = '';
        GLOBAL_TERMS.forEach(term => {
            const opt = document.createElement('option');
            opt.value = term.startDate;
            opt.textContent = term.label;
            if (term.startDate === curStart) opt.selected = true;
            masterSel.appendChild(opt);
        });

        // 終了日・バッジの初期表示更新
        const updateTermBadges = (startDateStr) => {
            const termDef = findTermByStartDate(startDateStr);
            if (termDef) {
                const endDisplay = document.getElementById('termEndDateDisplay');
                if (endDisplay) endDisplay.textContent = termDef.endDate;
                const badge = document.getElementById('termLabelBadge');
                if (badge) badge.textContent = `【${termDef.year}年度 第${termDef.termNo}ターム】`;
                const daysBadge = document.getElementById('termDaysBadge');
                if (daysBadge) daysBadge.textContent = `${termDef.numDays}日間`;
            }
        };
        updateTermBadges(curStart);

        masterSel.onchange = async (e) => {
            const newStart = e.target.value;
            if (!newStart) return;

            currentWorkingStartDate = newStart;
            localStorage.setItem('shift_schedule_current_start_date', newStart);

            // hidden input も更新
            const dateInput = document.getElementById('termStartDate');
            if (dateInput) dateInput.value = newStart;

            // termSelect（もし存在すれば）も同期
            const otherTermSel = document.getElementById('termSelect');
            if (otherTermSel && otherTermSel !== masterSel) otherTermSel.value = newStart;

            updateTermBadges(newStart);

            const selText = masterSel.options[masterSel.selectedIndex]?.text || newStart;
            showToast(`📅 マスターテーブル: ${selText} に切り替え中...`);

            // ★ クラウドから新タームの全病棟（1f, 2f, 3f, south, st, life）最新データを一括自動取得！
            if (typeof pullStateFromCloud === 'function') {
                try {
                    await pullStateFromCloud(true, false);
                } catch (err) {
                    console.warn('Cloud sync error on term switch:', err);
                }
            }

            // ★ 全フロア統合テーブルを新タームの内容で完全再描画！
            if (typeof renderMasterIntegrationView === 'function') {
                renderMasterIntegrationView();
            }

            // ★ 勤務分析・平準化ダッシュボードも新タームの内容で完全再計算・再描画！
            if (typeof renderStatsDashboard === 'function' && lastSolveResult && lastSolveResult.stats) {
                renderStatsDashboard(lastSolveResult.stats);
            }

            showToast(`✅ マスターテーブル: ${selText} に切り替え完了しました`);
        };
    }
    // DOM初期化時に即座に呼び出し
    initMasterTermSelect();
    setTimeout(initMasterTermSelect, 150);"""

assert old_init_block in text, "old_init_block not found in app.js"
text = text.replace(old_init_block, new_init_block)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: app.js updated with robust initMasterTermSelect!")
