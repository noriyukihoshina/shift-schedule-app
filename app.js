/**
 * 勤務表作成システム - アプリケーションロジック (app.js)
 * 最新版:
 * - 8時可フラグ: 1〜9番目のスタッフのみON（現場の実態に完全一致）
 * - 8時勤務の優先割当＆8時可能スタッフの早遅Eからの温存保護
 * - Excel出力: 事前希望枠を「赤字の太字（Bold）」で確実にエクスポート
 * - 作業完了通知音「ポン♪」機能（Web Audio API）
 * - 障壁セルの薄いブルー網掛け＆解消時の自動クリア
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // ★ 正規13ターム定義 ＆ セレクター制御
    // ==========================================
    function generateAllTerms() {
        const years = [2025, 2026, 2027];
        const allTerms = [];

        years.forEach(year => {
            let cur = new Date(year, 3, 1); // 4月1日
            for (let t = 1; t <= 12; t++) {
                const sDate = new Date(cur);
                const eDate = new Date(cur);
                eDate.setDate(cur.getDate() + 27);

                const sStr = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}`;
                const eStr = `${eDate.getFullYear()}-${String(eDate.getMonth() + 1).padStart(2, '0')}-${String(eDate.getDate()).padStart(2, '0')}`;

                allTerms.push({
                    year,
                    termNo: t,
                    startDate: sStr,
                    endDate: eStr,
                    numDays: 28,
                    isTerm13: false,
                    label: `【${year}年度 第${t}ターム】 ${sDate.getMonth() + 1}/${sDate.getDate()} 〜 ${eDate.getMonth() + 1}/${eDate.getDate()} (28日間)`
                });

                cur.setDate(cur.getDate() + 28);
            }

            // 第13ターム: 3月3日(平年) 〜 3月31日 (29日間・年度末)
            const t13Start = new Date(cur);
            const t13End = new Date(year + 1, 2, 31);
            const diffDays = Math.round((t13End - t13Start) / (1000 * 60 * 60 * 24)) + 1;

            const s13Str = `${t13Start.getFullYear()}-${String(t13Start.getMonth() + 1).padStart(2, '0')}-${String(t13Start.getDate()).padStart(2, '0')}`;
            const e13Str = `${t13End.getFullYear()}-${String(t13End.getMonth() + 1).padStart(2, '0')}-${String(t13End.getDate()).padStart(2, '0')}`;

            allTerms.push({
                year,
                termNo: 13,
                startDate: s13Str,
                endDate: e13Str,
                numDays: diffDays,
                isTerm13: true,
                label: `【${year}年度 第13ターム】 ${t13Start.getMonth() + 1}/${t13Start.getDate()} 〜 ${t13End.getMonth() + 1}/${t13End.getDate()} (${diffDays}日間・年度末調整)`
            });
        });

        return allTerms;
    }

    const GLOBAL_TERMS = generateAllTerms();

    function findTermByStartDate(startDate) {
        if (!startDate) return GLOBAL_TERMS.find(t => t.startDate === '2026-04-01') || GLOBAL_TERMS[0];
        const match = GLOBAL_TERMS.find(t => t.startDate === startDate);
        if (match) return match;

        // もし一致しない日付の場合、その日付が含まれるタームまたは最も近いタームを返す
        const targetTime = new Date(startDate + 'T00:00:00').getTime();
        if (!isNaN(targetTime)) {
            for (const t of GLOBAL_TERMS) {
                const sTime = new Date(t.startDate + 'T00:00:00').getTime();
                const eTime = new Date(t.endDate + 'T23:59:59').getTime();
                if (targetTime >= sTime && targetTime <= eTime) {
                    return t;
                }
            }
        }
        return GLOBAL_TERMS.find(t => t.startDate === '2026-04-01') || GLOBAL_TERMS[0];
    }

    // ★ コメント（備考欄）や氏名の文字化け・制御文字・Excel改行エスケープを除去するサニタイザ
    function cleanTextValue(val) {
        if (val === undefined || val === null) return '';
        return String(val)
            .replace(/_x000[dDaA]_/g, ' ')
            .replace(/\uFFFD/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/[\r\n]+/g, ' ')
            .trim();
    }

    function escapeHtmlText(val) {
        return cleanTextValue(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeXmlText(val) {
        return cleanTextValue(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // ★ 「係長」「主任」「副主任」の択一（排他）制御ヘルパー
    function enforceRoleExclusivity(staff, preferredFlag = null) {
        if (!staff) return;
        const roleFlags = ['isSectionChief', 'isChief', 'isSubChief'];
        if (preferredFlag && roleFlags.includes(preferredFlag) && staff[preferredFlag]) {
            roleFlags.forEach(rf => {
                if (rf !== preferredFlag) staff[rf] = false;
            });
            return;
        }
        // 優先指定がない場合は 係長 > 主任 > 副主任 の優先順で1つのみに絞る
        if (staff.isSectionChief) {
            staff.isChief = false;
            staff.isSubChief = false;
        } else if (staff.isChief) {
            staff.isSubChief = false;
        }
    }

    let termSelectorInitialized = false;
    function initTermSelector() {
        const select = document.getElementById('termSelect');
        if (!select) return;

        const curStart = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        select.innerHTML = '';
        GLOBAL_TERMS.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.startDate;
            opt.textContent = t.label;
            if (t.startDate === curStart) opt.selected = true;
            select.appendChild(opt);
        });

        if (termSelectorInitialized) return;
        termSelectorInitialized = true;

        select.addEventListener('change', () => {
            const newDate = select.value;
            if (!newDate || newDate === currentWorkingStartDate) return;

            // 直前の期間データとスタッフマスターを確実に保存
            saveStaffMaster();
            saveCurrentTermToStorage(currentWorkingStartDate);

            // 新しい期間に切り替え
            currentWorkingStartDate = newDate;
            const startDateInput = document.getElementById('termStartDate');
            if (startDateInput) startDateInput.value = newDate;

            const term = findTermByStartDate(newDate);
            const stdHolidaySelect = document.getElementById('standardHolidaySelect');

            if (localStorage.getItem(`${STORAGE_KEY_PREFIX}${newDate}`)) {
                loadTermFromStorage(newDate);
                if (term && term.isTerm13 && stdHolidaySelect && stdHolidaySelect.value === '8.0') {
                    stdHolidaySelect.value = '8.5';
                    saveCurrentTermToStorage(newDate);
                }
                showToast(`📁 期間「${term ? term.label : newDate}」の保存データを読み込みました`);
            } else {
                initNewTerm(newDate);
                if (term && term.isTerm13) {
                    showToast(`📅 ${term.year}年度 第13ターム（年度末 ${term.numDays}日間）を選択しました（公休枠: 8.5日）`);
                } else {
                    showToast(`🆕 新規期間「${term ? term.label : newDate}」の編集を開始しました`);
                }
            }
            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
            renderSavedTermsSelect();
        });
    }

    // ★ スタッフ属性マスターの保存（タームを切り替えても・リロードしてもトグルや設定を完全維持）
    function saveStaffMaster() {
        try {
            const masterList = staffList.map(s => {
                enforceRoleExclusivity(s);
                return {
                    id: s.id,
                    name: cleanTextValue(s.name),
                    isUnused: !!s.isUnused,
                    section: s.section || '',
                    can8: !!s.can8,
                    noEarly: !!s.noEarly,
                    noLate: !!s.noLate,
                    noEve: !!s.noEve,
                    canSched: !!s.canSched,
                    isSectionChief: !!s.isSectionChief,
                    isChief: !!s.isChief,
                    isSubChief: !!s.isSubChief,
                    isHalf: !!s.isHalf,
                    isFullTime: !!s.isFullTime,
                    allow6Consec: !!s.allow6Consec,
                    prevName: cleanTextValue(s.prevName || ''),
                    remarks: cleanTextValue(s.remarks || '')
                };
            });
            localStorage.setItem(STORAGE_KEY_STAFF_MASTER, JSON.stringify(masterList));
        } catch (e) {
            console.error('スタッフマスターの保存に失敗:', e);
        }
    }

    function applyMasterArrayToStaffList(masterList) {
        if (!Array.isArray(masterList)) return false;
        masterList.forEach((ms, idx) => {
            if (staffList[idx] && ms) {
                staffList[idx].name = cleanTextValue(ms.name) || staffList[idx].name;
                staffList[idx].isUnused = ms.isUnused !== undefined ? !!ms.isUnused : staffList[idx].isUnused;
                staffList[idx].section = ms.section || '';
                staffList[idx].can8 = ms.can8 !== undefined ? !!ms.can8 : staffList[idx].can8;
                staffList[idx].noEarly = !!ms.noEarly;
                staffList[idx].noLate = !!ms.noLate;
                staffList[idx].noEve = !!ms.noEve;
                staffList[idx].canSched = ms.canSched !== undefined ? !!ms.canSched : staffList[idx].canSched;
                staffList[idx].isSectionChief = !!ms.isSectionChief;
                staffList[idx].isChief = !!(ms.isChief || ms.chief);
                staffList[idx].isSubChief = !!ms.isSubChief;
                staffList[idx].isHalf = !!ms.isHalf;
                staffList[idx].isFullTime = ms.isFullTime !== undefined ? !!ms.isFullTime : staffList[idx].isFullTime;
                staffList[idx].allow6Consec = !!ms.allow6Consec;
                staffList[idx].prevName = cleanTextValue(ms.prevName || '');
                staffList[idx].remarks = cleanTextValue(ms.remarks || '');
                enforceRoleExclusivity(staffList[idx]);
            }
        });
        return true;
    }

    function loadStaffMaster() {
        try {
            let raw = localStorage.getItem(STORAGE_KEY_STAFF_MASTER);
            if (!raw) {
                // 旧キーからのフォールバック救済
                raw = localStorage.getItem('shift_schedule_staff_master');
            }
            if (!raw) return false;
            const masterList = JSON.parse(raw);
            return applyMasterArrayToStaffList(masterList);
        } catch (e) {
            console.error('スタッフマスターの読込に失敗:', e);
            return false;
        }
    }

    // ★ 部署別パスワード認証モーダル制御
    // ==========================================
    function checkDeptAuthentication() {
        if (!window.APP_CONFIG || !window.APP_CONFIG.password) return;
        const config = window.APP_CONFIG;

        // ヘッダータイトルの更新
        const titleEl = document.querySelector('.header-title h1');
        if (titleEl && config.deptName) {
            titleEl.textContent = `勤務予定表 自動作成システム 【${config.deptName}】`;
            document.title = `勤務予定表 自動作成システム - ${config.deptName}`;
        }

        const authKey = `auth_${config.deptId}`;
        if (sessionStorage.getItem(authKey) === 'true') {
            return; // 認証済み
        }

        // 認証モーダルを動的生成して画面全体を安全にロック
        const overlay = document.createElement('div');
        overlay.id = 'deptAuthOverlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
        `;

        overlay.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); text-align: center;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔒</div>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: #1e293b; margin-bottom: 0.25rem;">【${config.deptName}】認証</h3>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem;">パスワードを入力して勤務表を開いてください</p>
                <div style="margin-bottom: 1rem;">
                    <input type="password" id="deptAuthPasswordInput" placeholder="パスワードを入力" style="width: 100%; padding: 10px 14px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 1.1rem; text-align: center; letter-spacing: 4px; outline: none; box-sizing: border-box;">
                    <div id="deptAuthErrorMsg" style="color: #dc2626; font-size: 0.8rem; margin-top: 6px; display: none; font-weight: 600;">パスワードが正しくありません</div>
                </div>
                <button type="button" id="deptAuthSubmitBtn" style="width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background 0.2s;">
                    ロック解除
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = document.getElementById('deptAuthPasswordInput');
        const submitBtn = document.getElementById('deptAuthSubmitBtn');
        const errorMsg = document.getElementById('deptAuthErrorMsg');

        function tryAuth() {
            if (input.value === config.password) {
                sessionStorage.setItem(authKey, 'true');
                overlay.remove();
            } else {
                errorMsg.style.display = 'block';
                input.value = '';
                input.focus();
            }
        }

        submitBtn.addEventListener('click', tryAuth);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') tryAuth();
        });

        setTimeout(() => input.focus(), 100);
    }

    checkDeptAuthentication();
    const NUM_STAFF = 60;
    let NUM_DAYS = 28;
    const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

    let staffList = [];
    let currentSelectedSymbol = '休';
    let lastSolveResult = null;
    let lastScheduler = null;
    let currentWorkingStartDate = '2026-04-01';
    let autoAssignedRefKeys = new Set(); // "s,d" 自動配分されたリフセル（通常文字・編集自由扱い）
    let autoAssignedStaffIds = new Set(); // 自動配分対象となったスタッフID（誤消去検知用）

    // ★ 日別出勤増減枠のデフォルト生成（ユーザー要望: 土日祝日はデフォルトで -2、平日は 0）
    function createDefaultDayOffsets(dates) {
        const curDates = dates || (typeof getTermInfo === 'function' ? getTermInfo().dates : null);
        const arr = new Array(NUM_DAYS).fill(0);
        if (!curDates || !Array.isArray(curDates)) return arr;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dObj = curDates[d];
            if (dObj) {
                const isWeekendOrHol = dObj.isSun || dObj.isSat || 
                                       dObj.wIdx === 5 || dObj.wIdx === 6 || 
                                       dObj.weekday === '土' || dObj.weekday === '日' || 
                                       dObj.isHoliday || dObj.isHol;
                if (isWeekendOrHol) {
                    arr[d] = -2;
                }
            }
        }
        return arr;
    }

    let dayOffsets = new Array(NUM_DAYS).fill(0); // 日別出勤増減枠（初期化時に土日祝日-2を適用）

    // ★ Web Audio API による心地よい短い「ポン♪」通知音の再生
    function playNotificationSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            // 主音（ポン）
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            const now = ctx.currentTime;
            osc.frequency.setValueAtTime(880, now); // ラ(A5)
            osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.15); // レ(D5)へスッと抜ける

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {
            // 音声非対応環境では静かにスキップ
        }
    }

    // スタッフデータの初期化（60名枠、51〜60番目は初期状態で不使用）
    function initStaffData() {
        staffList = [];
        for (let i = 1; i <= NUM_STAFF; i++) {
            staffList.push({
                id: i,
                name: `スタッフ ${String(i).padStart(2, '0')}`,
                isUnused: (i > 48),  // 49〜60番目は初期状態で不使用（48名運用）
                section: '',         // 'PT A', 'PT B', 'OT A', 'OT B', または ''
                can8: (i <= 9),      // 1〜9番目のみ8時可能（現場の運用に完全一致）
                noEarly: false,     // 早番不可
                noLate: false,      // 遅番不可
                noEve: false,       // E不可
                canSched: (i <= 8), // ★ スケ可（毎日2名以上必要・○のみ）
                isSectionChief: (i === 1),  // ★ 係長（平日5連勤、不在時主任出勤）
                isChief: (i === 2 || i === 3),       // ★ 主任（係長不在時に1名以上出勤）
                isSubChief: (i === 4 || i === 5),    // ★ 副主任（係長主任不在時A1名B1名出勤）
                isHalf: false,                       // ★ 0.5（出勤実数を0.5人換算）
                isFullTime: (i <= 10),               // ★ 専従
                allow6Consec: false,                 // ★ 6連勤可
                prevName: '',                        // ★ 旧姓（改姓時の引き継ぎ用）
                remarks: '',                         // ★ 備考メモ（AG列）
                prevDays: ['', '', '', '', ''],
                days: new Array(NUM_DAYS).fill('')
            });
        }
    }

    // ==========================================
    // ★ 期間別ローカルストレージ自動保存＆復元管理
    // ==========================================
    // ★ 部署別設定 (APP_CONFIG) に対応したストレージキー動的生成
    const appConfig = window.APP_CONFIG || { deptId: 'master', deptName: 'マスター統括', password: '77777' };
    const deptPrefix = appConfig.deptId ? `${appConfig.deptId}_` : '';
    const STORAGE_KEY_PREFIX = `shift_schedule_${deptPrefix}term_`;
    const STORAGE_KEY_LAST_ACTIVE = `shift_schedule_${deptPrefix}last_active_start_date`;
    const STORAGE_KEY_SAVED_TERMS = `shift_schedule_${deptPrefix}saved_terms`;
    const STORAGE_KEY_STAFF_MASTER = `shift_schedule_${deptPrefix}staff_master`;

    // ==========================================
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
            badgeText.textContent = customText || `☁️ クラウド自動保存済 (${nowStr}) [別PC同期OK]`;
            if (badge) { badge.style.background = '#ecfdf5'; badge.style.color = '#047857'; badge.style.borderColor = '#a7f3d0'; }
            if (dot) dot.style.background = '#10b981';
        } else {
            badgeText.textContent = customText || `💾 自動保存済 (${nowStr})`;
            if (badge) { badge.style.background = '#ecfdf5'; badge.style.color = '#047857'; badge.style.borderColor = '#a7f3d0'; }
            if (dot) dot.style.background = '#10b981';
        }
    }

    function updateSaveStatusUI(savedDate) {
        const timeStr = (savedDate || new Date()).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        if (isCloudInitialSyncDone && !isRestoringFromCloud) {
            scheduleCloudSync();
        } else {
            setCloudStatusBadge('local', `💾 自動保存済 (${timeStr})`);
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
            const curTermRaw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${curDate}`);
            const curTermData = curTermRaw ? JSON.parse(curTermRaw) : null;
            const savedTerms = getSavedTerms();

            let fullTermsMap = null;
            if (includeAllLocalTerms) {
                fullTermsMap = {};
                savedTerms.forEach(tDate => {
                    const tRaw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tDate}`);
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
            const resp = await fetch(`/api/cloud_sync?deptId=${encodeURIComponent(deptId)}&t=${Date.now()}`, {
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
                            localStorage.setItem(`${STORAGE_KEY_PREFIX}${tDate}`, JSON.stringify(cloud.terms[tDate]));
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

                if (localStorage.getItem(`${STORAGE_KEY_PREFIX}${finalDate}`)) {
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
    }

    function getSavedTerms() {
        try {
            const termSet = new Set();
            // 1. 記録された一覧
            const raw = localStorage.getItem(STORAGE_KEY_SAVED_TERMS);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) arr.forEach(t => termSet.add(t));
            }
            // 2. localStorage全体の shift_schedule_term_ キーを自動スキャンして取りこぼしを完全防止
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(STORAGE_KEY_PREFIX)) {
                    const datePart = k.replace(STORAGE_KEY_PREFIX, '');
                    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                        termSet.add(datePart);
                    }
                }
            }
            // 3. 現在日付（未保存でもスロットとして追加）
            const curDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
            if (curDate && /^\d{4}-\d{2}-\d{2}$/.test(curDate)) {
                termSet.add(curDate);
            }

            const sorted = Array.from(termSet).sort();
            localStorage.setItem(STORAGE_KEY_SAVED_TERMS, JSON.stringify(sorted));
            return sorted;
        } catch (e) {
            return [];
        }
    }

    function updateSavedTermsList(startDate) {
        try {
            let terms = getSavedTerms();
            if (!terms.includes(startDate)) {
                terms.push(startDate);
                terms.sort();
                localStorage.setItem(STORAGE_KEY_SAVED_TERMS, JSON.stringify(terms));
            }
            renderSavedTermsSelect();
        } catch (e) {
            console.error(e);
        }
    }

    function renderSavedTermsSelect() {
        const select = document.getElementById('savedTermsSelect');
        if (!select) return;
        const terms = getSavedTerms();
        const curDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;

        let html = '<option value="" selected>(保存済み期間の呼出)</option>';
        terms.forEach(t => {
            const d = new Date(t + 'T00:00:00');
            const dEnd = new Date(d);
            dEnd.setDate(dEnd.getDate() + 27);
            const mStart = d.getMonth() + 1;
            const dayStart = d.getDate();
            const mEnd = dEnd.getMonth() + 1;
            const dayEnd = dEnd.getDate();
            const isCurrent = (t === curDate);
            const label = `${t} (${mStart}/${dayStart}～${mEnd}/${dayEnd})${isCurrent ? ' 【現在作業中】' : ''}`;
            html += `<option value="${t}">${label}</option>`;
        });
        select.innerHTML = html;
        select.value = ''; // 常に「(保存済み期間の呼出)」を選択状態にしておく（同じ期間でも何度でも再呼出可能に）
    }

    function clearOutputTables() {
        const thead = document.getElementById('outputTableHead');
        const tbody = document.getElementById('outputTableBody');
        const tfoot = document.getElementById('outputTableFoot');
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = `<tr><td colspan="38" style="text-align:center; padding: 40px; color: #94a3b8; font-size: 0.95rem;">💡 勤務表がまだ生成されていません。「希望入力」シートで希望を入力・確認し、【⚡ 勤務表を自動生成する】を実行してください。</td></tr>`;
        if (tfoot) tfoot.innerHTML = '';

        const checkThead = document.getElementById('checkTableHead');
        const checkTbody = document.getElementById('checkTableBody');
        const checkTfoot = document.getElementById('checkTableFoot');
        if (checkThead) checkThead.innerHTML = '';
        if (checkTbody) checkTbody.innerHTML = `<tr><td colspan="38" style="text-align:center; padding: 40px; color: #94a3b8; font-size: 0.95rem;">💡 勤務表がまだ完成していません。「修正作業エリア」で【✨ 特殊勤務を入れる】を実行するとここに完成版が表示されます。</td></tr>`;
        if (checkTfoot) checkTfoot.innerHTML = '';

        if (typeof resetStatsDashboard === 'function') {
            resetStatsDashboard();
        }
    }

    function saveCurrentTermToStorage(explicitDate) {
        try {
            const startDateInput = document.getElementById('termStartDate');
            const startDate = explicitDate || (startDateInput ? startDateInput.value : currentWorkingStartDate);
            if (!startDate) return;

            const stdHolidaySelect = document.getElementById('standardHolidaySelect');
            const stdHolidays = stdHolidaySelect ? parseFloat(stdHolidaySelect.value) : 8.0;

            const activeTabEl = document.querySelector('.tab-panel.active');
            const activeTab = activeTabEl ? activeTabEl.id : 'inputTab';

            const data = {
                startDate: startDate,
                standardHolidays: stdHolidays,
                staffList: staffList.map(s => ({
                    id: s.id,
                    name: s.name,
                    isUnused: !!s.isUnused,
                    section: s.section || '',
                    can8: s.can8,
                    noEarly: s.noEarly,
                    noLate: s.noLate,
                    noEve: s.noEve,
                    canSched: s.canSched,
                    isSectionChief: !!s.isSectionChief,
                    isChief: !!s.chief || !!s.isChief,
                    isSubChief: !!s.isSubChief,
                    isHalf: !!s.isHalf,
                    isFullTime: s.isFullTime,
                    prevName: s.prevName || '',
                    remarks: s.remarks || '',
                    allow6Consec: s.allow6Consec,
                    prevDays: [...s.prevDays],
                    days: [...s.days]
                })),
                outputGrid: (lastSolveResult && lastSolveResult.grid) 
                    ? lastSolveResult.grid.map(row => row.map(c => ({ ...c }))) 
                    : null,
                lastSolveStats: (lastSolveResult && lastSolveResult.stats) 
                    ? lastSolveResult.stats 
                    : null,
                activeTab: activeTab,
                dayOffsets: [...dayOffsets],
                updatedAt: new Date().toISOString()
            };

            localStorage.setItem(`${STORAGE_KEY_PREFIX}${startDate}`, JSON.stringify(data));
            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, startDate);

            updateSavedTermsList(startDate);
            saveStaffMaster();
            updateSaveStatusUI(new Date());
        } catch (err) {
            console.error('自動保存に失敗しました:', err);
        }
    }

    function loadTermFromStorage(startDate) {
        try {
            let raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${startDate}`);
            if (!raw) {
                // 旧ストレージキー（病棟プレフィックス導入前）からの自動引き継ぎ救済
                raw = localStorage.getItem(`shift_schedule_term_${startDate}`);
            }
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !data.staffList) return false;

            // 日付セット & 期間タイトル・NUM_DAYS更新を先に行う
            const targetStart = data.startDate || startDate;
            const dateInput = document.getElementById('termStartDate');
            if (dateInput) dateInput.value = targetStart;
            currentWorkingStartDate = targetStart;
            const term = getTermInfo();

            // 1. 公休日数（第13タームはデフォルト8.5、明示保存があればそれを優先）
            const stdSel = document.getElementById('standardHolidaySelect');
            if (stdSel) {
                const valNum = parseFloat(data.standardHolidays);
                if (valNum === 8.5) stdSel.value = '8.5';
                else if (valNum === 9.0) stdSel.value = '9.0';
                else if (term.isTerm13 && !data.standardHolidays) stdSel.value = '8.5';
                else stdSel.value = '8.0';
            }

            // 2. スタッフのターム固有データ（prevDays, days）および基本属性の復元
            data.staffList.forEach((s, idx) => {
                if (staffList[idx]) {
                    staffList[idx].name = cleanTextValue(s.name) || staffList[idx].name;
                    staffList[idx].isUnused = s.isUnused !== undefined ? !!s.isUnused : (idx >= 48);
                    staffList[idx].section = s.section || '';
                    staffList[idx].can8 = s.can8 !== undefined ? !!s.can8 : staffList[idx].can8;
                    staffList[idx].noEarly = !!s.noEarly;
                    staffList[idx].noLate = !!s.noLate;
                    staffList[idx].noEve = !!s.noEve;
                    staffList[idx].canSched = s.canSched !== undefined ? !!s.canSched : staffList[idx].canSched;
                    staffList[idx].isSectionChief = !!s.isSectionChief;
                    staffList[idx].isChief = !!(s.isChief || s.chief);
                    staffList[idx].isSubChief = !!s.isSubChief;
                    staffList[idx].isHalf = !!s.isHalf;
                    staffList[idx].isFullTime = s.isFullTime !== undefined ? !!s.isFullTime : staffList[idx].isFullTime;
                    staffList[idx].prevName = cleanTextValue(s.prevName || '');
                    staffList[idx].remarks = cleanTextValue(s.remarks || '');
                    staffList[idx].allow6Consec = !!s.allow6Consec;
                    enforceRoleExclusivity(staffList[idx]);

                    staffList[idx].prevDays = Array.isArray(s.prevDays) ? [...s.prevDays] : ['', '', '', '', ''];
                    const loadedDays = Array.isArray(s.days) ? [...s.days] : [];
                    while (loadedDays.length < NUM_DAYS) loadedDays.push('');
                    staffList[idx].days = loadedDays.slice(0, NUM_DAYS);
                }
            });

            // ★ スタッフマスターが存在する場合は、トグル・役職・所属・氏名等のマスター設定を最優先で同期！
            // （ただしターム固有の備考 remarks が入っている場合は残し、空ならマスターの remarks を使用）
            const remarksBackup = staffList.map(st => st.remarks);
            if (loadStaffMaster()) {
                staffList.forEach((st, idx) => {
                    if (remarksBackup[idx] && !st.remarks) {
                        st.remarks = remarksBackup[idx];
                    }
                });
            } else {
                // マスター未作成なら現在の状態でマスターを初期保存
                saveStaffMaster();
            }

            // 2.5 日別出勤増減枠（dayOffsets）の復元
            const defaultOffsets = createDefaultDayOffsets(term.dates);
            if (Array.isArray(data.dayOffsets) && data.dayOffsets.length >= 28) {
                const hasAnyNonZero = data.dayOffsets.some(v => v !== 0);
                if (!hasAnyNonZero) {
                    dayOffsets = [...defaultOffsets];
                } else {
                    dayOffsets = [...data.dayOffsets];
                    while (dayOffsets.length < NUM_DAYS) {
                        dayOffsets.push(defaultOffsets[dayOffsets.length] || 0);
                    }
                    dayOffsets = dayOffsets.slice(0, NUM_DAYS);
                }
            } else {
                dayOffsets = [...defaultOffsets];
            }

            // 4. 入力テーブル描画
            renderInputTable();

            // 5. 出力テーブル復元
            if (data.outputGrid && Array.isArray(data.outputGrid)) {
                const stdVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                const scheduler = new ShiftScheduler(staffList, {
                    standardHolidays: stdVal,
                    dates: term.dates,
                    dayOffsets: [...dayOffsets]
                });
                scheduler.grid = data.outputGrid.map(row => {
                    const rCopy = Array.isArray(row) ? row.map(c => ({ ...c })) : [];
                    while (rCopy.length < NUM_DAYS) rCopy.push({ symbol: '', isFixed: false });
                    return rCopy.slice(0, NUM_DAYS);
                });
                const newStats = scheduler.calculateStats();
                lastScheduler = scheduler;
                lastSolveResult = {
                    success: true,
                    grid: scheduler.grid,
                    stats: newStats
                };
                renderOutputTable(lastSolveResult.grid, newStats);
                renderStatsDashboard(newStats);
            } else {
                lastSolveResult = null;
                lastScheduler = null;
                clearOutputTables();
            }

            // 6. タブ復元
            if (data.activeTab && document.getElementById(data.activeTab)) {
                switchTab(data.activeTab);
            }

            undoStack.length = 0;
            redoStack.length = 0;
            updateUndoRedoUI();
            clearConflictHighlights();

            updateSaveStatusUI(new Date(data.updatedAt || Date.now()));
            renderSavedTermsSelect();
            return true;
        } catch (err) {
            console.error('復元に失敗しました:', err);
            return false;
        }
    }

    // 直前ターム（終了日が新ターム開始日の前日、または直近の過去ターム）を検索
    function findPreviousTerm(startDateStr) {
        try {
            const terms = getSavedTerms();
            if (!terms || terms.length === 0) return null;

            const curD = new Date(startDateStr + 'T00:00:00');
            const prevEndD = new Date(curD);
            prevEndD.setDate(prevEndD.getDate() - 1);
            const prevEndYMD = `${prevEndD.getFullYear()}-${String(prevEndD.getMonth() + 1).padStart(2, '0')}-${String(prevEndD.getDate()).padStart(2, '0')}`;

            // 1. 終了日（開始日+27日）が新タームの前日と完全に一致するタームを探す
            for (const t of terms) {
                if (t === startDateStr) continue;
                const tD = new Date(t + 'T00:00:00');
                tD.setDate(tD.getDate() + (NUM_DAYS - 1));
                const tEndYMD = `${tD.getFullYear()}-${String(tD.getMonth() + 1).padStart(2, '0')}-${String(tD.getDate()).padStart(2, '0')}`;
                if (tEndYMD === prevEndYMD) {
                    return t;
                }
            }

            // 2. フォールバック: startDateStr より過去で最新の保存ターム
            const pastTerms = terms.filter(t => t < startDateStr).sort().reverse();
            if (pastTerms.length > 0) {
                return pastTerms[0];
            }

            return null;
        } catch (e) {
            console.error('直前タームの検索エラー:', e);
            return null;
        }
    }

    // 指定した直前タームから最終5日間の実績を staffList の prevDays に反映する
    function applyPreviousTermHistory(prevStartDateStr, showToastMsg = true) {
        try {
            const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${prevStartDateStr}`);
            if (!raw) return false;
            const prevData = JSON.parse(raw);
            if (!prevData) return false;

            let appliedCount = 0;

            // 前タームのスタッフを氏名（正規化）でマップ化
            const prevStaffByName = new Map();
            if (Array.isArray(prevData.staffList)) {
                prevData.staffList.forEach((pst, pIdx) => {
                    const normName = (pst.name || '').trim();
                    if (!normName) return;
                    let last5 = ['', '', '', '', ''];
                    if (prevData.outputGrid && prevData.outputGrid[pIdx] && prevData.outputGrid[pIdx].length >= NUM_DAYS) {
                        const row = prevData.outputGrid[pIdx];
                        last5 = [
                            row[NUM_DAYS - 5]?.symbol || '',
                            row[NUM_DAYS - 4]?.symbol || '',
                            row[NUM_DAYS - 3]?.symbol || '',
                            row[NUM_DAYS - 2]?.symbol || '',
                            row[NUM_DAYS - 1]?.symbol || ''
                        ];
                    } else if (Array.isArray(pst.days)) {
                        last5 = [
                            pst.days[NUM_DAYS - 5] || '',
                            pst.days[NUM_DAYS - 4] || '',
                            pst.days[NUM_DAYS - 3] || '',
                            pst.days[NUM_DAYS - 2] || '',
                            pst.days[NUM_DAYS - 1] || ''
                        ];
                    }
                    prevStaffByName.set(normName, last5);
                });
            }

            for (let s = 0; s < NUM_STAFF; s++) {
                if (!staffList[s]) continue;
                const curName = (staffList[s].name || '').trim();
                const prevName = (staffList[s].prevName || '').trim();

                // 照合優先: 1. 現在の氏名、2. 改姓・旧姓（prevName）
                let last5 = prevStaffByName.get(curName) || (prevName ? prevStaffByName.get(prevName) : null);
                if (last5) {
                    staffList[s].prevDays = [...last5];
                    if (last5.some(v => v !== '')) appliedCount++;
                } else {
                    // 過去に該当名がない新規中途採用等のスタッフ
                    staffList[s].prevDays = ['', '', '', '', ''];
                }
            }

            renderInputTable();
            saveCurrentTermToStorage();

            if (showToastMsg) {
                const prevD = new Date(prevStartDateStr + 'T00:00:00');
                const prevEndD = new Date(prevD);
                prevEndD.setDate(prevEndD.getDate() + 27);
                const titleStr = `${prevD.getMonth() + 1}/${prevD.getDate()}～${prevEndD.getMonth() + 1}/${prevEndD.getDate()}`;
                showToast(`🔗 直前ターム（${titleStr}）の最終5日間実績を取り込みました（${appliedCount}名分反映）`);
            }
            return true;
        } catch (e) {
            console.error('前ターム実績の反映に失敗しました:', e);
            return false;
        }
    }

    function initNewTerm(newStartDate) {
        const dateInput = document.getElementById('termStartDate');
        if (dateInput) dateInput.value = newStartDate;
        currentWorkingStartDate = newStartDate;

        // 先に getTermInfo() を呼んで NUM_DAYS (28 or 29) を確定させる
        const term = getTermInfo();

        // スタッフ基本設定マスターを引き継ぎ復元！
        loadStaffMaster();
        staffList.forEach(s => {
            enforceRoleExclusivity(s);
            s.prevDays = ['', '', '', '', ''];
            s.days = new Array(NUM_DAYS).fill('');
        });
        autoAssignedRefKeys.clear();
        autoAssignedStaffIds.clear();
        lastSolveResult = null;
        lastScheduler = null;

        // ★ 公休枠制限: 第13ターム（29日間）なら 8.5日、通常ターム（28日間）なら 8.0日
        const stdHolidaySelect = document.getElementById('standardHolidaySelect');
        if (stdHolidaySelect) {
            stdHolidaySelect.value = term.isTerm13 ? '8.5' : '8.0';
        }

        dayOffsets = createDefaultDayOffsets(term.dates);

        // ★ 直前タームが存在すれば、その最終5日間の勤務実績を自動連携！
        const prevTerm = findPreviousTerm(newStartDate);
        if (prevTerm) {
            applyPreviousTermHistory(prevTerm, false);
        }

        renderInputTable();
        clearOutputTables();
        switchTab('inputTab');

        undoStack.length = 0;
        redoStack.length = 0;
        updateUndoRedoUI();
        clearConflictHighlights();

        saveStaffMaster();
        saveCurrentTermToStorage();

        if (prevTerm) {
            const pD = new Date(prevTerm + 'T00:00:00');
            const pTermDef = findTermByStartDate(prevTerm);
            const pDays = pTermDef ? pTermDef.numDays : 28;
            const pEndD = new Date(pD);
            pEndD.setDate(pEndD.getDate() + (pDays - 1));
            const pTitle = `${pD.getMonth() + 1}/${pD.getDate()}～${pEndD.getMonth() + 1}/${pEndD.getDate()}`;
            showToast(`🆕 新規期間（${term.title}）を開始しました（直前 ${pTitle} の最終5日実績を自動入力済）`);
        }
        renderSavedTermsSelect();
    }

    // ==========================================
    // ★ 戻る（Undo） / やり直す（Redo） 履歴管理
    // ==========================================
    const MAX_HISTORY = 50;
    const undoStack = [];
    const redoStack = [];

    function getHistorySnapshot() {
        return {
            staffList: staffList.map(s => ({
                id: s.id,
                name: s.name,
                isUnused: !!s.isUnused,
                section: s.section || '',
                can8: !!s.can8,
                noEarly: !!s.noEarly,
                noLate: !!s.noLate,
                noEve: !!s.noEve,
                canSched: !!s.canSched,
                isSectionChief: !!s.isSectionChief,
                isChief: !!s.isChief,
                isSubChief: !!s.isSubChief,
                isHalf: !!s.isHalf,
                isFullTime: !!s.isFullTime,
                allow6Consec: !!s.allow6Consec,
                prevName: s.prevName || '',
                remarks: s.remarks || '',
                prevDays: [...s.prevDays],
                days: [...s.days]
            })),
            startDate: document.getElementById('termStartDate')?.value || currentWorkingStartDate,
            outputGrid: (lastSolveResult && lastSolveResult.grid) ? lastSolveResult.grid.map(row => row.map(c => ({ ...c }))) : null
        };
    }

    function pushHistory() {
        undoStack.push(getHistorySnapshot());
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        redoStack.length = 0; // 新規操作時はredoをクリア
        updateUndoRedoUI();
        saveCurrentTermToStorage();
    }

    function undo() {
        if (undoStack.length === 0) return;
        redoStack.push(getHistorySnapshot());
        const prevState = undoStack.pop();
        restoreHistoryState(prevState);
        updateUndoRedoUI();
        saveStaffMaster();
        saveCurrentTermToStorage();
        showToast('↩ 直前の状態に戻しました');
    }

    function redo() {
        if (redoStack.length === 0) return;
        undoStack.push(getHistorySnapshot());
        const nextState = redoStack.pop();
        restoreHistoryState(nextState);
        updateUndoRedoUI();
        saveStaffMaster();
        saveCurrentTermToStorage();
        showToast('↪ やり直しました');
    }

    function restoreHistoryState(state) {
        if (!state) return;
        if (state.startDate) {
            const startDateInput = document.getElementById('termStartDate');
            if (startDateInput && startDateInput.value !== state.startDate) {
                startDateInput.value = state.startDate;
                currentWorkingStartDate = state.startDate;
                getTermInfo();
            }
        }
        if (state.staffList) {
            state.staffList.forEach((s, idx) => {
                if (staffList[idx]) {
                    staffList[idx].name = cleanTextValue(s.name) || staffList[idx].name;
                    staffList[idx].isUnused = s.isUnused !== undefined ? !!s.isUnused : (idx >= 48);
                    staffList[idx].section = s.section || '';
                    staffList[idx].can8 = !!s.can8;
                    staffList[idx].noEarly = !!s.noEarly;
                    staffList[idx].noLate = !!s.noLate;
                    staffList[idx].noEve = !!s.noEve;
                    staffList[idx].canSched = !!s.canSched;
                    staffList[idx].isSectionChief = !!s.isSectionChief;
                    staffList[idx].isChief = !!s.isChief;
                    staffList[idx].isSubChief = !!s.isSubChief;
                    staffList[idx].isHalf = !!s.isHalf;
                    staffList[idx].isFullTime = !!s.isFullTime;
                    staffList[idx].allow6Consec = !!s.allow6Consec;
                    staffList[idx].prevName = cleanTextValue(s.prevName || '');
                    staffList[idx].remarks = cleanTextValue(s.remarks || '');
                    enforceRoleExclusivity(staffList[idx]);
                    staffList[idx].prevDays = [...s.prevDays];
                    staffList[idx].days = [...s.days];
                }
            });
        }
        // 出力シートの復元
        if (state.outputGrid && lastSolveResult) {
            lastSolveResult.grid = state.outputGrid.map(row => row.map(c => ({ ...c })));
            if (lastScheduler) {
                lastScheduler.grid = lastSolveResult.grid;
                const newStats = lastScheduler.calculateStats();
                lastSolveResult.stats = newStats;
                renderOutputTable(lastSolveResult.grid, newStats);
                renderStatsDashboard(newStats);
            } else {
                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        }
        renderInputTable();

        const activeTab = document.querySelector('.tab-panel.active')?.id;
        if (activeTab === 'outputTab') {
            checkWorkAreaConstraints(false);
        } else if (activeTab === 'checkTab') {
            checkFinalConstraints(false);
        } else if (activeTab === 'inputTab') {
            checkInputConstraints(false);
        }
    }

    function updateUndoRedoUI() {
        const undoDisabled = (undoStack.length === 0);
        const redoDisabled = (redoStack.length === 0);
        const undoBtns = [
            document.getElementById('undoBtn'),
            document.getElementById('headerUndoBtn'),
            document.getElementById('outputUndoBtn'),
            document.getElementById('checkUndoBtn')
        ];
        const redoBtns = [
            document.getElementById('redoBtn'),
            document.getElementById('outputRedoBtn'),
            document.getElementById('checkRedoBtn')
        ];

        undoBtns.forEach(btn => {
            if (btn) {
                btn.disabled = undoDisabled;
                btn.style.opacity = undoDisabled ? '0.5' : '1';
                btn.style.cursor = undoDisabled ? 'not-allowed' : 'pointer';
            }
        });
        redoBtns.forEach(btn => {
            if (btn) {
                btn.disabled = redoDisabled;
                btn.style.opacity = redoDisabled ? '0.5' : '1';
                btn.style.cursor = redoDisabled ? 'not-allowed' : 'pointer';
            }
        });
    }

    // サンプルデータの生成（現場の運用に合わせて各属性を設定）
    function loadSampleData() {
        initTermSelector();
    initStaffData();

        const names = [
            "佐藤 健一", "鈴木 美咲", "高橋 浩", "田中 優子", "伊藤 直樹",
            "渡辺 恵子", "山本 大介", "中村 陽子", "小林 誠", "加藤 真理",
            "吉田 拓也", "山田 綾子", "佐々木 亮", "山口 香織", "松本 健",
            "井上 裕子", "木村 剛", "林 由美", "斎藤 翔太", "清水 さやか",
            "山崎 達也", "森 千春", "池田 健二", "橋本 麻美", "阿部 孝",
            "石川 智子", "山下 勇気", "中島 瞳", "石井 秀樹", "小川 美緒",
            "前田 慎太郎", "岡田 菜々", "長谷川 徹", "藤田 美紀", "後藤 雅人",
            "近藤 智子", "村上 康平", "遠藤 涼子", "青木 悠", "坂本 由加",
            "斉藤 貴之", "福田 裕美", "三浦 健司", "藤井 留美", "岡本 俊樹",
            "松田 裕子", "中川 雄太", "中野 亜紀", "原田 隆", "小野 奈央"
        ];

        names.forEach((name, idx) => {
            if (staffList[idx]) staffList[idx].name = name;
        });

        // 属性フラグ設定
        staffList.forEach((s, idx) => {
            s.can8 = (idx < 9);       // 8時可: 1〜9番目
            s.canSched = (idx < 8);   // スケ可: 8名
            s.isRole = (idx < 6);     // 役職: 6名
            s.isFullTime = (idx < 10); // 専従: 10名
            s.allow6Consec = (idx === 19 || idx === 20); // 20番・21番は6連勤可
            // セクション初期割り当て（PT A, PT B, OT A, OT B 各12名）
            if (idx < 12) s.section = 'PT A';
            else if (idx < 24) s.section = 'PT B';
            else if (idx < 36) s.section = 'OT A';
            else if (idx < 48) s.section = 'OT B';
            else s.section = '';
        });

        // 個別不可フラグ（現場の実態画像に合わせて設定）
        staffList[12].noEarly = true; // 13番 佐々木さん（早・遅・E不可）
        staffList[12].noLate = true;
        staffList[12].noEve = true;
        staffList[14].noEve = true;   // 15番 松本さん（E不可）
        staffList[15].noEve = true;   // 16番 井上さん（E不可）

        // 前ターム実績（画像の通り設定）
        staffList[0].prevDays = ['○', '○', '休', '○', '○'];
        staffList[1].prevDays = ['休', '休', '○', '○', '○'];
        staffList[2].prevDays = ['○', '休', '○', '○', '休'];
        staffList[3].prevDays = ['○', '○', '○', '○', '休'];
        staffList[4].prevDays = ['休', '○', '○', '○', '○'];
        staffList[5].prevDays = ['○', '○', '休', '○', '○'];
        staffList[6].prevDays = ['休', '休', '○', '○', '○'];
        staffList[7].prevDays = ['○', '休', '○', '○', '休'];
        staffList[8].prevDays = ['○', '○', '○', '○', '休'];

        for (let i = 9; i < NUM_STAFF; i++) {
            const patterns = [
                ['休', '○', '○', '○', '○'],
                ['○', '○', '休', '○', '○'],
                ['休', '休', '○', '○', '○'],
                ['○', '休', '○', '○', '休'],
                ['○', '○', '○', '○', '休']
            ];
            staffList[i].prevDays = [...patterns[i % patterns.length]];
        }

        // 当タームの事前固定枠（画像の通り反映）
        staffList[0].days[3] = '休'; // 佐藤さん 4日目休
        staffList[1].days[4] = '有'; staffList[1].days[8] = '休'; // 鈴木さん
        staffList[2].days[13] = '休'; // 高橋さん 14日目休
        staffList[3].days[19] = '休'; // 田中さん 20日目休
        staffList[5].days[0] = '休'; // 渡辺さん 1日目休、10〜14日目夏リフ
        staffList[5].days[9] = '上1'; staffList[5].days[10] = '上2'; staffList[5].days[11] = '上3'; staffList[5].days[12] = '上4'; staffList[5].days[13] = '上5';
        staffList[6].days[6] = '休'; // 山本さん 7日目休
        staffList[7].days[12] = '休'; // 中村さん 13日目休
        staffList[8].days[17] = '休'; // 小林さん 18日目休
        staffList[9].days[15] = '有'; // 加藤さん 16日目有
        staffList[10].days[13] = '出'; staffList[10].days[14] = '出'; // 吉田さん 14,15日目出張
        staffList[11].days[4] = '休'; // 山田さん 5日目休
        staffList[12].days[9] = '休'; // 佐々木さん 10日目休
        staffList[13].days[14] = '休'; // 山口さん 15日目休
        staffList[14].days[20] = '休'; // 松本さん 21日目休

        // その他のスタッフの希望休（28日間に均等分散）
        for (let i = 15; i < NUM_STAFF; i++) {
            const d1 = (i * 3 + 2) % 27;
            staffList[i].days[d1] = (i % 6 === 0) ? '有' : '休';
        }

        clearConflictHighlights();
        renderInputTable();
    }

    // 矛盾（解なし）検証用データ
    function loadConflictSampleData() {
        initStaffData();
        loadSampleData();

        // 10日目に希望休・有休を集中させ、出勤可能人数を不足させる
        for (let s = 0; s < 45; s++) {
            staffList[s].days[9] = (s % 4 === 0) ? '有' : '休';
        }

        renderInputTable();
        alert('【エラーハンドリング検証用データ】を投入しました。\n「10日目」に希望休が集中しています。\n「⚡ 勤務表を自動生成する」を押すと、障壁となっている10日目の休みセルが【薄いブルーで網掛け】されます。');
    }

    // ★ 日別出勤増減枠（プラス要因・マイナス要因）の操作
    function renderDayOffsetCtrl(d) {
        const rawVal = dayOffsets[d] || 0;
        const val = Math.round(rawVal * 10) / 10;
        const valText = val > 0 ? `+${val}` : (val < 0 ? `${val}` : '±0');
        const cls = val > 0 ? 'offset-pos' : (val < 0 ? 'offset-neg' : '');
        return `
            <div class="day-offset-ctrl" data-d="${d}" title="この日の出勤加減枠（0.5刻み、例: 行事で+0.5、減員で-0.5）" style="display:inline-flex; align-items:center; gap:2px;">
                <button type="button" class="day-offset-btn offset-minus" data-d="${d}" title="出勤人数を-0.5" style="width:16px; height:16px; font-size:10px; line-height:1; padding:0;">-</button>
                <span class="day-offset-val ${cls}" data-d="${d}" style="min-width:28px; font-size:0.75rem; font-weight:700; text-align:center;">${valText}</span>
                <button type="button" class="day-offset-btn offset-plus" data-d="${d}" title="出勤人数を+0.5" style="width:16px; height:16px; font-size:10px; line-height:1; padding:0;">+</button>
            </div>
        `;
    }

    function setDayOffset(d, delta) {
        if (d < 0 || d >= NUM_DAYS) return;
        pushHistory();
        const cur = dayOffsets[d] || 0;
        // 0.5刻みで加減算
        const nextVal = Math.round((cur + delta) * 10) / 10;
        dayOffsets[d] = Math.max(-10, Math.min(10, nextVal));

        updateDayOffsetDisplay();

        // 出力テーブル・ダッシュボードが表示されていればリアルタイム再計算
        if (lastSolveResult && lastScheduler) {
            lastScheduler.dayOffsets = [...dayOffsets];
            const newStats = lastScheduler.calculateStats();
            lastSolveResult.stats = newStats;
            renderOutputTable(lastSolveResult.grid, newStats);
            renderStatsDashboard(newStats);
        }

        const curDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
        saveCurrentTermToStorage(curDate);
    }

    function updateDayOffsetDisplay() {
        document.querySelectorAll('.day-offset-ctrl').forEach(ctrl => {
            const d = parseInt(ctrl.dataset.d, 10);
            if (isNaN(d) || d < 0 || d >= NUM_DAYS) return;
            const val = dayOffsets[d] || 0;
            const valSpan = ctrl.querySelector('.day-offset-val');
            if (valSpan) {
                valSpan.textContent = val > 0 ? `+${val}` : (val < 0 ? `${val}` : '±0');
                valSpan.className = `day-offset-val ${val > 0 ? 'offset-pos' : (val < 0 ? 'offset-neg' : '')}`;
            }
        });
    }

    // 入力テーブル描画
    function renderInputTable() {
        const thead = document.getElementById('inputTableHead');
        const tbody = document.getElementById('inputTableBody');
        if (!thead || !tbody) return;

        const term = getTermInfo();

        let headHtml = `
            <tr>
                <th class="sticky-col-1" rowspan="2" title="不使用時にONにする（勤務表・出力から除外）">不使用</th>
                <th class="sticky-col-2" rowspan="2">氏名</th>
                <th class="prev-col-header" colspan="5">前ターム最終5日間実績</th>
                <th colspan="${NUM_DAYS}">当ターム（${term.title}）希望休・事前固定枠（🔒手動以外は変更不可）</th>
                <th class="flag-col" rowspan="2" title="8時開始可能か（1〜9番のみON）">8時<br>可</th>
                <th class="flag-col" rowspan="2" title="早番不可">早<br>不可</th>
                <th class="flag-col" rowspan="2" title="遅番不可">遅<br>不可</th>
                <th class="flag-col" rowspan="2" title="イブニング不可">E<br>不可</th>
                <th class="flag-col" rowspan="2" title="PT A セクション（この中で出勤平均化）" style="background:#e0e7ff; color:#3730a3;">PT<br>A</th>
                <th class="flag-col" rowspan="2" title="PT B セクション（この中で出勤平均化）" style="background:#ede9fe; color:#5b21b6;">PT<br>B</th>
                <th class="flag-col" rowspan="2" title="OT A セクション（この中で出勤平均化）" style="background:#fae8ff; color:#86198f;">OT<br>A</th>
                <th class="flag-col" rowspan="2" title="OT B セクション（この中で出勤平均化）" style="background:#fce7f3; color:#9d174d;">OT<br>B</th>
                <th class="flag-col" rowspan="2" title="スケ可（毎日2名以上必要・○のみ）" style="background:#e0f2fe; color:#0369a1;">スケ<br>可</th>
                <th class="flag-col" rowspan="2" title="係長（基本平日5連勤、不在時主任1名以上出勤）" style="background:#fef3c7; color:#92400e;">係長</th>
                <th class="flag-col" rowspan="2" title="主任（係長不在時に1名以上出勤）" style="background:#fef9c3; color:#854d0e;">主任</th>
                <th class="flag-col" rowspan="2" title="副主任（係長主任不在時A1名B1名出勤）" style="background:#e0f2fe; color:#0369a1;">副主任</th>
                <th class="flag-col" rowspan="2" title="0.5（実数合計計算時に0.5人で計算）" style="background:#f3e8ff; color:#6b21a8; font-weight:800;">0.5</th>
                <th class="flag-col" rowspan="2" title="専従（毎日3名以上必要・出張除く）" style="background:#dcfce7; color:#166534;">専従</th>
                <th class="flag-col" rowspan="2" title="6連勤例外許可（週6勤務＆6連勤を許容）" style="background:#fee2e2; color:#991b1b;">6連勤<br>可</th>
                <th class="flag-col" rowspan="2" title="改姓・旧姓（前タームの氏名）" style="background:#f1f5f9; color:#475569; min-width:80px;">旧姓</th>
                <th class="remarks-col" rowspan="2" title="委員会等のメモ（ExcelのAG列と自動連携）" style="background:#f8fafc; color:#1e293b; min-width:220px; max-width:320px;">備考（メモ）</th>
            </tr>
            <tr>
                <th class="prev-col-header">前5</th>
                <th class="prev-col-header">前4</th>
                <th class="prev-col-header">前3</th>
                <th class="prev-col-header">前2</th>
                <th class="prev-col-header">前1</th>
        `;

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const cls = di.wIdx === 5 ? 'header-sat' : ((di.wIdx === 6 || di.isHoliday) ? 'header-sun' : '');
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            headHtml += `<th class="${cls} ${thickCls} header-day-col" title="${di.label} (${di.weekday})${di.isHoliday ? ' 祝日' : ''}">
                <div class="day-label">${di.label}</div>
                <div class="day-weekday"><small>${di.weekday}</small></div>
                ${renderDayOffsetCtrl(d)}
            </th>`;
        }
        headHtml += `</tr>`;
        thead.innerHTML = headHtml;

        let bodyHtml = '';
        staffList.forEach((staff, sIdx) => {
            const rowClass = staff.isUnused ? 'row-unused' : '';
            bodyHtml += `<tr class="${rowClass}">`;
            bodyHtml += `<td class="sticky-col-1 text-center" style="padding:2px;">
                <label class="toggle-switch" title="不使用（ONで勤務表・出力から除外）">
                    <input type="checkbox" ${staff.isUnused ? 'checked' : ''} data-unused="true" data-s="${sIdx}">
                    <span class="toggle-slider danger-slider"></span>
                </label>
            </td>`;
            bodyHtml += `<td class="sticky-col-2">
                <input type="text" class="staff-name-input" value="${escapeHtmlText(staff.name)}" data-s="${sIdx}" style="width:100%; border:none; background:transparent; font-weight:600; outline:none;">
            </td>`;

            // 前5日間
            for (let p = 0; p < 5; p++) {
                const val = staff.prevDays[p] || '';
                bodyHtml += `<td class="day-cell prev-col-cell" data-type="prev" data-s="${sIdx}" data-p="${p}">${val}</td>`;
            }

            // 当ターム 1日〜28日
            for (let d = 0; d < NUM_DAYS; d++) {
                const val = staff.days[d] || '';
                const cls = val ? 'day-cell fixed-cell' : 'day-cell';
                const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
                const lockTitle = val ? `事前固定枠: ${val}（自動上書きロック中）` : 'クリックで記号入力';
                bodyHtml += `<td class="${cls} ${thickCls}" data-type="day" data-s="${sIdx}" data-d="${d}" title="${lockTitle}">${val}</td>`;
            }

            // 28日の右側: 属性フラグトグルスイッチ群
            bodyHtml += `
                <td class="flag-col">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.can8 ? 'checked' : ''} data-flag="can8" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.noEarly ? 'checked' : ''} data-flag="noEarly" data-s="${sIdx}">
                        <span class="toggle-slider danger-slider"></span>
                    </label>
                </td>
                <td class="flag-col">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.noLate ? 'checked' : ''} data-flag="noLate" data-s="${sIdx}">
                        <span class="toggle-slider danger-slider"></span>
                    </label>
                </td>
                <td class="flag-col">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.noEve ? 'checked' : ''} data-flag="noEve" data-s="${sIdx}">
                        <span class="toggle-slider danger-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#eef2ff;">
                    <label class="toggle-switch" title="PT A セクション">
                        <input type="checkbox" ${staff.section === 'PT A' ? 'checked' : ''} data-section="PT A" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#f5f3ff;">
                    <label class="toggle-switch" title="PT B セクション">
                        <input type="checkbox" ${staff.section === 'PT B' ? 'checked' : ''} data-section="PT B" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#faf5ff;">
                    <label class="toggle-switch" title="OT A セクション">
                        <input type="checkbox" ${staff.section === 'OT A' ? 'checked' : ''} data-section="OT A" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#fdf2f8;">
                    <label class="toggle-switch" title="OT B セクション">
                        <input type="checkbox" ${staff.section === 'OT B' ? 'checked' : ''} data-section="OT B" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#f0f9ff;">
                    <label class="toggle-switch">
                        <input type="checkbox" ${staff.canSched ? 'checked' : ''} data-flag="canSched" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#fefce8;">
                    <label class="toggle-switch" title="係長">
                        <input type="checkbox" ${staff.isSectionChief ? 'checked' : ''} data-flag="isSectionChief" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#fef9c3;">
                    <label class="toggle-switch" title="主任">
                        <input type="checkbox" ${staff.isChief ? 'checked' : ''} data-flag="isChief" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#e0f2fe;">
                    <label class="toggle-switch" title="副主任">
                        <input type="checkbox" ${staff.isSubChief ? 'checked' : ''} data-flag="isSubChief" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#f3e8ff;">
                    <label class="toggle-switch" title="0.5（実数計算で0.5人換算）">
                        <input type="checkbox" ${staff.isHalf ? 'checked' : ''} data-flag="isHalf" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#f0fdf4;">
                    <label class="toggle-switch" title="専従">
                        <input type="checkbox" ${staff.isFullTime ? 'checked' : ''} data-flag="isFullTime" data-s="${sIdx}">
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#fef2e2;">
                    <label class="toggle-switch" title="6連勤可">
                        <input type="checkbox" ${staff.allow6Consec ? 'checked' : ''} data-flag="allow6Consec" data-s="${sIdx}">
                        <span class="toggle-slider danger-slider"></span>
                    </label>
                </td>
                <td class="flag-col" style="background:#f8fafc; padding:2px;">
                    <input type="text" class="staff-prevname-input" data-s="${sIdx}" value="${escapeHtmlText(staff.prevName || '')}" placeholder="旧姓" title="改姓前の前ターム氏名を入力すると過去履歴が引き継がれます" style="width:100%; border:1px solid #cbd5e1; border-radius:3px; padding:2px 4px; font-size:0.75rem; text-align:center;">
                </td>
                <td class="remarks-col" style="padding:2px 4px;">
                    <input type="text" class="staff-remarks-input" data-s="${sIdx}" value="${escapeHtmlText(staff.remarks || '')}" placeholder="委員会・用事等のメモ" style="width:100%; border:1px solid #cbd5e1; border-radius:3px; padding:2px 6px; font-size:0.78rem; background:white;">
                </td>
            `;

            bodyHtml += `</tr>`;
        });
        tbody.innerHTML = bodyHtml;

        attachInputTableEvents();
    }

    function attachInputTableEvents() {
        document.querySelectorAll('.staff-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const newName = cleanTextValue(e.target.value) || `スタッフ ${String(s + 1).padStart(2, '0')}`;
                if (staffList[s] && staffList[s].name !== newName) {
                    pushHistory();
                    staffList[s].name = newName;
                    e.target.value = newName;
                    saveStaffMaster();
                    saveCurrentTermToStorage();
                }
            });
        });

        document.querySelectorAll('.staff-prevname-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                if (staffList[s]) {
                    pushHistory();
                    staffList[s].prevName = cleanTextValue(e.target.value);
                    e.target.value = staffList[s].prevName;
                    saveStaffMaster();
                    saveCurrentTermToStorage();
                }
            });
        });

        document.querySelectorAll('.staff-remarks-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                if (staffList[s]) {
                    pushHistory();
                    staffList[s].remarks = cleanTextValue(e.target.value);
                    e.target.value = staffList[s].remarks;
                    saveStaffMaster();
                    saveCurrentTermToStorage();
                    if (lastSolveResult && lastSolveResult.grid) {
                        renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
                    }
                }
            });
        });

        // 不使用トグルのイベント（変更後に必ずマスター＆ターム保存！）
        document.querySelectorAll('input[type="checkbox"][data-unused]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                pushHistory();
                staffList[s].isUnused = e.target.checked;
                const tr = e.target.closest('tr');
                if (tr) {
                    if (e.target.checked) tr.classList.add('row-unused');
                    else tr.classList.remove('row-unused');
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        // セクション排他トグルのイベント（変更後に必ずマスター＆ターム保存！）
        document.querySelectorAll('input[type="checkbox"][data-section]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const sec = e.target.dataset.section;
                pushHistory();
                if (e.target.checked) {
                    staffList[s].section = sec;
                    document.querySelectorAll(`input[type="checkbox"][data-section][data-s="${s}"]`).forEach(other => {
                        if (other !== e.target) other.checked = false;
                    });
                } else {
                    if (staffList[s].section === sec) {
                        staffList[s].section = '';
                    }
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        // 各属性フラグトグルのイベント（「係長」「主任」「副主任」は択一排他制御＋変更後に必ず保存！）
        const exclusiveRoleFlags = ['isSectionChief', 'isChief', 'isSubChief'];
        document.querySelectorAll('input[type="checkbox"][data-flag]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const flag = e.target.dataset.flag;
                pushHistory();
                staffList[s][flag] = e.target.checked;

                // ★「係長」「主任」「副主任」は択一（1人が複数役職を同時に持たない）
                if (e.target.checked && exclusiveRoleFlags.includes(flag)) {
                    exclusiveRoleFlags.forEach(otherFlag => {
                        if (otherFlag !== flag) {
                            staffList[s][otherFlag] = false;
                            const otherChk = document.querySelector(`input[type="checkbox"][data-flag="${otherFlag}"][data-s="${s}"]`);
                            if (otherChk) otherChk.checked = false;
                        }
                    });
                }

                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const s = parseInt(cell.dataset.s, 10);
                const type = cell.dataset.type;

                let newSym = currentSelectedSymbol;
                if (currentSelectedSymbol === 'CLEAR') {
                    newSym = '';
                }

                // ★ P（プロテクト）ボタン選択時の処理
                if (currentSelectedSymbol === 'P') {
                    if (type === 'day') {
                        const d = parseInt(cell.dataset.d, 10);
                        const oldSym = staffList[s].days[d];
                        pushHistory();
                        if (oldSym) {
                            staffList[s].days[d] = '';
                            cell.textContent = '';
                            cell.classList.remove('fixed-cell');
                            showToast(`🔓 No.${staffList[s].id} の固定枠を解除しました`);
                        } else {
                            staffList[s].days[d] = '○';
                            cell.textContent = '○';
                            cell.classList.add('fixed-cell');
                            showToast(`🛡️ No.${staffList[s].id} を事前固定「○」（赤字保護）に設定しました`);
                        }
                    }
                    return;
                }

                if (type === 'prev') {
                    const p = parseInt(cell.dataset.p, 10);
                    if (staffList[s].prevDays[p] !== newSym) {
                        pushHistory();
                        staffList[s].prevDays[p] = newSym;
                        cell.textContent = newSym;
                    }
                } else if (type === 'day') {
                    const d = parseInt(cell.dataset.d, 10);
                    const oldSym = staffList[s].days[d];
                    if (oldSym !== newSym) {
                        const applyEdit = () => {
                            pushHistory();
                            staffList[s].days[d] = newSym;
                            cell.textContent = newSym;

                            if (newSym) {
                                cell.classList.add('fixed-cell');
                                cell.title = `事前固定枠: ${newSym}（自動上書きロック中）`;
                            } else {
                                cell.classList.remove('fixed-cell');
                                cell.title = 'クリックで記号入力';
                            }

                            const hasHighlights = document.querySelectorAll('#inputTableBody .conflict-highlight').length > 0;
                            const hasBanner = document.getElementById('conflictAlertBanner')?.classList.contains('show');
                            if (hasHighlights || hasBanner) {
                                checkInputConstraints(false);
                            }
                        };

                        if (oldSym && oldSym !== '') {
                            const term = getTermInfo();
                            const dateInfo = term.dates[d];
                            const staff = staffList[s];
                            showConfirmEditFixedModal({
                                staffId: staff.id,
                                staffName: staff.name,
                                dateLabel: `${dateInfo.label} (${dateInfo.weekday})`,
                                oldSym: oldSym,
                                newSym: newSym || '（消去）'
                            }, applyEdit);
                        } else {
                            applyEdit();
                        }
                    }
                }
            });
        });
    }

    // ==========================================
    // 入力シート用 障壁・制約違反ハイライト制御
    // ==========================================
    function applyConflictHighlights(conflictCells, errors = []) {
        clearConflictHighlights();

        if (!conflictCells || conflictCells.length === 0) return;

        conflictCells.forEach(item => {
            const cell = document.querySelector(`td[data-type="day"][data-s="${item.staffIndex}"][data-d="${item.dayIndex}"]`);
            if (cell) {
                cell.classList.add('conflict-highlight');
                cell.setAttribute('data-conflict-reason', item.reason || '障壁箇所');
                cell.title = `⚠️ 【障壁箇所】${item.reason || '制約の衝突原因となっています'}`;
            }
        });

        const banner = document.getElementById('conflictAlertBanner');
        if (banner) {
            banner.classList.add('show');
            const errList = errors && errors.length > 0
                ? `<ul style="font-size:0.8rem; color:#1e293b; margin:4px 0 0 0; padding-left:18px; max-height:100px; overflow-y:auto;">
                    ${errors.slice(0, 8).map(e => `<li>${e}</li>`).join('')}
                    ${errors.length > 8 ? `<li style="color:#64748b; font-style:italic;">...他 ${errors.length - 8} 件</li>` : ''}
                   </ul>`
                : '';
            banner.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                    <div style="display:flex; align-items:flex-start; gap:10px;">
                        <span style="font-size:1.4rem;">ℹ️</span>
                        <div>
                            <strong style="color:#1e3a8a;">障壁・制約違反箇所（薄いブルーの網掛けセル: ${conflictCells.length}箇所）を特定しました</strong>
                            <div style="font-size:0.82rem; color:#2563eb; margin-top:2px;">
                                該当セルをクリックして修正してください。条件が解決すると網掛けは自動的に消えます。（最終判断としてこのまま生成・終了することも可能です）
                            </div>
                            ${errList}
                        </div>
                    </div>
                    <button class="btn btn-outline" style="font-size:0.75rem; padding:4px 10px; margin-left:12px; white-space:nowrap;" onclick="document.getElementById('conflictAlertBanner').classList.remove('show');">閉じる</button>
                </div>
            `;
        }

        switchTab('inputTab');
        const firstCell = document.querySelector('.conflict-highlight');
        if (firstCell) {
            firstCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    function clearConflictHighlights() {
        document.querySelectorAll('#inputTableBody .conflict-highlight').forEach(cell => {
            cell.classList.remove('conflict-highlight');
            cell.removeAttribute('data-conflict-reason');
            const val = cell.textContent.trim();
            cell.title = val ? `事前固定枠: ${val}（自動上書きロック中）` : 'クリックで記号入力';
        });
        const banner = document.getElementById('conflictAlertBanner');
        if (banner) {
            banner.classList.remove('show');
            banner.innerHTML = '';
        }
    }

    function checkInputConstraints(showToastOnSuccess = false) {
        const term = getTermInfo();
        const res = validateInitialState(staffList, {
            dates: term.dates,
            standardHolidays: 8.0
        });

        if (res.errors && res.errors.length > 0) {
            applyConflictHighlights(res.conflictCells, res.errors);
            if (showToastOnSuccess) {
                showToast(`⚠️ 希望枠に${res.errors.length}件の制約矛盾があります。該当セルをブルー網掛けで表示しました。`);
            }
        } else {
            clearConflictHighlights();
            if (showToastOnSuccess) {
                showToast('🎉 事前希望枠に制約矛盾はありません。');
            }
        }
        return res;
    }

    // ==========================================
    // 出力シート用 確定勤務表エラー＆網掛け制御
    // ==========================================
    let currentOutputConflicts = [];

    function clearOutputConflictHighlights() {
        document.querySelectorAll(
            '#outputTableBody .conflict-highlight, #checkTableBody .conflict-highlight, ' +
            '#outputTableFoot .conflict-highlight, #checkTableFoot .conflict-highlight'
        ).forEach(cell => {
            cell.classList.remove('conflict-highlight');
            cell.removeAttribute('data-conflict-reason');
            if (cell.dataset.stat || cell.dataset.footerStat) {
                cell.removeAttribute('title');
            }
        });
        ['outputConflictAlertBanner', 'checkConflictAlertBanner'].forEach(id => {
            const banner = document.getElementById(id);
            if (banner) {
                banner.classList.remove('show');
                banner.innerHTML = '';
            }
        });
        currentOutputConflicts = [];
    }

    function applyOutputConflictHighlights(conflictCells, errors = []) {
        // 既存の網掛けを解除
        clearOutputConflictHighlights();

        currentOutputConflicts = conflictCells || [];

        if (currentOutputConflicts.length > 0) {
            currentOutputConflicts.forEach(item => {
                if (item.footerStat) {
                    // ★ フッター特殊勤務集計セル（早番・遅番・E・8時など）のブルー網掛け
                    const footCells = document.querySelectorAll(
                        `#outputTableFoot td[data-d="${item.dayIndex}"][data-footer-stat="${item.footerStat}"], ` +
                        `#checkTableFoot td[data-d="${item.dayIndex}"][data-footer-stat="${item.footerStat}"]`
                    );
                    footCells.forEach(cell => {
                        cell.classList.add('conflict-highlight');
                        cell.setAttribute('data-conflict-reason', item.reason || '特殊勤務人数不整合');
                        cell.title = `⚠️ 【人数不整合】${item.reason || '必要人数と一致していません'}`;
                    });
                } else if (item.statType) {
                    // ★ スタッフ行右側の集計列セル（例: 公休日数カウントエラー）のブルー網掛け
                    const statCells = document.querySelectorAll(
                        `#outputTableBody td[data-s="${item.staffIndex}"][data-stat="${item.statType}"], ` +
                        `#checkTableBody td[data-s="${item.staffIndex}"][data-stat="${item.statType}"]`
                    );
                    statCells.forEach(cell => {
                        cell.classList.add('conflict-highlight');
                        cell.setAttribute('data-conflict-reason', item.reason || '集計不整合');
                        cell.title = `⚠️ 【集計不整合】${item.reason || '集計値が基準と一致していません'}`;
                    });
                } else if (item.dayIndex !== undefined && item.staffIndex !== undefined) {
                    // 日付セルのブルー網掛け
                    const cells = document.querySelectorAll(
                        `#outputTableBody td[data-s="${item.staffIndex}"][data-d="${item.dayIndex}"], ` +
                        `#checkTableBody td[data-s="${item.staffIndex}"][data-d="${item.dayIndex}"]`
                    );
                    cells.forEach(cell => {
                        cell.classList.add('conflict-highlight');
                        cell.setAttribute('data-conflict-reason', item.reason || '制約違反');
                        cell.title = `⚠️ 【制約違反】${item.reason || '制約が守られていません'}`;
                    });
                }
            });
        }

        ['outputConflictAlertBanner', 'checkConflictAlertBanner'].forEach(id => {
            const banner = document.getElementById(id);
            if (banner) {
                if (errors.length > 0) {
                    banner.classList.add('show');
                    const errorListHtml = errors.slice(0, 10).map(err => `<li style="margin-bottom:2px;">${err}</li>`).join('');
                    const moreMsg = errors.length > 10 ? `<li style="color:#64748b; font-style:italic;">...他 ${errors.length - 10} 件の指摘事項</li>` : '';
                    banner.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                            <div style="display:flex; align-items:flex-start; gap:10px;">
                                <span style="font-size:1.4rem;">⚠️</span>
                                <div>
                                    <strong style="color:#1e3a8a; font-size:0.95rem;">
                                        制約チェック結果: ${errors.length}件の指摘事項（薄いブルーの網掛けセル: ${currentOutputConflicts.length}箇所）
                                    </strong>
                                    <div style="font-size:0.82rem; color:#2563eb; margin: 3px 0 6px 0;">
                                        該当セルをクリックして勤務や休日を修正してください。条件が解決すると網掛けは自動的に消えます。（最終判断としてこのまま保存・印刷することも可能です）
                                    </div>
                                    <ul style="font-size:0.8rem; color:#1e293b; margin:0; padding-left:18px; max-height:130px; overflow-y:auto;">
                                        ${errorListHtml}
                                        ${moreMsg}
                                    </ul>
                                </div>
                            </div>
                            <button class="btn btn-outline" style="font-size:0.75rem; padding:4px 10px; margin-left:12px; white-space:nowrap;" onclick="document.getElementById('${id}').classList.remove('show');">閉じる</button>
                        </div>
                    `;
                } else {
                    banner.classList.remove('show');
                    banner.innerHTML = '';
                }
            }
        });
    }

    // ★ 自動配分されたリフの誤消去検知チェック（ユーザー要望: 自動配分リフを間違えて消した場合に検知）
    function checkMissingAutoAssignedRef(grid, staffList, res) {
        if (!autoAssignedStaffIds || autoAssignedStaffIds.size === 0) return;
        if (!grid || !Array.isArray(grid)) return;

        staffList.forEach((st, sIdx) => {
            if (st.isUnused) return;
            if (!autoAssignedStaffIds.has(st.id)) return;

            // 当該スタッフのリフ（上1〜5、下1〜3）日数をグリッドから走査
            let refCount = 0;
            for (let d = 0; d < NUM_DAYS; d++) {
                const cell = grid[sIdx] ? grid[sIdx][d] : null;
                const sym = (cell && cell.symbol) ? cell.symbol : cell;
                if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                    refCount++;
                }
            }

            if (refCount === 0) {
                const warnMsg = `【スタッフ No.${st.id} ${st.name}】リフレッシュ休暇が設定されていません（自動配分後に誤って消去された可能性があります）。`;
                res.errors.push(warnMsg);
                res.isValid = false;
                res.conflictCells.push({
                    staffIndex: sIdx,
                    statType: 'ref',
                    reason: 'リフレッシュ休暇が未設定（自動配分後の誤消去の可能性）'
                });
            }
        });
    }

    // ステージ2: 修正作業エリア用の制約チェック（※特殊勤務が入っていないことはエラーとしない）
    function checkWorkAreaConstraints(showModalOnError = true, showToastOnSuccess = false) {
        if (!lastSolveResult || !lastSolveResult.grid) {
            if (showToastOnSuccess) showToast('勤務表がまだ生成されていません');
            return null;
        }

        const term = getTermInfo();
        const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
        const res = validateScheduleGrid(lastSolveResult.grid, staffList, {
            dates: term.dates,
            standardHolidays: stdHolidayVal,
            isFinal: false // ★ 特殊勤務なしはエラー外
        });

        // 自動配分リフの誤消去チェック
        checkMissingAutoAssignedRef(lastSolveResult.grid, staffList, res);

        if (!res.isValid) {
            applyOutputConflictHighlights(res.conflictCells, res.errors);
            if (showModalOnError) {
                showErrorModal(res.errors, {
                    title: '修正作業エリア: 制約の指摘・エラー検知',
                    subtitle: `勤務表に${res.errors.length}件の制約指摘があります（該当セルは青い網掛けで表示中）。`,
                    desc: '※この段階では特殊勤務が入っていないことはエラーになりません。内容をご確認の上修正してください。'
                });
            } else if (showToastOnSuccess) {
                showToast(`⚠️ ${res.errors.length}件の制約指摘があります（青い網掛け表示中）`);
            }
        } else {
            clearOutputConflictHighlights();
            const banner = document.getElementById('outputConflictAlertBanner');
            if (banner) {
                banner.classList.add('show');
                banner.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.4rem;">🎉</span>
                            <div>
                                <strong style="color:#065f46; font-size:0.95rem;">基本制約（連勤・週休・属性人数等）が100%遵守されています！</strong>
                                <div style="font-size:0.82rem; color:#047857; margin-top:2px;">
                                    修正が完了しましたら「✨ 特殊勤務を入れる」ボタンで完成へお進みください。
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-outline" style="font-size:0.75rem; padding:4px 10px;" onclick="document.getElementById('outputConflictAlertBanner').classList.remove('show');">閉じる</button>
                    </div>
                `;
            }
            if (showToastOnSuccess) {
                showToast('🎉 基本制約が完璧に遵守されています！');
            }
        }
        return res;
    }

    // ステージ3: 最終チェック&完成用の制約チェック（※特殊勤務の配置過不足も厳格にチェック）
    function checkFinalConstraints(showModalOnError = true, showToastOnSuccess = false) {
        if (!lastSolveResult || !lastSolveResult.grid) {
            if (showToastOnSuccess) showToast('勤務表がまだ生成されていません');
            return null;
        }

        const term = getTermInfo();
        const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
        const res = validateScheduleGrid(lastSolveResult.grid, staffList, {
            dates: term.dates,
            standardHolidays: stdHolidayVal,
            isFinal: true // ★ 特殊勤務の過不足も含めてチェック
        });

        // 自動配分リフの誤消去チェック
        checkMissingAutoAssignedRef(lastSolveResult.grid, staffList, res);

        if (!res.isValid) {
            applyOutputConflictHighlights(res.conflictCells, res.errors);
            if (showModalOnError) {
                showErrorModal(res.errors, {
                    title: '最終チェック&完成: 制約の指摘・エラー検知',
                    subtitle: `完成勤務表に${res.errors.length}件の制約指摘があります（該当セルは青い網掛けで表示中）。`,
                    desc: '連勤制限や週休2日、日別の特殊勤務人数（早3/遅1/E2/8時1）をご確認の上、必要に応じて修正してください。'
                });
            } else if (showToastOnSuccess) {
                showToast(`⚠️ ${res.errors.length}件の制約指摘があります（青い網掛け表示中）`);
            }
        } else {
            clearOutputConflictHighlights();
            const banner = document.getElementById('checkConflictAlertBanner');
            if (banner) {
                banner.classList.add('show');
                banner.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.4rem;">🎉</span>
                            <div>
                                <strong style="color:#065f46; font-size:0.95rem;">すべての制約（連勤・週休・属性・特殊勤務配置）が100%遵守されています！</strong>
                                <div style="font-size:0.82rem; color:#047857; margin-top:2px;">
                                    すべてのハード制約・ソフト制約が完全クリアされた完璧な勤務表です。
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-outline" style="font-size:0.75rem; padding:4px 10px;" onclick="document.getElementById('checkConflictAlertBanner').classList.remove('show');">閉じる</button>
                    </div>
                `;
            }
            if (showToastOnSuccess) {
                showToast('🎉 すべての制約が完璧に遵守されています！');
            }
        }
        return res;
    }

    // 後方互換性エイリアス
    function checkOutputConstraints(showToastOnSuccess = false) {
        return checkFinalConstraints(false, showToastOnSuccess);
    }

    let currentOutputSelectedSymbol = '休';

    // 入力シート用パレット
    document.querySelectorAll('.palette-btn:not(.output-palette-btn):not(.check-palette-btn)').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.palette-btn:not(.output-palette-btn):not(.check-palette-btn)').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentSelectedSymbol = btn.dataset.sym;
        });
    });

    // 出力シート用パレット
    document.querySelectorAll('.output-palette-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.output-palette-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentOutputSelectedSymbol = btn.dataset.sym;
        });
    });

    // チェックシート用パレット
    document.querySelectorAll('.check-palette-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.check-palette-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentOutputSelectedSymbol = btn.dataset.sym;
        });
    });

    // ★ 日別出勤加減ボタン（+ / -）のグローバルイベントリスナー
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.day-offset-btn');
        if (!btn) return;
        const d = parseInt(btn.dataset.d, 10);
        if (isNaN(d)) return;
        if (btn.classList.contains('offset-plus')) {
            setDayOffset(d, 0.5);
        } else if (btn.classList.contains('offset-minus')) {
            setDayOffset(d, -0.5);
        }
    });

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(tabId) {
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === tabId);
        });
        saveCurrentTermToStorage(); // ★ アクティブタブ状態も自動保存
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // ==========================================
    // ★ 日本の祝日判定ロジック（国民の祝日・振替休日・国民の休日）
    // ==========================================
    function isJapaneseHoliday(year, month, day) {
        // month: 1〜12, day: 1〜31
        const fixedHolidays = {
            '1-1': '元日',
            '2-11': '建国記念の日',
            '2-23': '天皇誕生日',
            '4-29': '昭和の日',
            '5-3': '憲法記念日',
            '5-4': 'みどりの日',
            '5-5': 'こどもの日',
            '8-11': '山の日',
            '11-3': '文化の日',
            '11-23': '勤労感謝の日'
        };

        const calcVernalEquinox = (y) => Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
        const calcAutumnEquinox = (y) => Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));

        const vernalDay = calcVernalEquinox(year);
        const autumnDay = calcAutumnEquinox(year);

        const getNthMonday = (y, m, n) => {
            const firstDay = new Date(y, m - 1, 1).getDay(); // 0=日, 1=月
            const firstMonday = (1 - firstDay + 7) % 7 + 1;
            return firstMonday + (n - 1) * 7;
        };

        const adultDay = getNthMonday(year, 1, 2);      // 1月第2月曜: 成人の日
        const oceanDay = getNthMonday(year, 7, 3);      // 7月第3月曜: 海の日
        const eldersDay = getNthMonday(year, 9, 3);     // 9月第3月曜: 敬老の日
        const sportsDay = getNthMonday(year, 10, 2);    // 10月第2月曜: スポーツの日

        const isBaseHoliday = (y, m, d) => {
            const key = `${m}-${d}`;
            if (fixedHolidays[key]) return true;
            if (m === 3 && d === vernalDay) return true;
            if (m === 9 && d === autumnDay) return true;
            if (m === 1 && d === adultDay) return true;
            if (m === 7 && d === oceanDay) return true;
            if (m === 9 && d === eldersDay) return true;
            if (m === 10 && d === sportsDay) return true;
            return false;
        };

        if (isBaseHoliday(year, month, day)) return true;

        // 振替休日判定（日曜日に重なった祝日の翌日以降の最初の平日）
        const checkDate = new Date(year, month - 1, day);
        if (checkDate.getDay() !== 0) {
            let cur = new Date(checkDate);
            while (true) {
                cur.setDate(cur.getDate() - 1);
                const curY = cur.getFullYear();
                const curM = cur.getMonth() + 1;
                const curD = cur.getDate();
                if (isBaseHoliday(curY, curM, curD)) {
                    if (cur.getDay() === 0) {
                        return true; // 日曜日の祝日に対する振替休日
                    }
                } else {
                    break;
                }
            }
        }

        // 国民の休日判定（祝日と祝日に挟まれた平日）
        const prevDate = new Date(year, month - 1, day - 1);
        const nextDate = new Date(year, month - 1, day + 1);
        if (isBaseHoliday(prevDate.getFullYear(), prevDate.getMonth() + 1, prevDate.getDate()) &&
            isBaseHoliday(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate())) {
            return true;
        }

        return false;
    }

    // ★ ターム期間・タイトル情報の取得（※/※※～※/※※勤務表）
    function getTermInfo(explicitStartDate) {
        const input = document.getElementById('termStartDate');
        const startStr = explicitStartDate || (input && input.value ? input.value : (currentWorkingStartDate || '2026-04-01'));
        const termDef = findTermByStartDate(startStr);
        const activeNumDays = (termDef && termDef.numDays) ? termDef.numDays : 28;
        NUM_DAYS = activeNumDays;

        // staffList の days 配列長を NUM_DAYS に安全同期
        if (Array.isArray(staffList)) {
            staffList.forEach(s => {
                if (Array.isArray(s.days)) {
                    while (s.days.length < NUM_DAYS) s.days.push('');
                }
            });
        }

        const parts = startStr.split('-').map(Number);
        const startDate = new Date(parts[0], parts[1] - 1, parts[2]);

        const dates = [];
        for (let i = 0; i < NUM_DAYS; i++) {
            const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const wIdx = (d.getDay() + 6) % 7; // 月曜=0, 日曜=6
            const isHoliday = isJapaneseHoliday(y, m, day);
            dates.push({
                y,
                m,
                year: y,
                month: m,
                day,
                weekday: WEEKDAYS[wIdx],
                label: `${m}/${day}`,
                wIdx,
                isSun: (wIdx === 6),
                isSat: (wIdx === 5),
                isHoliday,
                isHol: isHoliday,
                dateObj: d
            });
        }
        const first = dates[0];
        const last = dates[dates.length - 1];
        const title = `${first.m}/${first.day}～${last.m}/${last.day}勤務表`;
        const badgeText = termDef
            ? `第${termDef.termNo}ターム (${first.m}/${first.day}～${last.m}/${last.day})`
            : title;

        // UI表示の更新
        const termSelect = document.getElementById('termSelect');
        if (termSelect && termDef && termSelect.value !== termDef.startDate) {
            termSelect.value = termDef.startDate;
        }
        const endDisplay = document.getElementById('termEndDateDisplay');
        if (endDisplay) {
            const lastY = last.dateObj.getFullYear();
            const lastM = String(last.m).padStart(2, '0');
            const lastD = String(last.day).padStart(2, '0');
            endDisplay.textContent = `${lastY}-${lastM}-${lastD}`;
        }
        const badge = document.getElementById('termTitleBadge');
        if (badge) badge.textContent = badgeText;
        const daysBadge = document.getElementById('termDaysBadge');
        if (daysBadge) daysBadge.textContent = `${NUM_DAYS}日間`;

        const outTitle = document.getElementById('outputTitleDisplay');
        if (outTitle) outTitle.textContent = `✏️ ${title}（修正作業エリア）`;
        const checkTitle = document.getElementById('checkTitleDisplay');
        if (checkTitle) checkTitle.textContent = `🔍 ${title}（最終チェック&完成）`;

        if (typeof updateRefreshBadge === 'function') {
            updateRefreshBadge(dates);
        }

        return {
            title,
            badgeText,
            dates,
            first,
            last,
            numDays: NUM_DAYS,
            isTerm13: !!(termDef && termDef.isTerm13)
        };
    }

    const termStartDateInput = document.getElementById('termStartDate');
    if (termStartDateInput) {
        termStartDateInput.addEventListener('change', () => {
            const newDate = termStartDateInput.value;
            if (!newDate || newDate === currentWorkingStartDate) return;

            // 1. 直前の期間データをその日付キーで安全に保存！
            saveCurrentTermToStorage(currentWorkingStartDate);

            // 2. 新しい期間の保存データが存在するかチェック
            const key = `${STORAGE_KEY_PREFIX}${newDate}`;
            if (localStorage.getItem(key)) {
                currentWorkingStartDate = newDate;
                loadTermFromStorage(newDate);
                showToast(`💾 保存済みデータ（${newDate}～）を復元しました`);
            } else {
                currentWorkingStartDate = newDate;
                initNewTerm(newDate);
                showToast(`🆕 新規期間（${newDate}～）を開始しました（ブラウザ自動保存中）`);
            }
            renderSavedTermsSelect();
        });
    }

    const savedTermsSelect = document.getElementById('savedTermsSelect');
    if (savedTermsSelect) {
        savedTermsSelect.addEventListener('change', () => {
            const selectedDate = savedTermsSelect.value;
            if (!selectedDate) return;

            // 別の期間に切り替える場合のみ、直前の期間データを自動保存
            if (selectedDate !== currentWorkingStartDate) {
                saveCurrentTermToStorage();
            }

            currentWorkingStartDate = selectedDate;
            const loaded = loadTermFromStorage(selectedDate);
            if (loaded) {
                showToast(`💾 保存済み期間（${selectedDate}～）を呼び出しました`);
            } else {
                initNewTerm(selectedDate);
                showToast(`🆕 期間（${selectedDate}～）を開きました`);
            }

            // 呼出後は選択肢を「(保存済み期間の呼出)」にリセット（次回も同じ期間を選択可能にする）
            renderSavedTermsSelect();
        });
    }

    const resetCurrentTermBtn = document.getElementById('resetCurrentTermBtn');
    if (resetCurrentTermBtn) {
        resetCurrentTermBtn.addEventListener('click', () => {
            const term = getTermInfo();
            if (confirm(`【${term.title}】の作業内容（希望入力・作成済み勤務表）を初期状態（白紙）に戻しますか？`)) {
                initNewTerm(currentWorkingStartDate);
                showToast(`🗑️ 【${term.title}】を白紙に戻しました`);
            }
        });
    }

    const standardHolidaySelect = document.getElementById('standardHolidaySelect');
    if (standardHolidaySelect) {
        standardHolidaySelect.addEventListener('change', () => {
            saveCurrentTermToStorage();
        });
    }

    // 前ターム実績を自動取込ボタン（直前の保存済み勤務表の最終5日間実績を反映）
    const syncPrevTermHistoryBtn = document.getElementById('syncPrevTermHistoryBtn');
    if (syncPrevTermHistoryBtn) {
        syncPrevTermHistoryBtn.addEventListener('click', () => {
            const curDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
            const prevTerm = findPreviousTerm(curDate);
            if (!prevTerm) {
                alert('直前の保存済み勤務表データが見つかりませんでした。\n先に前ターム（例: 4/1～4/28）を作成・保存してください。');
                return;
            }
            const pD = new Date(prevTerm + 'T00:00:00');
            const pEndD = new Date(pD);
            pEndD.setDate(pEndD.getDate() + 27);
            const pTitle = `${pD.getMonth() + 1}/${pD.getDate()}～${pEndD.getMonth() + 1}/${pEndD.getDate()}`;

            if (confirm(`直前の勤務表【${pTitle}】の最終5日間の勤務実績を、この期間の「前ターム最終5日間実績」に取り込みますか？\n（※現在入力されている前実績は上書きされます）`)) {
                pushHistory();
                applyPreviousTermHistory(prevTerm, true);
            }
        });
    }

    // ==========================================
    // ★ リフレッシュ休暇（リフ）自動配分・管理システム
    // ==========================================
    function updateRefreshBadge(dates) {
        const badge = document.getElementById('refreshTermBadge');
        if (!badge) return;
        const curDates = dates || getTermInfo().dates;
        const groups = (typeof getTermRefreshGroups === 'function') ? getTermRefreshGroups(curDates) : [];
        if (groups && groups.length > 0) {
            const grpTexts = groups.map(g => `${g.month}月分(${g.symbol}: ${g.dayIndices.length}日間)`).join(' + ');
            badge.innerHTML = `🌴 リフ対象: ${grpTexts}`;
            badge.style.display = 'inline-block';
            badge.title = `この期間にはリフレッシュ休暇（${groups.map(g => g.symbol).join(', ')}）の対象日が含まれています`;
        } else {
            badge.style.display = 'none';
        }
    }

    function getObtainedRefreshHistory(currentStartDate) {
        const pastHistory = {};
        const currentHistory = {};
        const allHistoryDetails = [];

        for (let i = 1; i <= NUM_STAFF; i++) {
            pastHistory[i] = new Set();
            currentHistory[i] = new Set();
        }

        try {
            const terms = getSavedTerms();
            terms.forEach(termDate => {
                const isCurrent = (termDate === currentStartDate);
                const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${termDate}`);
                if (!raw) return;
                const data = JSON.parse(raw);
                if (!data) return;

                if (data.outputGrid && Array.isArray(data.outputGrid)) {
                    data.outputGrid.forEach((row, sIdx) => {
                        const staffId = sIdx + 1;
                        if (!pastHistory[staffId]) pastHistory[staffId] = new Set();
                        if (!currentHistory[staffId]) currentHistory[staffId] = new Set();

                        row.forEach((cell, dIdx) => {
                            const sym = (cell && cell.symbol) ? cell.symbol : cell;
                            if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                                if (isCurrent) {
                                    currentHistory[staffId].add(sym);
                                } else {
                                    pastHistory[staffId].add(sym);
                                }
                                allHistoryDetails.push({
                                    staffId,
                                    staffName: (data.staffList && data.staffList[sIdx]) ? data.staffList[sIdx].name : `スタッフ ${staffId}`,
                                    termDate,
                                    symbol: sym,
                                    dayIndex: dIdx,
                                    isCurrent
                                });
                            }
                        });
                    });
                } else if (data.staffList && Array.isArray(data.staffList)) {
                    data.staffList.forEach((st, sIdx) => {
                        const staffId = st.id || (sIdx + 1);
                        if (!pastHistory[staffId]) pastHistory[staffId] = new Set();
                        if (!currentHistory[staffId]) currentHistory[staffId] = new Set();

                        if (Array.isArray(st.days)) {
                            st.days.forEach((sym, dIdx) => {
                                if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                                    if (isCurrent) {
                                        currentHistory[staffId].add(sym);
                                    } else {
                                        pastHistory[staffId].add(sym);
                                    }
                                    allHistoryDetails.push({
                                        staffId,
                                        staffName: st.name,
                                        termDate,
                                        symbol: sym,
                                        dayIndex: dIdx,
                                        isCurrent
                                    });
                                }
                            });
                        }
                    });
                }
            });
        } catch (e) {
            console.error('リフ取得履歴のスキャン中にエラー:', e);
        }

        // 現在メモリ上の staffList.days にあるリフも当ターム取得として追加
        staffList.forEach(st => {
            if (st.isUnused) return;
            const staffId = st.id;
            if (!currentHistory[staffId]) currentHistory[staffId] = new Set();
            if (Array.isArray(st.days)) {
                st.days.forEach(sym => {
                    if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                        currentHistory[staffId].add(sym);
                    }
                });
            }
        });

        return { pastHistory, currentHistory, allHistoryDetails };
    }

    function handleAutoAssignRefreshHolidays(options = {}) {
        const silent = !!options.silent;
        const term = getTermInfo();
        const groups = (typeof getTermRefreshGroups === 'function') ? getTermRefreshGroups(term.dates) : [];

        if (!groups || groups.length === 0) {
            if (!silent) {
                showToast('ℹ️ 現在の期間（' + term.title + '）はリフレッシュ休暇の対象月ではありません（対象: 6〜10月, 12〜2月）');
            }
            return { success: false, assignedCount: 0, reason: 'not_refresh_month' };
        }

        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
        const { pastHistory } = getObtainedRefreshHistory(curStartDate);

        pushHistory();
        const res = autoAssignRefreshHolidaysCore(staffList, term.dates, {
            obtainedHistory: pastHistory
        });

        if (res.assignedCount > 0) {
            // ★ 自動配分されたリフのセルおよび対象スタッフを記録（通常文字・編集自由扱い＆誤消去検知用）
            if (Array.isArray(res.assignments)) {
                res.assignments.forEach(a => {
                    autoAssignedRefKeys.add(`${a.staffIndex},${a.dayIndex}`);
                    autoAssignedStaffIds.add(a.staffId);
                });
            }
            renderInputTable();
            saveCurrentTermToStorage();
            playNotificationSound();

            if (!silent) {
                const modal = document.getElementById('refreshResultModal');
                const detailsEl = document.getElementById('refreshResultDetails');
                const subtitleEl = document.getElementById('refreshResultSubtitle');

                if (subtitleEl) {
                    subtitleEl.textContent = `🌴 リフレッシュ休暇を計 ${res.assignedCount} 名に自動配分しました（重複なし・前ターム照合済）`;
                }

                if (detailsEl) {
                    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
                    res.groupResults.forEach(grp => {
                        html += `
                            <div style="border-left: 3px solid #10b981; padding-left: 8px;">
                                <strong>【${grp.symbol} (${grp.month}月分)】</strong>: 
                                ターム内 ${grp.daysInTerm}日 / 月全${grp.totalMonthDays}日 ➔ 日割り目標: <strong>${grp.targetCount}名</strong><br>
                                <span style="font-size:0.8rem; color:#475569;">
                                    （既存希望: ${grp.alreadyInTerm}名 ＋ 今回自動配分: <strong style="color:#047857;">${grp.assignedNow}名</strong>）
                                </span>
                            </div>
                        `;
                    });
                    html += '</div>';

                    if (res.assignments.length > 0) {
                        html += '<div style="margin-top:10px; max-height:140px; overflow-y:auto; border-top:1px dashed #cbd5e1; padding-top:6px; font-size:0.78rem; color:#334155;">';
                        html += '<strong>配分詳細:</strong><br>';
                        res.assignments.forEach(a => {
                            html += `・No.${a.staffId} ${a.staffName} ➔ <strong>${a.dateStr}</strong> に【${a.symbol}】<br>`;
                        });
                        html += '</div>';
                    }

                    detailsEl.innerHTML = html;
                }

                if (modal) modal.classList.add('active');
                showToast(`🌴 リフレッシュ休暇を ${res.assignedCount} 名に日割り均等配分しました`);
            }
        } else {
            if (!silent) {
                showToast('ℹ️ リフレッシュ休暇は既に必要人数分が割り当て済みです（または全員取得済みです）');
            }
        }

        return res;
    }

    function openRefreshStatusModal() {
        const modal = document.getElementById('refreshStatusModal');
        const container = document.getElementById('refreshStatusTableContainer');
        const summaryText = document.getElementById('refStatusSummaryText');
        if (!modal || !container) return;

        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
        const { pastHistory, currentHistory } = getObtainedRefreshHistory(curStartDate);

        const refSymbols = ['上1', '上2', '上3', '上4', '上5', '下1', '下2', '下3'];
        const activeStaff = staffList.filter(s => !s.isUnused);

        let html = `
            <table class="sheet-table" style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 6px; border: 1px solid #cbd5e1; width: 45px;">No.</th>
                        <th style="padding: 6px; border: 1px solid #cbd5e1; min-width: 100px;">氏名</th>
        `;
        refSymbols.forEach(sym => {
            const isSummer = sym.startsWith('上');
            const bg = isSummer ? '#ecfdf5' : '#f0f9ff';
            const color = isSummer ? '#047857' : '#0369a1';
            html += `<th style="padding: 6px; border: 1px solid #cbd5e1; background: ${bg}; color: ${color}; text-align: center; width: 65px;">${sym}</th>`;
        });
        html += `
                        <th style="padding: 6px; border: 1px solid #cbd5e1; width: 75px; text-align: center;">消化数</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let totalObtainedAll = 0;

        activeStaff.forEach(st => {
            const sId = st.id;
            const past = pastHistory[sId] || new Set();
            const cur = currentHistory[sId] || new Set();
            let staffCount = 0;

            html += `<tr>`;
            html += `<td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${sId}</td>`;
            html += `<td style="padding: 4px 6px; border: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">${st.name}</td>`;

            refSymbols.forEach(sym => {
                if (cur.has(sym)) {
                    staffCount++;
                    totalObtainedAll++;
                    html += `<td style="padding: 4px; border: 1px solid #e2e8f0; text-align: center; background: #dcfce7; color: #15803d; font-weight: 800;" title="当タームで取得">🌴 当ターム</td>`;
                } else if (past.has(sym)) {
                    staffCount++;
                    totalObtainedAll++;
                    html += `<td style="padding: 4px; border: 1px solid #e2e8f0; text-align: center; background: #e0f2fe; color: #0369a1; font-weight: 700;" title="過去タームで取得済">✅ 済</td>`;
                } else {
                    html += `<td style="padding: 4px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">-</td>`;
                }
            });

            html += `<td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700; background: #f8fafc;">${staffCount} / 8</td>`;
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        if (summaryText) {
            summaryText.textContent = `有効スタッフ: ${activeStaff.length}名 ／ 全体リフ消化総数: ${totalObtainedAll}回`;
        }

        modal.classList.add('active');
    }

    // イベントリスナーの登録
    const autoAssignRefBtn = document.getElementById('autoAssignRefBtn');
    if (autoAssignRefBtn) {
        autoAssignRefBtn.addEventListener('click', () => {
            handleAutoAssignRefreshHolidays({ silent: false });
        });
    }

    const viewRefStatusBtn = document.getElementById('viewRefStatusBtn');
    if (viewRefStatusBtn) {
        viewRefStatusBtn.addEventListener('click', openRefreshStatusModal);
    }

    const closeRefreshResultModalBtn = document.getElementById('closeRefreshResultModalBtn');
    if (closeRefreshResultModalBtn) {
        closeRefreshResultModalBtn.addEventListener('click', () => {
            document.getElementById('refreshResultModal')?.classList.remove('active');
        });
    }

    const refreshResultSolveBtn = document.getElementById('refreshResultSolveBtn');
    if (refreshResultSolveBtn) {
        refreshResultSolveBtn.addEventListener('click', () => {
            document.getElementById('refreshResultModal')?.classList.remove('active');
            const targetSolveBtn = document.getElementById('solveBtn') || document.getElementById('inputSolveBtn');
            if (targetSolveBtn) targetSolveBtn.click();
        });
    }

    const closeRefStatusModalBtn = document.getElementById('closeRefStatusModalBtn');
    if (closeRefStatusModalBtn) {
        closeRefStatusModalBtn.addEventListener('click', () => {
            document.getElementById('refreshStatusModal')?.classList.remove('active');
        });
    }

    const closeRefStatusModalCross = document.getElementById('closeRefStatusModalCross');
    if (closeRefStatusModalCross) {
        closeRefStatusModalCross.addEventListener('click', () => {
            document.getElementById('refreshStatusModal')?.classList.remove('active');
        });
    }

    // 第1段階: 基本勤務表 自動生成ボタン（特殊勤務の自動割当は行わず、すべて○で保持）
    const solveBtn = document.getElementById('solveBtn') || document.getElementById('inputSolveBtn');
    function setSolveLoading(loading) {
        const btns = [document.getElementById('solveBtn'), document.getElementById('inputSolveBtn')];
        btns.forEach(btn => {
            if (!btn) return;
            btn.disabled = loading;
            if (loading) {
                btn.innerHTML = `
                    <svg class="animate-spin" style="width:16px;height:16px;margin-right:6px;display:inline-block;animation:spin 1s linear infinite;" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity:0.25;"></circle>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    基本勤務表を計算中...
                `;
            } else {
                btn.innerHTML = `⚡ 勤務表を自動生成する`;
            }
        });
    }

    if (solveBtn) {
        solveBtn.addEventListener('click', () => {
            // ★ リフレッシュ休暇自動配分連携:
            // ターム内にリフ対象月が含まれており、かつまだリフが一切入っていない場合、自動配分を先に適用！
            const term = getTermInfo();
            const refGroups = (typeof getTermRefreshGroups === 'function') ? getTermRefreshGroups(term.dates) : [];
            if (refGroups && refGroups.length > 0) {
                let hasRef = false;
                for (let s = 0; s < NUM_STAFF; s++) {
                    if (staffList[s].isUnused) continue;
                    for (let d = 0; d < NUM_DAYS; d++) {
                        const sym = staffList[s].days[d];
                        if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                            hasRef = true;
                            break;
                        }
                    }
                    if (hasRef) break;
                }
                if (!hasRef) {
                    handleAutoAssignRefreshHolidays({ silent: true });
                }
            }

            setSolveLoading(true);

            setTimeout(() => {
                try {
                    const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                    const term = getTermInfo();
                    const scheduler = new ShiftScheduler(staffList, {
                        standardHolidays: stdHolidayVal,
                        dates: term.dates,
                        dayOffsets: [...dayOffsets]
                    });
                    const result = scheduler.solveBaseSchedule();

                    setSolveLoading(false);

                    if (result.success) {
                        clearConflictHighlights();
                        // ★ 自動配分リフを通常文字・編集自由セル（isFixed: false）にする
                        if (result.grid) {
                            for (let s = 0; s < NUM_STAFF; s++) {
                                if (!result.grid[s]) continue;
                                for (let d = 0; d < NUM_DAYS; d++) {
                                    const cell = result.grid[s][d];
                                    if (!cell) continue;
                                    const sym = cell.symbol || cell;
                                    const isRef = SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym);
                                    if (isRef && autoAssignedRefKeys.has(`${s},${d}`)) {
                                        cell.isFixed = false;
                                        cell.isAutoAssignedRef = true;
                                    }
                                }
                            }
                        }
                        lastScheduler = scheduler;
                        lastSolveResult = result;
                        renderOutputTable(result.grid, result.stats);
                        renderStatsDashboard(result.stats);
                        switchTab('outputTab');
                        saveCurrentTermToStorage(); // ★ 生成データをブラウザに自動保存
                        showToast('⚡ 基本勤務表を生成しました（修正作業エリアで微調整を行ってください）');
                    } else {
                        applyConflictHighlights(result.conflictCells);
                        showErrorModal(result.errors, {
                            title: '事前希望の制約指摘・エラー検知',
                            subtitle: '事前入力枠に制約違反や物理的衝突があります（該当セルを青い網掛けで表示中）。',
                            desc: '内容をご確認の上修正するか、あえて無視して基本勤務表の自動生成を進めることができます。',
                            onForceSolve: () => {
                                // エラーを無視して基本勤務表を強制生成！
                                const forceResult = scheduler.solveBaseSchedule({ force: true });
                                if (forceResult.grid) {
                                    for (let s = 0; s < NUM_STAFF; s++) {
                                        if (!forceResult.grid[s]) continue;
                                        for (let d = 0; d < NUM_DAYS; d++) {
                                            const cell = forceResult.grid[s][d];
                                            if (!cell) continue;
                                            const sym = cell.symbol || cell;
                                            const isRef = SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym);
                                            if (isRef && autoAssignedRefKeys.has(`${s},${d}`)) {
                                                cell.isFixed = false;
                                                cell.isAutoAssignedRef = true;
                                            }
                                        }
                                    }
                                }
                                lastScheduler = scheduler;
                                lastSolveResult = forceResult;
                                renderOutputTable(forceResult.grid, forceResult.stats);
                                renderStatsDashboard(forceResult.stats);
                                switchTab('outputTab');
                                saveCurrentTermToStorage(); // ★ 強制生成データをブラウザに自動保存
                                showToast('⚡ エラーを無視して基本勤務表を生成しました（修正作業エリアで微調整してください）');
                            }
                        });
                    }
                } catch (err) {
                    setSolveLoading(false);
                    showErrorModal([`予期せぬエラーが発生しました: ${err.message}`]);
                }
            }, 80);
        });
    }

    // 第2段階: 特殊勤務を入れるボタン（早3名・遅1名・E2名・8時1名を割り当てて最終完成）
    function handleAssignSpecialDuties() {
        const btns = [document.getElementById('assignSpecialBtn'), document.getElementById('outputAssignSpecialBtn')];
        btns.forEach(b => {
            if (b) {
                b.disabled = true;
                b.innerHTML = `特殊勤務を配置中...`;
            }
        });

        setTimeout(() => {
            try {
                if (!lastScheduler) {
                    // 基本勤務表がまだない場合はまず第1段階を実行
                    const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                    lastScheduler = new ShiftScheduler(staffList, {
                        standardHolidays: stdHolidayVal,
                        dates: getTermInfo().dates,
                        dayOffsets: [...dayOffsets]
                    });
                    const baseResult = lastScheduler.solveBaseSchedule();
                    if (!baseResult.success) {
                        btns.forEach(b => {
                            if (b) {
                                b.disabled = false;
                                b.innerHTML = `✨ 特殊勤務を入れる`;
                            }
                        });
                        applyConflictHighlights(baseResult.conflictCells);
                        showErrorModal(baseResult.errors);
                        return;
                    }
                }

                const specialResult = lastScheduler.assignSpecialDutiesToGrid();
                btns.forEach(b => {
                    if (b) {
                        b.disabled = false;
                        b.innerHTML = `✨ 特殊勤務を入れる`;
                    }
                });

                if (specialResult.success) {
                    clearConflictHighlights();
                    lastSolveResult = specialResult;
                    renderOutputTable(specialResult.grid, specialResult.stats);
                    renderStatsDashboard(specialResult.stats);
                    switchTab('checkTab');
                    checkFinalConstraints(false);
                    saveCurrentTermToStorage(); // ★ 特殊勤務割当データを自動保存
                    showToast('✨ 特殊勤務（早3名・遅1名・E2名・8時1名）を割り当て、「最終チェック&完成」を表示しました！');
                } else {
                    showErrorModal(specialResult.errors, {
                        title: '特殊勤務割当の指摘・エラー検知',
                        subtitle: '特殊勤務の候補者不足や制約との衝突があります。',
                        desc: '内容をご確認の上修正するか、あえて無視して可能な限り特殊勤務を割り当てて「最終チェック&完成」へ進むことができます。',
                        onForceSpecial: () => {
                            // エラーを無視して特殊勤務を割り当て！
                            const forcedResult = lastScheduler.assignSpecialDutiesToGrid({ force: true });
                            lastSolveResult = forcedResult;
                            renderOutputTable(forcedResult.grid, forcedResult.stats);
                            renderStatsDashboard(forcedResult.stats);
                            switchTab('checkTab');
                            checkFinalConstraints(false);
                            saveCurrentTermToStorage(); // ★ 強制特殊勤務割当データを自動保存
                            showToast('✨ エラーを無視して特殊勤務を割り当て、「最終チェック&完成」へ進みました（該当箇所はブルー網掛けで表示中）');
                        }
                    });
                }
            } catch (err) {
                btns.forEach(b => {
                    if (b) {
                        b.disabled = false;
                        b.innerHTML = `✨ 特殊勤務を入れる`;
                    }
                });
                showErrorModal([`予期せぬエラーが発生しました: ${err.message}`]);
            }
        }, 80);
    }

    const assignSpecialBtn = document.getElementById('assignSpecialBtn');
    if (assignSpecialBtn) assignSpecialBtn.addEventListener('click', handleAssignSpecialDuties);

    const outputAssignSpecialBtn = document.getElementById('outputAssignSpecialBtn');
    if (outputAssignSpecialBtn) outputAssignSpecialBtn.addEventListener('click', handleAssignSpecialDuties);

    // 出力テーブル描画（画像3のメリハリある罫線と「※/※※～※/※※勤務表」タイトルを反映）
    function renderOutputTable(grid, stats) {
        const thead = document.getElementById('outputTableHead');
        const tbody = document.getElementById('outputTableBody');
        const tfoot = document.getElementById('outputTableFoot');
        if (!thead || !tbody || !tfoot) return;

        const term = getTermInfo();

        let headHtml = `
            <tr>
                <th class="sticky-col-1 border-thick-bottom" rowspan="2">No</th>
                <th class="sticky-col-2 border-thick-right border-thick-bottom" rowspan="2">氏名</th>
                <th colspan="${NUM_DAYS}" class="border-thick-right border-thick-bottom" style="font-size:0.95rem; font-weight:800; background:#f8fafc; color:#1e293b;">${term.title}</th>
                <th colspan="9" class="border-thick-bottom" style="background:#e0f2fe; color:#0369a1; font-weight:800;">勤務・休暇 集計 ＆ 備考</th>
            </tr>
            <tr>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dateInfo = term.dates[d];
            const cls = dateInfo.wIdx === 5 ? 'header-sat' : ((dateInfo.wIdx === 6 || dateInfo.isHoliday) ? 'header-sun' : '');
            // 7日ごと（週区切り）および28日目に太線
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            headHtml += `<th class="${cls} ${thickCls} border-thick-bottom header-day-col" title="${dateInfo.label} (${dateInfo.weekday})${dateInfo.isHoliday ? ' 祝日' : ''}">
                <div class="day-label">${dateInfo.label}</div>
                <div class="day-weekday"><small>${dateInfo.weekday}</small></div>
                ${renderDayOffsetCtrl(d)}
            </th>`;
        }
        headHtml += `
                <th title="出勤日数" class="border-thick-bottom" style="background:#f1f5f9;">出勤</th>
                <th title="公休日数" class="border-thick-bottom" style="background:#f1f5f9; color:#1e293b;">公休</th>
                <th title="有給休暇日数" class="border-thick-bottom" style="background:#f1f5f9; color:#1e293b; font-weight:800;">有休</th>
                <th title="リフレッシュ休暇日数" class="border-thick-bottom" style="background:#f1f5f9; color:#1e293b;">リフ</th>
                <th title="早番回数" class="border-thick-bottom" style="background:#f1f5f9;">早</th>
                <th title="遅番回数" class="border-thick-bottom" style="background:#f1f5f9;">遅</th>
                <th title="イブニング回数" class="border-thick-bottom" style="background:#f1f5f9;">E</th>
                <th title="8時開始回数" class="border-thick-bottom" style="background:#f1f5f9;">8時</th>
                <th title="委員会・用事等の備考メモ" class="border-thick-bottom" style="background:#f8fafc; color:#1e293b; min-width:220px; max-width:320px;">備考（メモ）</th>
            </tr>
        `;
        thead.innerHTML = headHtml;

        let bodyHtml = '';
        const validStaffIndices = [];
        for (let s = 0; s < NUM_STAFF; s++) {
            if (!staffList[s].isUnused) validStaffIndices.push(s);
        }

        validStaffIndices.forEach((s, outIdx) => {
            const staff = staffList[s];
            const staffStat = stats.staffStats[s];
            const isLastStaff = (outIdx === validStaffIndices.length - 1);
            const rowBottomCls = isLastStaff ? 'border-thick-bottom' : '';

            bodyHtml += `<tr>`;
            bodyHtml += `<td class="sticky-col-1 font-mono ${rowBottomCls}">${outIdx + 1}</td>`;
            bodyHtml += `<td class="sticky-col-2 border-thick-right ${rowBottomCls}">${staff.name}</td>`;

            for (let d = 0; d < NUM_DAYS; d++) {
                const cell = grid[s][d];
                const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                // 事前入力希望枠は赤字・太字（網掛けなし！）
                const cls = cell.isFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';
                const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
                const titleText = cell.isFixed ? '🔒 事前固定希望枠（赤字・太字保持）' : 'システム自動配置';
                bodyHtml += `<td class="${cls} ${thickCls} ${rowBottomCls}" data-s="${s}" data-d="${d}" title="${titleText}">${displaySym}</td>`;
            }

            bodyHtml += `
                <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="work" style="font-weight:700; color:#1e293b; background:transparent;">${staffStat.workDays}</td>
                <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="off" style="font-weight:700; color:#1e293b; background:transparent;">${staffStat.offDays}</td>
                <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="paid" style="font-weight:800; color:#1e293b; background:transparent;">${staffStat.paidDays}</td>
                <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="ref" style="font-weight:600; color:#1e293b; background:transparent;">${staffStat.refDays}</td>
                <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="early" style="font-weight:600; color:#334155; background:transparent;">${staffStat.early}</td>
                <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="late" style="font-weight:600; color:#334155; background:transparent;">${staffStat.late}</td>
                <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="eve" style="font-weight:600; color:#334155; background:transparent;">${staffStat.eve}</td>
                <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="h8" style="font-weight:600; color:#334155; background:transparent;">${staffStat.h8}</td>
                <td class="remarks-cell ${rowBottomCls}" style="min-width:220px; max-width:320px; text-align:left; font-size:0.8rem; color:#475569; padding:2px 8px; white-space:normal; word-break:break-all; background:transparent;">${escapeHtmlText(staff.remarks || '')}</td>
            `;
            bodyHtml += `</tr>`;
        });
        tbody.innerHTML = bodyHtml;

        const validStaffStats = stats.staffStats.filter(s => !s.isUnused);
        const totalWorkSum = validStaffStats.reduce((acc, s) => acc + s.workDays, 0);
        const totalOffSum = validStaffStats.reduce((acc, s) => acc + s.offDays, 0);
        const totalPaidSum = validStaffStats.reduce((acc, s) => acc + s.paidDays, 0);
        const totalRefSum = validStaffStats.reduce((acc, s) => acc + s.refDays, 0);
        const totalEarlySum = validStaffStats.reduce((acc, s) => acc + s.early, 0);
        const totalLateSum = validStaffStats.reduce((acc, s) => acc + s.late, 0);
        const totalEveSum = validStaffStats.reduce((acc, s) => acc + s.eve, 0);
        const totalH8Sum = validStaffStats.reduce((acc, s) => acc + s.h8, 0);

        // 1行目: 出勤人数合計（総出勤者数）
        let footHtml = `
            <tr style="background:#f8fafc; font-weight:bold;">
                <th class="sticky-col-1" colspan="2">出勤人数合計</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls}" style="font-weight:800; color:#1e293b; font-size:0.95rem;">${dStat.totalWork}</td>`;
        }
        footHtml += `
            <td style="font-weight:700; color:#1e293b; background:transparent;">${totalWorkSum}</td>
            <td style="font-weight:700; color:#1e293b; background:transparent;">${totalOffSum}</td>
            <td style="font-weight:800; color:#1e293b; background:transparent;">${totalPaidSum}</td>
            <td style="font-weight:600; color:#1e293b; background:transparent;">${totalRefSum}</td>
            <td style="font-weight:600; color:#334155; background:transparent;">${totalEarlySum}</td>
            <td style="font-weight:600; color:#334155; background:transparent;">${totalLateSum}</td>
            <td style="font-weight:600; color:#334155; background:transparent;">${totalEveSum}</td>
            <td style="font-weight:600; color:#334155; background:transparent;">${totalH8Sum}</td>
        </tr>`;

        // 2行目: 実数合計（リハビリ実働人数: 出勤人数合計 - 加減枠）
        // 2行目: 実数合計（案B: 出勤実働 - 増員分。減員時は実数変更なし）
        const totalRealSum = stats.daily.reduce((sum, dStat) => sum + (dStat.realWork !== undefined ? dStat.realWork : dStat.totalWork), 0);
        footHtml += `
            <tr style="background:#f8fafc; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="color:#1e293b;" title="行事等の出勤加減枠を除いた実際のリハビリ業務稼働人数（案B: 増員分のみ減算、減員時は変更なし）">実数合計</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            const real = dStat.realWork !== undefined ? dStat.realWork : dStat.totalWork;
            footHtml += `<td class="${thickCls}" style="vertical-align:middle; font-weight:800; color:#1e293b; font-size:0.95rem;">${real}</td>`;
        }
        footHtml += `<td style="font-weight:700; color:#1e293b;">${totalRealSum}</td><td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // ★ セクション別出勤人数（PT A, OT A, PT B, OT B, ST）
        const secList = [
            { name: 'PT A', label: 'PT A 出勤', cls: 'foot-sec-pt-a', color: '#ea580c' },
            { name: 'OT A', label: 'OT A 出勤', cls: 'foot-sec-ot-a', color: '#ea580c' },
            { name: 'PT B', label: 'PT B 出勤', cls: 'foot-sec-pt-b', color: '#1d4ed8' },
            { name: 'OT B', label: 'OT B 出勤', cls: 'foot-sec-ot-b', color: '#1d4ed8' },
            { name: 'ST',   label: 'ST 出勤',   cls: 'foot-sec-st',   color: '#ec4899' }
        ];

        secList.forEach(sec => {
            footHtml += `
                <tr class="${sec.cls}" style="font-weight:700; font-size:0.82rem; background:transparent;">
                    <th class="sticky-col-1" colspan="2" style="color:${sec.color};">${sec.label}</th>
            `;
            let secTotalSum = 0;
            for (let d = 0; d < NUM_DAYS; d++) {
                const dStat = stats.daily[d];
                const secVal = (dStat.sectionWork && dStat.sectionWork[sec.name] !== undefined)
                    ? dStat.sectionWork[sec.name]
                    : 0;
                secTotalSum += secVal;
                const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
                footHtml += `<td class="${thickCls}" style="color:${sec.color}; font-weight:800;">${secVal > 0 ? secVal : '-'}</td>`;
            }
            footHtml += `<td style="font-weight:800; color:${sec.color};">${secTotalSum}</td><td colspan="8" style="color:#94a3b8;">-</td></tr>`;
        });

        // 早番
        footHtml += `
            <tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#334155;">早番</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls}" data-d="${d}" data-footer-stat="early" style="color:#334155; font-weight:700;">${dStat.early}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // 遅番
        footHtml += `
            <tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#334155;">遅番</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls}" data-d="${d}" data-footer-stat="late" style="color:#334155; font-weight:700;">${dStat.late}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // E (イブニング)
        footHtml += `
            <tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#334155;">E</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls}" data-d="${d}" data-footer-stat="eve" style="color:#334155; font-weight:700;">${dStat.eve}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // 8時勤務
        footHtml += `
            <tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1 border-thick-bottom" colspan="2" style="color:#334155;">8時</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
            footHtml += `<td class="${thickCls} border-thick-bottom" data-d="${d}" data-footer-stat="h8" style="color:#334155; font-weight:700;">${dStat.h8}</td>`;
        }
        footHtml += `<td class="border-thick-bottom" colspan="8" style="color:#94a3b8;">-</td></tr>`;

        tfoot.innerHTML = footHtml;

        const checkThead = document.getElementById('checkTableHead');
        const checkTbody = document.getElementById('checkTableBody');
        const checkTfoot = document.getElementById('checkTableFoot');
        if (checkThead && checkTbody && checkTfoot) {
            checkThead.innerHTML = headHtml;
            checkTbody.innerHTML = bodyHtml;
            checkTfoot.innerHTML = footHtml;
        }

        attachOutputTableEvents();
    }

    // 出力シートおよびチェックシートでのセルクリックによる手動調整イベント
    function attachOutputTableEvents() {
        document.querySelectorAll('#outputTableBody .day-cell, #checkTableBody .day-cell').forEach(cell => {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', () => {
                const s = parseInt(cell.dataset.s, 10);
                const d = parseInt(cell.dataset.d, 10);
                if (!lastSolveResult || !lastSolveResult.grid) return;

                // ★ P（プロテクト）ボタンが選択されている場合: 固定保護のトグル切り替え
                if (currentOutputSelectedSymbol === 'P') {
                    pushHistory();
                    const cellData = lastSolveResult.grid[s][d];
                    cellData.isFixed = !cellData.isFixed;
                    const oldSym = cellData.symbol || '○';
                    if (cellData.isFixed && !cellData.symbol) {
                        cellData.symbol = '○';
                    }
                    // 希望入力シート側にも事前固定枠として連動
                    staffList[s].days[d] = cellData.isFixed ? cellData.symbol : '';

                    if (lastScheduler) {
                        lastScheduler.grid[s][d].isFixed = cellData.isFixed;
                        lastScheduler.grid[s][d].symbol = cellData.symbol;
                    }
                    renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
                    const staff = staffList[s];
                    const term = getTermInfo();
                    const dateInfo = term.dates[d];
                    showToast(cellData.isFixed
                        ? `🛡️ 【No.${staff.id} ${staff.name}】${dateInfo.label} をプロテクト（固定希望・赤字）に設定しました`
                        : `🔓 【No.${staff.id} ${staff.name}】${dateInfo.label} のプロテクトを解除しました`);
                    return;
                }

                let newSym = currentOutputSelectedSymbol;
                if (newSym === 'CLEAR') newSym = '';

                const cellData = lastSolveResult.grid[s][d];
                const oldSym = cellData.symbol || '';

                // すでに同じ記号なら変更なし
                if (oldSym === newSym) return;

                const applyEdit = () => {
                    // 履歴を保存（Undo可能にする）
                    pushHistory();

                    // グリッドのシンボルを更新
                    cellData.symbol = newSym;
                    if (lastScheduler) {
                        lastScheduler.grid[s][d].symbol = newSym;
                        const newStats = lastScheduler.calculateStats();
                        lastSolveResult.stats = newStats;
                        renderOutputTable(lastSolveResult.grid, newStats);
                        renderStatsDashboard(newStats);
                    } else {
                        renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
                    }

                    // ★ リアルタイム制約チェック＆網掛け更新（現在開いているタブに合わせてチェック）
                    const activeTab = document.querySelector('.tab-panel.active')?.id;
                    if (activeTab === 'outputTab') {
                        checkWorkAreaConstraints(false);
                    } else {
                        checkFinalConstraints(false);
                    }
                };

                // ★ 事前固定希望枠（赤字）を修正する場合はポップアップで確認
                if (cellData.isFixed) {
                    const term = getTermInfo();
                    const dateInfo = term.dates[d];
                    const staff = staffList[s];
                    showConfirmEditFixedModal({
                        staffId: staff.id,
                        staffName: staff.name,
                        dateLabel: `${dateInfo.label} (${dateInfo.weekday})`,
                        oldSym: oldSym,
                        newSym: newSym || '（消去）'
                    }, applyEdit);
                    return;
                }

                // 通常セル（自動配置枠）はそのまま即座に適用
                applyEdit();
            });
        });
    }

    function resetStatsDashboard() {
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };
        setTxt('statWeekdayBadge', '- 日間');
        setTxt('statWeekdayWorkRange', '- 〜 - 名');
        setTxt('statWeekdayAvgWork', '- 名');

        setTxt('statHolidayBadge', '- 日間');
        setTxt('statHolidayWorkRange', '- 〜 - 名');
        setTxt('statHolidayAvgWork', '- 名');
        setTxt('statSunHolSubInfo', '土曜日・日曜日・国民の祝日');

        setTxt('statTotalPaidDays', '- 日');
        setTxt('statPaidStaffCount', '- 名');

        setTxt('statWorkRange', '- 〜 - 名');
        setTxt('statAvgWork', '- 名');
        setTxt('statSpecialCounts', '-');

        const chartEl = document.getElementById('dailyWorkChart');
        if (chartEl) {
            chartEl.innerHTML = '<div style="color: #94a3b8; font-size: 0.85rem; margin: auto;">勤務表を自動生成するとグラフが表示されます</div>';
        }
    }

    function renderStatsDashboard(stats) {
        if (!stats || !stats.daily || stats.daily.length === 0) {
            resetStatsDashboard();
            return;
        }

        const term = getTermInfo();
        const dates = term.dates;

        // 1. 「平日」と「土日祝（その他）」に完全に2区分
        const weekdayDaily = [];
        const holidayDaily = []; // 土日祝

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = dates[d];
            const totalWork = stats.daily[d].totalWork;
            const item = { d, totalWork, label: di.label, weekday: di.weekday, isHoliday: di.isHoliday };

            // 土曜(wIdx=5), 日曜(wIdx=6), 国民の祝日(isHoliday)
            const isWeekendOrHoliday = (di.wIdx === 5 || di.wIdx === 6 || di.isHoliday);
            if (isWeekendOrHoliday) {
                holidayDaily.push(item);
            } else {
                weekdayDaily.push(item);
            }
        }

        // --- 平日の集計（最小・最大・平均） ---
        const weekdayBadgeEl = document.getElementById('statWeekdayBadge');
        const weekdayRangeEl = document.getElementById('statWeekdayWorkRange');
        const weekdayAvgEl = document.getElementById('statWeekdayAvgWork');

        if (weekdayDaily.length > 0) {
            const works = weekdayDaily.map(item => item.totalWork);
            const wMin = Math.min(...works);
            const wMax = Math.max(...works);
            const wSum = works.reduce((a, b) => a + b, 0);
            const wAvg = (wSum / weekdayDaily.length).toFixed(1);

            if (weekdayBadgeEl) weekdayBadgeEl.textContent = `${weekdayDaily.length} 日間`;
            if (weekdayRangeEl) weekdayRangeEl.textContent = `${wMin} 〜 ${wMax} 名 (ブレ幅: ${wMax - wMin})`;
            
            const hasOffset = weekdayDaily.some(item => (dayOffsets && dayOffsets[item.d]) !== 0);
            if (hasOffset) {
                const realWorks = weekdayDaily.map(item => item.totalWork - ((dayOffsets && dayOffsets[item.d]) || 0));
                const realSum = realWorks.reduce((a, b) => a + b, 0);
                const realAvg = (realSum / weekdayDaily.length).toFixed(1);
                if (weekdayAvgEl) weekdayAvgEl.innerHTML = `${wAvg} 名 <span style="font-size:0.78rem; color:#64748b; font-weight:normal;">(実質リハ: ${realAvg}名)</span>`;
            } else {
                if (weekdayAvgEl) weekdayAvgEl.textContent = `${wAvg} 名`;
            }
        } else {
            if (weekdayBadgeEl) weekdayBadgeEl.textContent = '0 日間';
            if (weekdayRangeEl) weekdayRangeEl.textContent = '- 名';
            if (weekdayAvgEl) weekdayAvgEl.textContent = '- 名';
        }

        // --- 土日祝（その他）の集計（最小・最大・平均） ---
        const holidayBadgeEl = document.getElementById('statHolidayBadge');
        const holidayRangeEl = document.getElementById('statHolidayWorkRange');
        const holidayAvgEl = document.getElementById('statHolidayAvgWork');
        const sunHolSubInfoEl = document.getElementById('statSunHolSubInfo');

        if (holidayDaily.length > 0) {
            const works = holidayDaily.map(item => item.totalWork);
            const hMin = Math.min(...works);
            const hMax = Math.max(...works);
            const hSum = works.reduce((a, b) => a + b, 0);
            const hAvg = (hSum / holidayDaily.length).toFixed(1);

            if (holidayBadgeEl) holidayBadgeEl.textContent = `${holidayDaily.length} 日間`;
            if (holidayRangeEl) holidayRangeEl.textContent = `${hMin} 〜 ${hMax} 名 (ブレ幅: ${hMax - hMin})`;
            
            const hasHolidayOffset = holidayDaily.some(item => (dayOffsets && dayOffsets[item.d]) !== 0);
            if (hasHolidayOffset) {
                const realWorks = holidayDaily.map(item => item.totalWork - ((dayOffsets && dayOffsets[item.d]) || 0));
                const realSum = realWorks.reduce((a, b) => a + b, 0);
                const realAvg = (realSum / holidayDaily.length).toFixed(1);
                if (holidayAvgEl) holidayAvgEl.innerHTML = `${hAvg} 名 <span style="font-size:0.78rem; color:#64748b; font-weight:normal;">(実質リハ: ${realAvg}名)</span>`;
            } else {
                if (holidayAvgEl) holidayAvgEl.textContent = `${hAvg} 名`;
            }
            if (sunHolSubInfoEl) sunHolSubInfoEl.textContent = `土曜日・日曜日・国民の祝日（計${holidayDaily.length}日間）`;
        } else {
            if (holidayBadgeEl) holidayBadgeEl.textContent = '0 日間';
            if (holidayRangeEl) holidayRangeEl.textContent = '- 名';
            if (holidayAvgEl) holidayAvgEl.textContent = '- 名';
        }

        // --- 有休取得合計数 ---
        const validStaffStats = stats.staffStats.filter(s => !s.isUnused);
        const totalPaidDays = validStaffStats.reduce((sum, s) => sum + s.paidDays, 0);
        const paidStaffCount = validStaffStats.filter(s => s.paidDays > 0).length;

        const totalPaidEl = document.getElementById('statTotalPaidDays');
        const paidStaffEl = document.getElementById('statPaidStaffCount');
        if (totalPaidEl) {
            const formattedPaid = (totalPaidDays % 1 === 0) ? totalPaidDays.toFixed(0) : totalPaidDays.toFixed(1);
            totalPaidEl.textContent = `${formattedPaid} 日`;
        }
        if (paidStaffEl) {
            paidStaffEl.textContent = `${paidStaffCount} 名`;
        }

        // --- 全日（28日間）の出勤人数 ---
        const allDailyWorks = stats.daily.map(d => d.totalWork);
        const allMin = Math.min(...allDailyWorks);
        const allMax = Math.max(...allDailyWorks);
        const allAvg = (allDailyWorks.reduce((a, b) => a + b, 0) / NUM_DAYS).toFixed(1);

        const workRangeEl = document.getElementById('statWorkRange');
        const avgWorkEl = document.getElementById('statAvgWork');
        if (workRangeEl) workRangeEl.textContent = `${allMin} 〜 ${allMax} 名 (ブレ幅: ${allMax - allMin})`;
        if (avgWorkEl) avgWorkEl.textContent = `${allAvg} 名`;

        // --- 特殊勤務（早・遅・E・8時）の配置累計 ---
        const totalEarly = validStaffStats.reduce((sum, s) => sum + s.early, 0);
        const totalLate = validStaffStats.reduce((sum, s) => sum + s.late, 0);
        const totalEve = validStaffStats.reduce((sum, s) => sum + s.eve, 0);
        const totalH8 = validStaffStats.reduce((sum, s) => sum + s.h8, 0);
        const specEl = document.getElementById('statSpecialCounts');
        if (specEl) {
            specEl.textContent = `早: ${totalEarly}回 / 遅: ${totalLate}回 / E: ${totalEve}回 / 8時: ${totalH8}回`;
        }

        // --- 日別出勤人数グラフ（28日間、平日・土曜・祝日で色分け） ---
        const chartEl = document.getElementById('dailyWorkChart');
        if (chartEl) {
            let chartHtml = '';
            stats.daily.forEach((d, idx) => {
                const di = dates[idx];
                const pct = Math.min(100, Math.max(10, (d.totalWork / 60) * 100));

                let barColor = '#3b82f6'; // 平日: 青
                let dayLabelColor = '#64748b';
                if (di.isHoliday || di.wIdx === 6) {
                    barColor = '#ef4444'; // 祝日・日曜: 赤
                    dayLabelColor = '#dc2626';
                } else if (di.wIdx === 5) {
                    barColor = '#0ea5e9'; // 土曜: 水色
                    dayLabelColor = '#0284c7';
                }

                const dayBadge = di.isHoliday ? '祝' : di.weekday;
                chartHtml += `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;" title="${di.label} (${di.weekday})${di.isHoliday ? ' 祝日' : ''}: 出勤 ${d.totalWork}名">
                        <span style="font-size:0.68rem; font-weight:700; color:#1e293b;">${d.totalWork}</span>
                        <div style="width:100%; background:#f1f5f9; height:110px; border-radius:4px; display:flex; align-items:flex-end;">
                            <div style="width:100%; background:${barColor}; height:${pct}%; border-radius:4px; transition:height 0.3s;"></div>
                        </div>
                        <span style="font-size:0.68rem; font-weight:600; color:${dayLabelColor};">${d.day}</span>
                        <span style="font-size:0.62rem; color:${dayLabelColor};">${dayBadge}</span>
                    </div>
                `;
            });
            chartEl.innerHTML = chartHtml;
        }
    }

    const errorModal = document.getElementById('errorModal');
    const errorListEl = document.getElementById('errorList');
    const closeModalBtn = document.getElementById('closeModalBtn');

    function showErrorModal(errors, options = {}) {
        if (!errorModal || !errorListEl) {
            alert(errors.join('\n'));
            return;
        }
        const titleEl = document.getElementById('errorModalTitle');
        const subtitleEl = document.getElementById('errorModalSubtitle');
        const descEl = document.getElementById('errorModalDesc');
        const forceSolveBtn = document.getElementById('forceSolveBtn');
        const forceAssignSpecialBtn = document.getElementById('forceAssignSpecialBtn');

        if (titleEl) titleEl.textContent = options.title || '制約の指摘・エラー検知';
        if (subtitleEl) subtitleEl.textContent = options.subtitle || '制約条件または入力枠に違反・指摘箇所があります。該当セルは青い網掛けで表示されています。';
        if (descEl) descEl.textContent = options.desc || '内容をご確認の上、勤務表を修正してください。あえてこのまま進める場合は「無視して進む」ボタンを選択できます。';

        if (forceSolveBtn) {
            if (options.onForceSolve) {
                forceSolveBtn.style.display = 'inline-block';
                forceSolveBtn.onclick = () => {
                    errorModal.classList.remove('open');
                    options.onForceSolve();
                };
            } else {
                forceSolveBtn.style.display = 'none';
                forceSolveBtn.onclick = null;
            }
        }

        if (forceAssignSpecialBtn) {
            if (options.onForceSpecial) {
                forceAssignSpecialBtn.style.display = 'inline-block';
                forceAssignSpecialBtn.onclick = () => {
                    errorModal.classList.remove('open');
                    options.onForceSpecial();
                };
            } else {
                forceAssignSpecialBtn.style.display = 'none';
                forceAssignSpecialBtn.onclick = null;
            }
        }

        errorListEl.innerHTML = errors.map(err => `<li class="error-item">⚠️ ${err}</li>`).join('');
        errorModal.classList.add('open');
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            errorModal.classList.remove('open');
        });
    }

    // ==========================================
    // 事前希望事項（赤字）修正確認ポップアップ制御
    // ==========================================
    let pendingFixedEdit = null;

    function showConfirmEditFixedModal(info, onProceed) {
        const modal = document.getElementById('confirmEditFixedModal');
        if (!modal) {
            onProceed();
            return;
        }
        const staffEl = document.getElementById('confirmEditStaffName');
        const dateEl = document.getElementById('confirmEditDateLabel');
        const oldEl = document.getElementById('confirmEditOldSym');
        const newEl = document.getElementById('confirmEditNewSym');

        if (staffEl) staffEl.textContent = info.staffName || `スタッフ No.${info.staffId}`;
        if (dateEl) dateEl.textContent = info.dateLabel || `${info.dayIndex + 1}日目`;
        if (oldEl) oldEl.textContent = info.oldSym || '(空欄)';
        if (newEl) newEl.textContent = info.newSym || '(消去)';

        pendingFixedEdit = onProceed;
        modal.classList.add('open');
    }

    function closeConfirmEditFixedModal() {
        const modal = document.getElementById('confirmEditFixedModal');
        if (modal) modal.classList.remove('open');
        pendingFixedEdit = null;
    }

    const confirmEditProceedBtn = document.getElementById('confirmEditProceedBtn');
    if (confirmEditProceedBtn) {
        confirmEditProceedBtn.addEventListener('click', () => {
            if (pendingFixedEdit) {
                const fn = pendingFixedEdit;
                pendingFixedEdit = null;
                fn();
            }
            closeConfirmEditFixedModal();
        });
    }

    const confirmEditCancelBtn = document.getElementById('confirmEditCancelBtn');
    if (confirmEditCancelBtn) {
        confirmEditCancelBtn.addEventListener('click', () => {
            closeConfirmEditFixedModal();
        });
    }

    const confirmEditModalEl = document.getElementById('confirmEditFixedModal');
    if (confirmEditModalEl) {
        confirmEditModalEl.addEventListener('click', (e) => {
            if (e.target === confirmEditModalEl) {
                closeConfirmEditFixedModal();
            }
        });
    }

    const sampleBtn = document.getElementById('loadSampleBtn');
    if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
            pushHistory();
            loadSampleData();
            showToast('🎲 サンプルデータを投入しました（「↩ 戻る」で元に戻せます）');
        });
    }

    const conflictBtn = document.getElementById('loadConflictBtn');
    if (conflictBtn) {
        conflictBtn.addEventListener('click', () => {
            pushHistory();
            loadConflictSampleData();
        });
    }

    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (confirm('すべての事前入力枠および設定をクリアしますか？')) {
                pushHistory();
                clearConflictHighlights();
                initStaffData();
                renderInputTable();
                showToast('🧹 全消去しました（「↩ 戻る」で元に戻せます）');
            }
        });
    }

    // ★ 入力シート内の「⚡ 勤務表を自動生成する」ボタン連携
    const inputSolveBtn = document.getElementById('inputSolveBtn');
    if (inputSolveBtn && solveBtn) {
        inputSolveBtn.addEventListener('click', () => {
            solveBtn.click();
        });
    }

    // ★ 入力シート内の「🧹 全消去」ボタン連携
    const inputClearBtn = document.getElementById('inputClearBtn');
    if (inputClearBtn && clearAllBtn) {
        inputClearBtn.addEventListener('click', () => {
            clearAllBtn.click();
        });
    }

    // ★ 戻る（Undo） / やり直す（Redo） ボタンイベント
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.addEventListener('click', undo);

    const headerUndoBtn = document.getElementById('headerUndoBtn');
    if (headerUndoBtn) headerUndoBtn.addEventListener('click', undo);

    const outputUndoBtn = document.getElementById('outputUndoBtn');
    if (outputUndoBtn) outputUndoBtn.addEventListener('click', undo);

    const checkUndoBtn = document.getElementById('checkUndoBtn');
    if (checkUndoBtn) checkUndoBtn.addEventListener('click', undo);

    const redoBtn = document.getElementById('redoBtn');
    if (redoBtn) redoBtn.addEventListener('click', redo);

    const outputRedoBtn = document.getElementById('outputRedoBtn');
    if (outputRedoBtn) outputRedoBtn.addEventListener('click', redo);

    const checkRedoBtn = document.getElementById('checkRedoBtn');
    if (checkRedoBtn) checkRedoBtn.addEventListener('click', redo);

    // ★ 左右スクロールナビゲーションボタン（入力シート・出力シート共通）
    document.querySelectorAll('.scroll-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            const dir = btn.dataset.dir;
            const wrapper = document.getElementById(targetId);
            if (!wrapper) return;
            const scrollDistance = Math.max(320, Math.floor(wrapper.clientWidth * 0.65));
            wrapper.scrollBy({
                left: dir === 'left' ? -scrollDistance : scrollDistance,
                behavior: 'smooth'
            });
        });
    });

    // ★ キーボードショートカット (Ctrl+Z: 戻る / Ctrl+Y: やり直す)
    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            // テキスト入力欄にフォーカスがある時はブラウザ標準の文字Undoに委ねる
            return;
        }

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
            e.preventDefault();
            redo();
        }
    });

    // トースト通知関数
    function showToast(message, type = 'success') {
        let toast = document.getElementById('appToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'appToast';
            toast.className = 'app-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `app-toast show ${type}`;
        setTimeout(() => {
            toast.className = 'app-toast';
        }, 3500);
    }

    // 列インデックス (0 = A, 2 = C, 29 = AD, etc.) からExcel列名 (A, B, C, ..., AD) を取得
    function getExcelColName(colIdx) {
        let name = '';
        let num = colIdx + 1;
        while (num > 0) {
            let mod = (num - 1) % 26;
            name = String.fromCharCode(65 + mod) + name;
            num = Math.floor((num - mod) / 26);
        }
        return name;
    }

    // 1. ★ Excel用出勤カウント数式ジェネレーター（共通関数）
    function makeWorkCountFormula(rngStr) {
        return `COUNTIF(${rngStr},"○")+COUNTIF(${rngStr},"〇")+COUNTIF(${rngStr},"◯")+COUNTIF(${rngStr},"出")+COUNTIF(${rngStr},"早")+COUNTIF(${rngStr},"遅")+COUNTIF(${rngStr},"E")+COUNTIF(${rngStr},"8時")+COUNTIF(${rngStr},"ハヤ")+COUNTIF(${rngStr},"オソ")+COUNTIF(${rngStr},"イブ")+0.5*(COUNTIF(${rngStr},"○/休")+COUNTIF(${rngStr},"〇/休")+COUNTIF(${rngStr},"休/○")+COUNTIF(${rngStr},"休/〇")+COUNTIF(${rngStr},"○/有")+COUNTIF(${rngStr},"〇/有")+COUNTIF(${rngStr},"有/○")+COUNTIF(${rngStr},"有/〇"))`;
    }

    // ★ Excel出力用HTMLテーブル生成（エクスポート・コピペ共通：A列Noなし、列幅・行高・全集計行・ST挿入自動追従数式）
    function generateExcelTableHtml(grid, stats) {
        const term = getTermInfo();
        const borderThin = 'border:0.5pt solid #cbd5e1;';
        const borderThickR = 'border-right:2pt solid #475569;';
        const borderMediumR = 'border-right:1.5pt solid #64748b;';
        const borderThickB = 'border-bottom:2pt solid #475569;';

        const validStaffIndices = [];
        for (let s = 0; s < NUM_STAFF; s++) {
            if (!staffList[s].isUnused) validStaffIndices.push(s);
        }

        const startRow = 4;
        const endRow = startRow + validStaffIndices.length - 1;
        const stStartRow = endRow + 1; // 48名構成なら52行目（STが挟まれる開始行）

        // セクション別範囲（PT A, PT B, OT A, OT B）の開始・終了行番号を計算
        let ptAStart = startRow, ptAEnd = startRow;
        let ptBStart = startRow, ptBEnd = startRow;
        let otAStart = startRow, otAEnd = startRow;
        let otBStart = startRow, otBEnd = startRow;

        validStaffIndices.forEach((s, outIdx) => {
            const rowNum = startRow + outIdx;
            const sec = staffList[s].section;
            if (sec === 'PT A') {
                if (ptAStart === startRow && outIdx !== 0 && staffList[validStaffIndices[0]].section !== 'PT A') ptAStart = rowNum;
                ptAEnd = rowNum;
            } else if (sec === 'PT B') {
                if (ptBStart === startRow) ptBStart = rowNum;
                ptBEnd = rowNum;
            } else if (sec === 'OT A') {
                if (otAStart === startRow) otAStart = rowNum;
                otAEnd = rowNum;
            } else if (sec === 'OT B') {
                if (otBStart === startRow) otBStart = rowNum;
                otBEnd = rowNum;
            }
        });
        if (ptAEnd === startRow && validStaffIndices.length >= 48) {
            ptAStart = 4; ptAEnd = 15;
            ptBStart = 16; ptBEnd = 27;
            otAStart = 28; otAEnd = 39;
            otBStart = 40; otBEnd = 51;
        }

        let tableHtml = `<table style="border-collapse:collapse; font-family:'Meiryo', 'Yu Gothic', sans-serif; font-size:10pt; border:2pt solid #475569;">
<colgroup>
  <col style="width:175px;">
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            tableHtml += `  <col style="width:115px;">\n`;
        }
        tableHtml += `  <col style="width:105px;">
  <col style="width:105px;">
  <col style="width:105px;">
  <col style="width:75px;">
  <col style="width:75px;">
  <col style="width:75px;">
  <col style="width:75px;">
  <col style="width:75px;">
</colgroup>
<thead>
  <tr style="height:35px;">
    <th rowspan="2" style="width:175px; min-width:175px; max-width:175px; background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickR} ${borderThickB} text-align:center;">氏名</th>
    <th colspan="${NUM_DAYS}" style="background-color:#f8fafc; color:#1e293b; font-weight:bold; font-size:11pt; ${borderThin} ${borderThickR} ${borderThickB} text-align:center;">${term.title}</th>
    <th colspan="8" style="background-color:#e0f2fe; color:#0369a1; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">勤務・休暇 集計</th>
  </tr>
  <tr style="height:35px;">
`;

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const bg = di.wIdx === 5 ? '#e0f2fe' : (di.wIdx === 6 || di.isHoliday ? '#ffe4e6' : '#f1f5f9');
            const col = di.wIdx === 5 ? '#0284c7' : (di.wIdx === 6 || di.isHoliday ? '#e11d48' : '#1e293b');
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            tableHtml += `    <th style="width:115px; min-width:115px; max-width:115px; background-color:${bg}; color:${col}; font-weight:bold; ${borderThin} ${rightBorder} ${borderThickB} text-align:center;">${di.label}<br><small>${di.weekday}</small></th>\n`;
        }

        tableHtml += `    <th style="width:105px; background-color:#f1f5f9; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">出勤</th>
    <th style="width:105px; background-color:#f1f5f9; color:#000000; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">公休</th>
    <th style="width:105px; background-color:#f1f5f9; color:#000000; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">有休</th>
    <th style="width:75px; background-color:#f1f5f9; color:#000000; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">リフ</th>
    <th style="width:75px; min-width:75px; max-width:75px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">早</th>
    <th style="width:75px; min-width:75px; max-width:75px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">遅</th>
    <th style="width:75px; min-width:75px; max-width:75px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">E</th>
    <th style="width:75px; min-width:75px; max-width:75px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">8時</th>
  </tr>
</thead>
<tbody>
`;

        validStaffIndices.forEach((s, outIdx) => {
            const staff = staffList[s];
            const isLast = (outIdx === validStaffIndices.length - 1);
            const rowBottom = isLast ? borderThickB : '';

            tableHtml += `  <tr style="height:33px;">\n`;
            tableHtml += `    <td style="width:175px; min-width:175px; max-width:175px; height:33px; text-align:left; font-weight:bold; ${borderThin} ${borderThickR} ${rowBottom} padding-left:8px;">${staff.name}</td>\n`;

            for (let d = 0; d < NUM_DAYS; d++) {
                const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '', isFixed: false };
                let rawSym = cell.symbol || '';
                let sym = rawSym.replace(/[◦•･◯○●]/g, '〇');
                const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
                if (cell.isFixed) {
                    tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:33px; color:#DC2626 !important; font-weight:bold !important; background-color:transparent !important; ${borderThin} ${rightBorder} ${rowBottom} text-align:center; mso-number-format:'\\@';"><b style="color:#DC2626;">${sym}</b></td>\n`;
                } else {
                    tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:33px; color:#1E293B !important; font-weight:normal; ${borderThin} ${rightBorder} ${rowBottom} text-align:center; mso-number-format:'\\@';">${sym}</td>\n`;
                }
            }

            const rowNum = startRow + outIdx;
            const rng = `B${rowNum}:AC${rowNum}`;

            const fWork = `=${makeWorkCountFormula(rng)}`;
            const fOff = `=COUNTIF(${rng},"休")+0.5*(COUNTIF(${rng},"○/休")+COUNTIF(${rng},"〇/休")+COUNTIF(${rng},"休/○")+COUNTIF(${rng},"休/〇"))`;
            const fPaid = `=COUNTIF(${rng},"有")+0.5*(COUNTIF(${rng},"○/有")+COUNTIF(${rng},"〇/有")+COUNTIF(${rng},"有/○")+COUNTIF(${rng},"有/〇"))`;
            const fRef = `=COUNTIF(${rng},"上1")+COUNTIF(${rng},"上2")+COUNTIF(${rng},"上3")+COUNTIF(${rng},"上4")+COUNTIF(${rng},"上5")+COUNTIF(${rng},"下1")+COUNTIF(${rng},"下2")+COUNTIF(${rng},"下3")`;
            const fEarly = `=COUNTIF(${rng},"早")+COUNTIF(${rng},"ハヤ")`;
            const fLate = `=COUNTIF(${rng},"遅")+COUNTIF(${rng},"オソ")`;
            const fEve = `=COUNTIF(${rng},"E")+COUNTIF(${rng},"イブ")`;
            const fH8 = `=COUNTIF(${rng},"8時")`;

            tableHtml += `    <td style="width:105px; height:33px; font-weight:bold; ${borderThin} ${rowBottom} text-align:center;">${fWork}</td>
    <td style="width:105px; height:33px; font-weight:bold; color:#000000; ${borderThin} ${rowBottom} text-align:center;">${fOff}</td>
    <td style="width:105px; height:33px; font-weight:bold; color:#000000; background-color:transparent; ${borderThin} ${rowBottom} text-align:center;">${fPaid}</td>
    <td style="width:75px; height:33px; font-weight:bold; color:#000000; ${borderThin} ${rowBottom} text-align:center;">${fRef}</td>
    <td style="width:75px; min-width:75px; max-width:75px; height:33px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fEarly}</td>
    <td style="width:75px; min-width:75px; max-width:75px; height:33px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fLate}</td>
    <td style="width:75px; min-width:75px; max-width:75px; height:33px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fEve}</td>
    <td style="width:75px; min-width:75px; max-width:75px; height:33px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fH8}</td>
  </tr>\n`;
        });

        tableHtml += `</tbody>\n<tfoot>\n`;

        // 1. 出勤人数合計（行高38px固定）
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; ${borderThin} ${borderThickR} border-bottom:1pt solid #64748b; font-weight:bold; text-align:center;">出勤人数合計</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fDayWork = `=${makeWorkCountFormula(`INDIRECT("${col}$4:${col}"&(ROW()-1))`)}`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:1pt solid #64748b; text-align:center;">${fDayWork}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; font-weight:bold; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AD$4:AD"&(ROW()-1)))</td>
    <td style="width:105px; height:38px; font-weight:bold; color:#000000; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AE$4:AE"&(ROW()-1)))</td>
    <td style="width:105px; height:38px; font-weight:bold; color:#000000; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AF$4:AF"&(ROW()-1)))</td>
    <td style="width:75px; height:38px; font-weight:bold; color:#000000; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AG$4:AG"&(ROW()-1)))</td>
    <td style="width:75px; min-width:75px; max-width:75px; height:38px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AH$4:AH"&(ROW()-1)))</td>
    <td style="width:75px; min-width:75px; max-width:75px; height:38px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AI$4:AI"&(ROW()-1)))</td>
    <td style="width:75px; min-width:75px; max-width:75px; height:38px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AJ$4:AJ"&(ROW()-1)))</td>
    <td style="width:75px; min-width:75px; max-width:75px; height:38px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AK$4:AK"&(ROW()-1)))</td>
  </tr>
`;

        // 2. 実数合計（行高38px固定）
        const realRowIdx = endRow + 2;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; font-weight:bold; text-align:center;">実数合計</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const offset = (dayOffsets && dayOffsets[d]) ? dayOffsets[d] : 0;
            const fReal = (offset > 0) ? `=INDIRECT("${col}"&(ROW()-1))-(${offset})` : `=INDIRECT("${col}"&(ROW()-1))`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fReal}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${realRowIdx}:AC${realRowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 3. PT A 出勤
        const ptARowIdx = endRow + 3;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#ea580c; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">PT A 出勤</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fPtA = `=${makeWorkCountFormula(`${col}$${ptAStart}:${col}$${ptAEnd}`)}`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#ea580c; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fPtA}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#ea580c; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${ptARowIdx}:AC${ptARowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 4. OT A 出勤
        const otARowIdx = endRow + 4;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#ea580c; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">OT A 出勤</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fOtA = `=${makeWorkCountFormula(`${col}$${otAStart}:${col}$${otAEnd}`)}`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#ea580c; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fOtA}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#ea580c; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${otARowIdx}:AC${otARowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 5. PT B 出勤
        const ptBRowIdx = endRow + 5;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#1d4ed8; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">PT B 出勤</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fPtB = `=${makeWorkCountFormula(`${col}$${ptBStart}:${col}$${ptBEnd}`)}`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#1d4ed8; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fPtB}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#1d4ed8; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${ptBRowIdx}:AC${ptBRowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 6. OT B 出勤
        const otBRowIdx = endRow + 6;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#1d4ed8; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">OT B 出勤</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fOtB = `=${makeWorkCountFormula(`${col}$${otBStart}:${col}$${otBEnd}`)}`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#1d4ed8; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fOtB}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#1d4ed8; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${otBRowIdx}:AC${otBRowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 7. ST 出勤（51と52の間にSTが挟まれた場合に自動追従・集計）
        const stRowIdx = endRow + 7;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#ec4899; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">ST 出勤</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fSt = `=IF((ROW()-7)<${stStartRow},0,${makeWorkCountFormula(`INDIRECT("${col}\$${stStartRow}:${col}"&(ROW()-7))`)} )`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#ec4899; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fSt}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#ec4899; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${stRowIdx}:AC${stRowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 8. 早番
        const earlyRowIdx = endRow + 8;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">早番</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fEarly = `=COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-8)),"早")+COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-8)),"ハヤ")`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fEarly}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#334155; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${earlyRowIdx}:AC${earlyRowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 9. 遅番
        const lateRowIdx = endRow + 9;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">遅番</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fLate = `=COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-9)),"遅")+COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-9)),"オソ")`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fLate}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#334155; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${lateRowIdx}:AC${lateRowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 10. E
        const eveRowIdx = endRow + 10;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">E</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fEve = `=COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-10)),"E")+COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-10)),"イブ")`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fEve}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#334155; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${eveRowIdx}:AC${eveRowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center; color:#94a3b8;">-</td>
  </tr>
`;

        // 11. 8時
        const h8RowIdx = endRow + 11;
        tableHtml += `  <tr style="height:38px; background-color:#ffffff;">
    <th style="width:175px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${borderThickR} ${borderThickB} text-align:center;">8時</th>
`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = getExcelColName(d + 1);
            const rightBorder = ((d + 1) === NUM_DAYS) ? borderThickR : (((d + 1) % 7 === 0) ? borderMediumR : '');
            const fH8 = `=COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-11)),"8時")`;
            tableHtml += `    <td style="width:115px; min-width:115px; max-width:115px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${rightBorder} ${borderThickB} text-align:center;">${fH8}</td>\n`;
        }
        tableHtml += `    <td style="width:105px; height:38px; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">=SUM(B${h8RowIdx}:AC${h8RowIdx})</td>
    <td colspan="7" style="height:38px; ${borderThin} ${borderThickB}; text-align:center; color:#94a3b8;">-</td>
  </tr>
</tfoot>
</table>`;

        return tableHtml;
    }

    // 2. ★ Excel貼り付け用コピー処理（安全フェイルセーフ対応）
    const copyForExcelBtn = document.getElementById('copyForExcelBtn');
    if (copyForExcelBtn) {
        copyForExcelBtn.addEventListener('click', () => {
            safeCopyForExcel();
        });
    }

    const checkCopyForExcelBtn = document.getElementById('checkCopyForExcelBtn');
    if (checkCopyForExcelBtn) {
        checkCopyForExcelBtn.addEventListener('click', () => {
            safeCopyForExcel();
        });
    }

    function safeCopyForExcel() {
        try {
            let gridToCopy = null;
            let statsToCopy = null;

            if (lastSolveResult && lastSolveResult.grid) {
                gridToCopy = lastSolveResult.grid;
                statsToCopy = lastSolveResult.stats;
            } else if (lastScheduler && lastScheduler.grid) {
                gridToCopy = lastScheduler.grid;
                statsToCopy = lastScheduler.calculateStats();
            } else {
                const term = getTermInfo();
                const stdVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                const scheduler = new ShiftScheduler(staffList, {
                    standardHolidays: stdVal,
                    dates: term.dates,
                    dayOffsets: [...dayOffsets]
                });
                gridToCopy = scheduler.grid;
                statsToCopy = scheduler.calculateStats();
            }

            copyForExcel(gridToCopy, statsToCopy);
        } catch (err) {
            console.error('コピーエラー:', err);
            showToast('⚠️ コピー中にエラーが発生しました: ' + err.message);
        }
    }

    function copyForExcel(grid, stats) {
        const tableHtml = generateExcelTableHtml(grid, stats);
        try {
            const blobHtml = new Blob([tableHtml], { type: 'text/html' });
            const blobText = new Blob([tableHtml.replace(/<[^>]+>/g, '\t')], { type: 'text/plain' });
            const item = new ClipboardItem({
                'text/html': blobHtml,
                'text/plain': blobText
            });

            navigator.clipboard.write([item]).then(() => {
                showToast('📋 コピー完了！Excelを開いて Ctrl + V で貼り付けてください（列幅固定・赤字太字・自動計算数式がそのまま反映されます）');
            }).catch(err => {
                fallbackCopyText(tableHtml);
            });
        } catch (e) {
            fallbackCopyText(tableHtml);
        }
    }



    // ==========================================
    // 3. ★ スタッフ入力用 空白勤務表 (.xlsx) のダウンロード（プルダウン付き）
    // ==========================================
    // ZIPアーカイブ生成用 CRC32 テーブル
    const zipCrcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        zipCrcTable[n] = c;
    }
    function calcZipCrc32(buf) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < buf.length; i++) {
            crc = (crc >>> 8) ^ zipCrcTable[(crc ^ buf[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // 純粋なJavaScript（外部ライブラリゼロ）によるZIPアーカイブ（Store非圧縮）生成
    function createZipUint8Array(files) {
        const textEncoder = new TextEncoder();
        const fileEntries = files.map(f => {
            const nameBytes = textEncoder.encode(f.name);
            const dataBytes = (typeof f.data === 'string') ? textEncoder.encode(f.data) : f.data;
            return {
                name: f.name,
                nameBytes,
                dataBytes,
                crc: calcZipCrc32(dataBytes),
                size: dataBytes.length
            };
        });

        let localHeadersSize = 0;
        fileEntries.forEach(f => {
            f.offset = localHeadersSize;
            localHeadersSize += 30 + f.nameBytes.length + f.size;
        });

        let centralDirSize = 0;
        fileEntries.forEach(f => {
            centralDirSize += 46 + f.nameBytes.length;
        });

        const totalSize = localHeadersSize + centralDirSize + 22;
        const buf = new Uint8Array(totalSize);
        const view = new DataView(buf.buffer);
        let pos = 0;

        // Local headers & Data
        fileEntries.forEach(f => {
            view.setUint32(pos, 0x04034b50, true); pos += 4;
            view.setUint16(pos, 20, true); pos += 2;
            view.setUint16(pos, 0x0800, true); pos += 2; // UTF-8
            view.setUint16(pos, 0, true); pos += 2; // store (0)
            view.setUint16(pos, 0x4a21, true); pos += 2;
            view.setUint16(pos, 0x5894, true); pos += 2;
            view.setUint32(pos, f.crc, true); pos += 4;
            view.setUint32(pos, f.size, true); pos += 4;
            view.setUint32(pos, f.size, true); pos += 4;
            view.setUint16(pos, f.nameBytes.length, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            buf.set(f.nameBytes, pos); pos += f.nameBytes.length;
            buf.set(f.dataBytes, pos); pos += f.size;
        });

        // Central Directory
        const cdOffset = pos;
        fileEntries.forEach(f => {
            view.setUint32(pos, 0x02014b50, true); pos += 4;
            view.setUint16(pos, 20, true); pos += 2;
            view.setUint16(pos, 20, true); pos += 2;
            view.setUint16(pos, 0x0800, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint16(pos, 0x4a21, true); pos += 2;
            view.setUint16(pos, 0x5894, true); pos += 2;
            view.setUint32(pos, f.crc, true); pos += 4;
            view.setUint32(pos, f.size, true); pos += 4;
            view.setUint32(pos, f.size, true); pos += 4;
            view.setUint16(pos, f.nameBytes.length, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint16(pos, 0, true); pos += 2;
            view.setUint32(pos, 0, true); pos += 4;
            view.setUint32(pos, f.offset, true); pos += 4;
            buf.set(f.nameBytes, pos); pos += f.nameBytes.length;
        });

        // End of Central Directory (EOCD)
        view.setUint32(pos, 0x06054b50, true); pos += 4;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, fileEntries.length, true); pos += 2;
        view.setUint16(pos, fileEntries.length, true); pos += 2;
        view.setUint32(pos, centralDirSize, true); pos += 4;
        view.setUint32(pos, cdOffset, true); pos += 4;
        view.setUint16(pos, 0, true); pos += 2;

        return buf;
    }

    // 列番号（1-based）からExcel列記号（A, B, ..., Z, AA, ..., AM）への変換
    function toColLetter(colIdx) {
        let temp = colIdx;
        let letter = '';
        while (temp > 0) {
            let rem = (temp - 1) % 26;
            letter = String.fromCharCode(65 + rem) + letter;
            temp = Math.floor((temp - 1) / 26);
        }
        return letter;
    }

    // スタッフ入力用 空白勤務表 (.xlsx) のダウンロード実行
    const downloadBlankTemplateBtn = document.getElementById('downloadBlankTemplateBtn');
    if (downloadBlankTemplateBtn) {
        downloadBlankTemplateBtn.addEventListener('click', () => {
            downloadBlankXlsx();
        });
    }

    function downloadBlankXlsx() {
        const term = getTermInfo();
        const numDays = term.dates.length;
        const title = `${term.first.m}月${term.first.day}日～${term.last.m}月${term.last.day}日 スタッフ希望勤務入力シート（希望勤務はプルダウンから選択してください）`;

        const lastDayCol = toColLetter(2 + numDays); // 28日: AD(列30), 29日: AE(列31)
        const colOff = toColLetter(3 + numDays);    // 28日: AE(列31), 29日: AF(列32)
        const colPaid = toColLetter(4 + numDays);   // 28日: AF(列32), 29日: AG(列33)
        const colRemarks = toColLetter(5 + numDays);// 28日: AG(列33), 29日: AH(列34)

        const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

        const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="希望入力シート" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

        const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

        const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="12"/><name val="游ゴシック"/><color rgb="1E293B"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/><color rgb="DC2626"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="EFF6FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FEF2F2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F0FDF4"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="thin"><color rgb="CBD5E1"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="thin"><color rgb="CBD5E1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

        // sheet1.xml の組み立て
        let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="5" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="${2 + numDays}" width="6" customWidth="1"/>
    <col min="${3 + numDays}" max="${4 + numDays}" width="11" customWidth="1"/>
    <col min="${5 + numDays}" max="${5 + numDays}" width="162" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="24" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>${title}</t></is></c>
    </row>
    <row r="2" ht="22" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>No</t></is></c>
      <c r="B2" s="2" t="inlineStr"><is><t>氏名</t></is></c>`;

        // 日付ヘッダー (C2〜)
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const colLetter = toColLetter(3 + d);
            const dateStr = `${di.m}/${di.day}`;
            sheet1 += `\n      <c r="${colLetter}2" s="2" t="inlineStr"><is><t>${dateStr}</t></is></c>`;
        }
        sheet1 += `\n      <c r="${colOff}2" s="2" t="inlineStr"><is><t>希望休数</t></is></c>`;
        sheet1 += `\n      <c r="${colPaid}2" s="2" t="inlineStr"><is><t>希望有休数</t></is></c>`;
        sheet1 += `\n      <c r="${colRemarks}2" s="2" t="inlineStr"><is><t>備考</t></is></c>`;
        sheet1 += `\n    </row>`;

        // 3行目: 曜日ヘッダー行
        sheet1 += `\n    <row r="3" ht="20" customHeight="1">
      <c r="A3" s="2"/>
      <c r="B3" s="2"/>`;
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const colLetter = toColLetter(3 + d);
            let sIdx = 2; // 平日
            if (di.weekday === '土' || di.wIdx === 5) sIdx = 3;
            else if (di.weekday === '日' || di.wIdx === 6 || di.isHoliday) sIdx = 4;
            sheet1 += `\n      <c r="${colLetter}3" s="${sIdx}" t="inlineStr"><is><t>${di.weekday || di.w}</t></is></c>`;
        }
        sheet1 += `\n      <c r="${colOff}3" s="2"/>
      <c r="${colPaid}3" s="2"/>
      <c r="${colRemarks}3" s="2"/>
    </row>`;

        // 有効スタッフのみ抽出
        const validStaff = staffList.filter(s => !s.isUnused);
        const maxRow = 3 + validStaff.length;

        // データ行（row 4〜: 希望枠は完全空欄）
        validStaff.forEach((staff, idx) => {
            const r = idx + 4;
            sheet1 += `\n    <row r="${r}" ht="20" customHeight="1">
      <c r="A${r}" s="5"><v>${idx + 1}</v></c>
      <c r="B${r}" s="6" t="inlineStr"><is><t>${escapeXmlText(staff.name)}</t></is></c>`;

            for (let d = 0; d < numDays; d++) {
                const colLetter = toColLetter(3 + d);
                sheet1 += `\n      <c r="${colLetter}${r}" s="5"/>`;
            }

            const rng = `C${r}:${lastDayCol}${r}`;
            const fOff = `COUNTIF(${rng},&quot;休&quot;)+0.5*(COUNTIF(${rng},&quot;○/休&quot;)+COUNTIF(${rng},&quot;〇/休&quot;)+COUNTIF(${rng},&quot;休/○&quot;)+COUNTIF(${rng},&quot;休/〇&quot;))`;
            const fPaid = `COUNTIF(${rng},&quot;有&quot;)+0.5*(COUNTIF(${rng},&quot;○/有&quot;)+COUNTIF(${rng},&quot;〇/有&quot;)+COUNTIF(${rng},&quot;有/○&quot;)+COUNTIF(${rng},&quot;有/〇&quot;))`;
            sheet1 += `\n      <c r="${colOff}${r}" s="7"><f>${fOff}</f><v>0</v></c>
      <c r="${colPaid}${r}" s="7"><f>${fPaid}</f><v>0</v></c>
      <c r="${colRemarks}${r}" s="6" t="inlineStr"><is><t>${escapeXmlText(staff.remarks || '')}</t></is></c>
    </row>`;
        });

        sheet1 += `\n  </sheetData>`;

        // ドロップダウンリスト（プルダウンデータ入力規則）を C4:{lastDayCol}{maxRow} に適用
        sheet1 += `\n  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="C4:${lastDayCol}${maxRow}" promptTitle="希望勤務の選択" prompt="プルダウンから希望勤務記号を選択してください。" errorTitle="入力値エラー" error="一覧（プルダウン）にある記号のみ入力できます。">
      <formula1>&quot;休,有,○,出,早,遅,E,8時,ハヤ,オソ,イブ,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3,ー&quot;</formula1>
    </dataValidation>
  </dataValidations>`;
        sheet1 += `\n  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>\n</worksheet>`;

        const files = [
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rels },
            { name: 'xl/workbook.xml', data: workbook },
            { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
            { name: 'xl/styles.xml', data: styles },
            { name: 'xl/worksheets/sheet1.xml', data: sheet1 }
        ];

        const zipBuf = createZipUint8Array(files);
        const blob = new Blob([zipBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${title.split('（')[0].replace(/\s+/g, '')}.xlsx`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 2000);
        showToast('📄 スタッフ配布用の空白勤務表（.xlsx）をダウンロードしました！');
    }
    function normalizeSymbol(val) {
        if (!val) return null;
        let s = val.toString().trim();
        if (!s) return null;

        // 表記揺れの自動吸収
        if (s === '公休' || s === '公' || s === '休日') return '休';
        if (s === '有休' || s === '有給' || s === '年休') return '有';
        if (s === '〇' || s === '◯' || s === '◦' || s === '•' || s === '･' || s === '●' || s === '日勤' || s === '日' || s === 'O' || s === 'o' || s === '○') return '○';
        if (s === '出張') return '出';
        if (s === '早番') return '早';
        if (s === '遅番') return '遅';
        if (s === 'イブニング' || s === 'Ｅ' || s === 'e') return 'E';
        if (s === '8' || s === '８' || s === '8:00') return '8時';
        if (s === 'ハヤ' || s === 'はや') return 'ハヤ';
        if (s === 'オソ' || s === 'おそ') return 'オソ';
        if (s === 'イブ' || s === 'いぶ') return 'イブ';

        // 半日勤務の揺れ
        s = s.replace(/[〇◯◦•･●]/g, '○').replace(/公休/g, '休').replace(/有休/g, '有');
        if (s === '○/休' || s === '休/○' || s === '○/有' || s === '有/○') return s;

        // リフレッシュ休暇（全角数字を半角に変換）
        s = s.replace(/[１-５]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));
        if (/^[上下][1-5]$/.test(s)) return s;

        if (ALLOWED_SYMBOLS.has(s)) return s;
        return null;
    }

    // ==========================================
    // 希望勤務データのグリッド反映処理（赤字・太字・変更不可ロック）
    // ==========================================
    function applyScheduleImport(extractedItems, mode = 'merge', remarksMap = null) {
        const term = getTermInfo();
        // mode: 'replace' の場合は既存の入力希望を一度クリア
        if (mode === 'replace') {
            for (let s = 0; s < NUM_STAFF; s++) {
                for (let d = 0; d < NUM_DAYS; d++) {
                    staffList[s].days[d] = '';
                }
            }
        }

        if (remarksMap && typeof remarksMap === 'object') {
            Object.keys(remarksMap).forEach(sIdxStr => {
                const sIdx = parseInt(sIdxStr, 10);
                if (staffList[sIdx]) {
                    staffList[sIdx].remarks = cleanTextValue(remarksMap[sIdxStr]);
                }
            });
        }

        let updatedCount = 0;
        const affectedStaff = new Set();

        extractedItems.forEach(item => {
            const { staffIdx, dayIdx, symbol } = item;
            if (staffIdx >= 0 && staffIdx < NUM_STAFF && dayIdx >= 0 && dayIdx < NUM_DAYS) {
                const norm = normalizeSymbol(symbol);
                if (norm) {
                    staffList[staffIdx].days[dayIdx] = norm;
                    updatedCount++;
                    affectedStaff.add(staffIdx);
                } else if (mode === 'replace' && (!symbol || symbol === '')) {
                    staffList[staffIdx].days[dayIdx] = '';
                }
            }
        });

        // テーブル再描画 ＆ 自動保存
        renderInputTable();
        const modeText = mode === 'replace' ? '（既存枠クリア済み）' : '';
        saveStaffMaster();
        saveCurrentTermToStorage();
        if (updatedCount === 0) {
            showToast(`📄 【${term.title}】事前希望枠を全クリア（白紙）にしました`);
        } else {
            showToast(`🎉 【${term.title}】${affectedStaff.size}名・計${updatedCount}件の希望勤務を取り込みました${modeText}`);
        }
    }

    // ★ XMLノードから <rPh>（日本語Excelが自動付与する「ふりがな」タグ）を完全除外してテキストのみを抽出するヘルパー
    function extractXmlTextWithoutPhonetic(node) {
        if (!node) return '';
        const clone = node.cloneNode(true);
        // <rPh>（ふりがな要素）を削除してから <t> を連結する（これで「委員会イインカイ」等の文字化けを100%防止）
        const rPhNodes = clone.getElementsByTagName('rPh');
        while (rPhNodes.length > 0) {
            if (rPhNodes[0].parentNode) {
                rPhNodes[0].parentNode.removeChild(rPhNodes[0]);
            } else {
                break;
            }
        }
        const tNodes = clone.getElementsByTagName('t');
        let str = '';
        if (tNodes.length > 0) {
            for (let j = 0; j < tNodes.length; j++) {
                str += tNodes[j].textContent;
            }
        } else {
            str = clone.textContent || '';
        }
        return cleanTextValue(str);
    }

    // ★ CSV / TSV ファイルの自動文字コード判定読み込み（UTF-8 / Shift-JIS 自動判別）
    async function readTextFileAutoEncoding(file) {
        const buf = await file.arrayBuffer();
        const uint8 = new Uint8Array(buf);
        try {
            // まず UTF-8 (fatal: true) でデコードを試みる
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            return utf8Decoder.decode(uint8);
        } catch (e) {
            // 日本語版Excelが出力した Shift-JIS (CP932) CSV の場合は Shift-JIS でデコード
            try {
                const sjisDecoder = new TextDecoder('shift-jis');
                return sjisDecoder.decode(uint8);
            } catch (e2) {
                return new TextDecoder().decode(uint8);
            }
        }
    }

    // ==========================================
    // 純粋JSによる .xlsx 解凍＆パース処理（ふりがな除去・28/29日動的列対応）
    // ==========================================
    async function parseXlsxBuffer(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(bytes.buffer);
        const textDecoder = new TextDecoder('utf-8');
        const entries = {};

        // Central Directory から正確な圧縮サイズ・オフセットを取得（Excel上書き保存時の Data Descriptor にも対応）
        const cdEntries = [];
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                const totalEntries = view.getUint16(i + 10, true);
                let cdPos = view.getUint32(i + 16, true);
                for (let e = 0; e < totalEntries && cdPos < bytes.length - 46; e++) {
                    if (view.getUint32(cdPos, true) !== 0x02014b50) break;
                    const method = view.getUint16(cdPos + 10, true);
                    const compSize = view.getUint32(cdPos + 20, true);
                    const nameLen = view.getUint16(cdPos + 28, true);
                    const extraLen = view.getUint16(cdPos + 30, true);
                    const commentLen = view.getUint16(cdPos + 32, true);
                    const localOffset = view.getUint32(cdPos + 42, true);
                    const name = textDecoder.decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen));
                    cdEntries.push({ name, method, compSize, localOffset });
                    cdPos += 46 + nameLen + extraLen + commentLen;
                }
                break;
            }
        }

        async function inflateEntry(method, compData) {
            if (method === 0) return compData;
            if (method === 8 && typeof DecompressionStream !== 'undefined') {
                try {
                    const ds = new DecompressionStream('deflate-raw');
                    const writer = ds.writable.getWriter();
                    writer.write(compData);
                    writer.close();
                    const reader = ds.readable.getReader();
                    const chunks = [];
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                    }
                    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
                    const decompData = new Uint8Array(totalLen);
                    let off = 0;
                    for (const c of chunks) {
                        decompData.set(c, off);
                        off += c.length;
                    }
                    return decompData;
                } catch (e) {
                    console.warn('Decompress error', e);
                }
            }
            return null;
        }

        if (cdEntries.length > 0) {
            for (const ce of cdEntries) {
                const pos = ce.localOffset;
                if (pos + 30 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
                    const nameLen = view.getUint16(pos + 26, true);
                    const extraLen = view.getUint16(pos + 28, true);
                    const dataStart = pos + 30 + nameLen + extraLen;
                    const compData = bytes.subarray(dataStart, dataStart + ce.compSize);
                    const decompData = await inflateEntry(ce.method, compData);
                    if (decompData) {
                        entries[ce.name] = textDecoder.decode(decompData);
                    }
                }
            }
        } else {
            let pos = 0;
            while (pos < bytes.length - 4) {
                const sig = view.getUint32(pos, true);
                if (sig === 0x04034b50) {
                    const method = view.getUint16(pos + 8, true);
                    const compSize = view.getUint32(pos + 18, true);
                    const nameLen = view.getUint16(pos + 26, true);
                    const extraLen = view.getUint16(pos + 28, true);
                    const name = textDecoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
                    const dataStart = pos + 30 + nameLen + extraLen;
                    const compData = bytes.subarray(dataStart, dataStart + compSize);
                    const decompData = await inflateEntry(method, compData);
                    if (decompData) {
                        entries[name] = textDecoder.decode(decompData);
                    }
                    pos = dataStart + (compSize || 1);
                } else {
                    pos++;
                }
            }
        }

        // sharedStrings.xml の抽出（★ <rPh> ふりがなタグを完全除外！）
        const sharedStrings = [];
        if (entries['xl/sharedStrings.xml']) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(entries['xl/sharedStrings.xml'], 'text/xml');
            const siNodes = xmlDoc.getElementsByTagName('si');
            for (let i = 0; i < siNodes.length; i++) {
                sharedStrings.push(extractXmlTextWithoutPhonetic(siNodes[i]));
            }
        }

        const sheetXml = entries['xl/worksheets/sheet1.xml'];
        if (!sheetXml) {
            throw new Error('Excelシート（sheet1.xml）が見つかりませんでした。');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(sheetXml, 'text/xml');
        const cNodes = xmlDoc.getElementsByTagName('c');

        function getCellText(c) {
            const t = c.getAttribute('t');
            if (t === 's') {
                const vNode = c.getElementsByTagName('v')[0];
                if (vNode) return sharedStrings[parseInt(vNode.textContent, 10)] || '';
                return '';
            } else if (t === 'inlineStr') {
                const isNode = c.getElementsByTagName('is')[0];
                return extractXmlTextWithoutPhonetic(isNode || c);
            } else if (t === 'str') {
                const vNode = c.getElementsByTagName('v')[0];
                return cleanTextValue(vNode ? vNode.textContent : '');
            } else {
                const fNode = c.getElementsByTagName('f')[0];
                if (fNode) return ''; // 数式セル（集計列など）のキャッシュ数値 <v>0</v> は文字列として扱わない
                const vNode = c.getElementsByTagName('v')[0];
                return cleanTextValue(vNode ? vNode.textContent : '');
            }
        }

        // タイトルから期間開始日を検出
        let detectedStartDate = null;
        const titleRegex = /(?:(\d{4})[年\/-])?(\d{1,2})月(\d{1,2})日[～〜~-](\d{1,2})月(\d{1,2})日/;
        const currentYear = document.getElementById('termStartDate')?.value
            ? parseInt(document.getElementById('termStartDate').value.split('-')[0], 10)
            : 2026;

        // 全セルをマップ化
        const cellMap = new Map(); // "row,col" -> { c, text }
        let maxRow = 0;
        let maxCol = 0;

        for (let i = 0; i < cNodes.length; i++) {
            const c = cNodes[i];
            const ref = c.getAttribute('r');
            if (!ref) continue;
            const m = ref.match(/^([A-Z]+)([0-9]+)$/);
            if (!m) continue;
            const colStr = m[1];
            const row = parseInt(m[2], 10);
            let col = 0;
            for (let k = 0; k < colStr.length; k++) {
                col = col * 26 + (colStr.charCodeAt(k) - 64);
            }
            const text = getCellText(c);
            cellMap.set(`${row},${col}`, { c, text, ref });
            if (row > maxRow) maxRow = row;
            if (col > maxCol) maxCol = col;

            if (row === 1 && col === 1 && text) {
                const tm = text.match(titleRegex);
                if (tm) {
                    const y = tm[1] ? parseInt(tm[1], 10) : currentYear;
                    const mon = String(parseInt(tm[2], 10)).padStart(2, '0');
                    const day = String(parseInt(tm[3], 10)).padStart(2, '0');
                    const candidate = `${y}-${mon}-${day}`;
                    const matchedTerm = findTermByStartDate(candidate);
                    detectedStartDate = matchedTerm ? matchedTerm.startDate : candidate;
                }
            }
        }

        // 2行目のヘッダーを走査して、シート種別（希望シート vs 完成勤務表 vs 旧シート）・日付開始列・日数・備考列を正確に特定！
        let dayStartCol = 3; // デフォルト: C列 (希望入力シート)
        let remarksCol = -1;
        let nameCol = 2;     // デフォルト: B列 (希望入力シート)
        let dataStartRow = 4;

        const a2Text = cellMap.get('2,1')?.text || '';
        const b2Text = cellMap.get('2,2')?.text || '';
        const c2Text = cellMap.get('2,3')?.text || '';

        if (a2Text === '氏名') {
            // 完成・修正勤務表 (exportExcelSpreadsheet): A列=氏名, B列〜=日付
            nameCol = 1;
            dayStartCol = 2;
            dataStartRow = 4;
        } else if (a2Text === 'No' && b2Text === '氏名' && c2Text === '8時可') {
            // 旧レイアウト: A=No, B=氏名, L(12)〜=日付
            nameCol = 2;
            dayStartCol = 12;
            dataStartRow = 3;
        } else {
            // 希望入力シート (downloadBlankXlsx): A=No, B=氏名, C(3)〜=日付
            nameCol = 2;
            dayStartCol = 3;
            dataStartRow = 4;
        }

        // 2行目から「備考」または「備考（メモ）」列を探す
        for (let col = 1; col <= maxCol; col++) {
            const hText = cellMap.get(`2,${col}`)?.text || '';
            if (hText.includes('備考') || hText.includes('メモ') || hText.includes('コメント')) {
                remarksCol = col;
                break;
            }
        }

        // 対象タームの日数（28日 or 29日）を判定
        const targetTerm = findTermByStartDate(detectedStartDate || currentWorkingStartDate);
        const sheetNumDays = targetTerm ? targetTerm.numDays : NUM_DAYS;

        if (remarksCol === -1 && dataStartRow === 4) {
            remarksCol = (dayStartCol === 3) ? (5 + sheetNumDays) : (10 + sheetNumDays);
        }

        // 有効スタッフのインデックス一覧
        const validStaffIndices = [];
        staffList.forEach((st, idx) => {
            if (!st.isUnused) validStaffIndices.push(idx);
        });

        const items = [];
        const remarksMap = {};

        for (let row = dataStartRow; row <= maxRow; row++) {
            const rowName = cellMap.get(`${row},${nameCol}`)?.text || '';
            // フッター集計行（出勤人数合計・実数合計・早番等）に達したら終了
            if (['出勤人数合計', '実数合計', 'PT A 出勤', 'OT A 出勤', 'PT B 出勤', 'OT B 出勤', 'ST 出勤', '早番', '遅番', 'E', '8時', '専従'].some(k => rowName.startsWith(k))) {
                break;
            }

            // スタッフの特定（1. 氏名一致 → 2. 有効スタッフ順 → 3. 行番号順）
            let staffIdx = -1;
            if (rowName) {
                const byName = staffList.findIndex(st => cleanTextValue(st.name) === rowName);
                if (byName >= 0) staffIdx = byName;
            }
            if (staffIdx === -1) {
                const offsetIdx = row - dataStartRow;
                if (offsetIdx >= 0 && offsetIdx < validStaffIndices.length) {
                    staffIdx = validStaffIndices[offsetIdx];
                } else if (offsetIdx >= 0 && offsetIdx < NUM_STAFF) {
                    staffIdx = offsetIdx;
                }
            }

            if (staffIdx < 0 || staffIdx >= NUM_STAFF) continue;

            // 日付セルの読み取り
            for (let d = 0; d < sheetNumDays; d++) {
                const col = dayStartCol + d;
                const cellEntry = cellMap.get(`${row},${col}`);
                if (cellEntry && cellEntry.text) {
                    items.push({
                        staffIdx,
                        dayIdx: d,
                        symbol: cellEntry.text
                    });
                }
            }

            // 右側の備考（コメント）列の読み取り
            if (remarksCol > 0) {
                const remEntry = cellMap.get(`${row},${remarksCol}`);
                if (remEntry && remEntry.text && remEntry.text !== '-') {
                    remarksMap[staffIdx] = remEntry.text;
                } else {
                    remarksMap[staffIdx] = '';
                }
            }
        }

        return { items, startDate: detectedStartDate, remarksMap };
    }

    // ==========================================
    // CSV / TSV テキストのパース処理
    // ==========================================
    function parseCsvOrTsvText(text) {
        const cleanFullText = text.replace(/^\uFEFF/, '');
        const lines = cleanFullText.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return { items: [], startDate: null, remarksMap: {} };

        const isTsv = lines[0].includes('\t');
        function parseLine(line) {
            if (isTsv) return line.split('\t').map(c => cleanTextValue(c.replace(/^"(.*)"$/, '$1')));
            const res = [];
            let cur = '';
            let inQ = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                    else { inQ = !inQ; }
                } else if (ch === ',' && !inQ) {
                    res.push(cleanTextValue(cur));
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            res.push(cleanTextValue(cur));
            return res;
        }

        const rows = lines.map(parseLine);
        const items = [];
        const remarksMap = {};

        let detectedStartDate = null;
        const currentYear = document.getElementById('termStartDate')?.value ? parseInt(document.getElementById('termStartDate').value.split('-')[0], 10) : 2026;

        for (let i = 0; i < Math.min(3, rows.length); i++) {
            const lineStr = rows[i].join(' ');
            const m = lineStr.match(/(?:(\d{4})[年\/-])?(\d{1,2})[月\/-](\d{1,2})/);
            if (m) {
                const y = m[1] ? parseInt(m[1], 10) : currentYear;
                const mon = String(parseInt(m[2], 10)).padStart(2, '0');
                const day = String(parseInt(m[3], 10)).padStart(2, '0');
                const candidate = `${y}-${mon}-${day}`;
                const matchedTerm = findTermByStartDate(candidate);
                detectedStartDate = matchedTerm ? matchedTerm.startDate : candidate;
                break;
            }
        }

        if ((rows[0].length === 28 || rows[0].length === 29) && rows.length <= NUM_STAFF) {
            rows.forEach((rowVals, sIdx) => {
                rowVals.forEach((val, dIdx) => {
                    if (val) items.push({ staffIdx: sIdx, dayIdx: dIdx, symbol: val });
                });
            });
            return { items, startDate: detectedStartDate, remarksMap };
        }

        let headerRowIdx = -1;
        let dayColStart = 2;
        let remarksColIdx = -1;

        for (let i = 0; i < Math.min(5, rows.length); i++) {
            const r = rows[i];
            if (r.some(cell => cell.includes('No') || cell.includes('氏名') || cell.includes('/'))) {
                headerRowIdx = i;
                for (let c = 0; c < r.length; c++) {
                    if (/\d+[\/月]\d+/.test(r[c])) {
                        dayColStart = c;
                        break;
                    }
                }
                for (let c = 0; c < r.length; c++) {
                    if (r[c].includes('備考') || r[c].includes('メモ')) {
                        remarksColIdx = c;
                        break;
                    }
                }
                break;
            }
        }

        const dataStartRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
        for (let r = dataStartRow; r < rows.length; r++) {
            const rowVals = rows[r];
            if (rowVals.length < 2) continue;

            let staffIdx = -1;
            const noVal = parseInt(rowVals[0], 10);
            if (!isNaN(noVal) && noVal >= 1 && noVal <= NUM_STAFF) {
                staffIdx = noVal - 1;
            } else {
                const nameVal = rowVals[1] || rowVals[0];
                if (nameVal) {
                    const found = staffList.findIndex(st => cleanTextValue(st.name) === nameVal);
                    if (found >= 0) staffIdx = found;
                }
            }

            if (staffIdx >= 0 && staffIdx < NUM_STAFF) {
                for (let d = 0; d < NUM_DAYS; d++) {
                    const col = dayColStart + d;
                    if (col < rowVals.length && rowVals[col]) {
                        items.push({ staffIdx, dayIdx: d, symbol: rowVals[col] });
                    }
                }
                if (remarksColIdx >= 0 && remarksColIdx < rowVals.length) {
                    remarksMap[staffIdx] = rowVals[remarksColIdx] || '';
                }
            }
        }

        return { items, startDate: detectedStartDate, remarksMap };
    }

    // ==========================================
    // ファイル取り込みイベント（.xlsx / .csv / .tsv）
    // ==========================================
    const importScheduleFileInput = document.getElementById('importScheduleFileInput');
    if (importScheduleFileInput) {
        importScheduleFileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            try {
                let parseResult;
                if (file.name.toLowerCase().endsWith('.xlsx')) {
                    const buf = await file.arrayBuffer();
                    parseResult = await parseXlsxBuffer(buf);
                } else {
                    const text = await readTextFileAutoEncoding(file);
                    parseResult = parseCsvOrTsvText(text);
                }

                pushHistory();

                if (parseResult && parseResult.startDate) {
                    const startDateInput = document.getElementById('termStartDate');
                    if (startDateInput) {
                        startDateInput.value = parseResult.startDate;
                        currentWorkingStartDate = parseResult.startDate;
                        getTermInfo();
                    }
                }

                if (!parseResult || !parseResult.items || parseResult.items.length === 0) {
                    applyScheduleImport([], 'replace', parseResult ? parseResult.remarksMap : null);
                    showToast('📄 白紙の希望シートを取り込みました。事前希望枠を全クリア（白紙）にしました。');
                    return;
                }

                applyScheduleImport(parseResult.items, 'replace', parseResult.remarksMap);
                checkInputConstraints(false);

            } catch (err) {
                console.error(err);
                alert('ファイルの取り込みに失敗しました: ' + err.message);
            } finally {
                importScheduleFileInput.value = '';
            }
        });
    }

    // ==========================================
    // 修正済み確定勤務表ファイル取り込み共通処理
    // ==========================================
    async function handleImportSchedule(file, isFinalStage) {
        if (!file) return;

        try {
            let parseResult;
            if (file.name.toLowerCase().endsWith('.xlsx')) {
                const buf = await file.arrayBuffer();
                parseResult = await parseXlsxBuffer(buf);
            } else {
                const text = await readTextFileAutoEncoding(file);
                parseResult = parseCsvOrTsvText(text);
            }

            if (!parseResult || !parseResult.items || parseResult.items.length === 0) {
                alert('ファイルから有効な勤務データが読み取れませんでした。形式をご確認ください。');
                return;
            }

            pushHistory();

            if (parseResult.startDate) {
                const startDateInput = document.getElementById('termStartDate');
                if (startDateInput) {
                    startDateInput.value = parseResult.startDate;
                    currentWorkingStartDate = parseResult.startDate;
                    getTermInfo();
                }
            }

            if (parseResult.remarksMap && typeof parseResult.remarksMap === 'object') {
                Object.keys(parseResult.remarksMap).forEach(sIdxStr => {
                    const sIdx = parseInt(sIdxStr, 10);
                    if (staffList[sIdx] && parseResult.remarksMap[sIdxStr] !== undefined) {
                        staffList[sIdx].remarks = cleanTextValue(parseResult.remarksMap[sIdxStr]);
                    }
                });
            }

            const term = getTermInfo();
            const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');

            if (!lastScheduler) {
                lastScheduler = new ShiftScheduler(staffList, {
                    standardHolidays: stdHolidayVal,
                    dates: term.dates,
                    dayOffsets: [...dayOffsets]
                });
            }

            const newGrid = [];
            for (let s = 0; s < NUM_STAFF; s++) {
                const row = [];
                for (let d = 0; d < NUM_DAYS; d++) {
                    const originalWish = staffList[s].days[d] || '';
                    row.push({
                        symbol: originalWish ? originalWish : '',
                        isFixed: (originalWish !== '')
                    });
                }
                newGrid.push(row);
            }

            parseResult.items.forEach(item => {
                const { staffIdx, dayIdx, symbol } = item;
                if (staffIdx >= 0 && staffIdx < NUM_STAFF && dayIdx >= 0 && dayIdx < NUM_DAYS) {
                    const norm = normalizeSymbol(symbol);
                    if (norm) {
                        newGrid[staffIdx][dayIdx].symbol = norm;
                    }
                }
            });

            lastScheduler.grid = newGrid;
            const newStats = lastScheduler.calculateStats();
            lastSolveResult = {
                success: true,
                grid: newGrid,
                stats: newStats,
                errors: []
            };

            renderInputTable();
            renderOutputTable(newGrid, newStats);
            renderStatsDashboard(newStats);

            if (isFinalStage) {
                switchTab('checkTab');
                const checkRes = checkFinalConstraints(true);
                if (checkRes && !checkRes.isValid) {
                    showToast(`📂 修正済み勤務表を取り込みました（${checkRes.errors.length}件の制約指摘をブルー網掛けで表示中）`);
                } else {
                    showToast(`📂 修正済み勤務表を取り込みました（全制約が完全遵守されています！）`);
                }
            } else {
                switchTab('outputTab');
                const checkRes = checkWorkAreaConstraints(true);
                if (checkRes && !checkRes.isValid) {
                    showToast(`📂 修正済み勤務表を取り込みました（${checkRes.errors.length}件の制約指摘をブルー網掛けで表示中）`);
                } else {
                    showToast(`📂 修正済み勤務表を取り込みました（基本制約が完全遵守されています！）`);
                }
            }

            saveStaffMaster();
            saveCurrentTermToStorage();

        } catch (err) {
            console.error(err);
            alert('修正済み勤務表の取り込みに失敗しました: ' + err.message);
        }
    }

    // 修正作業エリア（ステージ2）のファイル取り込み
    const importModifiedWorkAreaFileInput = document.getElementById('importModifiedWorkAreaFileInput');
    if (importModifiedWorkAreaFileInput) {
        importModifiedWorkAreaFileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            await handleImportSchedule(file, false);
            importModifiedWorkAreaFileInput.value = '';
        });
    }

    // 最終チェック&完成（ステージ3）のファイル取り込み
    const importModifiedScheduleFileInput = document.getElementById('importModifiedScheduleFileInput');
    if (importModifiedScheduleFileInput) {
        importModifiedScheduleFileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            await handleImportSchedule(file, true);
            importModifiedScheduleFileInput.value = '';
        });
    }

    // 修正作業エリア（ステージ2）のチェックボタン
    const validateWorkAreaBtn = document.getElementById('validateWorkAreaBtn');
    if (validateWorkAreaBtn) {
        validateWorkAreaBtn.addEventListener('click', () => {
            checkWorkAreaConstraints(true, true);
        });
    }

    // 最終チェック&完成（ステージ3）のチェックボタン
    const validateOutputBtn = document.getElementById('validateOutputBtn');
    if (validateOutputBtn) {
        validateOutputBtn.addEventListener('click', () => {
            checkFinalConstraints(true, true);
        });
    }

    // 希望入力（ステージ1）のチェックボタン
    const validateInputBtn = document.getElementById('validateInputBtn');
    if (validateInputBtn) {
        validateInputBtn.addEventListener('click', () => {
            checkInputConstraints(true);
        });
    }


    // 4. スプレッドシート（.xls）エクスポート（A3横向き・全集計行・ST自動追従数式対応）
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            safeExportExcel();
        });
    }

    const checkExportExcelBtn = document.getElementById('checkExportExcelBtn');
    if (checkExportExcelBtn) {
        checkExportExcelBtn.addEventListener('click', () => {
            safeExportExcel();
        });
    }

    function safeExportExcel() {
        try {
            let gridToExport = null;
            let statsToExport = null;

            if (lastSolveResult && lastSolveResult.grid) {
                gridToExport = lastSolveResult.grid;
                statsToExport = lastSolveResult.stats;
            } else if (lastScheduler && lastScheduler.grid) {
                gridToExport = lastScheduler.grid;
                statsToExport = lastScheduler.calculateStats();
            } else {
                const term = getTermInfo();
                const stdVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                const scheduler = new ShiftScheduler(staffList, {
                    standardHolidays: stdVal,
                    dates: term.dates,
                    dayOffsets: [...dayOffsets]
                });
                gridToExport = scheduler.grid;
                statsToExport = scheduler.calculateStats();
            }

            exportExcelSpreadsheet(gridToExport, statsToExport);
        } catch (err) {
            console.error('Excelエクスポートエラー:', err);
            showToast('⚠️ Excel出力中にエラーが発生しました: ' + err.message);
        }
    }

    function exportExcelSpreadsheet(grid, stats) {
        const term = getTermInfo();
        const numDays = term.dates.length;
        const safeTitle = `${term.first.m}月${term.first.day}日～${term.last.m}月${term.last.day}日 勤務表`;
        // シート名禁則文字 (: \ / ? * [ ]) を全角またはハイフンにサニタイズ
        const sanitizedSheetName = `${term.first.m}月${term.first.day}日～${term.last.m}月${term.last.day}日勤務表`
            .replace(/[/\\?*\[\]:]/g, '_')
            .substring(0, 31);
        const title = safeTitle;

        // 動的列レターの算出
        const firstDayCol = 'B'; // 列2
        const lastDayCol = toColLetter(1 + numDays); // 28日: AC(列29), 29日: AD(列30)
        const colWork = toColLetter(2 + numDays);    // 28日: AD, 29日: AE
        const colOff = toColLetter(3 + numDays);     // 28日: AE, 29日: AF
        const colPaid = toColLetter(4 + numDays);    // 28日: AF, 29日: AG
        const colRef = toColLetter(5 + numDays);     // 28日: AG, 29日: AH
        const colEarly = toColLetter(6 + numDays);   // 28日: AH, 29日: AI
        const colLate = toColLetter(7 + numDays);    // 28日: AI, 29日: AJ
        const colEve = toColLetter(8 + numDays);     // 28日: AJ, 29日: AK
        const colH8 = toColLetter(9 + numDays);      // 28日: AK, 29日: AL
        const colRemarks = toColLetter(10 + numDays); // 28日: AL, 29日: AM

        const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

        const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${sanitizedSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

        const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

        const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="10">
    <font><sz val="9"/><name val="Meiryo"/><color rgb="000000"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="000000"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="DC2626"/></font>
    <font><b/><sz val="12"/><name val="Meiryo"/><color rgb="1E293B"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="EA580C"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="1D4ED8"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="EC4899"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="15803D"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="7C3AED"/></font>
    <font><sz val="9"/><name val="Meiryo"/><color rgb="64748B"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="EFF6FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FEF2F2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F0FDF4"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="thin"><color rgb="CBD5E1"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="thin"><color rgb="CBD5E1"/></bottom>
    </border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="medium"><color rgb="64748B"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="thin"><color rgb="CBD5E1"/></bottom>
    </border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="thin"><color rgb="CBD5E1"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="medium"><color rgb="64748B"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

        // 有効スタッフのみ抽出
        const validStaffIndices = [];
        staffList.forEach((s, idx) => {
            if (!s.isUnused) validStaffIndices.push(idx);
        });

        // ワークカウント数式ヘルパー (○, 〇, 出, 早, 遅, E, 8時, ハヤ, オソ, イブ + 半休0.5)
        function makeWorkCountFormulaXml(rRng) {
            return `COUNTIF(${rRng},&quot;○&quot;)+COUNTIF(${rRng},&quot;〇&quot;)+COUNTIF(${rRng},&quot;出&quot;)+COUNTIF(${rRng},&quot;早&quot;)+COUNTIF(${rRng},&quot;遅&quot;)+COUNTIF(${rRng},&quot;E&quot;)+COUNTIF(${rRng},&quot;8時&quot;)+COUNTIF(${rRng},&quot;ハヤ&quot;)+COUNTIF(${rRng},&quot;オソ&quot;)+COUNTIF(${rRng},&quot;イブ&quot;)+0.5*(COUNTIF(${rRng},&quot;○/休&quot;)+COUNTIF(${rRng},&quot;〇/休&quot;)+COUNTIF(${rRng},&quot;休/○&quot;)+COUNTIF(${rRng},&quot;休/〇&quot;)+COUNTIF(${rRng},&quot;○/有&quot;)+COUNTIF(${rRng},&quot;〇/有&quot;)+COUNTIF(${rRng},&quot;有/○&quot;)+COUNTIF(${rRng},&quot;有/〇&quot;))`;
        }

        // リフレッシュ休暇数式ヘルパー
        function makeRefHolidayFormulaXml(rRng) {
            return `COUNTIF(${rRng},&quot;上1&quot;)+COUNTIF(${rRng},&quot;上2&quot;)+COUNTIF(${rRng},&quot;上3&quot;)+COUNTIF(${rRng},&quot;上4&quot;)+COUNTIF(${rRng},&quot;上5&quot;)+COUNTIF(${rRng},&quot;下1&quot;)+COUNTIF(${rRng},&quot;下2&quot;)+COUNTIF(${rRng},&quot;下3&quot;)`;
        }

        let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="3" xSplit="1" topLeftCell="B4" activePane="bottomRight" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18" customHeight="1"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>`;

        // 日付列: 幅4.2
        for (let d = 0; d < numDays; d++) {
            sheet1 += `\n    <col min="${2 + d}" max="${2 + d}" width="4.2" customWidth="1"/>`;
        }
        // 集計列: 幅5.5
        for (let c = 2 + numDays; c <= 9 + numDays; c++) {
            sheet1 += `\n    <col min="${c}" max="${c}" width="5.5" customWidth="1"/>`;
        }
        // 備考欄 (メモ): 幅162 (約1300ピクセル相当)
        sheet1 += `\n    <col min="${10 + numDays}" max="${10 + numDays}" width="162" customWidth="1"/>`;
        sheet1 += `\n  </cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>${title}</t></is></c>
      <c r="${colWork}1" s="2" t="inlineStr"><is><t>勤務・休暇 集計</t></is></c>
    </row>
    <row r="2" ht="24" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>氏名</t></is></c>`;

        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const col = toColLetter(2 + d);
            sheet1 += `\n      <c r="${col}2" s="2" t="inlineStr"><is><t>${di.label || di.day}</t></is></c>`;
        }
        sheet1 += `\n      <c r="${colWork}2" s="2" t="inlineStr"><is><t>出勤</t></is></c>
      <c r="${colOff}2" s="2" t="inlineStr"><is><t>公休</t></is></c>
      <c r="${colPaid}2" s="2" t="inlineStr"><is><t>有休</t></is></c>
      <c r="${colRef}2" s="2" t="inlineStr"><is><t>リフ</t></is></c>
      <c r="${colEarly}2" s="2" t="inlineStr"><is><t>早</t></is></c>
      <c r="${colLate}2" s="2" t="inlineStr"><is><t>遅</t></is></c>
      <c r="${colEve}2" s="2" t="inlineStr"><is><t>E</t></is></c>
      <c r="${colH8}2" s="2" t="inlineStr"><is><t>8時</t></is></c>
      <c r="${colRemarks}2" s="2" t="inlineStr"><is><t>備考（メモ）</t></is></c>
    </row>`;

        // 3行目: 曜日ヘッダー行
        sheet1 += `\n    <row r="3" ht="20" customHeight="1">
      <c r="A3" s="2"/>`;
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const col = toColLetter(2 + d);
            let sIdx = 2;
            if (di.wIdx === 5) sIdx = 3; // 土曜青
            else if (di.wIdx === 6 || di.isHoliday) sIdx = 4; // 日祝赤
            sheet1 += `\n      <c r="${col}3" s="${sIdx}" t="inlineStr"><is><t>${di.weekday || di.w}</t></is></c>`;
        }
        sheet1 += `\n      <c r="${colWork}3" s="2"/><c r="${colOff}3" s="2"/><c r="${colPaid}3" s="2"/><c r="${colRef}3" s="2"/><c r="${colEarly}3" s="2"/><c r="${colLate}3" s="2"/><c r="${colEve}3" s="2"/><c r="${colH8}3" s="2"/><c r="${colRemarks}3" s="2"/>
    </row>`;

        // スタッフ行 (row 4〜: 行高 ht="24.75")
        validStaffIndices.forEach((s, idx) => {
            const staff = staffList[s];
            const r = 4 + idx;
            const rng = `${firstDayCol}${r}:${lastDayCol}${r}`;

            sheet1 += `\n    <row r="${r}" ht="24.75" customHeight="1">`;
            sheet1 += `\n      <c r="A${r}" s="5" t="inlineStr"><is><t>${escapeXmlText(staff.name)}</t></is></c>`;

            for (let d = 0; d < numDays; d++) {
                const col = toColLetter(2 + d);
                const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '', isFixed: false };
                let rawSym = cell.symbol || '';
                let sym = rawSym.replace(/[◦•･◯○●]/g, '〇');
                const sIdx = cell.isFixed ? 7 : 6;
                sheet1 += `\n      <c r="${col}${r}" s="${sIdx}" t="inlineStr"><is><t>${sym}</t></is></c>`;
            }

            const fWork = makeWorkCountFormulaXml(rng);
            const fOff = `COUNTIF(${rng},&quot;休&quot;)+0.5*(COUNTIF(${rng},&quot;○/休&quot;)+COUNTIF(${rng},&quot;〇/休&quot;)+COUNTIF(${rng},&quot;休/○&quot;)+COUNTIF(${rng},&quot;休/〇&quot;))`;
            const fPaid = `COUNTIF(${rng},&quot;有&quot;)+0.5*(COUNTIF(${rng},&quot;○/有&quot;)+COUNTIF(${rng},&quot;〇/有&quot;)+COUNTIF(${rng},&quot;有/○&quot;)+COUNTIF(${rng},&quot;有/〇&quot;))`;
            const fRef = makeRefHolidayFormulaXml(rng);
            const fEarly = `COUNTIF(${rng},&quot;早&quot;)+COUNTIF(${rng},&quot;ハヤ&quot;)`;
            const fLate = `COUNTIF(${rng},&quot;遅&quot;)+COUNTIF(${rng},&quot;オソ&quot;)`;
            const fEve = `COUNTIF(${rng},&quot;E&quot;)+COUNTIF(${rng},&quot;イブ&quot;)`;
            const fH8 = `COUNTIF(${rng},&quot;8時&quot;)`;

            sheet1 += `\n      <c r="${colWork}${r}" s="8"><f>${fWork}</f><v>0</v></c>
      <c r="${colOff}${r}" s="8"><f>${fOff}</f><v>0</v></c>
      <c r="${colPaid}${r}" s="8"><f>${fPaid}</f><v>0</v></c>
      <c r="${colRef}${r}" s="8"><f>${fRef}</f><v>0</v></c>
      <c r="${colEarly}${r}" s="8"><f>${fEarly}</f><v>0</v></c>
      <c r="${colLate}${r}" s="8"><f>${fLate}</f><v>0</v></c>
      <c r="${colEve}${r}" s="8"><f>${fEve}</f><v>0</v></c>
      <c r="${colH8}${r}" s="8"><f>${fH8}</f><v>0</v></c>
      <c r="${colRemarks}${r}" s="14" t="inlineStr"><is><t>${escapeXmlText(staff.remarks || '')}</t></is></c>
    </row>`;
        });

        // 集計フッター行
        const endRow = 3 + validStaffIndices.length;

        // 1. 出勤人数合計行
        const rWork = endRow + 1;
        sheet1 += `\n    <row r="${rWork}" ht="28.5" customHeight="1">
      <c r="A${rWork}" s="9" t="inlineStr"><is><t>出勤人数合計</t></is></c>`;

        for (let d = 0; d < numDays; d++) {
            const col = toColLetter(2 + d);
            const rngCol = `${col}$4:${col}$${endRow}`;
            const fColWork = makeWorkCountFormulaXml(rngCol);
            sheet1 += `\n      <c r="${col}${rWork}" s="9"><f>${fColWork}</f><v>0</v></c>`;
        }
        sheet1 += `\n      <c r="${colWork}${rWork}" s="9"><f>SUM(${firstDayCol}${rWork}:${lastDayCol}${rWork})</f><v>0</v></c>`;
        sheet1 += `\n      <c r="${colOff}${rWork}" s="13"><f>SUM(${colOff}$4:${colOff}$${endRow})</f><v>0</v></c>`;
        sheet1 += `\n      <c r="${colPaid}${rWork}" s="13"><f>SUM(${colPaid}$4:${colPaid}$${endRow})</f><v>0</v></c>`;
        sheet1 += `\n      <c r="${colRef}${rWork}" s="13"><f>SUM(${colRef}$4:${colRef}$${endRow})</f><v>0</v></c>`;
        sheet1 += `\n      <c r="${colEarly}${rWork}" s="13"><f>SUM(${colEarly}$4:${colEarly}$${endRow})</f><v>0</v></c>`;
        sheet1 += `\n      <c r="${colLate}${rWork}" s="13"><f>SUM(${colLate}$4:${colLate}$${endRow})</f><v>0</v></c>`;
        sheet1 += `\n      <c r="${colEve}${rWork}" s="13"><f>SUM(${colEve}$4:${colEve}$${endRow})</f><v>0</v></c>`;
        sheet1 += `\n      <c r="${colH8}${rWork}" s="13"><f>SUM(${colH8}$4:${colH8}$${endRow})</f><v>0</v></c>`;
        sheet1 += `\n      <c r="${colRemarks}${rWork}" s="9" t="inlineStr"><is><t>-</t></is></c>`;
        sheet1 += `\n    </row>`;

        // 2. 実数合計行 (案B仕様: offset > 0 のみ減算)
        const rReal = endRow + 2;
        sheet1 += `\n    <row r="${rReal}" ht="28.5" customHeight="1">
      <c r="A${rReal}" s="9" t="inlineStr"><is><t>実数合計</t></is></c>`;
        for (let d = 0; d < numDays; d++) {
            const col = toColLetter(2 + d);
            const offset = (dayOffsets && dayOffsets[d]) ? dayOffsets[d] : 0;
            const fReal = (offset > 0) ? `${col}${rWork}-(${offset})` : `${col}${rWork}`;
            sheet1 += `\n      <c r="${col}${rReal}" s="9"><f>${fReal}</f><v>0</v></c>`;
        }
        sheet1 += `\n      <c r="${colWork}${rReal}" s="9"><f>SUM(${firstDayCol}${rReal}:${lastDayCol}${rReal})</f><v>0</v></c>`;
        for (let c = 3 + numDays; c <= 10 + numDays; c++) {
            sheet1 += `\n      <c r="${toColLetter(c)}${rReal}" s="9" t="inlineStr"><is><t>-</t></is></c>`;
        }
        sheet1 += `\n    </row>`;

        // 特殊勤務集計ヘルパー行の生成関数
        function renderSpecialRow(rNum, label, sIdx, symList) {
            sheet1 += `\n    <row r="${rNum}" ht="20" customHeight="1">
      <c r="A${rNum}" s="${sIdx}" t="inlineStr"><is><t>${label}</t></is></c>`;
            for (let d = 0; d < numDays; d++) {
                const col = toColLetter(2 + d);
                const rngCol = `${col}$4:${col}$${endRow}`;
                const formula = symList.map(sym => `COUNTIF(${rngCol},&quot;${sym}&quot;)`).join('+');
                sheet1 += `\n      <c r="${col}${rNum}" s="${sIdx}"><f>${formula}</f><v>0</v></c>`;
            }
            sheet1 += `\n      <c r="${colWork}${rNum}" s="${sIdx}"><f>SUM(${firstDayCol}${rNum}:${lastDayCol}${rNum})</f><v>0</v></c>`;
            for (let c = 3 + numDays; c <= 10 + numDays; c++) {
                sheet1 += `\n      <c r="${toColLetter(c)}${rNum}" s="${sIdx}" t="inlineStr"><is><t>-</t></is></c>`;
            }
            sheet1 += `\n    </row>`;
        }

        renderSpecialRow(endRow + 3, '早番 (早/ハヤ)', 10, ['早', 'ハヤ']);
        renderSpecialRow(endRow + 4, '遅番 (遅/オソ)', 11, ['遅', 'オソ']);
        renderSpecialRow(endRow + 5, 'イブニング (E/イブ)', 12, ['E', 'イブ']);
        renderSpecialRow(endRow + 6, '8:00 (8時)', 13, ['8時']);

        // 専従人数
        const rFull = endRow + 7;
        sheet1 += `\n    <row r="${rFull}" ht="20" customHeight="1">
      <c r="A${rFull}" s="9" t="inlineStr"><is><t>専従</t></is></c>`;
        for (let d = 0; d < numDays; d++) {
            const col = toColLetter(2 + d);
            const terms = validStaffIndices.filter(s => staffList[s].isFullTime).map(s => {
                const r = 4 + validStaffIndices.indexOf(s);
                return `IF(OR(${col}${r}=&quot;休&quot;,${col}${r}=&quot;有&quot;,${col}${r}=&quot;出&quot;,${col}${r}=&quot;上1&quot;,${col}${r}=&quot;上2&quot;,${col}${r}=&quot;上3&quot;,${col}${r}=&quot;上4&quot;,${col}${r}=&quot;上5&quot;,${col}${r}=&quot;下1&quot;,${col}${r}=&quot;下2&quot;,${col}${r}=&quot;下3&quot;,${col}${r}=&quot;ー&quot;),0,1)`;
            });
            const f = terms.length > 0 ? terms.join('+') : '0';
            sheet1 += `\n      <c r="${col}${rFull}" s="9"><f>${f}</f><v>0</v></c>`;
        }
        sheet1 += `\n      <c r="${colWork}${rFull}" s="9" t="inlineStr"><is><t>-</t></is></c>`;
        for (let c = 3 + numDays; c <= 10 + numDays; c++) {
            sheet1 += `\n      <c r="${toColLetter(c)}${rFull}" s="9" t="inlineStr"><is><t>-</t></is></c>`;
        }
        sheet1 += `\n    </row>`;

        sheet1 += `\n  </sheetData>
  <pageMargins left="0.2" right="0.2" top="0.3" bottom="0.3" header="0.1" footer="0.1"/>
  <pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"/>
</worksheet>`;

        const files = [
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rels },
            { name: 'xl/workbook.xml', data: workbook },
            { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
            { name: 'xl/styles.xml', data: styles },
            { name: 'xl/worksheets/sheet1.xml', data: sheet1 }
        ];

        const zipBuf = createZipUint8Array(files);
        const blob = new Blob([zipBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${safeTitle.replace(/\s+/g, '')}.xlsx`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 2000);
        showToast('📊 本物のExcelファイル（.xlsx）をダウンロードしました！（A3横・1ページ印刷設定・動的数式・赤字太字付き）');
    }
    // 初期起動（直前に作業していた期間、または保存データを自動復元）
    initStaffData();
    loadStaffMaster(); // ★ スタッフの基本属性・トグル設定（係長/主任/副主任/0.5/専従/所属/備考等）を確実に復元

    const lastActiveDate = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE) || localStorage.getItem('shift_schedule_last_active_start_date');
    const defaultDate = document.getElementById('termStartDate')?.value || '2026-04-01';
    const matchedTerm = findTermByStartDate(lastActiveDate || defaultDate);
    const targetDate = matchedTerm ? matchedTerm.startDate : (lastActiveDate || defaultDate);

    currentWorkingStartDate = targetDate;
    const dateInput = document.getElementById('termStartDate');
    if (dateInput) dateInput.value = targetDate;

    // ★ 13ターム選択プルダウンの初期化とイベント登録
    initTermSelector();

    if (localStorage.getItem(`${STORAGE_KEY_PREFIX}${targetDate}`) || localStorage.getItem(`shift_schedule_term_${targetDate}`)) {
        loadTermFromStorage(targetDate);
    } else {
        const term = getTermInfo();
        const stdHolidaySelect = document.getElementById('standardHolidaySelect');
        if (stdHolidaySelect) stdHolidaySelect.value = term.isTerm13 ? '8.5' : '8.0';
        dayOffsets = createDefaultDayOffsets(term.dates);
        renderInputTable();
        clearOutputTables();
        saveStaffMaster();
        saveCurrentTermToStorage(); // 初期状態を自動保存
    }
    renderSavedTermsSelect();

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
});
