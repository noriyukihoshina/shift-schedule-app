// add_cloud_sync_feature.js
// index.html と app.js に「クラウド自動保存・別PC間リアルタイム同期」機能を組み込むスクリプト

const fs = require('fs');
const path = require('path');

// ============================================================
// 1. index.html の更新（ヘッダーにクラウド同期ステータス＆手動同期ボタン配置、キャッシュバスターrev30更新）
// ============================================================
const indexPath = path.join(__dirname, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const oldHeaderBadgeRegex = /<div style="display: flex; align-items: center; gap: 10px; font-size: 0\.82rem;">[\s\S]*?<\/header>/;
const newHeaderBadgeHtml = `<div style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem;">
            <span id="autoSaveStatusBadge" style="display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 12px; border-radius: 9999px; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <span id="autoSaveStatusDot" style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
                <span id="autoSaveStatusText">☁️ クラウド同期確認中...</span>
            </span>
            <button type="button" id="manualCloudSyncBtn" title="クラウド上の最新データ（別PCでの変更内容）を今すぐ読み込みます" style="background: rgba(255,255,255,0.15); color: #ffffff; border: 1px solid rgba(255,255,255,0.35); padding: 4px 10px; border-radius: 9999px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                🔄 最新同期
            </button>
        </div>
    </header>`;

if (oldHeaderBadgeRegex.test(indexHtml)) {
    indexHtml = indexHtml.replace(oldHeaderBadgeRegex, newHeaderBadgeHtml);
    console.log('index.html: Updated header cloud sync badge and button');
}

indexHtml = indexHtml.replace(/solver\.js\?v=[^"]+/, 'solver.js?v=20261016_rev30');
indexHtml = indexHtml.replace(/app\.js\?v=[^"]+/, 'app.js?v=20261016_rev30');

fs.writeFileSync(indexPath, indexHtml, 'utf8');

// ============================================================
// 2. app.js の更新（クラウド自動保存・起動時クラウド復元・タブ復帰時同期）
// ============================================================
const appPath = path.join(__dirname, 'app.js');
let appCode = fs.readFileSync(appPath, 'utf8');

// 2-1. updateSaveStatusUI とクラウド同期管理関数を追加
const oldUpdateStatusRegex = /function updateSaveStatusUI\(savedDate\) \{[\s\S]*?\n    \}/;
const newCloudSyncFunctions = `// ==========================================
    // ★ クラウド自動保存 ＆ 別PC間リアルタイム同期エンジン
    // ==========================================
    let isCloudInitialSyncDone = false;
    let isRestoringFromCloud = false;
    let cloudSyncTimer = null;
    let lastCloudUpdatedAt = null;
    let isCloudSyncInFlight = false;
    let pendingCloudResave = false;

    function setCloudStatusBadge(mode, customText) {
        const badgeText = document.getElementById('autoSaveStatusText');
        const badge = document.getElementById('autoSaveStatusBadge');
        const dot = document.getElementById('autoSaveStatusDot');
        if (!badgeText) return;

        const nowStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        if (mode === 'syncing') {
            badgeText.textContent = customText || '☁️ クラウドへ自動保存中...';
            if (badge) { badge.style.background = '#eff6ff'; badge.style.color = '#1d4ed8'; badge.style.borderColor = '#93c5fd'; }
            if (dot) dot.style.background = '#3b82f6';
        } else if (mode === 'synced') {
            badgeText.textContent = customText || \`☁️ クラウド自動保存済 (\${nowStr}) [別PC同期OK]\`;
            if (badge) { badge.style.background = '#ecfdf5'; badge.style.color = '#047857'; badge.style.borderColor = '#a7f3d0'; }
            if (dot) dot.style.background = '#10b981';
        } else {
            badgeText.textContent = customText || \`💾 自動保存済 (\${nowStr})\`;
            if (badge) { badge.style.background = '#ecfdf5'; badge.style.color = '#047857'; badge.style.borderColor = '#a7f3d0'; }
            if (dot) dot.style.background = '#10b981';
        }
    }

    function updateSaveStatusUI(savedDate) {
        const timeStr = (savedDate || new Date()).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        if (isCloudInitialSyncDone && !isRestoringFromCloud) {
            scheduleCloudSync();
        } else {
            setCloudStatusBadge('local', \`💾 自動保存済 (\${timeStr})\`);
        }
    }

    function scheduleCloudSync() {
        if (!isCloudInitialSyncDone || isRestoringFromCloud) return;
        setCloudStatusBadge('syncing', '☁️ クラウドへ自動保存中...');
        if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
        cloudSyncTimer = setTimeout(() => {
            pushStateToCloud(false);
        }, 500);
    }

    async function pushStateToCloud(includeAllLocalTerms = false) {
        if (isRestoringFromCloud) return;
        if (isCloudSyncInFlight) {
            pendingCloudResave = true;
            return;
        }
        isCloudSyncInFlight = true;
        try {
            const deptId = (appConfig && appConfig.deptId) ? appConfig.deptId : 'master';
            const masterRaw = localStorage.getItem(STORAGE_KEY_STAFF_MASTER);
            const staffMaster = masterRaw ? JSON.parse(masterRaw) : null;
            const curDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
            const curTermRaw = localStorage.getItem(\`\${STORAGE_KEY_PREFIX}\${curDate}\`);
            const curTermData = curTermRaw ? JSON.parse(curTermRaw) : null;
            const savedTerms = getSavedTerms();

            let fullTermsMap = null;
            if (includeAllLocalTerms) {
                fullTermsMap = {};
                savedTerms.forEach(tDate => {
                    const tRaw = localStorage.getItem(\`\${STORAGE_KEY_PREFIX}\${tDate}\`);
                    if (tRaw) {
                        try { fullTermsMap[tDate] = JSON.parse(tRaw); } catch (e) {}
                    }
                });
            }

            const resp = await fetch('/api/cloud_sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deptId,
                    staffMaster,
                    lastActiveDate: curDate,
                    savedTerms,
                    termDate: curDate,
                    termData: curTermData,
                    fullTermsMap
                })
            });

            if (resp.ok) {
                const resJson = await resp.json();
                if (resJson && resJson.ok) {
                    lastCloudUpdatedAt = resJson.updatedAt;
                    setCloudStatusBadge('synced');
                } else {
                    setCloudStatusBadge('local');
                }
            } else {
                setCloudStatusBadge('local');
            }
        } catch (err) {
            // ローカルファイル(file://)等で開いている場合はブラウザ保存表示にフォールバック
            setCloudStatusBadge('local');
        } finally {
            isCloudSyncInFlight = false;
            if (pendingCloudResave) {
                pendingCloudResave = false;
                scheduleCloudSync();
            }
        }
    }

    async function pullStateFromCloud(isInitialBoot = false, showToastMsg = false) {
        try {
            const deptId = (appConfig && appConfig.deptId) ? appConfig.deptId : 'master';
            setCloudStatusBadge('syncing', '☁️ クラウド同期中...');
            const resp = await fetch(\`/api/cloud_sync?deptId=\${encodeURIComponent(deptId)}&t=\${Date.now()}\`, {
                method: 'GET',
                cache: 'no-store'
            });

            if (!resp.ok) {
                isCloudInitialSyncDone = true;
                setCloudStatusBadge('local');
                return false;
            }

            const resJson = await resp.json();
            if (!resJson || !resJson.ok) {
                isCloudInitialSyncDone = true;
                setCloudStatusBadge('local');
                return false;
            }

            // クラウド上にまだデータが存在しない場合：現在のPCのデータをクラウドへ初期アップロード！
            if (!resJson.exists || !resJson.cloudState) {
                isCloudInitialSyncDone = true;
                await pushStateToCloud(true);
                return true;
            }

            const cloud = resJson.cloudState;
            lastCloudUpdatedAt = cloud.updatedAt || null;

            isRestoringFromCloud = true;
            try {
                // 1. スタッフマスター（全トグル・役職・所属・氏名・備考）のクラウド復元
                if (Array.isArray(cloud.staffMaster) && cloud.staffMaster.length > 0) {
                    localStorage.setItem(STORAGE_KEY_STAFF_MASTER, JSON.stringify(cloud.staffMaster));
                    applyMasterArrayToStaffList(cloud.staffMaster);
                }

                // 2. 全保存タームデータのクラウド復元
                if (cloud.terms && typeof cloud.terms === 'object') {
                    Object.keys(cloud.terms).forEach(tDate => {
                        if (cloud.terms[tDate]) {
                            localStorage.setItem(\`\${STORAGE_KEY_PREFIX}\${tDate}\`, JSON.stringify(cloud.terms[tDate]));
                        }
                    });
                }

                // 3. 保存済みターム一覧の同期
                if (Array.isArray(cloud.savedTerms)) {
                    const localTerms = getSavedTerms();
                    const mergedTerms = Array.from(new Set([...localTerms, ...cloud.savedTerms])).sort();
                    localStorage.setItem(STORAGE_KEY_SAVED_TERMS, JSON.stringify(mergedTerms));
                }

                // 4. 表示中タームの再読込＆画面反映
                const targetTermDate = (isInitialBoot && cloud.lastActiveDate)
                    ? cloud.lastActiveDate
                    : (currentWorkingStartDate || cloud.lastActiveDate || '2026-04-01');

                const matchedTerm = findTermByStartDate(targetTermDate);
                const finalDate = matchedTerm ? matchedTerm.startDate : targetTermDate;

                currentWorkingStartDate = finalDate;
                localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, finalDate);
                const dateInput = document.getElementById('termStartDate');
                if (dateInput) dateInput.value = finalDate;
                const termSelect = document.getElementById('termSelect');
                if (termSelect) termSelect.value = finalDate;

                if (localStorage.getItem(\`\${STORAGE_KEY_PREFIX}\${finalDate}\`)) {
                    loadTermFromStorage(finalDate);
                } else {
                    loadStaffMaster();
                    renderInputTable();
                }
                renderSavedTermsSelect();
            } finally {
                isRestoringFromCloud = false;
                isCloudInitialSyncDone = true;
            }

            setCloudStatusBadge('synced');
            if (showToastMsg) {
                showToast('☁️ クラウドから最新の勤務表・トグル設定を同期しました！');
            }
            return true;
        } catch (err) {
            isRestoringFromCloud = false;
            isCloudInitialSyncDone = true;
            setCloudStatusBadge('local');
            return false;
        }
    }`;

if (oldUpdateStatusRegex.test(appCode)) {
    appCode = appCode.replace(oldUpdateStatusRegex, newCloudSyncFunctions);
    console.log('app.js: Replaced updateSaveStatusUI with full Cloud Sync Engine');
} else {
    throw new Error('Could not find oldUpdateStatusRegex in app.js');
}

// 2-2. 起動処理末尾で pullStateFromCloud(true, false) と手動同期ボタン・フォーカス自動同期を登録
const oldStartupEndRegex = /renderSavedTermsSelect\(\);\r?\n\}\);/;
const newStartupEndCode = `renderSavedTermsSelect();

    // ★ 起動時にクラウドから最新データ（トグル設定・勤務表）を自動同期！
    pullStateFromCloud(true, false);

    // ★ ヘッダーの「🔄 最新同期」ボタン
    const manualSyncBtn = document.getElementById('manualCloudSyncBtn');
    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', () => {
            pullStateFromCloud(false, true);
        });
    }

    // ★ 別PCで変更された後、このPCのブラウザ画面に戻ってきた際にも自動でクラウド同期
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isCloudInitialSyncDone && !isCloudSyncInFlight && !cloudSyncTimer) {
            pullStateFromCloud(false, false);
        }
    });
});`;

if (oldStartupEndRegex.test(appCode)) {
    appCode = appCode.replace(oldStartupEndRegex, newStartupEndCode);
    console.log('app.js: Added cloud sync boot and visibilitychange listeners');
} else {
    throw new Error('Could not find oldStartupEndRegex in app.js');
}

fs.writeFileSync(appPath, appCode, 'utf8');
console.log('SUCCESS: Cloud sync added to index.html and app.js!');
