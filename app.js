// ★ リフレッシュ休暇記号判定（上1〜5、下1〜3。これらはいかなる場合も赤字固定にせず通常黒字！）
function isRefreshHolidaySymbol(sym) {
    if (!sym || typeof sym !== 'string') return false;
    const cleanSym = sym.trim();
    if (['上1', '上2', '上3', '上4', '上5', '下1', '下2', '下3'].includes(cleanSym)) return true;
    if (cleanSym.startsWith('上') || cleanSym.startsWith('下') || cleanSym.includes('リフ')) return true;
    return false;
}

// ★ 有給休暇記号判定
function isPaidHolidaySymbol(sym) {
    if (!sym || typeof sym !== 'string') return false;
    const cleanSym = sym.trim();
    return cleanSym === '有' || cleanSym === '有休' || cleanSym === '有/休' || cleanSym === '休/有';
}

// ★ 純粋公休記号判定
function isPublicOffSymbol(sym) {
    if (!sym || typeof sym !== 'string') return false;
    const cleanSym = sym.trim();
    return cleanSym === '休';
}

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

    // ★ ユーザー指示: 罫線の縦太線が火曜日と水曜日の間に引かれているが、土曜日と日曜日の間に引いて。
    // カレンダー日付が土曜日（wIdx === 5）の列の右側に border-thick-right を付与するヘルパー
    
    // ★ 添付1: 4/28と出勤集計の間にはさらに太い線（border-thickest-right）、土曜日は太線（border-thick-right）
    function getDayBorderClass(d) {
        if (d === NUM_DAYS - 1) return 'border-thickest-right';
        if (isSaturdayCol(d)) return 'border-thick-right';
        return '';
    }

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


    // ==========================================
    // ★ 正規13ターム定義 ＆ セレクター制御
    // ==========================================
    function generateAllTerms() {
        const years = [2026, 2027];
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

        const curStart = localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || localStorage.getItem('shift_schedule_current_start_date') || document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        currentWorkingStartDate = curStart;
        const startDateInput = document.getElementById('termStartDate');
        if (startDateInput) startDateInput.value = curStart;
        getTermInfo(curStart);
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

            // ★ マスターテーブルの場合: 病棟個別のスタッフ初期化を行わず、全病棟統合ビューを即座に再描画！
            if (isMaster) {
                currentWorkingStartDate = newDate;
                const startDateInput = document.getElementById('termStartDate');
                if (startDateInput) startDateInput.value = newDate;

                localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newDate);
                localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newDate);
                localStorage.setItem('shift_schedule_current_start_date', newDate);

                const termInfo = getTermInfo(newDate);
                const endDisplay = document.getElementById('termEndDateDisplay');
                if (endDisplay && termInfo.last) {
                    const lastY = termInfo.last.dateObj.getFullYear();
                    const lastM = String(termInfo.last.m).padStart(2, '0');
                    const lastD = String(termInfo.last.day).padStart(2, '0');
                    endDisplay.textContent = `${lastY}-${lastM}-${lastD}`;
                }
                const termBadge = document.getElementById('termTitleBadge') || document.getElementById('termLabelBadge');
                if (termBadge) termBadge.textContent = termInfo.badgeText;
                const daysBadge = document.getElementById('termDaysBadge');
                if (daysBadge) daysBadge.textContent = `${termInfo.dates.length}日間`;

                const checkTitle = document.getElementById('checkTitleDisplay');
                if (checkTitle) {
                    checkTitle.textContent = `🏢 ${termInfo.title}（全フロア統合サマリー＆勤務詳細集約）`;
                }

                showToast(`📅 マスターテーブル: ${termInfo.title} に切り替えました`);

                // クラウドから最新データを同期して統合テーブルを即時再描画
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
                return;
            }

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
            localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newDate);
            localStorage.setItem('shift_schedule_current_start_date', newDate);
            renderSavedTermsSelect();

            // 終了日・バッジ・タイトルの動的更新
            const termInfo = getTermInfo(newDate);
            const endDisplay = document.getElementById('termEndDateDisplay');
            if (endDisplay && termInfo.last) {
                const lastY = termInfo.last.dateObj.getFullYear();
                const lastM = String(termInfo.last.m).padStart(2, '0');
                const lastD = String(termInfo.last.day).padStart(2, '0');
                endDisplay.textContent = `${lastY}-${lastM}-${lastD}`;
            }
            const termBadge = document.getElementById('termTitleBadge') || document.getElementById('termLabelBadge');
            if (termBadge) termBadge.textContent = termInfo.badgeText;
            const daysBadge = document.getElementById('termDaysBadge');
            if (daysBadge) daysBadge.textContent = `${termInfo.dates.length}日間`;
        });
    }

    // ★ スタッフ属性マスターの保存（タームを切り替えても・リロードしてもトグルや設定を完全維持）
    // ※ 備考（remarks）はターム固有情報のためマスターには含めず、ターム間での混入・引き継ぎを防止する
    function saveStaffMaster() {
        try {
            const masterList = staffList.map(s => {
                enforceRoleExclusivity(s);
                return {
                    id: s.id,
                    name: cleanTextValue(s.name),
                    isUnused: !!s.isUnused,
                    floor: s.floor || '',
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
                    isZeroCount: !!s.isZeroCount,
                    isFirstYear: !!s.isFirstYear,
                    lifeSection: s.lifeSection || '',
                    haSection: s.haSection || '',
                    jobTitle: s.jobTitle || '',
                    isFullTime: !!s.isFullTime,
                    allow6Consec: !!s.allow6Consec,
                isSatSunOff: !!s.isSatSunOff,
                isSunOff: !!s.isSunOff,
                    prevName: cleanTextValue(s.prevName || '')
                };
            });
            window.localStorage.setItem(STORAGE_KEY_STAFF_MASTER, JSON.stringify(masterList));
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
                staffList[idx].floor = ms.floor !== undefined ? ms.floor : staffList[idx].floor;
                staffList[idx].section = ms.section || staffList[idx].section || '';
                // ★ トグルトリガーによるデータ保護（No.指定ではなく、トグル設定の有無を判定して空上書きを遮断）
                staffList[idx].lifeSection = ms.lifeSection || staffList[idx].lifeSection || '';
                staffList[idx].haSection = ms.haSection || staffList[idx].haSection || '';
                staffList[idx].jobTitle = ms.jobTitle || staffList[idx].jobTitle || '';
                staffList[idx].can8 = ms.can8 !== undefined ? !!ms.can8 : staffList[idx].can8;
                staffList[idx].noEarly = ms.noEarly !== undefined ? !!ms.noEarly : staffList[idx].noEarly;
                staffList[idx].noLate = ms.noLate !== undefined ? !!ms.noLate : staffList[idx].noLate;
                staffList[idx].noEve = ms.noEve !== undefined ? !!ms.noEve : staffList[idx].noEve;
                staffList[idx].canSched = ms.canSched !== undefined ? !!ms.canSched : staffList[idx].canSched;
                staffList[idx].isSectionChief = ms.isSectionChief !== undefined ? !!ms.isSectionChief : staffList[idx].isSectionChief;
                staffList[idx].isChief = ms.isChief !== undefined ? !!(ms.isChief || ms.chief) : staffList[idx].isChief;
                staffList[idx].isSubChief = ms.isSubChief !== undefined ? !!ms.isSubChief : staffList[idx].isSubChief;
                staffList[idx].isHalf = ms.isHalf !== undefined ? !!ms.isHalf : staffList[idx].isHalf;
                // 管理トグルONのスタッフは自動的にisZeroCountも保護
                staffList[idx].isZeroCount = ms.isZeroCount !== undefined ? !!ms.isZeroCount : (staffList[idx].lifeSection === '管理' ? true : staffList[idx].isZeroCount);
                staffList[idx].isFirstYear = !!ms.isFirstYear;
                staffList[idx].isFullTime = ms.isFullTime !== undefined ? !!ms.isFullTime : staffList[idx].isFullTime;
                staffList[idx].allow6Consec = !!ms.allow6Consec;
                staffList[idx].prevName = cleanTextValue(ms.prevName || '');
                // ※ remarks（備考）はターム固有のためマスターから上書きしない
                enforceRoleExclusivity(staffList[idx]);
            }
        });
        if (staffList.length > NUM_STAFF) {
            staffList = staffList.slice(0, NUM_STAFF);
        }
        return true;
    }

    function loadStaffMaster() {
        try {
            let raw = window.localStorage.getItem(STORAGE_KEY_STAFF_MASTER);
            if (!raw && !isST) {
                // 旧キーからのフォールバック救済（※ STは他病棟キーと混同しないようフォールバック禁止）
                raw = window.localStorage.getItem('shift_schedule_staff_master');
            }
            if (!raw) return false;
            const masterList = JSON.parse(raw);
            return applyMasterArrayToStaffList(masterList);
        } catch (e) {
            console.error('スタッフマスターの読込に失敗:', e);
            return false;
        }
    }

    // ★ 部署別パスワード認証モーダル制御（開くたびに要求、リロード時は不要）
    // ==========================================
    const DEFAULT_DEPT_PASSWORDS = {
        '1f': '111111',
        '1F': '111111',
        '2f': '222222',
        '2F': '222222',
        '3f': '333333',
        '3F': '333333',
        'south': '444444',
        '南': '444444',
        'st': '111111',
        'life': '555555',
        'life_admin': '555555',
        'master': '777777'
    };

    function checkDeptAuthentication() {
        const config = window.APP_CONFIG || { deptId: 'master', deptName: 'マスターテーブル' };
        const deptId = config.deptId || (document.body.className.match(/theme-([a-z0-9]+)/) ? document.body.className.match(/theme-([a-z0-9]+)/)[1] : 'master');
        const expectedPassword = config.password || DEFAULT_DEPT_PASSWORDS[deptId] || DEFAULT_DEPT_PASSWORDS[config.floor] || '777777';

        // ヘッダータイトルの更新
        const titleEl = document.querySelector('.header-title h1');
        if (titleEl && config.deptName) {
            titleEl.textContent = `勤務予定表 自動作成システム 〜 ${config.deptName} 〜`;
            document.title = `勤務予定表 自動作成システム - ${config.deptName}`;
        }

        // ★ ユーザー指示: オンライン（Vercel等のWeb上）ではパスワードは不要！
        // 病院のイントラ環境（file:プロトコル等のオフライン運用）でのみパスワード画面を起動する
        const isOnlineHost = (window.location.protocol === 'http:' || window.location.protocol === 'https:');
        if (isOnlineHost) {
            return; // オンライン環境ではパスワード不要で即座に開く
        }

        const authKey = `auth_${deptId}`;
        // ★ ユーザー指示: リロード時は不要、ブラウザで新しく開くたびにパスワードを要求（sessionStorage）
        if (sessionStorage.getItem(authKey) === 'true') {
            return; // 認証済み
        }

        // 各フロアのテーマカラー＆アイコン情報
        const themeInfo = {
            '1f': { color: '#2563eb', bg: '#eff6ff', name: '1階病棟' },
            '2f': { color: '#ea580c', bg: '#fff7ed', name: '2階病棟' },
            '3f': { color: '#16a34a', bg: '#f0fdf4', name: '3階病棟' },
            'south': { color: '#7c3aed', bg: '#faf5ff', name: '南病棟' },
            'life': { color: '#0d9488', bg: '#f0fdfa', name: '生活期' },
            'master': { color: '#b45309', bg: '#fefce8', name: 'マスターテーブル（統括）' }
        }[deptId] || { color: '#0284c7', bg: '#f0f9ff', name: config.deptName || '勤務表システム' };

        // 認証モーダルを動的生成して画面全体を安全にロック
        const overlay = document.createElement('div');
        overlay.id = 'deptAuthOverlay';
        overlay.className = 'auth-lock-overlay';

        overlay.innerHTML = `
            <div class="auth-modal-card">
                <div class="auth-modal-icon">
                    <span style="display:inline-flex; align-items:center; justify-content:center; width:68px; height:68px; background:${themeInfo.bg}; border:2px solid ${themeInfo.color}; border-radius:50%; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                        💻
                    </span>
                </div>
                <h3 class="auth-modal-title" style="color:${themeInfo.color};">【${themeInfo.name}】</h3>
                <p class="auth-modal-subtitle">セキュリティ認証が必要です。<br>設定されたパスワードを入力してください。</p>
                <div class="auth-input-group">
                    <input type="password" id="deptAuthPasswordInput" class="auth-password-input" maxlength="8" placeholder="••••••" autofocus autocomplete="off">
                    <div id="deptAuthErrorMsg" class="auth-error-text" style="display: none;">⚠️ パスワードが正しくありません</div>
                </div>
                <button type="button" id="deptAuthSubmitBtn" class="auth-submit-btn" style="background: linear-gradient(135deg, ${themeInfo.color} 0%, #0f172a 100%);">
                    🔓 ログインして勤務表を開く
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = document.getElementById('deptAuthPasswordInput');
        const submitBtn = document.getElementById('deptAuthSubmitBtn');
        const errorMsg = document.getElementById('deptAuthErrorMsg');

        function tryAuth() {
            if (input.value === expectedPassword) {
                sessionStorage.setItem(authKey, 'true');
                overlay.classList.add('hidden');
                setTimeout(() => overlay.remove(), 250);
            } else {
                errorMsg.style.display = 'block';
                input.value = '';
                input.focus();
                input.style.borderColor = '#dc2626';
                setTimeout(() => { input.style.borderColor = '#cbd5e1'; }, 1000);
            }
        }

        submitBtn.addEventListener('click', tryAuth);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') tryAuth();
        });

        setTimeout(() => input.focus(), 150);
    }

    checkDeptAuthentication();
    // ==========================================
    // ★ 部署別設定 (APP_CONFIG) に対応したストレージキー動的生成 & ST/生活期モード判定
    // ==========================================
    const appConfig = window.APP_CONFIG || { deptId: 'master', deptName: 'マスター統括', password: '' };
    const isST = !!appConfig.isST || (appConfig.deptId === 'st');
    const isMaster = (appConfig.deptId === 'master');
    const isLife = !!appConfig.isLife || (appConfig.deptId === 'life' || appConfig.deptId === 'life_admin');
    const isSouth = (appConfig.floor === '南' || appConfig.deptId === 'south');
    const currentFloor = appConfig.floor || (appConfig.deptId === '1f' ? '1F' : (appConfig.deptId === '2f' ? '2F' : (appConfig.deptId === '3f' ? '3F' : (appConfig.deptId === 'south' ? '南' : (isLife ? '生活期' : '')))));
    const deptPrefix = appConfig.deptId ? `${appConfig.deptId}_` : '';
    // ★ スタッフ数上限: STは36名、生活期は45名（46人目以降不要）、通常病棟POは60名
    const NUM_STAFF = isST ? 36 : (isLife ? 45 : 60);
    let NUM_DAYS = 28;
    const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
    const STORAGE_KEY_PREFIX = `shift_schedule_${deptPrefix}term_`;
    const STORAGE_KEY_GLOBAL_CURRENT_TERM = 'shift_schedule_global_active_term_start_date';
    const STORAGE_KEY_LAST_ACTIVE = `shift_schedule_${deptPrefix}last_active_start_date`;
    const STORAGE_KEY_SAVED_TERMS = `shift_schedule_${deptPrefix}saved_terms`;
    const STORAGE_KEY_STAFF_MASTER = `shift_schedule_${deptPrefix}staff_master`;

    let staffList = [];
    let currentSelectedSymbol = '休';
    let lastSolveResult = null;
    let lastScheduler = null;
    let currentWorkingStartDate = '2026-04-01';
    let autoAssignedRefKeys = new Set(); // "s,d" 自動配分されたリフセル（通常文字・編集自由扱い）
    let autoAssignedStaffIds = new Set(); // 自動配分対象となったスタッフID（誤消去検知用）

    // ★ 日別出勤増減枠のデフォルト生成（STテーブルおよび生活期・通所は全稼働日均一のため全日0、通常病棟POは土日祝日-2・平日0）
    function createDefaultDayOffsets(dates) {
        if (isST || isLife) {
            return new Array(NUM_DAYS).fill(0);
        }
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

    let dayOffsets = new Array(NUM_DAYS).fill(0); // 日別出勤増減枠（STは全日0、通常POは初期化時に土日祝日-2を適用）

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

    // スタッフデータの初期化（60名枠、ST時は初期16名、通常は48名運用）
    function initStaffData() {
        staffList = [];
        for (let i = 1; i <= NUM_STAFF; i++) {
            if (isST) {
                // ★ ST専用初期データ（添付1の公認標準配置：各階4名、計16名。17〜36番は不使用）
                const floor = (i <= 4) ? '1F' : ((i <= 8) ? '2F' : ((i <= 12) ? '3F' : ((i <= 16) ? '南' : '')));
                const canSched = (i === 1 || i === 2 || i === 5 || i === 6 || i === 9 || i === 10 || i === 13 || i === 14);
                const isSectionChief = (i === 1);
                const isSubChief = (i === 5 || i === 9 || i === 13);
                const isFullTime = (i === 3 || i === 8 || i === 12 || i === 16);
                staffList.push({
                    id: i,
                    name: `ST ${String(i).padStart(2, '0')}`,
                    isUnused: (i > 16),      // 17〜36番目は初期状態で不使用
                    floor: floor,           // '1F', '2F', '3F', '南' (択一)
                    section: '',
                    can8: false,
                    noEarly: false,         // 早番不可
                    noLate: true,           // STは遅番なし
                    noEve: true,            // STはEなし
                    canSched: canSched,     // スケ可（各階2名ずつ計8名）
                    isSectionChief: isSectionChief,  // 1F: ST01が係長
                    isChief: false,
                    isSubChief: isSubChief,          // 2F: ST05, 3F: ST09, 南: ST13が副主任
                    isHalf: false,          // 0.5
                    isZeroCount: false,     // 0
                    isFirstYear: false,     // 1年目
                    lifeSection: '',        // 生活期セクション
                    haSection: '',          // ハセクション
                    jobTitle: '',           // 職種（PT/OT/ST）
                    isFullTime: isFullTime, // 専従（1F: ST03, 2F: ST08, 3F: ST12, 南: ST16）
                    allow6Consec: false,
                    isSatSunOff: false,
                    isSunOff: false,    // 6連勤可
                    prevName: '',           // 旧姓
                    remarks: '',            // 備考メモ
                    prevDays: new Array(7).fill(''),
                    days: new Array(NUM_DAYS).fill('')
                });
            } else {
                // スタッフ初期化（生活期も番号固定ではなく、ユーザーがトグルで動的に指定）
                const defaultStaffName = `スタッフ ${String(i).padStart(2, '0')}`;
                const defaultHaSec = '';

                staffList.push({
                    id: i,
                    name: defaultStaffName,
                    isUnused: (isLife ? false : (i > 48)),  // 生活期は45名全員使用、POは49〜60番目不使用
                    floor: currentFloor || '',
                    section: '',         // 'PT A', 'PT B', 'OT A', 'OT B', または ''
                    can8: (isSouth 
                        ? ((i >= 5 && i <= 9) || (i >= 27 && i <= 31)) 
                        : ((i >= 2 && i <= 6) || (i >= 15 && i <= 19) || (i >= 28 && i <= 32) || (i >= 39 && i <= 43))), // ★ Aチーム(PT A/OT A)とBチーム(PT B/OT B)に同数均等配置 // 南病棟は南2・南3双方に8時可能スタッフを均等配置
                    noEarly: false,     // 早番不可
                    noLate: false,      // 遅番不可
                    noEve: false,       // E不可
                    canSched: (i <= 8), // ★ スケ可（毎日2名以上必要・○のみ）
                    isSectionChief: (i === 1),  // ★ 係長（平日5連勤、不在時主任出勤）
                    isChief: (i === 2 || i === 3),       // ★ 主任（係長不在時に1名以上出勤）
                    isSubChief: (i === 4 || i === 5),    // ★ 副主任（係長主任不在時A1名B1名出勤）
                    isHalf: false,                       // ★ 0.5（出勤実数を0.5人換算）
                    isZeroCount: false,                  // ★ 0（出勤実数を0人換算）
                    isFirstYear: false,                  // ★ 1年目
                    lifeSection: '',                     // ★ 生活期セクション
                    haSection: defaultHaSec,             // ★ ハセクション（ハ1〜ハ4）
                    jobTitle: '',                        // ★ 職種（PT/OT/ST）
                    isFullTime: (i <= 10),               // ★ 専従
                    allow6Consec: false,
                    isSatSunOff: false,
                    isSunOff: false,                 // ★ 6連勤可
                    prevName: '',                        // ★ 旧姓（改姓時の引き継ぎ用）
                    remarks: '',                         // ★ 備考メモ（AG列）
                    prevDays: new Array(7).fill(''),
                    days: new Array(NUM_DAYS).fill('')
                });
            }
        }
    }


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

        const nowStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (mode === 'syncing') {
            badgeText.textContent = customText || `🔄 自動保存中... (${nowStr})`;
            if (badge) { badge.style.background = '#eff6ff'; badge.style.color = '#1d4ed8'; badge.style.borderColor = '#93c5fd'; }
            if (dot) dot.style.background = '#3b82f6';
        } else if (mode === 'synced') {
            badgeText.textContent = customText || `🟢 自動保存済み (${nowStr})`;
            if (badge) { badge.style.background = '#ecfdf5'; badge.style.color = '#047857'; badge.style.borderColor = '#a7f3d0'; }
            if (dot) dot.style.background = '#10b981';
        } else {
            badgeText.textContent = customText || `🟢 自動保存済み (${nowStr})`;
            if (badge) { badge.style.background = '#ecfdf5'; badge.style.color = '#047857'; badge.style.borderColor = '#a7f3d0'; }
            if (dot) dot.style.background = '#10b981';
        }
    }

    function updateSaveStatusUI(savedDate) {
        const timeStr = (savedDate || new Date()).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setCloudStatusBadge('synced', `🟢 自動保存済み (${timeStr})`);
        if (isCloudInitialSyncDone && !isRestoringFromCloud) {
            scheduleCloudSync();
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

            // ★ 安全ガード: ローカルのデータが完全な初期デフォルト（全員スタッフ01、トグル空、勤務表も空）の場合、クラウドへ空プッシュして既存データを破壊することを防止！
            if (Array.isArray(staffMaster)) {
                const isAllDefault = staffMaster.every((s, i) => (!s.name || s.name === `スタッフ ${String(i+1).padStart(2,'0')}`) && !s.can8 && !s.isChief && !s.isHalf);
                const hasAnyShift = curTermData && ((curTermData.outputGrid && curTermData.outputGrid.length > 0) || (curTermData.staffList && curTermData.staffList.some(s => s.days && s.days.some(d => d))));
                if (isAllDefault && !hasAnyShift && !includeAllLocalTerms) {
                    console.warn('クラウド保存スキップ: 有意なデータが未入力（初期デフォルト値）のためクラウド上書きを防止しました');
                    return;
                }
            }

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
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
            if (isMaster) renderMasterIntegrationView();
            return false;
        }
        try {
            const deptId = (appConfig && appConfig.deptId) ? appConfig.deptId : 'master';
            setCloudStatusBadge('syncing', '☁️ クラウド同期中...');

            // ★ マスターテーブルの場合: 全病棟(1f, 2f, 3f, south, st)の最新クラウドデータも一括取得してLocalStorageを最新化！
            if (isMaster) {
                const subDepts = ['1f', '2f', '3f', 'south', 'st'];
                await Promise.allSettled(subDepts.map(async subId => {
                    try {
                        const r = await fetch(`/api/cloud_sync?deptId=${encodeURIComponent(subId)}&t=${Date.now()}`, { cache: 'no-store' });
                        if (!r.ok) return;
                        const j = await r.json();
                        const subCloud = j && (j.cloudState || j.data);
                        if (subCloud && subCloud.terms && typeof subCloud.terms === 'object') {
                            Object.keys(subCloud.terms).forEach(tDate => {
                                if (subCloud.terms[tDate]) {
                                    window.localStorage.setItem(`shift_schedule_${subId}_term_${tDate}`, JSON.stringify(subCloud.terms[tDate]));
                                }
                            });
                        }
                    } catch (e) {
                        // オフラインまたは通信失敗時はローカルキャッシュをそのまま維持
                    }
                }));
            } else if (!isST && currentFloor) {
                // ★ 各病棟テーブル（1F, 2F, 3F, 南）の場合:
                // 1) ST専用テーブルの最新クラウドデータを自動取得してLocalStorageを同期！
                try {
                    const r = await fetch(`/api/cloud_sync?deptId=st&t=${Date.now()}`, { cache: 'no-store' });
                    if (r.ok) {
                        const j = await r.json();
                        const stCloud = j && (j.cloudState || j.data);
                        if (stCloud && stCloud.terms && typeof stCloud.terms === 'object') {
                            Object.keys(stCloud.terms).forEach(tDate => {
                                if (stCloud.terms[tDate]) {
                                    window.localStorage.setItem(`shift_schedule_st_term_${tDate}`, JSON.stringify(stCloud.terms[tDate]));
                                }
                            });
                            loadLinkedSTData(currentWorkingStartDate);
                            loadLinkedLifeData(currentWorkingStartDate);
                        }
                    }
                } catch (e) {}

                // 2) 全体マスター(master)の最新クラウドデータも取得し、共通スタッフマスタ(トグル・役職・セクション)を同期！
                try {
                    const rMaster = await fetch(`/api/cloud_sync?deptId=master&t=${Date.now()}`, { cache: 'no-store' });
                    if (rMaster.ok) {
                        const jMaster = await rMaster.json();
                        const mCloud = jMaster && (jMaster.cloudState || jMaster.data);
                        if (mCloud && Array.isArray(mCloud.staffMaster) && mCloud.staffMaster.length > 0) {
                            const curLocalMaster = window.localStorage.getItem(STORAGE_KEY_STAFF_MASTER);
                            let needMasterSync = !curLocalMaster;
                            if (curLocalMaster) {
                                try {
                                    const lList = JSON.parse(curLocalMaster);
                                    needMasterSync = lList.every((s, i) => (!s.name || s.name === `スタッフ ${String(i+1).padStart(2,'0')}`) && !s.can8 && !s.isChief && !s.isHalf);
                                } catch(e) { needMasterSync = true; }
                            }
                            if (needMasterSync) {
                                window.localStorage.setItem(STORAGE_KEY_STAFF_MASTER, JSON.stringify(mCloud.staffMaster));
                                applyMasterArrayToStaffList(mCloud.staffMaster);
                            }
                        }
                    }
                } catch (e) {}
            }

            const resp = await fetch(`/api/cloud_sync?deptId=${encodeURIComponent(deptId)}&t=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store'
            });

            if (!resp.ok) {
                isCloudInitialSyncDone = true;
                setCloudStatusBadge('local');
                if (isMaster) renderMasterIntegrationView();
                return false;
            }

            const resJson = await resp.json();
            if (!resJson || !resJson.ok) {
                isCloudInitialSyncDone = true;
                setCloudStatusBadge('local');
                if (isMaster) renderMasterIntegrationView();
                return false;
            }

            // クラウド上にまだファイル自体が存在しない場合:
            // 空の初期値であればクラウドへ送信せず、有意なデータが存在する場合のみ初期保存
            if (!resJson.exists) {
                isCloudInitialSyncDone = true;
                const localMasterRaw = window.localStorage.getItem(STORAGE_KEY_STAFF_MASTER);
                let hasMeaningfulData = false;
                if (localMasterRaw) {
                    try {
                        const lList = JSON.parse(localMasterRaw);
                        hasMeaningfulData = lList.some(s => s.name && !s.name.startsWith('スタッフ ') || s.can8 || s.isChief || s.isHalf || s.section);
                    } catch (e) {}
                }
                if (hasMeaningfulData) {
                    await pushStateToCloud(true);
                }
                if (isMaster) renderMasterIntegrationView();
                return true;
            }
            if (!resJson.cloudState) {
                isCloudInitialSyncDone = true;
                setCloudStatusBadge('local');
                if (isMaster) renderMasterIntegrationView();
                return false;
            }

            const cloud = resJson.cloudState;
            lastCloudUpdatedAt = cloud.updatedAt || null;

            isRestoringFromCloud = true;
            try {
                // 1. スタッフマスター（全トグル・役職・所属・氏名・備考）のクラウド復元
                // 判定ロジック:
                // - showToastMsg（手動更新）または isInitialBoot（起動時）
                // - またはローカルが未編集の初期デフォルト（名前がスタッフ01かつトグルが空）の場合
                // ➔ クラウドのトグル設定・マスタを確実に復元・画面へ即座に反映！
                const localMasterRaw = window.localStorage.getItem(STORAGE_KEY_STAFF_MASTER);
                let shouldApplyMaster = (!localMasterRaw || showToastMsg || isInitialBoot);
                if (localMasterRaw && !showToastMsg && !isInitialBoot) {
                    try {
                        const localList = JSON.parse(localMasterRaw);
                        const isLocalDefault = Array.isArray(localList) && localList.every((s, i) => (!s.name || s.name === `スタッフ ${String(i+1).padStart(2,'0')}`) && !s.can8 && !s.isChief && !s.isHalf);
                        if (isLocalDefault) shouldApplyMaster = true;
                    } catch (e) {
                        shouldApplyMaster = true;
                    }
                }

                if (shouldApplyMaster && Array.isArray(cloud.staffMaster) && cloud.staffMaster.length > 0) {
                    window.localStorage.setItem(STORAGE_KEY_STAFF_MASTER, JSON.stringify(cloud.staffMaster));
                    applyMasterArrayToStaffList(cloud.staffMaster);
                }

                // 2. 全保存タームデータのクラウド同期（ローカル最新編集データおよび白紙化データの絶対保護）
                if (cloud.terms && typeof cloud.terms === 'object') {
                    Object.keys(cloud.terms).forEach(tDate => {
                        if (cloud.terms[tDate]) {
                            const curLocal = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${tDate}`);
                            if (curLocal) {
                                try {
                                    const lT = JSON.parse(curLocal);
                                    const localTime = new Date(lT.updatedAt || 0).getTime();
                                    const cloudTime = new Date(cloud.terms[tDate].updatedAt || 0).getTime();
                                    // ローカルのタイムスタンプがクラウドと同等以上なら、白紙化状態も含めて絶対に上書きしない
                                    if (!showToastMsg && localTime >= cloudTime) {
                                        return;
                                    }
                                } catch (e) {}
                            }
                            window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${tDate}`, JSON.stringify(cloud.terms[tDate]));
                        }
                    });
                }

                // 3. 保存済みターム一覧の同期
                if (Array.isArray(cloud.savedTerms)) {
                    const sortedTerms = Array.from(new Set(cloud.savedTerms)).sort();
                    window.localStorage.setItem(STORAGE_KEY_SAVED_TERMS, JSON.stringify(sortedTerms));
                }

                // 4. 表示中タームの再読込＆画面反映
                // ★ ユーザー指示: 他テーブルへ遷移した際にクラウドの古い日付でタームが進んだり戻ったりするのを完全遮断！
                const globalSyncDate = window.localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || window.localStorage.getItem('shift_schedule_current_start_date');
                const targetTermDate = globalSyncDate || currentWorkingStartDate || (isInitialBoot && cloud.lastActiveDate ? cloud.lastActiveDate : '2026-04-01');

                const matchedTerm = findTermByStartDate(targetTermDate);
                const finalDate = matchedTerm ? matchedTerm.startDate : targetTermDate;

                currentWorkingStartDate = finalDate;
                window.localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, finalDate);
                const dateInput = document.getElementById('termStartDate');
                if (dateInput) dateInput.value = finalDate;
                const termSelect = document.getElementById('termSelect');
                if (termSelect) termSelect.value = finalDate;

                if (window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${finalDate}`)) {
                    loadTermFromStorage(finalDate);
                } else {
                    loadStaffMaster();
                    staffList.forEach(s => { s.remarks = ''; });
                    renderInputTable();
                }
                renderSavedTermsSelect();
                // トグル状態および入力テーブルを画面へ確実に反映
                renderInputTable();
            } finally {
                isRestoringFromCloud = false;
                isCloudInitialSyncDone = true;
                if (isMaster) {
                    renderMasterIntegrationView();
                }
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
            if (isMaster) {
                renderMasterIntegrationView();
            }
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

            // ★ ユーザー指示: 2025年度のタームは不要。2026-04-01以降のタームのみ保持・表示
            const sorted = Array.from(termSet)
                .filter(dStr => dStr >= '2026-04-01')
                .sort();
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
                    floor: s.floor || '',
                    section: s.section || '',
                    can8: !!s.can8,
                    noEarly: !!s.noEarly,
                    noLate: !!s.noLate,
                    noEve: !!s.noEve,
                    canSched: !!s.canSched,
                    isSectionChief: !!s.isSectionChief,
                    isChief: !!(s.chief || s.isChief),
                    isSubChief: !!s.isSubChief,
                    isHalf: !!s.isHalf,
                    isFullTime: !!s.isFullTime,
                    prevName: s.prevName || '',
                    remarks: s.remarks || '',
                    allow6Consec: !!s.allow6Consec,
                isSatSunOff: !!s.isSatSunOff,
                isSunOff: !!s.isSunOff,
                    prevDays: (Array.isArray(s.prevDays) ? s.prevDays : []).map(v => extractCellSymbol(v)),
                    days: (Array.isArray(s.days) ? s.days : []).map(v => extractCellSymbol(v))
                })),
                outputGrid: (lastSolveResult && lastSolveResult.grid) 
                    ? lastSolveResult.grid.map(row => row.map(c => ({ ...c }))) 
                    : null,
                activeTab: activeTab,
                dayOffsets: [...dayOffsets],
                sectionTeamLeveledRev45: true,
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


            // ★ ST所属スタッフ連携データの読み込み（病棟テーブル時）
            loadLinkedSTData(targetStart);
            loadLinkedLifeData(targetStart);

            // ★ 別ターム読み込み時に前タームの自動配分リフ追跡メモリを必ずクリア（他タームへの誤警告防止）
            autoAssignedRefKeys.clear();
            autoAssignedStaffIds.clear();

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
                    staffList[idx].floor = s.floor || staffList[idx].floor || '';
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

                    let pDays = Array.isArray(s.prevDays) ? s.prevDays.map(v => extractCellSymbol(v)) : [];
                    if (pDays.length < 7) {
                        while (pDays.length < 7) pDays.unshift('');
                    } else if (pDays.length > 7) {
                        pDays = pDays.slice(-7);
                    }
                    staffList[idx].prevDays = pDays;
                    const loadedDays = Array.isArray(s.days) ? s.days.map(v => extractCellSymbol(v)) : [];
                    while (loadedDays.length < NUM_DAYS) loadedDays.push('');
                    staffList[idx].days = loadedDays.slice(0, NUM_DAYS);
                }
            });
            if (staffList.length > NUM_STAFF) {
                staffList = staffList.slice(0, NUM_STAFF);
            }

            // ★ スタッフマスターが存在する場合は、トグル・役職・所属・氏名等のマスター設定を最優先で同期！
            // （※備考 remarks はターム固有情報のため、当該タームの remarks をそのまま維持しマスターからは引き継がない）
            const termRemarks = staffList.map(st => st.remarks || '');
            if (loadStaffMaster()) {
                staffList.forEach((st, idx) => {
                    st.remarks = termRemarks[idx] || '';
                });
            } else {
                // マスター未作成なら現在の状態でマスターを初期保存
                saveStaffMaster();
            }

            // 2.5 日別出勤増減枠（dayOffsets）の復元
            const defaultOffsets = createDefaultDayOffsets(term.dates);
            if (isST || isLife) {
                // ★ STテーブルおよび生活期テーブルはユーザー要望により日付の上下矢印（dayOffsets）は全日デフォルト0に固定
                dayOffsets = new Array(NUM_DAYS).fill(0);
            } else if (Array.isArray(data.dayOffsets) && data.dayOffsets.length >= 28) {
                const hasAnyNonZero = data.dayOffsets.some(v => v !== 0);
                // 古い月曜始まりダミー(d=5,6が土日)のまま水曜始まりタームに保存されてしまった古いデータの自動補正判定:
                // 実際の土日祝(defaultOffsets === -2)の日のうち半分以上が0で、かつ実際の平日に-2が混入している場合はカレンダー整合補正
                let weekendMatchCount = 0;
                let weekendTotalCount = 0;
                let weekdayMinusTwoCount = 0;
                for (let d = 0; d < NUM_DAYS; d++) {
                    if (defaultOffsets[d] === -2) {
                        weekendTotalCount++;
                        if (data.dayOffsets[d] < 0) weekendMatchCount++;
                    } else if (data.dayOffsets[d] === -2) {
                        weekdayMinusTwoCount++;
                    }
                }
                const isStaleMisalignedOffsets = (weekendTotalCount >= 6 && weekendMatchCount <= 2 && weekdayMinusTwoCount >= 4);

                if (!hasAnyNonZero || isStaleMisalignedOffsets) {
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
                    dayOffsets: [...dayOffsets],
                    isST: isST,
                    isSouth: isSouth,
                    isLife: isLife,
                    lifeDailyWork: getLinkedLifeDailyWork(),
                    stDailyWork: getLinkedSTDailyWork(),
                    stDailyHeadCount: getLinkedSTDailyHeadCount(),
                    stDailyFtWork: getLinkedSTDailyFtWork(),
                    stDailyEarly: getLinkedSTDailyEarly(),
                    stDailyLate: getLinkedSTDailyLate(),
                    stDailyEve: getLinkedSTDailyEve(),
                    stFloorFtCount: getLinkedSTFloorFtCount()
                });
                scheduler.grid = data.outputGrid.map(row => {
                    const rCopy = Array.isArray(row) ? row.map(c => ({ ...c })) : [];
                    while (rCopy.length < NUM_DAYS) rCopy.push({ symbol: '', isFixed: false });
                    return rCopy.slice(0, NUM_DAYS);
                });

                // ★ 過去の旧エンジン（rev37以前）で生成された出力データがクラウドに残っており、
                // 26日目（日曜）に25.5名のような極端な落ち込み（実数負荷の最大-最小差 > 3.0）がある場合は、
                // 最新の平準化エンジンで自動再計算して異常値を即座に解消する
                let hasUnfixedSpecialInLoaded = false;
                for (let s = 0; s < NUM_STAFF; s++) {
                    if (!scheduler.grid[s]) continue;
                    for (let d = 0; d < NUM_DAYS; d++) {
                        const c = scheduler.grid[s][d];
                        if (c && !c.isFixed && (isRestrictedSpecial(c.symbol) || c.symbol === SYMBOLS.H8)) {
                            hasUnfixedSpecialInLoaded = true;
                            break;
                        }
                    }
                    if (hasUnfixedSpecialInLoaded) break;
                }
                const loadedLoads = [];
                const secArrays = { 'PT A': [], 'PT B': [], 'OT A': [], 'OT B': [], teamA: [], teamB: [] };
                for (let d = 0; d < NUM_DAYS; d++) {
                    loadedLoads.push(scheduler.getDailyEffectiveRealLoad(d));
                    if (typeof scheduler.getDailySectionWorkMap === 'function') {
                        const sm = scheduler.getDailySectionWorkMap(d);
                        secArrays['PT A'].push(sm['PT A']);
                        secArrays['PT B'].push(sm['PT B']);
                        secArrays['OT A'].push(sm['OT A']);
                        secArrays['OT B'].push(sm['OT B']);
                        secArrays.teamA.push(sm.teamA);
                        secArrays.teamB.push(sm.teamB);
                    }
                }
                const loadedLoadDiff = Math.max(...loadedLoads) - Math.min(...loadedLoads);
                const calcSpread = (arr) => arr.length > 0 ? (Math.max(...arr) - Math.min(...arr)) : 0;
                const maxSecSpread = Math.max(
                    calcSpread(secArrays['PT A']),
                    calcSpread(secArrays['PT B']),
                    calcSpread(secArrays['OT A']),
                    calcSpread(secArrays['OT B'])
                );
                const maxTeamSpread = Math.max(calcSpread(secArrays.teamA), calcSpread(secArrays.teamB));

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

    // セルまたはオブジェクトから安全に文字列シンボルを抽出するヘルパー（[object Object] の混入を100%物理遮断）
    function extractCellSymbol(cell) {
        if (cell === null || cell === undefined) return '';
        let depth = 0;
        while (cell && typeof cell === 'object' && depth < 5) {
            depth++;
            if (cell.symbol !== undefined && cell.symbol !== null) {
                cell = cell.symbol;
            } else if (cell.value !== undefined && cell.value !== null) {
                cell = cell.value;
            } else if (cell.text !== undefined && cell.text !== null) {
                cell = cell.text;
            } else {
                return '';
            }
        }
        const str = String(cell).trim();
        if (str === '[object Object]' || str === 'undefined' || str === 'null' || str === 'NaN') return '';
        return str;
    }

    // ==========================================
    // ★ ユーザー指示: 統括マスターテーブルから全スタッフの最新確定最終7日データを自動集約・保存
    // マスターテーブルで施された微調整（早・遅の変更、公休移動等）を確実に保持
    // ==========================================
    function saveMasterConfirmedLast7Days(termStartDate) {
        if (!termStartDate) return;
        try {
            const term = getTermInfo(termStartDate);
            const numDays = term.dates.length;
            const confirmedMap = {};

            // 各フロア（1f, 2f, 3f, south）の最終確定グリッドから最終7日を抽出
            ['1f', '2f', '3f', 'south'].forEach(flId => {
                const raw = localStorage.getItem(`shift_schedule_${flId}_term_${termStartDate}`);
                if (raw) {
                    try {
                        const data = JSON.parse(raw);
                        if (Array.isArray(data.staffList) && Array.isArray(data.outputGrid)) {
                            data.staffList.forEach((st, sIdx) => {
                                const name = (st.name || '').trim();
                                const row = data.outputGrid[sIdx];
                                if (name && Array.isArray(row) && row.length >= 7) {
                                    const rLen = row.length;
                                    confirmedMap[name] = [
                                        extractCellSymbol(row[rLen - 7]),
                                        extractCellSymbol(row[rLen - 6]),
                                        extractCellSymbol(row[rLen - 5]),
                                        extractCellSymbol(row[rLen - 4]),
                                        extractCellSymbol(row[rLen - 3]),
                                        extractCellSymbol(row[rLen - 2]),
                                        extractCellSymbol(row[rLen - 1])
                                    ];
                                }
                            });
                        }
                    } catch (e) {}
                }
            });

            // STスタッフの最終7日
            const rawSt = localStorage.getItem(`shift_schedule_st_term_${termStartDate}`);
            if (rawSt) {
                try {
                    const stData = JSON.parse(rawSt);
                    if (Array.isArray(stData.staffList) && Array.isArray(stData.outputGrid)) {
                        stData.staffList.forEach((st, sIdx) => {
                            const name = (st.name || '').trim();
                            const row = stData.outputGrid[sIdx];
                            if (name && Array.isArray(row) && row.length >= 7) {
                                const rLen = row.length;
                                confirmedMap[name] = [
                                    extractCellSymbol(row[rLen - 7]),
                                    extractCellSymbol(row[rLen - 6]),
                                    extractCellSymbol(row[rLen - 5]),
                                    extractCellSymbol(row[rLen - 4]),
                                    extractCellSymbol(row[rLen - 3]),
                                    extractCellSymbol(row[rLen - 2]),
                                    extractCellSymbol(row[rLen - 1])
                                ];
                            }
                        });
                    }
                } catch (e) {}
            }

            // 生活期スタッフの最終7日
            const rawLife = localStorage.getItem(`shift_schedule_life_term_${termStartDate}`);
            if (rawLife) {
                try {
                    const lifeData = JSON.parse(rawLife);
                    if (Array.isArray(lifeData.staffList) && Array.isArray(lifeData.outputGrid)) {
                        lifeData.staffList.forEach((st, sIdx) => {
                            const name = (st.name || '').trim();
                            const row = lifeData.outputGrid[sIdx];
                            if (name && Array.isArray(row) && row.length >= 7) {
                                const rLen = row.length;
                                confirmedMap[name] = [
                                    extractCellSymbol(row[rLen - 7]),
                                    extractCellSymbol(row[rLen - 6]),
                                    extractCellSymbol(row[rLen - 5]),
                                    extractCellSymbol(row[rLen - 4]),
                                    extractCellSymbol(row[rLen - 3]),
                                    extractCellSymbol(row[rLen - 2]),
                                    extractCellSymbol(row[rLen - 1])
                                ];
                            }
                        });
                    }
                } catch (e) {}
            }

            localStorage.setItem(`shift_schedule_master_confirmed_last7_${termStartDate}`, JSON.stringify(confirmedMap));
            // 過去コードとの互換性用
            localStorage.setItem(`shift_schedule_master_confirmed_last5_${termStartDate}`, JSON.stringify(confirmedMap));
        } catch (e) {
            console.warn('saveMasterConfirmedLast7Days error:', e);
        }
    }
    const saveMasterConfirmedLast5Days = saveMasterConfirmedLast7Days;

    // ★ ユーザー指示: 直前タームの最終7日間実績を反映する（マスターテーブルで微調整されたデータを最優先で引っ張る！）
    function applyPreviousTermHistory(prevStartDateStr, showToastMsg = true) {
        try {
            let appliedCount = 0;
            const prevStaffByName = new Map();
            let usedSource = 'フロア保存データ';

            // 1. 【最優先】マスターテーブル統括ファイルで確定・微調整された最終7日間実績をチェック
            let rawMasterConfirmed = localStorage.getItem(`shift_schedule_master_confirmed_last7_${prevStartDateStr}`);
            if (!rawMasterConfirmed) {
                rawMasterConfirmed = localStorage.getItem(`shift_schedule_master_confirmed_last5_${prevStartDateStr}`);
            }
            if (rawMasterConfirmed) {
                try {
                    const masterMap = JSON.parse(rawMasterConfirmed);
                    if (masterMap && typeof masterMap === 'object') {
                        Object.keys(masterMap).forEach(name => {
                            let arr = masterMap[name];
                            if (Array.isArray(arr)) {
                                let last7 = arr.map(v => extractCellSymbol(v));
                                while (last7.length < 7) last7.unshift('');
                                if (last7.length > 7) last7 = last7.slice(-7);
                                prevStaffByName.set(name.trim(), last7);
                            }
                        });
                        if (prevStaffByName.size > 0) {
                            usedSource = '👑 マスターテーブル統括データ（微調整反映済）';
                        }
                    }
                } catch (e) {}
            }

            // 2. マスター確定データがない場合のフォールバック（フロアの保存データ）
            if (prevStaffByName.size === 0) {
                const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${prevStartDateStr}`);
                if (raw) {
                    try {
                        const prevData = JSON.parse(raw);
                        if (prevData && Array.isArray(prevData.staffList)) {
                            prevData.staffList.forEach((pst, pIdx) => {
                                const normName = (pst.name || '').trim();
                                if (!normName) return;
                                let last7 = new Array(7).fill('');
                                if (prevData.outputGrid && prevData.outputGrid[pIdx] && prevData.outputGrid[pIdx].length >= 7) {
                                    const row = prevData.outputGrid[pIdx];
                                    const rLen = row.length;
                                    last7 = [
                                        extractCellSymbol(row[rLen - 7]),
                                        extractCellSymbol(row[rLen - 6]),
                                        extractCellSymbol(row[rLen - 5]),
                                        extractCellSymbol(row[rLen - 4]),
                                        extractCellSymbol(row[rLen - 3]),
                                        extractCellSymbol(row[rLen - 2]),
                                        extractCellSymbol(row[rLen - 1])
                                    ];
                                } else if (Array.isArray(pst.days) && pst.days.length >= 7) {
                                    const dLen = pst.days.length;
                                    last7 = [
                                        extractCellSymbol(pst.days[dLen - 7]),
                                        extractCellSymbol(pst.days[dLen - 6]),
                                        extractCellSymbol(pst.days[dLen - 5]),
                                        extractCellSymbol(pst.days[dLen - 4]),
                                        extractCellSymbol(pst.days[dLen - 3]),
                                        extractCellSymbol(pst.days[dLen - 2]),
                                        extractCellSymbol(pst.days[dLen - 1])
                                    ];
                                }
                                prevStaffByName.set(normName, last7);
                            });
                        }
                    } catch (e) {}
                }
            }

            for (let s = 0; s < NUM_STAFF; s++) {
                if (!staffList[s]) continue;
                const curName = (staffList[s].name || '').trim();
                const prevName = (staffList[s].prevName || '').trim();

                // 照合優先: 1. 現在の氏名、2. 改姓・旧姓（prevName）
                let last7 = prevStaffByName.get(curName) || (prevName ? prevStaffByName.get(prevName) : null);
                if (last7) {
                    staffList[s].prevDays = last7.map(v => extractCellSymbol(v));
                    if (staffList[s].prevDays.some(v => v !== '')) appliedCount++;
                } else {
                    // 過去に該当名がない新規中途採用等のスタッフ
                    staffList[s].prevDays = new Array(7).fill('');
                }
            }

            renderInputTable();
            saveCurrentTermToStorage();

            if (showToastMsg) {
                const prevD = new Date(prevStartDateStr + 'T00:00:00');
                const prevEndD = new Date(prevD);
                prevEndD.setDate(prevEndD.getDate() + 27);
                const titleStr = `${prevD.getMonth() + 1}/${prevD.getDate()}～${prevEndD.getMonth() + 1}/${prevEndD.getDate()}`;
                showToast(`🔗 直前ターム（${titleStr}）の最終7日実績を【${usedSource}】から取り込みました（${appliedCount}名分反映）`);
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


        // ★ ST所属スタッフ連携データの読み込み（病棟テーブル時）
        loadLinkedSTData(newStartDate);
        loadLinkedLifeData(newStartDate);

        // スタッフ基本設定マスターを引き継ぎ復元！（※備考 remarks はターム固有のため白紙リセット）
        loadStaffMaster();
        staffList.forEach(s => {
            enforceRoleExclusivity(s);
            s.remarks = '';
            s.prevDays = new Array(7).fill('');
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

        // ★ 直前タームが存在すれば、その最終7日間の勤務実績を自動連携！
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

    // ★ マスターテーブル専用 Undo/Redo 履歴スタック
    const masterUndoStack = [];
    const masterRedoStack = [];

    function pushMasterHistory(action) {
        masterUndoStack.push(action);
        if (masterUndoStack.length > MAX_HISTORY) {
            masterUndoStack.shift();
        }
        masterRedoStack.length = 0;
        updateUndoRedoUI();
    }

    function getHistorySnapshot() {
        return {
            staffList: staffList.map(s => ({
                id: s.id,
                name: s.name,
                isUnused: !!s.isUnused,
                floor: s.floor || '',
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
                isZeroCount: !!s.isZeroCount,
                isFirstYear: !!s.isFirstYear,
                lifeSection: s.lifeSection || '',
                haSection: s.haSection || '',
                jobTitle: s.jobTitle || '',
                isFullTime: !!s.isFullTime,
                allow6Consec: !!s.allow6Consec,
                isSatSunOff: !!s.isSatSunOff,
                isSunOff: !!s.isSunOff,
                prevName: s.prevName || '',
                remarks: s.remarks || '',
                prevDays: [...s.prevDays],
                days: [...s.days]
            })),
            startDate: document.getElementById('termStartDate')?.value || currentWorkingStartDate,
            outputGrid: (lastSolveResult && lastSolveResult.grid) ? lastSolveResult.grid.map(row => row.map(c => ({ ...c }))) : null,
            outputStats: (lastSolveResult && lastSolveResult.stats) ? JSON.parse(JSON.stringify(lastSolveResult.stats)) : null,
            stTermJson: localStorage.getItem(`shift_schedule_st_term_${document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01'}`),
            lifeTermJson: localStorage.getItem(`shift_schedule_life_term_${document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01'}`)
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
        if (isMaster) {
            if (masterUndoStack.length === 0) return;
            const action = masterUndoStack.pop();
            masterRedoStack.push(action);
            try {
                localStorage.setItem(action.targetKey, action.prevJson);
                renderMasterIntegrationView();
                if (action.openFloors && Array.isArray(action.openFloors)) {
                    action.openFloors.forEach(flId => {
                        const rows = document.querySelectorAll(`.master-detail-${flId}`);
                        rows.forEach(r => { r.style.display = 'table-row'; });
                        const btn = document.querySelector(`.toggle-master-floor-btn[data-floor="${flId}"]`);
                        if (btn) {
                            btn.innerHTML = '▲折りたたむ';
                            btn.style.background = '#f1f5f9';
                        }
                    });
                }
                updateUndoRedoUI();
                showToast('↩ 直前の状態に戻しました');
            } catch (err) {
                console.error('マスターUndoエラー:', err);
            }
            return;
        }

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
        if (isMaster) {
            if (masterRedoStack.length === 0) return;
            const action = masterRedoStack.pop();
            masterUndoStack.push(action);
            try {
                localStorage.setItem(action.targetKey, action.nextJson);
                renderMasterIntegrationView();
                if (action.openFloors && Array.isArray(action.openFloors)) {
                    action.openFloors.forEach(flId => {
                        const rows = document.querySelectorAll(`.master-detail-${flId}`);
                        rows.forEach(r => { r.style.display = 'table-row'; });
                        const btn = document.querySelector(`.toggle-master-floor-btn[data-floor="${flId}"]`);
                        if (btn) {
                            btn.innerHTML = '▲折りたたむ';
                            btn.style.background = '#f1f5f9';
                        }
                    });
                }
                updateUndoRedoUI();
                showToast('↪ やり直しました');
            } catch (err) {
                console.error('マスターRedoエラー:', err);
            }
            return;
        }

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
                    staffList[idx].floor = s.floor || staffList[idx].floor || '';
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
                    staffList[idx].isZeroCount = !!s.isZeroCount;
                    staffList[idx].isFirstYear = !!s.isFirstYear;
                    staffList[idx].lifeSection = s.lifeSection || '';
                    staffList[idx].haSection = s.haSection || '';
                    staffList[idx].jobTitle = s.jobTitle || '';
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
        // STおよび生活期ハ連携データの復元
        const curTermDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        if (state.stTermJson !== undefined) {
            if (state.stTermJson) {
                localStorage.setItem(`shift_schedule_st_term_${curTermDate}`, state.stTermJson);
            } else {
                localStorage.removeItem(`shift_schedule_st_term_${curTermDate}`);
            }
            if (typeof loadLinkedSTData === 'function') loadLinkedSTData();
        }
        if (state.lifeTermJson !== undefined) {
            if (state.lifeTermJson) {
                localStorage.setItem(`shift_schedule_life_term_${curTermDate}`, state.lifeTermJson);
            } else {
                localStorage.removeItem(`shift_schedule_life_term_${curTermDate}`);
            }
            if (typeof loadLinkedLifeData === 'function') loadLinkedLifeData();
        }

        // 出力シートの復元
        if (state.outputGrid) {
            const restoredGrid = state.outputGrid.map(row => row.map(c => ({ ...c })));
            if (!lastSolveResult) {
                lastSolveResult = { grid: restoredGrid, stats: state.outputStats || null };
            } else {
                lastSolveResult.grid = restoredGrid;
                if (state.outputStats) lastSolveResult.stats = state.outputStats;
            }
            if (lastScheduler) {
                lastScheduler.grid = lastSolveResult.grid;
                if (typeof getLinkedSTDailyWork === 'function') lastScheduler.stDailyWork = getLinkedSTDailyWork();
                if (typeof getLinkedSTDailyEarly === 'function') lastScheduler.stDailyEarly = getLinkedSTDailyEarly();
                if (typeof getLinkedSTDailyLate === 'function') lastScheduler.stDailyLate = getLinkedSTDailyLate();
                if (typeof getLinkedSTDailyEve === 'function') lastScheduler.stDailyEve = getLinkedSTDailyEve();
                if (typeof getLinkedLifeDailyWork === 'function') lastScheduler.lifeDailyWork = getLinkedLifeDailyWork();
                const newStats = lastScheduler.calculateStats();
                lastSolveResult.stats = newStats;
                renderOutputTable(lastSolveResult.grid, newStats);
                renderStatsDashboard(newStats);
            } else {
                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        } else {
            // 自動生成前の状態へ復元
            lastSolveResult = null;
            resetOutputTable();
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
        const undoDisabled = isMaster ? (masterUndoStack.length === 0) : (undoStack.length === 0);
        const redoDisabled = isMaster ? (masterRedoStack.length === 0) : (redoStack.length === 0);
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
    // ★ 生活期テーブルでは「✨ 特殊勤務を入れる」ボタンは不要のため完全非表示化
    if (isLife) {
        const specBtn = document.getElementById('assignSpecialDutiesBtn');
        if (specBtn) specBtn.style.display = 'none';
        const fSpecBtn = document.getElementById('forceAssignSpecialBtn');
        if (fSpecBtn) fSpecBtn.style.display = 'none';
    }

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
            <div class="day-offset-ctrl" data-d="${d}" title="この日の出勤加減枠（0.5刻み、例: 行事で+0.5、減員で-0.5）" style="display:inline-flex; align-items:center; justify-content:center; gap:1px; width:100%;">
                <button type="button" class="day-offset-btn offset-minus" data-d="${d}" title="出勤人数を-0.5" style="width:13px; height:16px; font-size:10px; line-height:1; padding:0;">-</button>
                <span class="day-offset-val ${cls}" data-d="${d}" style="min-width:20px; font-size:0.72rem; font-weight:700; text-align:center;">${valText}</span>
                <button type="button" class="day-offset-btn offset-plus" data-d="${d}" title="出勤人数を+0.5" style="width:13px; height:16px; font-size:10px; line-height:1; padding:0;">+</button>
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

        const isSouth = (currentFloor === '南' || appConfig.deptId === 'south');

        let headHtml = `
            <tr>
                <th class="sticky-col-1" rowspan="2" title="不使用時にONにする（勤務表・出力から除外）">不使用</th>
                <th class="sticky-col-2" rowspan="2">氏名</th>
                <th class="prev-col-header" colspan="7">前ターム最終7日間実績</th>
                <th colspan="${NUM_DAYS}">当ターム（${term.title}）希望休・事前固定枠（🔒手動以外は変更不可）</th>
        `;

        if (isST) {
            // ★ ST専用ヘッダー列（所属階 1F/2F/3F/南 択一、早不可、スケ可、係長/主任/副主任 択一、0.5、専従、6連勤可、旧姓、備考）
            headHtml += `
                <th class="flag-col" rowspan="2" title="1階病棟所属（択一）" style="background:#e0f2fe; color:#0369a1; font-weight:700;">1F</th>
                <th class="flag-col" rowspan="2" title="2階病棟所属（択一）" style="background:#dcfce7; color:#15803d; font-weight:700;">2F</th>
                <th class="flag-col" rowspan="2" title="3階病棟所属（択一）" style="background:#fef3c7; color:#a16207; font-weight:700;">3F</th>
                <th class="flag-col" rowspan="2" title="南病棟所属（択一）" style="background:#fce7f3; color:#be185d; font-weight:700;">南</th>
                <th class="flag-col" rowspan="2" title="早番不可">早<br>不可</th>
                <th class="flag-col" rowspan="2" title="スケ可（各階毎日どちらか1名以上出勤）" style="background:#e0f2fe; color:#0369a1;">スケ<br>可</th>
                <th class="flag-col" rowspan="2" title="係長（役職は択一）" style="background:#fef3c7; color:#92400e;">係長</th>
                <th class="flag-col" rowspan="2" title="主任（役職は択一）" style="background:#fef9c3; color:#854d0e;">主任</th>
                <th class="flag-col" rowspan="2" title="副主任（役職は択一）" style="background:#e0f2fe; color:#0369a1;">副主任</th>
                <th class="flag-col" rowspan="2" title="0（実数合計計算時に0人で計算）" style="background:#fae8ff; color:#86198f; font-weight:800;">0</th>
                <th class="flag-col" rowspan="2" title="0.5（実数合計計算時に0.5人で計算）" style="background:#f3e8ff; color:#6b21a8; font-weight:800;">0.5</th>
                <th class="flag-col" rowspan="2" title="1年目スタッフ" style="background:#fef08a; color:#854d0e; font-weight:800;">1年目</th>
                <th class="flag-col" rowspan="2" title="専従" style="background:#dcfce7; color:#166534;">専従</th>
                <th class="flag-col" rowspan="2" title="土日休（事前希望がない限り土日休み固定）" style="background:#dbeafe; color:#1e40af; font-weight:800;">土日休</th>
                <th class="flag-col" rowspan="2" title="日休（日曜日固定公休＋平日分散配置）" style="background:#fef3c7; color:#92400e; font-weight:800;">日休</th>
                <th class="flag-col" rowspan="2" title="6連勤例外許可" style="background:#fee2e2; color:#991b1b;">6連勤<br>可</th>
                <th class="flag-col" rowspan="2" title="改姓・旧姓（前タームの氏名）" style="background:#f1f5f9; color:#475569; min-width:80px;">旧姓</th>
                <th class="remarks-col" rowspan="2" title="委員会等のメモ（ExcelのAG列と自動連携）" style="background:#f8fafc; color:#1e293b; min-width:220px; max-width:320px;">備考（メモ）</th>
            `;
        } else if (isLife) {
            // ★ 生活期テーブル専用ヘッダー（PT/OT/ST, 係長/主任/副主任, 8時可, 訪問/通所/Cl1/Cl2/管理, ハ1〜ハ4, 0, 0.5）
            headHtml += `
                <th class="flag-col" rowspan="2" title="PT（択一）" style="background:#e0e7ff; color:#3730a3; font-weight:800;">PT</th>
                <th class="flag-col" rowspan="2" title="OT（択一）" style="background:#fae8ff; color:#86198f; font-weight:800;">OT</th>
                <th class="flag-col" rowspan="2" title="ST（択一）" style="background:#fce7f3; color:#9d174d; font-weight:800;">ST</th>
                <th class="flag-col" rowspan="2" title="係長（択一）" style="background:#fef3c7; color:#92400e; font-weight:800;">係長</th>
                <th class="flag-col" rowspan="2" title="主任（択一）" style="background:#fef9c3; color:#854d0e; font-weight:800;">主任</th>
                <th class="flag-col" rowspan="2" title="副主任（択一）" style="background:#e0f2fe; color:#0369a1; font-weight:800;">副主任</th>
                <th class="flag-col" rowspan="2" title="8時開始可能か（訪問のみ使用）" style="background:#e0f2fe; color:#0369a1; font-weight:800;">8時<br>可</th>
                <th class="flag-col" rowspan="2" title="訪問（土日休み固定、8時勤務あり）" style="background:#e0f2fe; color:#0369a1; font-weight:800;">訪問</th>
                <th class="flag-col" rowspan="2" title="通所（日曜日全員休み、平日は分散）" style="background:#fef3c7; color:#92400e; font-weight:800;">通所</th>
                <th class="flag-col" rowspan="2" title="Cl1（土日休み固定、集計除外）" style="background:#f1f5f9; color:#475569; font-weight:800;">Cl1</th>
                <th class="flag-col" rowspan="2" title="Cl2（日曜日全員休み、平日は分散）" style="background:#ffedd5; color:#c2410c; font-weight:800;">Cl2</th>
                <th class="flag-col" rowspan="2" title="管理（土日休み固定、集計除外）" style="background:#f3e8ff; color:#6b21a8; font-weight:800;">管理</th>
                <th class="flag-col" rowspan="2" title="ハ1（土日休み固定、1階へ実数0.5加算）" style="background:#dcfce7; color:#15803d; font-weight:800;">ハ1</th>
                <th class="flag-col" rowspan="2" title="ハ2（土日休み固定、2階へ実数0.5加算）" style="background:#dcfce7; color:#15803d; font-weight:800;">ハ2</th>
                <th class="flag-col" rowspan="2" title="ハ3（通所と同じ組み方、3階へ実数0.5加算）" style="background:#dcfce7; color:#15803d; font-weight:800;">ハ3</th>
                <th class="flag-col" rowspan="2" title="ハ南（通所と同じ組み方、南病棟へ実数0.5加算）" style="background:#fae8ff; color:#86198f; font-weight:800;">ハ南</th>
                <th class="flag-col" rowspan="2" title="0（実数計算で0人換算）" style="background:#f5d0fe; color:#701a75; font-weight:800;">0</th>
                <th class="flag-col" rowspan="2" title="0.5（実数計算で0.5人換算）" style="background:#e9d5ff; color:#581c87; font-weight:800;">0.5</th>
                                <th class="flag-col" rowspan="2" title="土日休（土日固定休み）" style="background:#dbeafe; color:#1e40af; font-weight:800;">土日休</th>
                <th class="flag-col" rowspan="2" title="日休（日曜日固定公休＋平日分散配置）" style="background:#fef3c7; color:#92400e; font-weight:800;">日休</th>
                <th class="flag-col" rowspan="2" title="6連勤例外許可" style="background:#fee2e2; color:#991b1b;">6連勤<br>可</th>
                <th class="flag-col" rowspan="2" title="改姓・旧姓（前タームの氏名）" style="background:#f1f5f9; color:#475569; min-width:80px;">旧姓</th>
                <th class="remarks-col" rowspan="2" title="メモ" style="background:#f8fafc; color:#1e293b; min-width:220px; max-width:320px;">備考（メモ）</th>
            `;
        } else {
            // 通常PT/OTテーブルヘッダー（南病棟はPT 2/3, OT 2/3と表記）
            headHtml += `
                <th class="flag-col" rowspan="2" title="8時開始可能か（1〜9番のみON）">8時<br>可</th>
                <th class="flag-col" rowspan="2" title="早番不可">早<br>不可</th>
                <th class="flag-col" rowspan="2" title="遅番不可">遅<br>不可</th>
                <th class="flag-col" rowspan="2" title="イブニング不可">E<br>不可</th>
                <th class="flag-col" rowspan="2" title="${isSouth ? 'PT 2 セクション' : 'PT A セクション（この中で出勤平均化）'}" style="background:#e0e7ff; color:#3730a3;">PT<br>${isSouth ? '2' : 'A'}</th>
                <th class="flag-col" rowspan="2" title="${isSouth ? 'PT 3 セクション' : 'PT B セクション（この中で出勤平均化）'}" style="background:#ede9fe; color:#5b21b6;">PT<br>${isSouth ? '3' : 'B'}</th>
                <th class="flag-col" rowspan="2" title="${isSouth ? 'OT 2 セクション' : 'OT A セクション（この中で出勤平均化）'}" style="background:#fae8ff; color:#86198f;">OT<br>${isSouth ? '2' : 'A'}</th>
                <th class="flag-col" rowspan="2" title="${isSouth ? 'OT 3 セクション' : 'OT B セクション（この中で出勤平均化）'}" style="background:#fce7f3; color:#9d174d;">OT<br>${isSouth ? '3' : 'B'}</th>
                <th class="flag-col" rowspan="2" title="スケ可（毎日2名以上必要・○のみ）" style="background:#e0f2fe; color:#0369a1;">スケ<br>可</th>
                <th class="flag-col" rowspan="2" title="係長（基本平日5連勤、不在時主任1名以上出勤）" style="background:#fef3c7; color:#92400e;">係長</th>
                <th class="flag-col" rowspan="2" title="主任（係長不在時に1名以上出勤）" style="background:#fef9c3; color:#854d0e;">主任</th>
                <th class="flag-col" rowspan="2" title="副主任（係長主任不在時A1名B1名出勤）" style="background:#e0f2fe; color:#0369a1;">副主任</th>
                <th class="flag-col" rowspan="2" title="0（実数合計計算時に0人で計算）" style="background:#fae8ff; color:#86198f; font-weight:800;">0</th>
                <th class="flag-col" rowspan="2" title="0.5（実数合計計算時に0.5人で計算）" style="background:#f3e8ff; color:#6b21a8; font-weight:800;">0.5</th>
                <th class="flag-col" rowspan="2" title="1年目スタッフ" style="background:#fef08a; color:#854d0e; font-weight:800;">1年目</th>
                <th class="flag-col" rowspan="2" title="専従（PT・OT・ST専従でその階3名以上出勤）" style="background:#dcfce7; color:#166534;">専従</th>
                <th class="flag-col" rowspan="2" title="6連勤例外許可（週6勤務＆6連勤を許容）" style="background:#fee2e2; color:#991b1b;">6連勤<br>可</th>
                <th class="flag-col" rowspan="2" title="改姓・旧姓（前タームの氏名）" style="background:#f1f5f9; color:#475569; min-width:80px;">旧姓</th>
                <th class="remarks-col" rowspan="2" title="委員会等のメモ（ExcelのAG列と自動連携）" style="background:#f8fafc; color:#1e293b; min-width:220px; max-width:320px;">備考（メモ）</th>
            `;
        }
        headHtml += `
            </tr>
            <tr>
                <th class="prev-col-header">前7</th>
                <th class="prev-col-header">前6</th>
                <th class="prev-col-header">前5</th>
                <th class="prev-col-header">前4</th>
                <th class="prev-col-header">前3</th>
                <th class="prev-col-header">前2</th>
                <th class="prev-col-header">前1</th>
        `;

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const cls = di.wIdx === 5 ? 'header-sat' : ((di.wIdx === 6 || di.isHoliday) ? 'header-sun' : '');
            const thickCls = getDayBorderClass(d);
            headHtml += `<th class="${cls} ${thickCls} header-day-col col-day-fixed" style="width:52px; min-width:52px; max-width:52px;" title="${di.label} (${di.weekday})${di.isHoliday ? ' 祝日' : ''}">
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
            bodyHtml += `<tr class="${rowClass}" draggable="true" data-s="${sIdx}" style="cursor:move;">`;
            bodyHtml += `<td class="sticky-col-1 text-center" style="padding:2px;">
                <label class="toggle-switch" title="不使用（ONで勤務表・出力から除外）">
                    <input type="checkbox" ${staff.isUnused ? 'checked' : ''} data-unused="true" data-s="${sIdx}">
                    <span class="toggle-slider danger-slider"></span>
                </label>
            </td>`;
            bodyHtml += `<td class="sticky-col-2">
                <input type="text" class="staff-name-input" value="${escapeHtmlText(staff.name)}" data-s="${sIdx}" style="width:100%; border:none; background:transparent; font-weight:600; outline:none;">
            </td>`;

            // 前7日間
            for (let p = 0; p < 7; p++) {
                const val = extractCellSymbol(staff.prevDays ? staff.prevDays[p] : '');
                let specialCls = '';
                if (val === '早' || val === 'ハヤ') specialCls = ' cell-special-early';
                else if (val === '遅') specialCls = ' cell-special-late';
                else if (val === 'E') specialCls = ' cell-special-eve';
                bodyHtml += `<td class="day-cell prev-col-cell${specialCls}" data-sym="${val}" data-type="prev" data-s="${sIdx}" data-p="${p}">${val}</td>`;
            }

            // 当ターム 1日〜28日
            const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
            for (let d = 0; d < NUM_DAYS; d++) {
                const val = extractCellSymbol(staff.days ? staff.days[d] : '');
                const isRef = isRefreshHolidaySymbol(val);
                // ★ ユーザー指示: リフレッシュ休暇「上1〜5」「下1〜3」はいかなる場合も赤字固定にせず通常黒字（編集自由）！
                const isFixed = (val && !isRef) ? true : false;
                const cls = isFixed ? 'day-cell fixed-cell' : (val ? 'day-cell auto-ref-cell' : 'day-cell');
                const thickCls = getDayBorderClass(d);
                const lockTitle = isFixed ? `事前固定枠: ${val}（自動上書きロック中）` : (val ? `自動配分リフ: ${val}（編集・変更自由）` : 'クリックで記号入力');
                let specialCls = '';
                if (val === '早' || val === 'ハヤ') specialCls = ' cell-special-early';
                else if (val === '遅') specialCls = ' cell-special-late';
                else if (val === 'E') specialCls = ' cell-special-eve';
                bodyHtml += `<td class="${cls} ${thickCls}${specialCls}" data-sym="${val}" data-type="day" data-s="${sIdx}" data-d="${d}" title="${lockTitle}">${val}</td>`;
            }

            // 28日の右側: 属性フラグトグルスイッチ群
            if (isST) {
                // ★ ST専用フラグ列
                bodyHtml += `
                    <td class="flag-col" style="background:#f0f9ff;">
                        <label class="toggle-switch" title="1F所属（択一）">
                            <input type="checkbox" ${staff.floor === '1F' ? 'checked' : ''} data-floor="1F" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#f0fdf4;">
                        <label class="toggle-switch" title="2F所属（択一）">
                            <input type="checkbox" ${staff.floor === '2F' ? 'checked' : ''} data-floor="2F" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fefce8;">
                        <label class="toggle-switch" title="3F所属（択一）">
                            <input type="checkbox" ${staff.floor === '3F' ? 'checked' : ''} data-floor="3F" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fdf2f8;">
                        <label class="toggle-switch" title="南所属（択一）">
                            <input type="checkbox" ${staff.floor === '南' ? 'checked' : ''} data-floor="南" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col">
                        <label class="toggle-switch" title="早番不可">
                            <input type="checkbox" ${staff.noEarly ? 'checked' : ''} data-flag="noEarly" data-s="${sIdx}">
                            <span class="toggle-slider danger-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#f0f9ff;">
                        <label class="toggle-switch" title="スケ可">
                            <input type="checkbox" ${staff.canSched ? 'checked' : ''} data-flag="canSched" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fefce8;">
                        <label class="toggle-switch" title="係長（択一）">
                            <input type="checkbox" ${staff.isSectionChief ? 'checked' : ''} data-flag="isSectionChief" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fef9c3;">
                        <label class="toggle-switch" title="主任（択一）">
                            <input type="checkbox" ${staff.isChief ? 'checked' : ''} data-flag="isChief" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#e0f2fe;">
                        <label class="toggle-switch" title="副主任（択一）">
                            <input type="checkbox" ${staff.isSubChief ? 'checked' : ''} data-flag="isSubChief" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fae8ff;">
                        <label class="toggle-switch" title="0（実数計算で0人換算）">
                            <input type="checkbox" ${staff.isZeroCount ? 'checked' : ''} data-flag="isZeroCount" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#f3e8ff;">
                        <label class="toggle-switch" title="0.5（実数計算で0.5人換算）">
                            <input type="checkbox" ${staff.isHalf ? 'checked' : ''} data-flag="isHalf" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fef08a;">
                        <label class="toggle-switch" title="1年目スタッフ">
                            <input type="checkbox" ${staff.isFirstYear ? 'checked' : ''} data-flag="isFirstYear" data-s="${sIdx}">
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
            } else if (isLife) {
                // ★ 生活期テーブル専用行セル（PT/OT/ST, 係長/主任/副主任, 訪問/通所/Cl1/Cl2/管理, ハ1〜ハ南, 0, 0.5）
                // 1. 職種（PT/OT/ST: 択一）
                bodyHtml += `
                    <td class="flag-col" style="background:#eef2ff;">
                        <label class="toggle-switch" title="PT">
                            <input type="checkbox" ${staff.jobTitle === 'PT' ? 'checked' : ''} data-life-job="PT" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fdf4ff;">
                        <label class="toggle-switch" title="OT">
                            <input type="checkbox" ${staff.jobTitle === 'OT' ? 'checked' : ''} data-life-job="OT" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fff1f2;">
                        <label class="toggle-switch" title="ST">
                            <input type="checkbox" ${staff.jobTitle === 'ST' ? 'checked' : ''} data-life-job="ST" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fffbeb;">
                        <label class="toggle-switch" title="係長">
                            <input type="checkbox" ${staff.isSectionChief ? 'checked' : ''} data-life-role="isSectionChief" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fefce8;">
                        <label class="toggle-switch" title="主任">
                            <input type="checkbox" ${staff.isChief ? 'checked' : ''} data-life-role="isChief" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#f0f9ff;">
                        <label class="toggle-switch" title="副主任">
                            <input type="checkbox" ${staff.isSubChief ? 'checked' : ''} data-life-role="isSubChief" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#e0f2fe;">
                        <label class="toggle-switch" title="8時開始可能か（訪問のみ使用）">
                            <input type="checkbox" ${staff.can8 ? 'checked' : ''} data-flag="can8" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                `;

                // 2. 生活期業務（訪問・通所・Cl1・Cl2・管理: 択一）
                const lifeSecs = ['訪問', '通所', 'Cl1', 'Cl2', '管理'];
                lifeSecs.forEach(secName => {
                    bodyHtml += `
                        <td class="flag-col" style="background:#f8fafc;">
                            <label class="toggle-switch" title="${secName}">
                                <input type="checkbox" ${staff.lifeSection === secName ? 'checked' : ''} data-life-section="${secName}" data-s="${sIdx}">
                                <span class="toggle-slider"></span>
                            </label>
                        </td>
                    `;
                });

                // 3. ハセクション（ハ1・ハ2・ハ3・ハ4: 択一）
                const haSecs = ['ハ1', 'ハ2', 'ハ3', 'ハ南'];
                haSecs.forEach(haName => {
                    bodyHtml += `
                        <td class="flag-col" style="background:#f0fdf4;">
                            <label class="toggle-switch" title="${haName}">
                                <input type="checkbox" ${(staff.haSection === haName || (haName === 'ハ南' && staff.haSection === 'ハ4')) ? 'checked' : ''} data-ha-section="${haName}" data-s="${sIdx}">
                                <span class="toggle-slider"></span>
                            </label>
                        </td>
                    `;
                });
                bodyHtml += `
                    <td class="flag-col" style="background:#fae8ff;">
                        <label class="toggle-switch" title="0（実数計算で0人換算）">
                            <input type="checkbox" ${staff.isZeroCount ? 'checked' : ''} data-flag="isZeroCount" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#f3e8ff;">
                        <label class="toggle-switch" title="0.5（実数計算で0.5人換算）">
                            <input type="checkbox" ${staff.isHalf ? 'checked' : ''} data-flag="isHalf" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                                        <td class="flag-col" style="background:#eff6ff;">
                        <label class="toggle-switch" title="土日休">
                            <input type="checkbox" ${staff.isSatSunOff ? 'checked' : ''} data-off-type="satSun" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fefce8;">
                        <label class="toggle-switch" title="日休">
                            <input type="checkbox" ${staff.isSunOff ? 'checked' : ''} data-off-type="sunOnly" data-s="${sIdx}">
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
                        <input type="text" class="staff-prevname-input" data-s="${sIdx}" value="${escapeHtmlText(staff.prevName || '')}" placeholder="旧姓" style="width:100%; border:1px solid #cbd5e1; border-radius:3px; padding:2px 4px; font-size:0.75rem; text-align:center;">
                    </td>
                    <td class="remarks-col" style="padding:2px 4px;">
                        <input type="text" class="staff-remarks-input" data-s="${sIdx}" value="${escapeHtmlText(staff.remarks || '')}" placeholder="メモ" style="width:100%; border:1px solid #cbd5e1; border-radius:3px; padding:2px 6px; font-size:0.78rem; background:white;">
                    </td>
                `;
            } else {
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
                        <label class="toggle-switch" title="${isSouth ? 'PT 2 セクション' : 'PT A セクション'}">
                            <input type="checkbox" ${(staff.section === 'PT A' || (isSouth && (staff.section === 'PT 2' || staff.section === 'PT A'))) ? 'checked' : ''} data-section="${isSouth ? 'PT 2' : 'PT A'}" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#f5f3ff;">
                        <label class="toggle-switch" title="${isSouth ? 'PT 3 セクション' : 'PT B セクション'}">
                            <input type="checkbox" ${(staff.section === 'PT B' || (isSouth && (staff.section === 'PT 3' || staff.section === 'PT B'))) ? 'checked' : ''} data-section="${isSouth ? 'PT 3' : 'PT B'}" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#faf5ff;">
                        <label class="toggle-switch" title="${isSouth ? 'OT 2 セクション' : 'OT A セクション'}">
                            <input type="checkbox" ${(staff.section === 'OT A' || (isSouth && (staff.section === 'OT 2' || staff.section === 'OT A'))) ? 'checked' : ''} data-section="${isSouth ? 'OT 2' : 'OT A'}" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fdf2f8;">
                        <label class="toggle-switch" title="${isSouth ? 'OT 3 セクション' : 'OT B セクション'}">
                            <input type="checkbox" ${(staff.section === 'OT B' || (isSouth && (staff.section === 'OT 3' || staff.section === 'OT B'))) ? 'checked' : ''} data-section="${isSouth ? 'OT 3' : 'OT B'}" data-s="${sIdx}">
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
                    <td class="flag-col" style="background:#fae8ff;">
                        <label class="toggle-switch" title="0（実数計算で0人換算）">
                            <input type="checkbox" ${staff.isZeroCount ? 'checked' : ''} data-flag="isZeroCount" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#f3e8ff;">
                        <label class="toggle-switch" title="0.5（実数計算で0.5人換算）">
                            <input type="checkbox" ${staff.isHalf ? 'checked' : ''} data-flag="isHalf" data-s="${sIdx}">
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="flag-col" style="background:#fef08a;">
                        <label class="toggle-switch" title="1年目スタッフ">
                            <input type="checkbox" ${staff.isFirstYear ? 'checked' : ''} data-flag="isFirstYear" data-s="${sIdx}">
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
            }

            bodyHtml += `</tr>`;
        });

        // ★「1階」「2階」「3階」「南」のテーブルの最下部にSTのスタッフ名と勤務を確認できるように表示
        // ★ STカラー（ピンク/ローズ系）を全階共通で適用
        if (!isST && currentFloor && linkedStStaffData && linkedStStaffData.staffList && linkedStStaffData.staffList.length > 0) {
            bodyHtml += `
                <tr style="background:#fce7f3; border-top: 3px solid #db2777;">
                    <th colspan="${NUM_DAYS + 24}" style="text-align:left; padding:8px 12px; font-size:0.85rem; font-weight:800; color:#9d174d; letter-spacing:0.03em;">
                        【${currentFloor} 所属 STスタッフ】
                    </th>
                </tr>
            `;

            linkedStStaffData.staffList.forEach((st, stIdx) => {
                const rowData = linkedStStaffData.grid[stIdx] || [];

                bodyHtml += `<tr class="st-linked-row" style="background:#fff5f8 !important; color:#334155; opacity:0.95;">`;
                bodyHtml += `<td class="sticky-col-1 font-mono" style="background:#fff5f8 !important; color:#9d174d !important; font-weight:800;">ST-${stIdx + 1}</td>`;
                bodyHtml += `<td class="sticky-col-2 border-thick-right" style="background:#fff5f8 !important; color:#9d174d !important; font-weight:700; text-align:left; padding-left:8px;">
                    ${escapeHtmlText(st.name)}
                    ${st.prevName ? `<span style="font-size:0.7rem; color:#64748b;">(${escapeHtmlText(st.prevName)})</span>` : ''}
                    <span style="font-size:0.65rem; background:#fbcfe8; color:#9d174d; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:700;">${st.floor}</span>
                </td>`;

                // 前5日間（空セル5列）
                for (let p = 0; p < 5; p++) {
                    bodyHtml += `<td class="prev-col-cell text-center" style="background:#fff5f8; color:#94a3b8; font-size:0.8rem;">-</td>`;
                }

                // 当ターム 1日〜28日
                for (let d = 0; d < NUM_DAYS; d++) {
                    const c = rowData[d] || { symbol: '' };
                    const sym = c.symbol ? c.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                    const thickCls = getDayBorderClass(d);

                    // ★ 事前固定希望（本人が希望入力した枠）のみ赤字・太字（fixed-cell）！自動生成された公休等は通常文字
                    const originalWish = (st.days && st.days[d]) ? st.days[d] : '';
                    const isRef = isRefreshHolidaySymbol(sym) || isRefreshHolidaySymbol(originalWish);
                    const isCellFixed = !isRef && !!(
                        (originalWish !== '' && originalWish === sym) ||
                        (c && c.isFixed && originalWish !== '')
                    );
                    const cellCls = isCellFixed ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');
                    const cellTitle = isCellFixed
                        ? `STスタッフ（事前固定希望）: ${escapeHtmlText(st.name)} / ${sym}`
                        : `STスタッフ（自動配置）: ${escapeHtmlText(st.name)} / ${sym}`;

                    bodyHtml += `<td class="${thickCls} ${cellCls}" style="text-align:center; font-size:0.85rem; background:#fff5f8;" title="${cellTitle}">${sym}</td>`;
                }

                // 右側フラグ列（17列分）
                bodyHtml += `<td class="flag-col" colspan="17" style="background:#fff5f8; color:#9d174d; font-size:0.75rem; text-align:left; padding:2px 8px; font-weight:600;">ST専用テーブル連携（参照のみ）</td>`;
                bodyHtml += `</tr>`;
            });
        }

        tbody.innerHTML = bodyHtml;

        // ★ ユーザー指示: 希望入力画面でスタッフの並び替え（ドラッグ＆ドロップ）
        let draggedIndex = null;
        tbody.querySelectorAll('tr[draggable="true"]').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                draggedIndex = parseInt(row.dataset.s, 10);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedIndex);
                row.classList.add('dragging-row');
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                row.classList.add('drag-over-row');
            });

            row.addEventListener('dragleave', () => {
                row.classList.remove('drag-over-row');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('drag-over-row');
                const targetIndex = parseInt(row.dataset.s, 10);
                if (draggedIndex !== null && targetIndex !== null && draggedIndex !== targetIndex) {
                    pushHistory();
                    const movedItem = staffList.splice(draggedIndex, 1)[0];
                    staffList.splice(targetIndex, 0, movedItem);
                    // No再付番（idを1〜Nに整列）
                    staffList.forEach((st, idx) => {
                        st.id = idx + 1;
                    });
                    saveCurrentTermToStorage();
                    renderInputTable();
                    showToast(`📋 スタッフの並び順を更新しました（No.${draggedIndex + 1} ➔ No.${targetIndex + 1}）`);
                }
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging-row');
                tbody.querySelectorAll('.drag-over-row').forEach(r => r.classList.remove('drag-over-row'));
                draggedIndex = null;
            });
        });


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
                // ★ 土日休・日休の排他トグル処理（生活期・ST共通）
        document.querySelectorAll('input[type="checkbox"][data-off-type]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const offType = e.target.dataset.offType;
                if (!staffList[s]) return;
                pushHistory();
                if (offType === 'satSun') {
                    staffList[s].isSatSunOff = e.target.checked;
                    if (staffList[s].isSatSunOff) {
                        staffList[s].isSunOff = false;
                    }
                } else if (offType === 'sunOnly') {
                    staffList[s].isSunOff = e.target.checked;
                    if (staffList[s].isSunOff) {
                        staffList[s].isSatSunOff = false;
                    }
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
                renderInputTable();
            });
        });

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

        // 所属フロア排他トグルのイベント（1F/2F/3F/南は択一排他制御＋変更後に必ずマスター＆ターム保存！）
        document.querySelectorAll('input[type="checkbox"][data-floor]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const floor = e.target.dataset.floor;
                pushHistory();
                if (e.target.checked) {
                    staffList[s].floor = floor;
                    document.querySelectorAll(`input[type="checkbox"][data-floor][data-s="${s}"]`).forEach(other => {
                        if (other !== e.target) other.checked = false;
                    });
                } else {
                    if (staffList[s].floor === floor) {
                        staffList[s].floor = '';
                    }
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

                // ★「0」と「0.5」は択一排他制御
                if (e.target.checked && flag === 'isZeroCount') {
                    staffList[s].isHalf = false;
                    const halfChk = document.querySelector(`input[type="checkbox"][data-flag="isHalf"][data-s="${s}"]`);
                    if (halfChk) halfChk.checked = false;
                } else if (e.target.checked && flag === 'isHalf') {
                    staffList[s].isZeroCount = false;
                    const zeroChk = document.querySelector(`input[type="checkbox"][data-flag="isZeroCount"][data-s="${s}"]`);
                    if (zeroChk) zeroChk.checked = false;
                }

                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        // ★ 生活期 職種択一排他制御（PT・OT・ST）
        document.querySelectorAll('input[type="checkbox"][data-life-job]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const job = e.target.dataset.lifeJob;
                pushHistory();
                if (e.target.checked) {
                    staffList[s].jobTitle = job;
                    document.querySelectorAll(`input[type="checkbox"][data-life-job][data-s="${s}"]`).forEach(other => {
                        if (other !== e.target) other.checked = false;
                    });
                } else {
                    if (staffList[s].jobTitle === job) {
                        staffList[s].jobTitle = '';
                    }
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        // ★ 生活期 役職択一排他制御（係長・主任・副主任）
        document.querySelectorAll('input[type="checkbox"][data-life-role]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const role = e.target.dataset.lifeRole;
                pushHistory();
                staffList[s].isSectionChief = false;
                staffList[s].isChief = false;
                staffList[s].isSubChief = false;
                if (e.target.checked) {
                    staffList[s][role] = true;
                    document.querySelectorAll(`input[type="checkbox"][data-life-role][data-s="${s}"]`).forEach(other => {
                        if (other !== e.target) other.checked = false;
                    });
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        // ★ 生活期セクション択一排他制御（訪問・通所・Cl1・Cl2・管理）
        document.querySelectorAll('input[type="checkbox"][data-life-section]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const sec = e.target.dataset.lifeSection;
                pushHistory();
                if (e.target.checked) {
                    staffList[s].lifeSection = sec;
                    document.querySelectorAll(`input[type="checkbox"][data-life-section][data-s="${s}"]`).forEach(other => {
                        if (other !== e.target) other.checked = false;
                    });
                } else {
                    if (staffList[s].lifeSection === sec) {
                        staffList[s].lifeSection = '';
                    }
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        // ★ 生活期 ハセクション択一排他制御（ハ1・ハ2・ハ3・ハ4）
        document.querySelectorAll('input[type="checkbox"][data-ha-section]').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const s = parseInt(e.target.dataset.s, 10);
                const ha = e.target.dataset.haSection;
                pushHistory();
                if (e.target.checked) {
                    staffList[s].haSection = ha;
                    document.querySelectorAll(`input[type="checkbox"][data-ha-section][data-s="${s}"]`).forEach(other => {
                        if (other !== e.target) other.checked = false;
                    });
                } else {
                    if (staffList[s].haSection === ha) {
                        staffList[s].haSection = '';
                    }
                }
                saveStaffMaster();
                saveCurrentTermToStorage();
            });
        });

        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const s = parseInt(cell.dataset.s, 10);
                const type = cell.dataset.type;

                // ★ ユーザー指示: コピペモード時のクリックは「セルの選択（フォーカス）」のみ！
                // セルクリックでの勝手なコピーや貼り付けは完全廃止し、Excel同様に Ctrl+C でコピー、Ctrl+V で貼り付けを行う
                if (isCopyMode) {
                    if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                    selectedCopyCell = cell;
                    cell.classList.add('copy-selected-cell');
                    // パレット記号等の直接入力を阻止
                    return;
                }

                let newSym = getActivePaletteSymbol(false);
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
                        saveCurrentTermToStorage(); // ★ Pトグル変更時も即時自動保存！
                    }
                    return;
                }

                if (type === 'prev') {
                    const p = parseInt(cell.dataset.p, 10);
                    if (staffList[s].prevDays[p] !== newSym) {
                        pushHistory();
                        staffList[s].prevDays[p] = newSym;
                        cell.textContent = newSym;
                        saveCurrentTermToStorage(); // ★ 前月実績変更時も即時自動保存！
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
                            saveCurrentTermToStorage(); // ★ セル編集時も即時自動保存！
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

    // ★ ST役職者の出勤状況を取得（POテーブルで役職者不在時にST役職者をカウント可能にする）
    function getSTChiefCoverageDays(floorKey, startDate) {
        const chiefDays = new Set();
        const subChiefDays = new Set();
        if (isST || !floorKey) return { chiefDays, subChiefDays };
        try {
            const rawSt = localStorage.getItem('shift_schedule_st_term_' + startDate);
            if (!rawSt) return { chiefDays, subChiefDays };
            const stData = JSON.parse(rawSt);
            if (!stData || !Array.isArray(stData.staffList)) return { chiefDays, subChiefDays };
            stData.staffList.forEach((st, sIdx) => {
                if (st.isUnused) return;
                const matchesFloor = (st.floor === floorKey || (st.floor && st.floor.includes(floorKey)));
                if (!matchesFloor) return;
                const days = (stData.outputGrid && stData.outputGrid[sIdx]) ? stData.outputGrid[sIdx] : (st.days || []);
                for (let d = 0; d < days.length; d++) {
                    const cell = days[d];
                    const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                    const isWorking = sym && sym !== '休' && sym !== '有' && sym !== '特' && !sym.startsWith('上') && !sym.startsWith('下');
                    if (isWorking) {
                        if (st.isSectionChief || st.isChief) chiefDays.add(d);
                        if (st.isSubChief) subChiefDays.add(d);
                    }
                }
            });
        } catch (e) {
            console.warn('ST役職者データ読み込みスキップ:', e);
        }
        return { chiefDays, subChiefDays };
    }

    function checkInputConstraints(showToastOnSuccess = false) {
        const term = getTermInfo();

        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
        const stCoverage = getSTChiefCoverageDays(currentFloor, curStartDate);
        const res = validateInitialState(staffList, {
            dates: term.dates,
            standardHolidays: parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0'),
            isST: isST,
            stChiefWorkingDays: stCoverage.chiefDays,
            stSubChiefWorkingDays: stCoverage.subChiefDays
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
    // ※ 前タームからの続きで既にリフ（上1等）を取得済みのため当タームで配分対象外となったスタッフは警告しない
    function checkMissingAutoAssignedRef(grid, staffList, res) {
        if (!grid || !Array.isArray(grid)) return;
        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;

        staffList.forEach((st, sIdx) => {
            if (st.isUnused) return;

            // 当タームの希望入力シート（staffList[sIdx].days）にリフが入っているか、または当タームで自動配分されたかを確認
            const hasRefInCurrentInput = Array.isArray(st.days) && st.days.some(sym =>
                SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)
            );
            const wasAutoAssignedInCurrentTerm = autoAssignedStaffIds && autoAssignedStaffIds.has(`${curStartDate}:${st.id}`);

            // 当タームで最初から配分されていないスタッフ（前タームで上1等を取得済みで当ターム対象外のスタッフ）はチェック対象外
            if (!hasRefInCurrentInput && !wasAutoAssignedInCurrentTerm) return;

            // 当該スタッフのリフ（上1〜5、下1〜3）日数を出力グリッドから走査
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
            isFinal: false, // ★ 特殊勤務なしはエラー外
            isST: isST,
            isSouth: isSouth,
            isLife: isLife,
            stStaffData: linkedStStaffData,
            linkedStStaffData: linkedStStaffData
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
            isFinal: true, // ★ 特殊勤務の過不足も含めてチェック
            isST: isST,
            isSouth: isSouth,
            isLife: isLife,
            stStaffData: linkedStStaffData,
            linkedStStaffData: linkedStStaffData
        });

        // 自動配分リフの誤消去チェック
        checkMissingAutoAssignedRef(lastSolveResult.grid, staffList, res);

        if (!res.isValid) {
            applyOutputConflictHighlights(res.conflictCells, res.errors);
            if (showModalOnError) {
                const specialDesc = isSouth 
                    ? '日別の特殊勤務人数（早:南2に1名・南3に1名 / 遅:南2に1名・南3に1名 / E:南2に1名・南3に1名）' 
                    : (isST || isLife ? '' : '日別の特殊勤務人数（早3/遅1/E2/8時1）');
                showErrorModal(res.errors, {
                    title: '最終チェック&完成: 制約の指摘・エラー検知',
                    subtitle: `完成勤務表に${res.errors.length}件の制約指摘があります（該当セルは青い網掛けで表示中）。`,
                    desc: `連勤制限や週休2日${specialDesc ? `、${specialDesc}` : ''}をご確認の上、必要に応じて修正してください。`
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

    
    // ★ ユーザー指示: 記号パレットバグ修正＆リアルタイムアクティブ記号の取得
    function getActivePaletteSymbol(isOutput = false) {
        const activeTabPanel = document.querySelector('.tab-panel.active');
        if (activeTabPanel) {
            const btn = activeTabPanel.querySelector('.palette-btn.selected');
            if (btn && btn.dataset.sym !== undefined) return btn.dataset.sym;
        }
        const anyBtn = document.querySelector('.palette-btn.selected');
        if (anyBtn && anyBtn.dataset.sym !== undefined) return anyBtn.dataset.sym;
        return isOutput ? currentOutputSelectedSymbol : currentSelectedSymbol;
    }

    // ★ ユーザー指示: コピペモード用状態変数（デフォルトON）
    let isCopyMode = true;
    let clipboardSymbol = null;
    let selectedCopyCell = null;

    // ★ マスターテーブル共通フロア定義 & 展開状態永続保持用Set（再描画時も折りたたまれず展開状態を100%維持）
    const MASTER_FLOOR_CONFIGS = [
        { id: '1f', floorKey: '1F', label: '1階', bg: '#f0f8ff', headerBg: '#e0f2fe', border: '#bae6fd', badgeColor: '#0369a1' },
        { id: '2f', floorKey: '2F', label: '2階', bg: '#fff8f0', headerBg: '#ffedd5', border: '#fed7aa', badgeColor: '#c2410c' },
        { id: '3f', floorKey: '3F', label: '3階', bg: '#ecfdf5', headerBg: '#a7f3d0', border: '#34d399', badgeColor: '#065f46' },
        { id: 'south', floorKey: '南', label: '南', bg: '#faf5ff', headerBg: '#f3e8ff', border: '#e9d5ff', badgeColor: '#7e22ce' }
    ];
    const masterExpandedFloors = new Set();

    // ★ ユーザー指示: マスターテーブル直接セル更新・コピペ共通関数
    function updateMasterIntegrationCell(cell, newSym) {
        if (!cell) return false;
        const floorId = cell.dataset.floor;
        const isStCell = (cell.dataset.isSt === '1');
        const isHaCell = (cell.dataset.isHa === '1');
        const staffId = cell.dataset.staffId;
        const staffName = cell.dataset.staffName;
        const haIdx = parseInt(cell.dataset.haIdx, 10);
        const dayIdx = parseInt(cell.dataset.day, 10);

        const termSel = document.getElementById('masterTermSelect') || document.getElementById('termSelect');
        const curStartDate = (termSel && termSel.value) ? termSel.value : (document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01');
        const isLifeCell = (floorId === 'life') || isHaCell;
        const targetKey = isLifeCell
            ? `shift_schedule_life_term_${curStartDate}`
            : (isStCell ? `shift_schedule_st_term_${curStartDate}` : `shift_schedule_${floorId}_term_${curStartDate}`);

        try {
            let raw = localStorage.getItem(targetKey);
            let fData = null;
            if (raw) {
                try { fData = JSON.parse(raw); } catch (e) {}
            }
            if (!fData && isLifeCell) {
                let baseStaff = [];
                try {
                    const rawM = localStorage.getItem('shift_schedule_life_staff_master');
                    if (rawM) baseStaff = JSON.parse(rawM);
                } catch (e) {}
                if (!baseStaff || baseStaff.length === 0) {
                    baseStaff = [
                        { id: 41, name: '生活期 ハ1', haSection: 'ハ1', isUnused: false },
                        { id: 42, name: '生活期 ハ2', haSection: 'ハ2', isUnused: false },
                        { id: 43, name: '生活期 ハ3', haSection: 'ハ3', isUnused: false },
                        { id: 44, name: '生活期 ハ南', haSection: 'ハ南', isUnused: false }
                    ];
                }
                fData = {
                    staffList: baseStaff,
                    outputGrid: baseStaff.map(() => new Array(NUM_DAYS).fill(null).map(() => ({ symbol: '', isFixed: false })))
                };
                raw = JSON.stringify(fData);
            }
            if (!fData || !Array.isArray(fData.staffList)) return false;

            let stIdx = -1;
            if (isHaCell) {
                if (haIdx >= 0 && fData.staffList[haIdx]) {
                    stIdx = haIdx;
                } else {
                    stIdx = fData.staffList.findIndex(st => (staffId && String(st.id) === String(staffId)) || st.name === staffName || (st.haSection && staffName.includes(st.haSection)));
                }
                if (stIdx === -1) {
                    fData.staffList.push({ id: staffId || 41, name: staffName, isUnused: false });
                    stIdx = fData.staffList.length - 1;
                }
            } else {
                stIdx = fData.staffList.findIndex(st => (staffId && String(st.id) === String(staffId)) || st.name === staffName);
            }
            if (stIdx === -1) return false;

            if (!fData.outputGrid) fData.outputGrid = [];
            if (!fData.outputGrid[stIdx]) fData.outputGrid[stIdx] = new Array(NUM_DAYS).fill({ symbol: '', isFixed: false });

            const curCell = fData.outputGrid[stIdx][dayIdx];
            const curFixed = (curCell && typeof curCell === 'object') ? !!curCell.isFixed : false;

            if (newSym === 'P') {
                const curSym = (curCell && typeof curCell === 'object') ? curCell.symbol : (curCell || '');
                fData.outputGrid[stIdx][dayIdx] = { symbol: curSym, isFixed: !curFixed };
            } else {
                fData.outputGrid[stIdx][dayIdx] = { symbol: newSym, isFixed: curFixed };
            }

            const openFloors = Array.from(masterExpandedFloors);
            const prevJson = raw;
            fData.updatedAt = new Date().toISOString();
            const nextJson = JSON.stringify(fData);
            if (typeof pushMasterHistory === 'function') {
                pushMasterHistory({
                    targetKey: targetKey,
                    prevJson: prevJson,
                    nextJson: nextJson,
                    openFloors: openFloors
                });
            }
            localStorage.setItem(targetKey, nextJson);

            // 全体サマリー＆階別集計を即時再描画（masterExpandedFloorsにより展開行は折りたたまれず完全維持！）
            if (typeof renderMasterIntegrationView === 'function') {
                renderMasterIntegrationView();
            }

            // 貼り付け後もセルのフォーカス・選択枠を再付与
            const reSelected = document.querySelector(`.master-editable-cell[data-floor="${floorId}"][data-staff-id="${staffId}"][data-day="${dayIdx}"]`);
            if (reSelected) {
                if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                reSelected.classList.add('copy-selected-cell');
                selectedCopyCell = reSelected;
            }

            showToast(`📋 【${newSym || '空欄'}】を${staffName}（${dayIdx + 1}日目）に反映しました`);
            return true;
        } catch (err) {
            console.error('マスター直接修正エラー:', err);
            return false;
        }
    }

    // ★ ユーザー指示: 特殊勤務（早・遅・E）の目立つ背景色分けヘルパー（全画面・全テーブル共通）
    function applySpecialDutyCellClass(cell, sym) {
        if (!cell) return;
        cell.classList.remove('cell-special-early', 'cell-special-late', 'cell-special-eve');
        if (sym === '早') cell.classList.add('cell-special-early');
        else if (sym === '遅') cell.classList.add('cell-special-late');
        else if (sym === 'E') cell.classList.add('cell-special-eve');
        cell.dataset.sym = sym || '';
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
            const isActive = (panel.id === tabId);
            panel.classList.toggle('active', isActive);
            // ★ インラインスタイルが存在していても確実に強制表示/非表示を同期切り替え！
            panel.style.display = isActive ? 'block' : 'none';
        });
        if (isMaster && (tabId === 'checkTab' || tabId === 'statsTab')) {
            renderMasterIntegrationView();
        }
        if (isLife && tabId === 'checkTab') {
            // 生活期は基本勤務表がそのまま完成版のため、checkTableに自動同期描画！
            if (lastSolveResult && lastSolveResult.grid) {
                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
            }
        }
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
        const isMasterView = isMaster || !!document.getElementById('masterTermSelect');
        const checkTitle = document.getElementById('checkTitleDisplay');
        if (checkTitle) {
            if (isMasterView) {
                checkTitle.textContent = `🏢 ${title}（全フロア統合サマリー＆勤務詳細集約）`;
            } else {
                checkTitle.textContent = `🔍 ${title}（最終チェック&完成）`;
            }
        }

        if (typeof updateRefreshBadge === 'function') {
            updateRefreshBadge(dates);
        }

        const weekSpans = (typeof getSunToSatWeekSpans === 'function')
            ? getSunToSatWeekSpans(dates, NUM_DAYS)
            : [];

        return {
            title,
            badgeText,
            dates,
            first,
            last,
            numDays: NUM_DAYS,
            weekSpans,
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
                showToast(`🆕 新規期間（${newDate}～）を開始しました（クラウド自動保存中）`);
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
                pushStateToCloud(false);
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

            if (confirm(`直前の勤務表【${pTitle}】の最終7日間の勤務実績を、この期間の「前ターム最終7日間実績」に取り込みますか？\n（※現在入力されている前実績は上書きされます）`)) {
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
        const futureHistory = {};
        const allHistoryDetails = [];

        for (let i = 1; i <= NUM_STAFF; i++) {
            pastHistory[i] = new Set();
            currentHistory[i] = new Set();
            futureHistory[i] = new Set();
        }

        // 現在のスタッフ一覧から、氏名および旧姓（prevName）によるスタッフID逆引きマップを構築
        const nameToCurrentId = new Map();
        staffList.forEach((st, sIdx) => {
            const cId = st.id || (sIdx + 1);
            if (st.name && st.name.trim()) nameToCurrentId.set(st.name.trim(), cId);
            if (st.prevName && st.prevName.trim()) nameToCurrentId.set(st.prevName.trim(), cId);
        });

        try {
            const terms = getSavedTerms();
            terms.forEach(termDate => {
                // 当ターム分は現在メモリ上の staffList.days / lastSolveResult.grid を最優先で参照するためスキップ
                if (termDate === currentStartDate) return;
                const isPast = (termDate < currentStartDate);
                const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${termDate}`);
                if (!raw) return;
                const data = JSON.parse(raw);
                if (!data) return;

                if (data.outputGrid && Array.isArray(data.outputGrid)) {
                    data.outputGrid.forEach((row, sIdx) => {
                        const savedSt = (data.staffList && data.staffList[sIdx]);
                        const sName = savedSt ? (savedSt.name || '').trim() : '';
                        const sPrevName = savedSt ? (savedSt.prevName || '').trim() : '';
                        let staffId = (sName && nameToCurrentId.has(sName)) ? nameToCurrentId.get(sName) :
                                      (sPrevName && nameToCurrentId.has(sPrevName)) ? nameToCurrentId.get(sPrevName) :
                                      (sIdx + 1);

                        if (!pastHistory[staffId]) pastHistory[staffId] = new Set();
                        if (!futureHistory[staffId]) futureHistory[staffId] = new Set();

                        row.forEach((cell, dIdx) => {
                            const sym = (cell && cell.symbol) ? cell.symbol : cell;
                            if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                                if (isPast) {
                                    pastHistory[staffId].add(sym);
                                } else {
                                    futureHistory[staffId].add(sym);
                                }
                                allHistoryDetails.push({
                                    staffId,
                                    staffName: savedSt ? savedSt.name : `スタッフ ${staffId}`,
                                    termDate,
                                    symbol: sym,
                                    dayIndex: dIdx,
                                    isCurrent: false
                                });
                            }
                        });
                    });
                } else if (data.staffList && Array.isArray(data.staffList)) {
                    data.staffList.forEach((st, sIdx) => {
                        const sName = (st.name || '').trim();
                        const sPrevName = (st.prevName || '').trim();
                        let staffId = (sName && nameToCurrentId.has(sName)) ? nameToCurrentId.get(sName) :
                                      (sPrevName && nameToCurrentId.has(sPrevName)) ? nameToCurrentId.get(sPrevName) :
                                      (st.id || (sIdx + 1));

                        if (!pastHistory[staffId]) pastHistory[staffId] = new Set();
                        if (!futureHistory[staffId]) futureHistory[staffId] = new Set();

                        if (Array.isArray(st.days)) {
                            st.days.forEach((sym, dIdx) => {
                                if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                                    if (isPast) {
                                        pastHistory[staffId].add(sym);
                                    } else {
                                        futureHistory[staffId].add(sym);
                                    }
                                    allHistoryDetails.push({
                                        staffId,
                                        staffName: st.name,
                                        termDate,
                                        symbol: sym,
                                        dayIndex: dIdx,
                                        isCurrent: false
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

        // 現在メモリ上の staffList.days（および確定グリッドがある場合は lastSolveResult.grid）にあるリフを当ターム取得として追加
        staffList.forEach((st, sIdx) => {
            if (st.isUnused) return;
            const staffId = st.id || (sIdx + 1);
            if (!currentHistory[staffId]) currentHistory[staffId] = new Set();
            if (Array.isArray(st.days)) {
                st.days.forEach((sym, dIdx) => {
                    if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                        currentHistory[staffId].add(sym);
                        allHistoryDetails.push({
                            staffId,
                            staffName: st.name,
                            termDate: currentStartDate,
                            symbol: sym,
                            dayIndex: dIdx,
                            isCurrent: true
                        });
                    }
                });
            }
            if (lastSolveResult && Array.isArray(lastSolveResult.grid) && Array.isArray(lastSolveResult.grid[sIdx])) {
                lastSolveResult.grid[sIdx].forEach((cell, dIdx) => {
                    const sym = (cell && cell.symbol) ? cell.symbol : cell;
                    if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                        currentHistory[staffId].add(sym);
                    }
                });
            }
        });

        return { pastHistory, currentHistory, futureHistory, allHistoryDetails };
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
        const { pastHistory, futureHistory } = getObtainedRefreshHistory(curStartDate);

        pushHistory();
        const res = autoAssignRefreshHolidaysCore(staffList, term.dates, {
            obtainedHistory: pastHistory,
            futureHistory: futureHistory
        });

        if (res.assignedCount > 0) {
            // ★ 自動配分されたリフのセルおよび対象スタッフを当ターム日付付きで記録（通常文字・編集自由扱い＆誤消去検知用）
            if (Array.isArray(res.assignments)) {
                res.assignments.forEach(a => {
                    autoAssignedRefKeys.add(`${curStartDate}:${a.staffIndex},${a.dayIndex}`);
                    autoAssignedStaffIds.add(`${curStartDate}:${a.staffId}`);
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
        const { pastHistory, currentHistory, futureHistory } = getObtainedRefreshHistory(curStartDate);

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
            const fut = (futureHistory && futureHistory[sId]) ? futureHistory[sId] : new Set();
            let staffCount = 0;

            html += `<tr>`;
            html += `<td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${sId}</td>`;
            html += `<td style="padding: 4px 6px; border: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">${st.name}</td>`;

            refSymbols.forEach(sym => {
                if (cur.has(sym)) {
                    staffCount++;
                    totalObtainedAll++;
                    html += `<td style="padding: 4px; border: 1px solid #e2e8f0; text-align: center; background: #dcfce7; color: #15803d; font-weight: 800;" title="当タームで取得">🌴 当ターム</td>`;
                } else if (past.has(sym) || fut.has(sym)) {
                    staffCount++;
                    totalObtainedAll++;
                    html += `<td style="padding: 4px; border: 1px solid #e2e8f0; text-align: center; background: #e0f2fe; color: #0369a1; font-weight: 700;" title="他タームで取得済">✅ 済</td>`;
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

    // 💾 手動保存ボタン（全テーブル・全タブ対応）
    document.querySelectorAll('.manual-save-btn, #manualSaveBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            saveCurrentTermToStorage();
            if (typeof showToast === 'function') {
                showToast('💾 勤務表データをブラウザに保存しました！');
            }
        });
    });

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
        // ★ ユーザー指示: ⚡ 勤務表を自動生成するを押したタイミングで前ターム最終7日間実績を読み込んでいない場合は自動で前ターム最終7日間実績を読み込んでから作業を開始
        const hasPrevHistory = staffList.some(s => !s.isUnused && s.prevDays && s.prevDays.some(p => p && p.trim() !== ''));
        if (!hasPrevHistory) {
            const curDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
            const prevTerm = findPreviousTerm(curDate);
            if (prevTerm) {
                const applied = applyPreviousTermHistory(prevTerm, false);
                if (applied) {
                    showToast('🔗 直前の前ターム最終7日間実績を自動取込しました');
                    renderInputTable();
                }
            }
        }

            pushHistory(); // ★ 勤務表生成前の状態を記録し、「↩ 戻る」で元に戻せるようにする
            // ★ リフレッシュ休暇自動配分連携:
            // ターム内にリフ対象月が含まれており、まだ必要人数分に達していないグループ（月末最終タームの未消化分含む）があれば自動配分を補完適用！
            const term = getTermInfo();

            const refGroups = (typeof getTermRefreshGroups === 'function') ? getTermRefreshGroups(term.dates) : [];
            if (refGroups && refGroups.length > 0) {
                handleAutoAssignRefreshHolidays({ silent: true });
            }

            setSolveLoading(true);

            setTimeout(() => {
                try {
                    const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                    const term = getTermInfo();

                    const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
                    if (!isST && !isLife && currentFloor) {
                        loadLinkedSTData(curStartDate);
                        loadLinkedLifeData(curStartDate);
                    }
                    const stCoverage = getSTChiefCoverageDays(currentFloor, curStartDate);
                    const scheduler = new ShiftScheduler(staffList, {
                        standardHolidays: stdHolidayVal,
                        dates: term.dates,
                        dayOffsets: [...dayOffsets],
                        isST: isST,
                        isSouth: isSouth,
                        isLife: isLife,
                        lifeDailyWork: getLinkedLifeDailyWork(),
                        stChiefWorkingDays: stCoverage.chiefDays,
                        stSubChiefWorkingDays: stCoverage.subChiefDays,
                        stDailyWork: getLinkedSTDailyWork(),
                        stDailyHeadCount: getLinkedSTDailyHeadCount(),
                        stDailyFtWork: getLinkedSTDailyFtWork(),
                        stDailyEarly: getLinkedSTDailyEarly(),
                    stDailyLate: getLinkedSTDailyLate(),
                    stDailyEve: getLinkedSTDailyEve(),
                        stFloorFtCount: getLinkedSTFloorFtCount()
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
                                    if (isRef && autoAssignedRefKeys.has(`${curStartDate}:${s},${d}`)) {
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
                        checkWorkAreaConstraints(false);
                        saveCurrentTermToStorage(); // ★ 生成データをブラウザに自動保存
                        showToast('⚡ 基本勤務表を生成しました（修正作業エリアで微調整を行ってください）');
                    } else {
                        applyConflictHighlights(result.conflictCells);
                        showErrorModal(result.errors, {
                            title: '事前希望の制約指摘・エラー検知',
                            subtitle: '事前入力枠に制約違反や物理的衝突があります（該当セルを青い網掛けで表示中）。',
                            desc: '内容をご確認の上修正するか、あえて無視して基本勤務表の自動生成を進めることができます。',
                            onForceSolve: () => {
                                try {
                                    // エラーを無視して基本勤務表を安全に強制生成！
                                    const freshScheduler = new ShiftScheduler(staffList, {
                                        standardHolidays: stdHolidayVal,
                                        dates: term.dates,
                                        dayOffsets: [...dayOffsets],
                                        isST: isST,
                                        isSouth: isSouth,
                                        isLife: isLife,
                                        lifeDailyWork: getLinkedLifeDailyWork(),
                                        stChiefWorkingDays: stCoverage.chiefDays,
                                        stSubChiefWorkingDays: stCoverage.subChiefDays,
                                        stDailyWork: getLinkedSTDailyWork(),
                                        stDailyHeadCount: getLinkedSTDailyHeadCount(),
                                        stDailyFtWork: getLinkedSTDailyFtWork(),
                                        stDailyEarly: getLinkedSTDailyEarly(),
                                        stDailyLate: getLinkedSTDailyLate(),
                                        stDailyEve: getLinkedSTDailyEve(),
                                        stFloorFtCount: getLinkedSTFloorFtCount()
                                    });
                                    const forceResult = freshScheduler.solveBaseSchedule({ force: true });
                                    if (forceResult && forceResult.grid) {
                                        for (let s = 0; s < NUM_STAFF; s++) {
                                            if (!forceResult.grid[s]) continue;
                                            for (let d = 0; d < NUM_DAYS; d++) {
                                                const cell = forceResult.grid[s][d];
                                                if (!cell) continue;
                                                const sym = cell.symbol || cell;
                                                const isRef = SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym);
                                                if (isRef && autoAssignedRefKeys.has(`${curStartDate}:${s},${d}`)) {
                                                    cell.isFixed = false;
                                                    cell.isAutoAssignedRef = true;
                                                }
                                            }
                                        }
                                        lastScheduler = freshScheduler;
                                        lastSolveResult = forceResult;
                                        renderOutputTable(forceResult.grid, forceResult.stats);
                                        renderStatsDashboard(forceResult.stats);
                                        switchTab('outputTab');
                                        checkWorkAreaConstraints(false);
                                        saveCurrentTermToStorage(); // ★ 強制生成データをブラウザに自動保存
                                        showToast('⚡ エラーを無視して基本勤務表を生成しました（修正作業エリアで微調整してください）');
                                    } else {
                                        showToast('⚠️ 強制生成に失敗しました。希望枠を再度ご確認ください。');
                                    }
                                } catch (forceErr) {
                                    console.error('onForceSolve error:', forceErr);
                                    showToast(`⚠️ 強制生成中にエラーが発生しました: ${forceErr.message}`);
                                }
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

    // ★ 修正作業エリア（#outputTableBody）の現在のセル内容を100%吸い上げてグリッド化する関数
    function extractCurrentOutputGrid() {
        const tbody = document.getElementById('outputTableBody');
        if (!tbody) return null;
        const rows = tbody.querySelectorAll('tr');
        if (!rows || rows.length === 0) return null;

        const grid = [];
        for (let s = 0; s < NUM_STAFF; s++) {
            grid.push(new Array(NUM_DAYS).fill(null).map(() => ({ symbol: '', isFixed: false })));
        }

        const cells = tbody.querySelectorAll('td.day-cell[data-s][data-d]');
        if (cells.length === 0) return null;

        cells.forEach(td => {
            const s = parseInt(td.dataset.s, 10);
            const d = parseInt(td.dataset.d, 10);
            if (!isNaN(s) && !isNaN(d) && s >= 0 && s < NUM_STAFF && d >= 0 && d < NUM_DAYS) {
                const sym = td.textContent.trim();
                const isFixed = td.classList.contains('fixed-cell');
                grid[s][d] = {
                    symbol: sym,
                    isFixed: isFixed
                };
            }
        });
        return grid;
    }

    function handleAssignSpecialDuties() {
        pushHistory(); // ★ 特殊勤務割り当て前の状態を記録し、「↩ 戻る」で元に戻せるようにする
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
                    const curStartDate3 = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
                    const stCoverage3 = getSTChiefCoverageDays(currentFloor, curStartDate3);
                    lastScheduler = new ShiftScheduler(staffList, {
                        standardHolidays: stdHolidayVal,
                        dates: getTermInfo().dates,
                        dayOffsets: [...dayOffsets],
                        isST: isST,
                        isSouth: isSouth,
                        isLife: isLife,
                        lifeDailyWork: getLinkedLifeDailyWork(),
                        stChiefWorkingDays: stCoverage3.chiefDays,
                        stSubChiefWorkingDays: stCoverage3.subChiefDays,
                        stDailyWork: getLinkedSTDailyWork(),
                        stDailyHeadCount: getLinkedSTDailyHeadCount(),
                        stDailyFtWork: getLinkedSTDailyFtWork(),
                        stDailyEarly: getLinkedSTDailyEarly(),
                    stDailyLate: getLinkedSTDailyLate(),
                    stDailyEve: getLinkedSTDailyEve(),
                        stFloorFtCount: getLinkedSTFloorFtCount()
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

                // 最新のスタッフ属性（係長・主任・副主任・8時可・0.5等）と日別加減枠を確実に同期してから特殊勤務を割り当てる
                lastScheduler.staffList = JSON.parse(JSON.stringify(staffList));
                lastScheduler.dayOffsets = [...dayOffsets];
                const curStartDate3 = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
                if (!isST && !isLife && currentFloor) {
                    loadLinkedSTData(curStartDate3);
                    lastScheduler.stDailyEarly = getLinkedSTDailyEarly();
                    lastScheduler.stDailyLate = getLinkedSTDailyLate();
                    lastScheduler.stDailyEve = getLinkedSTDailyEve();
                }

                // ★ ユーザーの手修正（修正作業エリアの微調整）を100%厳格保持するため、勝手な自動再生成は完全撤去！

                // ★ 修正作業エリアでユーザーが手動編集・微調整した最新のグリッドを確実に取得して適用！
                const domGrid = extractCurrentOutputGrid();
                if (domGrid && domGrid.length > 0) {
                    lastScheduler.grid = domGrid;
                } else if (lastSolveResult && lastSolveResult.grid) {
                    lastScheduler.grid = JSON.parse(JSON.stringify(lastSolveResult.grid));
                }

                const specialResult = lastScheduler.assignSpecialDutiesToGrid({ preserveGrid: true });
                if (typeof lastScheduler.autoFixOverallocatedEarlyDuties === 'function') {
                    lastScheduler.autoFixOverallocatedEarlyDuties();
                    specialResult.stats = lastScheduler.calculateStats();
                }
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
                    const toastMsg = isSouth 
                        ? '✨ 南病棟の特殊勤務（早・遅・E各2名 / 8時1名）を割り当て、「最終チェック&完成」を表示しました！' 
                        : '✨ 特殊勤務（早3名・遅1名・E2名・8時1名）を割り当て、「最終チェック&完成」を表示しました！';
                    showToast(toastMsg);
                } else {
                    showErrorModal(specialResult.errors, {
                        title: '特殊勤務割当の指摘・エラー検知',
                        subtitle: '特殊勤務の候補者不足や制約との衝突があります。',
                        desc: '内容をご確認の上修正するか、あえて無視して可能な限り特殊勤務を割り当てて「最終チェック&完成」へ進むことができます。',
                        onForceSpecial: () => {
                            // エラーを無視して特殊勤務を割り当て！
                            const forcedResult = lastScheduler.assignSpecialDutiesToGrid({ force: true, preserveGrid: true });
                            if (typeof lastScheduler.autoFixOverallocatedEarlyDuties === 'function') {
                                lastScheduler.autoFixOverallocatedEarlyDuties();
                                forcedResult.stats = lastScheduler.calculateStats();
                            }
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

    // ★ ユーザー指示: ブレ最小化ボタン（平日／休日／ST／生活期）
    const floorBalanceWeekdayBtn = document.getElementById('floorBalanceWeekdayBtn');
    if (floorBalanceWeekdayBtn) floorBalanceWeekdayBtn.addEventListener('click', handleFloorBalanceWeekday);

    const floorBalanceWeekendBtn = document.getElementById('floorBalanceWeekendBtn');
    if (floorBalanceWeekendBtn) floorBalanceWeekendBtn.addEventListener('click', handleFloorBalanceWeekend);

    const floorBalanceBtn = document.getElementById('floorBalanceBtn');
    if (floorBalanceBtn) floorBalanceBtn.addEventListener('click', handleFloorBalanceWeekday); // 互換性フォールバック

    const stBalanceBtn = document.getElementById('stBalanceBtn');
    if (stBalanceBtn) stBalanceBtn.addEventListener('click', handleSTBalance);

    const lifeBalanceVisitBtn = document.getElementById('lifeBalanceVisitBtn');
    if (lifeBalanceVisitBtn) lifeBalanceVisitBtn.addEventListener('click', handleLifeBalanceVisit);

    const lifeBalanceTsushoBtn = document.getElementById('lifeBalanceTsushoBtn');
    if (lifeBalanceTsushoBtn) lifeBalanceTsushoBtn.addEventListener('click', handleLifeBalanceTsusho);

    // ==========================================
    // ★ ST所属スタッフ連携データ管理（各病棟テーブルへの参照表示 & 実数合算用）
    // ==========================================
    let linkedStStaffData = null; // { staffList: [...], grid: [...] }

    function loadLinkedSTData(startDate) {
        if (isST || !currentFloor) {
            linkedStStaffData = null;
            return;
        }
        const targetDate = startDate || currentWorkingStartDate || '2026-04-01';
        const stKey = `shift_schedule_st_term_${targetDate}`;
        let raw = localStorage.getItem(stKey);
        if (!window._cloudMem) window._cloudMem = new Map();
        if (!raw) {
            if (window._cloudMem && window._cloudMem.has(stKey)) {
                raw = window._cloudMem.get(stKey);
            }
        }
        if (!raw) {
            // クラウドからSTの最新データをバックグラウンド取得して再読込（※PO側からSTのローカルストレージは一切汚染せずメモリキャッシュのみに保持）
            if (!window._stFetchInFlight) {
                window._stFetchInFlight = true;
                fetch(`/api/cloud_sync?deptId=st&t=${Date.now()}`, { cache: 'no-store' })
                    .then(r => r.ok ? r.json() : null)
                    .then(res => {
                        window._stFetchInFlight = false;
                        const cloudState = res && (res.cloudState || res.data);
                        if (cloudState && cloudState.terms && cloudState.terms[targetDate]) {
                            const termObj = cloudState.terms[targetDate];
                            window._cloudMem.set(stKey, JSON.stringify(termObj));
                            loadLinkedSTData(targetDate);
                            // 画面更新
                            if (lastSolveResult && lastSolveResult.grid) {
                                renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
                                renderStatsDashboard(lastSolveResult.stats);
                            }
                        }
                    })
                    .catch(() => { window._stFetchInFlight = false; });
            }
            linkedStStaffData = null;
            return;
        }

        try {
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.staffList)) {
                linkedStStaffData = null;
                return;
            }

            const matchingStaff = [];
            const matchingGrid = [];

            data.staffList.forEach((st, idx) => {
                // 不使用でなく、かつ当病棟フロア（1F, 2F, 3F, 南）に所属するST
                if (!st.isUnused && (st.floor === currentFloor || (st.floor && st.floor.includes(currentFloor)))) {
                    matchingStaff.push(st);
                    if (data.outputGrid && Array.isArray(data.outputGrid[idx])) {
                        matchingGrid.push(data.outputGrid[idx]);
                    } else if (Array.isArray(st.days)) {
                        matchingGrid.push(st.days.map(sym => ({ symbol: sym, isFixed: false })));
                    } else {
                        matchingGrid.push(new Array(NUM_DAYS).fill({ symbol: '' }));
                    }
                }
            });

            linkedStStaffData = {
                staffList: matchingStaff,
                grid: matchingGrid
            };
        } catch (e) {
            console.warn('ST連携データ読み込み警告:', e);
            linkedStStaffData = null;
        }
    }

    // ★ ST所属スタッフの日別出勤実数を取得（PT・OTの配分均等化に反映用）
    function getLinkedSTDailyWork() {
        if (!linkedStStaffData || !linkedStStaffData.staffList || !linkedStStaffData.grid) return null;
        const stWork = new Array(NUM_DAYS).fill(0);
        linkedStStaffData.staffList.forEach((st, idx) => {
            if (st.isUnused || st.isZeroCount) return;
            const row = linkedStStaffData.grid[idx] || [];
            for (let d = 0; d < NUM_DAYS; d++) {
                const c = row[d] || { symbol: '' };
                const sym = (c && typeof c === 'object') ? c.symbol : (c || '');
                if (isWorkSymbol(sym) && sym !== '研' && sym !== '張') {
                    stWork[d] += (st.isHalf ? 0.5 : 1.0);
                } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○' || sym === '〇/休' || sym === '休/〇' || sym === '〇/有' || sym === '有/〇') {
                    stWork[d] += (st.isHalf ? 0.25 : 0.5);
                }
            }
        });
        return stWork;
    }

    // ★ ST所属スタッフの日別出勤人数（頭数）を取得（0.5トグルの人でも出勤人数は1）
    function getLinkedSTDailyHeadCount() {
        if (!linkedStStaffData || !linkedStStaffData.staffList || !linkedStStaffData.grid) return null;
        const stHead = new Array(NUM_DAYS).fill(0);
        linkedStStaffData.staffList.forEach((st, idx) => {
            if (st.isUnused || st.isZeroCount) return;
            const row = linkedStStaffData.grid[idx] || [];
            for (let d = 0; d < NUM_DAYS; d++) {
                const c = row[d] || { symbol: '' };
                const sym = (c && typeof c === 'object') ? c.symbol : (c || '');
                if (isWorkSymbol(sym) && sym !== '研' && sym !== '張') {
                    stHead[d] += 1.0; // ★ 0.5トグルONでも出勤人数は1！
                } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○' || sym === '〇/休' || sym === '休/〇' || sym === '〇/有' || sym === '有/〇') {
                    stHead[d] += (st.isHalf ? 0.25 : 0.5);
                }
            }
        });
        return stHead;
    }

    // ★ ST専従スタッフの日別出勤数を取得（PT・OT・ST専従3名以上制約用）
    function getLinkedSTDailyFtWork() {
        if (!linkedStStaffData || !linkedStStaffData.staffList || !linkedStStaffData.grid) return null;
        const stFtWork = new Array(NUM_DAYS).fill(0);
        linkedStStaffData.staffList.forEach((st, idx) => {
            if (st.isUnused || !st.isFullTime) return;
            const row = linkedStStaffData.grid[idx] || [];
            for (let d = 0; d < NUM_DAYS; d++) {
                const c = row[d] || { symbol: '' };
                const sym = (c && typeof c === 'object') ? c.symbol : (c || '');
                if (isWorkSymbol(sym) && sym !== '張') {
                    stFtWork[d]++;
                }
            }
        });
        return stFtWork;
    }

    // ★ ST早番スタッフの日別出勤数を取得（各病棟テーブルの早番連携用）
    function getLinkedSTDailyEarly() {
        if (!linkedStStaffData || !linkedStStaffData.staffList || !linkedStStaffData.grid) return null;
        const stEarly = new Array(NUM_DAYS).fill(0);
        linkedStStaffData.staffList.forEach((st, idx) => {
            if (st.isUnused) return;
            const row = linkedStStaffData.grid[idx] || [];
            for (let d = 0; d < NUM_DAYS; d++) {
                const c = row[d] || { symbol: '' };
                const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                const wish = (st.days && st.days[d]) ? st.days[d] : '';
                if (sym === '早' || wish === '早') {
                    stEarly[d]++;
                }
            }
        });
        return stEarly;
    }

    // ★ ST遅番スタッフの日別出勤数を取得（各病棟テーブルの遅番連携用）
    function getLinkedSTDailyLate() {
        if (!linkedStStaffData || !linkedStStaffData.staffList || !linkedStStaffData.grid) return null;
        const stLate = new Array(NUM_DAYS).fill(0);
        linkedStStaffData.staffList.forEach((st, idx) => {
            if (st.isUnused) return;
            const row = linkedStStaffData.grid[idx] || [];
            for (let d = 0; d < NUM_DAYS; d++) {
                const c = row[d] || { symbol: '' };
                const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                const wish = (st.days && st.days[d]) ? st.days[d] : '';
                if (sym === '遅' || wish === '遅') {
                    stLate[d]++;
                }
            }
        });
        return stLate;
    }

    // ★ ST E番スタッフの日別出勤数を取得（各病棟テーブルのE連携用）
    function getLinkedSTDailyEve() {
        if (!linkedStStaffData || !linkedStStaffData.staffList || !linkedStStaffData.grid) return null;
        const stEve = new Array(NUM_DAYS).fill(0);
        linkedStStaffData.staffList.forEach((st, idx) => {
            if (st.isUnused) return;
            const row = linkedStStaffData.grid[idx] || [];
            for (let d = 0; d < NUM_DAYS; d++) {
                const c = row[d] || { symbol: '' };
                const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                const wish = (st.days && st.days[d]) ? st.days[d] : '';
                if (sym === 'E' || sym === 'イ' || sym === 'イブ' || wish === 'E' || wish === 'イ' || wish === 'イブ') {
                    stEve[d]++;
                }
            }
        });
        return stEve;
    }

    // ★ ST所属スタッフのうち専従スタッフの総数
    function getLinkedSTFloorFtCount() {
        if (!linkedStStaffData || !linkedStStaffData.staffList) return 0;
        return linkedStStaffData.staffList.filter(st => !st.isUnused && st.isFullTime).length;
    }

    // ==========================================
    // ★ 生活期ハ応援連携データ管理（1F:ハ1, 2F:ハ2, 3F:ハ3, 南:ハ南 の実数+0.5合算用）
    // ==========================================
    let linkedLifeStaffData = null; // { staffList: [...], grid: [...] }

    function loadLinkedLifeData(startDate) {
        if (isLife || !currentFloor) {
            linkedLifeStaffData = null;
            return;
        }
        const targetDate = startDate || currentWorkingStartDate || '2026-04-01';
        const lifeKey = `shift_schedule_life_term_${targetDate}`;
        const targetHas = (currentFloor === '1F' ? ['ハ1'] : (currentFloor === '2F' ? ['ハ2'] : (currentFloor === '3F' ? ['ハ3'] : (currentFloor === '南' ? ['ハ4', 'ハ南'] : []))));
        if (targetHas.length === 0) {
            linkedLifeStaffData = null;
            return;
        }

        // 1. 各種ソースから生活期データ・スタッフマスターを取得
        let rawTerm = localStorage.getItem(lifeKey);
        if (!window._cloudMem) window._cloudMem = new Map();
        if (!rawTerm && window._cloudMem.has(lifeKey)) {
            rawTerm = window._cloudMem.get(lifeKey);
        }
        // 他の生活期タームキーも検索フォールバック
        if (!rawTerm) {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('shift_schedule_life_term_')) {
                    const candidate = localStorage.getItem(k);
                    if (candidate) {
                        try {
                            const parsed = JSON.parse(candidate);
                            if (parsed && Array.isArray(parsed.staffList) && parsed.staffList.some(s => targetHas.includes(s.haSection))) {
                                rawTerm = candidate;
                                break;
                            }
                        } catch (e) {}
                    }
                }
            }
        }

        let rawMaster = localStorage.getItem('shift_schedule_life_staff_master');
        let masterStaffList = null;
        if (rawMaster) {
            try { masterStaffList = JSON.parse(rawMaster); } catch (e) {}
        }

        let termData = null;
        if (rawTerm) {
            try { termData = JSON.parse(rawTerm); } catch (e) {}
        }

        // 2. クラウド同期バックグラウンド取得（存在しない場合）
        if (!rawTerm && !window._lifeFetchInFlight) {
            window._lifeFetchInFlight = true;
            fetch(`/api/cloud_sync?deptId=life&t=${Date.now()}`, { cache: 'no-store' })
                .then(r => r.ok ? r.json() : null)
                .then(res => {
                    window._lifeFetchInFlight = false;
                    const cloudState = res && (res.cloudState || res.data);
                    if (cloudState) {
                        if (cloudState.terms && cloudState.terms[targetDate]) {
                            window._cloudMem.set(lifeKey, JSON.stringify(cloudState.terms[targetDate]));
                        }
                        if (cloudState.staffMaster) {
                            try { localStorage.setItem('shift_schedule_life_staff_master', JSON.stringify(cloudState.staffMaster)); } catch (e) {}
                        }
                        loadLinkedLifeData(targetDate);
                        if (lastSolveResult && lastSolveResult.grid) {
                            const currentStats = lastScheduler ? lastScheduler.calculateStats(lastSolveResult.grid) : null;
                            if (currentStats) {
                                renderOutputTable(lastSolveResult.grid, currentStats);
                                renderStatsDashboard(currentStats);
                            }
                        }
                    }
                })
                .catch(() => { window._lifeFetchInFlight = false; });
        }

        // 3. 生活期スタッフ一覧の構築（termData, masterStaffList, またはデフォルト標準定義から）
        let baseStaffList = (termData && Array.isArray(termData.staffList)) ? termData.staffList : (Array.isArray(masterStaffList) ? masterStaffList : []);

        // マスターの設定（haSection）をマージ
        if (Array.isArray(masterStaffList)) {
            masterStaffList.forEach((ms, idx) => {
                if (baseStaffList[idx]) {
                    if (ms.haSection !== undefined) baseStaffList[idx].haSection = ms.haSection;
                    if (ms.name) baseStaffList[idx].name = ms.name;
                    if (ms.isUnused !== undefined) baseStaffList[idx].isUnused = ms.isUnused;
                }
            });
        }

        // 該当フロアのハ応援スタッフを抽出
        let matchingStaff = [];
        let matchingGrid = [];

        baseStaffList.forEach((st, idx) => {
            if (!st.isUnused && targetHas.includes(st.haSection)) {
                matchingStaff.push(st);
                if (termData && termData.outputGrid && termData.outputGrid[idx]) {
                    matchingGrid.push(termData.outputGrid[idx]);
                } else if (st.days && Array.isArray(st.days)) {
                    matchingGrid.push(st.days.map(dSym => ({ symbol: dSym, isFixed: false })));
                } else {
                    matchingGrid.push(null);
                }
            }
        });

        // ★ もし生活期でまだハトグル設定されていない場合の公認デフォルトフォールバック
        // （1F: ハ1, 2F: ハ2, 3F: ハ3, 南: ハ4/ハ南）
        if (matchingStaff.length === 0) {
            const defaultHaName = targetHas[0];
            const defaultHaStaff = {
                id: (defaultHaName === 'ハ1' ? 41 : (defaultHaName === 'ハ2' ? 42 : (defaultHaName === 'ハ3' ? 43 : 44))),
                name: `生活期 ${defaultHaName}`,
                haSection: defaultHaName,
                isUnused: false,
                days: new Array(NUM_DAYS).fill('')
            };
            matchingStaff.push(defaultHaStaff);
            matchingGrid.push(null);
        }

        // 各日の勤務記号が空の場合の基本勤務記号解決
        // ハ1・ハ2: 土日休みの固定、平日○
        // ハ3・ハ4: 通所（日曜日休の固定、月〜土○）
        const term = getTermInfo(targetDate);
        const resolvedGrid = matchingStaff.map((st, mIdx) => {
            const rawRow = matchingGrid[mIdx];
            const row = [];
            const isWeekendOff = (st.haSection === 'ハ1' || st.haSection === 'ハ2');
            for (let d = 0; d < NUM_DAYS; d++) {
                let cellVal = rawRow ? rawRow[d] : null;
                let sym = (cellVal && typeof cellVal === 'object') ? (cellVal.symbol || '') : (cellVal || '');
                if (!sym && st.days && st.days[d]) sym = st.days[d];
                if (!sym) {
                    const dInfo = (term && term.dates && term.dates[d]) ? term.dates[d] : null;
                    const wDay = dInfo ? dInfo.weekday : (d % 7 === 5 ? '土' : (d % 7 === 6 ? '日' : '月'));
                    if (isWeekendOff) {
                        sym = (wDay === '土' || wDay === '日') ? '休' : '○';
                    } else {
                        // ハ3, ハ4（通所組み）: 日曜日休固定、月〜土は出勤○
                        sym = (wDay === '日') ? '休' : '○';
                    }
                }
                const isFixed = (cellVal && typeof cellVal === 'object') ? !!cellVal.isFixed : false;
                row.push({ symbol: sym, isFixed: isFixed });
            }
            return row;
        });

        linkedLifeStaffData = {
            staffList: matchingStaff,
            grid: resolvedGrid
        };
    }

    function getLinkedLifeDailyWork() {
        if (!linkedLifeStaffData || !linkedLifeStaffData.staffList || !linkedLifeStaffData.grid) return null;
        const lifeWork = new Array(NUM_DAYS).fill(0);
        linkedLifeStaffData.staffList.forEach((st, idx) => {
            if (st.isUnused || st.isZeroCount) return;
            const row = linkedLifeStaffData.grid[idx] || [];
            for (let d = 0; d < NUM_DAYS; d++) {
                const c = row[d] || { symbol: '' };
                const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                const wish = (st.days && st.days[d]) ? st.days[d] : '';
                const activeSym = sym || wish;
                if (isWorkSymbol(activeSym) && activeSym !== '研' && activeSym !== '張') {
                    lifeWork[d] += 0.5; // ★ 生活期ハ応援スタッフが出勤している日は実数に0.5加算！
                } else if (activeSym === '○/休' || activeSym === '休/○' || activeSym === '○/有' || activeSym === '有/○' || activeSym === '〇/休' || activeSym === '休/〇' || activeSym === '〇/有' || activeSym === '有/〇') {
                    lifeWork[d] += 0.25;
                }
            }
        });
        return lifeWork;
    }

    // 出力テーブル描画（画像3のメリハリある罫線と「※/※※～※/※※勤務表」タイトルを反映）

    // ★ グリッドから正確な stats（staffStats, daily等）を再計算する安全ヘルパー
    function calculateGridStats(grid) {
        if (!grid || !Array.isArray(grid) || grid.length === 0) return null;
        try {
            const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
            const term = getTermInfo(curStartDate);
            let scheduler = lastScheduler;
            if (!scheduler || typeof scheduler.calculateStats !== 'function') {
                scheduler = new ShiftScheduler(staffList, term.dates, { floor: currentFloor, isLife: isLife, isST: isST });
            }
            scheduler.grid = grid;
            return scheduler.calculateStats();
        } catch (e) {
            console.warn('calculateGridStats warning:', e);
            return null;
        }
    }

    function renderOutputTable(grid, stats) {
        const thead = document.getElementById('outputTableHead');
        const tbody = document.getElementById('outputTableBody');
        const tfoot = document.getElementById('outputTableFoot');
        if (!thead || !tbody || !tfoot) return;

        // ★ TDZ防止: 関数の冒頭で currentGrid を最優先かつ安全に初期化
        const currentGrid = grid || (lastSolveResult && lastSolveResult.grid) || [];

        // ★ stats が渡されていない場合、currentGrid から自動的に完全再計算（公休0バグ・クラッシュを物理防止！）
        if (!stats || !stats.staffStats) {
            stats = calculateGridStats(currentGrid);
        }

        // ★ 病棟テーブル描画時、ST所属スタッフ及び生活期ハ応援データを確実に最新化
        if (!isST && !isLife && currentFloor) {
            loadLinkedSTData();
            loadLinkedLifeData();
            if (lastScheduler && typeof lastScheduler.autoFixOverallocatedEarlyDuties === 'function') {
                lastScheduler.autoFixOverallocatedEarlyDuties();
            }
        }

        const term = getTermInfo();


        let headHtml = `
            <tr>
                <th class="sticky-col-1 border-thick-bottom" rowspan="2">${isST ? '階' : 'No'}</th>
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
            const thickCls = getDayBorderClass(d);
            headHtml += `<th class="${cls} ${thickCls} border-thick-bottom header-day-col col-day-fixed" style="width:52px; min-width:52px; max-width:52px;" title="${dateInfo.label} (${dateInfo.weekday})${dateInfo.isHoliday ? ' 祝日' : ''}">
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

        if (isST) {
            // ★ 添付3準拠デザイン: ST専用テーブルは階別（1階, 2階, 3階, 南）にグルーピング＆太線境界
            const stFloors = [
                { key: '1F', label: '1階', bg: '#f0f8ff', color: '#0369a1' },
                { key: '2F', label: '2階', bg: '#fff8f0', color: '#c2410c' },
                { key: '3F', label: '3階', bg: '#f2fcf5', color: '#15803d' },
                { key: '南', label: '南', bg: '#faf5ff', color: '#7e22ce' }
            ];

            const matchedStaffSet = new Set();
            stFloors.forEach((fl) => {
                const flStaffIndices = validStaffIndices.filter(s => {
                    const st = staffList[s];
                    if (!st) return false;
                    const flVal = (st.floor || '').trim();
                    const isMatch = (flVal === fl.key || flVal === fl.label || flVal.includes(fl.key) || flVal.includes(fl.label));
                    if (isMatch) matchedStaffSet.add(s);
                    return isMatch;
                });

                // 並び順: 係長 → 主任 → 副主任 → 希望入力ページの記載順
                flStaffIndices.sort((a, b) => {
                    const getRoleRank = (s) => {
                        const st = staffList[s];
                        if (st.isSectionChief) return 1;
                        if (st.isChief) return 2;
                        if (st.isSubChief) return 3;
                        return 4;
                    };
                    const rankA = getRoleRank(a);
                    const rankB = getRoleRank(b);
                    if (rankA !== rankB) return rankA - rankB;
                    return a - b;
                });

                flStaffIndices.forEach((s, idxInFl) => {
                    const staff = staffList[s];
                    const staffStat = (stats && stats.staffStats && stats.staffStats[s]) || { workDays:0, offDays:0, paidDays:0, refDays:0, early:0, late:0, eve:0, h8:0 };
                    const isLastInFloor = (idxInFl === flStaffIndices.length - 1);
                    // 添付3の太い黒境界線！
                    const rowBorderB = isLastInFloor ? 'border-bottom: 3.5px solid #1e293b !important;' : '';

                    bodyHtml += `<tr class="${isLastInFloor ? 'st-floor-last-row' : ''}" style="${rowBorderB}">`;
                    if (idxInFl === 0) {
                        bodyHtml += `<td class="sticky-col-1 border-thick-right" rowspan="${flStaffIndices.length}" style="background:${fl.bg}; color:${fl.color}; font-weight:800; font-size:0.95rem; text-align:center; vertical-align:middle; ${rowBorderB}">${fl.label}</td>`;
                    }
                    bodyHtml += `<td class="sticky-col-2 border-thick-right" style="text-align:left; padding-left:8px; font-weight:700; ${rowBorderB}">${escapeHtmlText(staff.name)}</td>`;

                    for (let d = 0; d < NUM_DAYS; d++) {
                        const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '' };
                        const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                        const isRef = isRefreshHolidaySymbol(displaySym) || isRefreshHolidaySymbol(cell.symbol);
                        const isFixedCell = cell.isFixed && !isRef;
                        const cls = isFixedCell ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');
                        const thickCls = getDayBorderClass(d);
                        const titleText = cell.isFixed ? '🔒 事前固定希望枠（赤字・太字保持）' : 'システム自動配置';
                        let specialCls = '';
                        if (displaySym === '早' || displaySym === 'ハヤ') specialCls = ' cell-special-early';
                        else if (displaySym === '遅') specialCls = ' cell-special-late';
                        else if (displaySym === 'E') specialCls = ' cell-special-eve';
                        bodyHtml += `<td class="${cls} ${thickCls}${specialCls}" data-sym="${displaySym}" data-s="${s}" data-d="${d}" title="${titleText}" style="${rowBorderB}">${displaySym}</td>`;
                    }

                    bodyHtml += `
                        <td class="stat-cell" data-s="${s}" data-stat="work" style="font-weight:700; color:#1e293b; background:transparent; ${rowBorderB}">${staffStat.workDays}</td>
                        <td class="stat-cell ${(!staff.isUnused && staffStat.offDays !== 8) ? 'holiday-alert-cell' : ''}" data-s="${s}" data-stat="off" title="${staffStat.offDays !== 8 ? '公休が8日ではありません（現在:' + staffStat.offDays + '日）' : '公休8日'}" style="font-weight:700; color:#1e293b; ${rowBorderB}">${staffStat.offDays}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="paid" style="font-weight:800; color:#1e293b; background:transparent; ${rowBorderB}">${staffStat.paidDays}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="ref" style="font-weight:600; color:#1e293b; background:transparent; ${rowBorderB}">${staffStat.refDays}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="early" style="font-weight:600; color:#c2410c; background:transparent; ${rowBorderB}">${staffStat.early}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="late" style="color:#94a3b8; background:transparent; ${rowBorderB}">-</td>
                        <td class="stat-cell" data-s="${s}" data-stat="eve" style="color:#94a3b8; background:transparent; ${rowBorderB}">-</td>
                        <td class="stat-cell" data-s="${s}" data-stat="h8" style="color:#94a3b8; background:transparent; ${rowBorderB}">-</td>
                        <td class="remarks-cell" style="min-width:220px; max-width:320px; text-align:left; font-size:0.8rem; color:#475569; padding:2px 8px; white-space:normal; word-break:break-all; background:transparent; ${rowBorderB}">${escapeHtmlText(staff.remarks || '')}</td>
                    </tr>`;
                });
            });

            // ★ 万が一どのフロアにも属していないスタッフがいた場合のフォールバック表示（行消滅を物理防止）
            const unassignedStaffIndices = validStaffIndices.filter(s => !matchedStaffSet.has(s));
            if (unassignedStaffIndices.length > 0) {
                unassignedStaffIndices.forEach((s, idxInFl) => {
                    const staff = staffList[s];
                    const staffStat = (stats && stats.staffStats && stats.staffStats[s]) || { workDays:0, offDays:0, paidDays:0, refDays:0, early:0, late:0, eve:0, h8:0 };
                    bodyHtml += `<tr>`;
                    if (idxInFl === 0) {
                        bodyHtml += `<td class="sticky-col-1 border-thick-right" rowspan="${unassignedStaffIndices.length}" style="background:#fef2f2; color:#b91c1c; font-weight:800; font-size:0.95rem; text-align:center; vertical-align:middle;">未設定</td>`;
                    }
                    bodyHtml += `<td class="sticky-col-2 border-thick-right" style="text-align:left; padding-left:8px; font-weight:700;">${escapeHtmlText(staff.name)}</td>`;
                    for (let d = 0; d < NUM_DAYS; d++) {
                        const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '' };
                        const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                        const isRef = isRefreshHolidaySymbol(displaySym) || isRefreshHolidaySymbol(cell.symbol);
                        const isFixedCell = cell.isFixed && !isRef;
                        const cls = isFixedCell ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');
                        const thickCls = getDayBorderClass(d);
                        let specialCls = '';
                        if (displaySym === '早') specialCls = ' cell-special-early';
                        else if (displaySym === '遅') specialCls = ' cell-special-late';
                        else if (displaySym === 'E') specialCls = ' cell-special-eve';
                        bodyHtml += `<td class="${cls} ${thickCls}${specialCls}" data-sym="${displaySym}" data-s="${s}" data-d="${d}">${displaySym}</td>`;
                    }
                    bodyHtml += `
                        <td class="stat-cell" data-s="${s}" data-stat="work">${staffStat.workDays}</td>
                        <td class="stat-cell ${(!staff.isUnused && staffStat.offDays !== 8) ? 'holiday-alert-cell' : ''}" data-s="${s}" data-stat="off" title="${staffStat.offDays !== 8 ? '公休が8日ではありません（現在:' + staffStat.offDays + '日）' : '公休8日'}">${staffStat.offDays}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="paid">${staffStat.paidDays}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="ref">${staffStat.refDays}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="early">${staffStat.early}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="late">-</td>
                        <td class="stat-cell" data-s="${s}" data-stat="eve">-</td>
                        <td class="stat-cell" data-s="${s}" data-stat="h8">-</td>
                        <td class="remarks-cell" style="min-width:220px; max-width:320px; text-align:left; font-size:0.8rem; color:#475569; padding:2px 8px;">${escapeHtmlText(staff.remarks || '')}</td>
                    </tr>`;
                });
            }
        } else {
            validStaffIndices.forEach((s, outIdx) => {
                const staff = staffList[s];
                const staffStat = stats.staffStats[s];
                const isLastStaff = (outIdx === validStaffIndices.length - 1);
                const rowBottomCls = isLastStaff ? 'border-thick-bottom' : '';

                bodyHtml += `<tr>`;
                bodyHtml += `<td class="sticky-col-1 font-mono ${rowBottomCls}">${outIdx + 1}</td>`;
                bodyHtml += `<td class="sticky-col-2 border-thick-right ${rowBottomCls}">${staff.name}</td>`;

                const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate;
                for (let d = 0; d < NUM_DAYS; d++) {
                    const cell = grid[s][d];
                    const displaySym = cell.symbol ? cell.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                    const isRef = isRefreshHolidaySymbol(displaySym) || isRefreshHolidaySymbol(cell.symbol);
                    // ★ ユーザー指示: リフレッシュ休暇「上1」等は希望と同じ赤字にせず、通常黒字（auto-ref-cell）！
                    const isCellFixed = cell.isFixed && !isRef;
                    const cls = isCellFixed ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');
                    const thickCls = getDayBorderClass(d);
                    let specialCls = '';
                    if (displaySym === '早') specialCls = ' cell-special-early';
                    else if (displaySym === '遅') specialCls = ' cell-special-late';
                    else if (displaySym === 'E') specialCls = ' cell-special-eve';
                    const titleText = isCellFixed ? '🔒 事前固定希望枠（赤字・太字保持）' : (isRef ? '🌴 自動配分リフ（通常編集自由）' : 'システム自動配置');
                    bodyHtml += `<td class="${cls} ${thickCls} ${rowBottomCls}${specialCls}" data-sym="${displaySym}" data-s="${s}" data-d="${d}" title="${titleText}">${displaySym}</td>`;
                }

                bodyHtml += `
                    <td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="work" style="font-weight:700; color:#1e293b; background:transparent;">${staffStat.workDays}</td>
                    <td class="stat-cell ${rowBottomCls} ${(!staff.isUnused && staffStat.offDays !== 8) ? 'holiday-alert-cell' : ''}" data-s="${s}" data-stat="off" title="${staffStat.offDays !== 8 ? '公休が8日ではありません（現在:' + staffStat.offDays + '日）' : '公休8日'}" style="font-weight:700; color:#1e293b;">${staffStat.offDays}</td>
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
        }

        // ★「1階」「2階」「3階」「南」のテーブルの最下部にSTのスタッフ名と勤務を確認できるように表示（どの階でも一目で識別できるようST専用公式カラー・ピンク/ローズ系を適用）
        if (!isST && currentFloor && linkedStStaffData && linkedStStaffData.staffList && linkedStStaffData.staffList.length > 0) {
            const stThemeBg = '#fff5f8';
            const stThemeHeaderBg = '#fce7f3';
            const stThemeBorder = '#db2777';
            const stThemeTextColor = '#9d174d';
            const stThemeBadgeBg = '#fbcfe8';

            bodyHtml += `
                <tr style="background:${stThemeHeaderBg}; border-top: 3px solid ${stThemeBorder};">
                    <th colspan="${NUM_DAYS + 11}" style="text-align:left; padding:8px 12px; font-size:0.85rem; font-weight:800; color:${stThemeTextColor}; letter-spacing:0.03em;">
                        【${currentFloor} 所属 STスタッフ】
                    </th>
                </tr>
            `;

            linkedStStaffData.staffList.forEach((st, stIdx) => {
                const rowData = linkedStStaffData.grid[stIdx] || [];
                let stWorkCount = 0;
                let stOffCount = 0;
                let stPaidCount = 0;
                let stRefCount = 0;
                let stEarlyCount = 0;

                bodyHtml += `<tr class="st-linked-row" style="background:${stThemeBg} !important; color:#334155; opacity:0.95;">`;
                bodyHtml += `<td class="sticky-col-1 font-mono" style="background:${stThemeBg} !important; color:${stThemeTextColor} !important; font-weight:800;">ST-${stIdx + 1}</td>`;
                bodyHtml += `<td class="sticky-col-2 border-thick-right" style="background:${stThemeBg} !important; color:${stThemeTextColor} !important; font-weight:700; text-align:left; padding-left:8px;">
                    ${escapeHtmlText(st.name)}
                    ${st.prevName ? `<span style="font-size:0.7rem; color:#64748b;">(${escapeHtmlText(st.prevName)})</span>` : ''}
                    <span style="font-size:0.65rem; background:${stThemeBadgeBg}; color:${stThemeTextColor}; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:700;">${st.floor}</span>
                </td>`;

                for (let d = 0; d < NUM_DAYS; d++) {
                    const c = rowData[d] || { symbol: '' };
                    const sym = c.symbol ? c.symbol.replace(/[◦•･◯〇●]/g, '○') : '';
                    const thickCls = getDayBorderClass(d);

                    if (sym === '休') stOffCount++;
                    else if (sym === '有') stPaidCount++;
                    else if (sym && sym.includes('リフ')) stRefCount++;
                    else if (sym === '早') { stEarlyCount++; stWorkCount += 1; }
                    else if (isWorkSymbol(sym)) { stWorkCount += 1; }

                    // ★ 事前固定希望（本人が希望入力した枠）のみ赤字・太字（fixed-cell）！自動生成された公休等は通常文字
                    const originalWish = (st.days && st.days[d]) ? st.days[d] : '';
                    const isRef = isRefreshHolidaySymbol(sym) || isRefreshHolidaySymbol(originalWish);
                    const isCellFixed = !isRef && !!(
                        (originalWish !== '' && originalWish === sym) ||
                        (c && c.isFixed && originalWish !== '')
                    );
                    const cellCls = isCellFixed ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');
                    const cellTitle = isCellFixed
                        ? `STスタッフ（事前固定希望）: ${escapeHtmlText(st.name)} / ${sym}`
                        : `STスタッフ（自動配置）: ${escapeHtmlText(st.name)} / ${sym}`;

                    let specialCls = '';
                    let cellBg = stThemeBg;
                    if (sym === '早' || sym === 'ハヤ') { specialCls = ' cell-special-early'; cellBg = ''; }
                    else if (sym === '遅') { specialCls = ' cell-special-late'; cellBg = ''; }
                    else if (sym === 'E') { specialCls = ' cell-special-eve'; cellBg = ''; }
                    const bgStyle = cellBg ? `background:${cellBg};` : '';

                    bodyHtml += `<td class="${thickCls} ${cellCls} editable-st-cell${specialCls}" data-sym="${sym}" data-is-st="1" data-st-id="${st.id}" data-st-idx="${stIdx}" data-d="${d}" style="text-align:center; font-size:0.85rem; ${bgStyle} cursor:pointer;" title="${cellTitle}">${sym}</td>`;
                }

                bodyHtml += `
                    <td style="text-align:center; font-weight:700; background:${stThemeBg}; color:#1e293b;">${stWorkCount}</td>
                    <td style="text-align:center; font-weight:700; background:${stThemeBg}; color:#1e293b;">${stOffCount}</td>
                    <td style="text-align:center; font-weight:800; background:${stThemeBg}; color:#1e293b;">${stPaidCount}</td>
                    <td style="text-align:center; font-weight:600; background:${stThemeBg}; color:#1e293b;">${stRefCount}</td>
                    <td style="text-align:center; font-weight:600; background:${stThemeBg}; color:#d97706;">${stEarlyCount}</td>
                    <td style="text-align:center; color:#94a3b8; background:${stThemeBg};">-</td>
                    <td style="text-align:center; color:#94a3b8; background:${stThemeBg};">-</td>
                    <td style="text-align:center; color:#94a3b8; background:${stThemeBg};">-</td>
                    <td style="font-size:0.78rem; color:#64748b; background:${stThemeBg}; text-align:left; padding:2px 8px;">ST専用テーブル連携（クリックで修正可能）</td>
                </tr>`;
            });
        }

        // ★ 生活期ハ応援スタッフの参照表示（添付5準拠: STの下にハーフマン出勤を記載）
        if (!isST && !isLife && currentFloor && linkedLifeStaffData && linkedLifeStaffData.staffList && linkedLifeStaffData.staffList.length > 0) {
            const haBadgeLabel = (currentFloor === '1F' ? 'ハ1' : (currentFloor === '2F' ? 'ハ2' : (currentFloor === '3F' ? 'ハ3' : 'ハ南')));
            bodyHtml += `
                <tr style="background:#ecfdf5; border-top: 3px solid #10b981;">
                    <th colspan="${NUM_DAYS + 11}" style="text-align:left; padding:8px 12px; font-size:0.85rem; font-weight:800; color:#065f46; letter-spacing:0.03em;">
                        【${currentFloor} 応援 ハーフマン】</th>
                </tr>
            `;

            linkedLifeStaffData.staffList.forEach((st, stIdx) => {
                const rowData = linkedLifeStaffData.grid[stIdx] || [];

                bodyHtml += `<tr class="life-linked-row" style="background:#f0fdf4 !important; color:#334155; opacity:0.95;">`;
                bodyHtml += `<td class="sticky-col-1 font-mono" style="background:#f0fdf4 !important; color:#059669 !important; font-weight:800;">ハ-${stIdx + 1}</td>`;
                bodyHtml += `<td class="sticky-col-2 border-thick-right" style="background:#f0fdf4 !important; color:#059669 !important; font-weight:700; text-align:left; padding-left:8px;">
                    ${escapeHtmlText(st.name)}
                    ${st.prevName ? `<span style="font-size:0.7rem; color:#64748b;">(${escapeHtmlText(st.prevName)})</span>` : ''}
                    <span style="font-size:0.65rem; background:#d1fae5; color:#065f46; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:700;">${st.haSection || haBadgeLabel}</span>
                </td>`;

                // 28日間の勤務セル（※前5日間の列は出力テーブルには不要！初日d=0から28日目d=27まで正確に対応）
                let haWorkCount = 0;
                let haOffCount = 0;
                let haPaidCount = 0;
                let haRefCount = 0;

                for (let d = 0; d < NUM_DAYS; d++) {
                    const thickCls = getDayBorderClass(d);
                    const c = rowData[d] || { symbol: '' };
                    const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');

                    if (isWorkSymbol(sym) && sym !== '研' && sym !== '張') {
                        haWorkCount += 1.0;
                    } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○' || sym === '〇/休' || sym === '休/〇' || sym === '〇/有' || sym === '有/〇') {
                        haWorkCount += 0.5;
                        if (sym.includes('休')) haOffCount += 0.5;
                        if (sym.includes('有')) haPaidCount += 0.5;
                    } else if (sym === '休') {
                        haOffCount += 1.0;
                    } else if (sym === '有') {
                        haPaidCount += 1.0;
                    } else if (sym.includes('リフ') || sym.startsWith('上') || sym.startsWith('下')) {
                        haRefCount += 1.0;
                    }

                    const isRef = isRefreshHolidaySymbol(sym);
                    const isCellFixed = !isRef && ((c && typeof c === 'object') ? !!c.isFixed : false);
                    const cellCls = isCellFixed ? 'day-cell fixed-cell' : (isRef ? 'day-cell auto-ref-cell' : 'day-cell auto-cell');
                    const cellTitle = `ハーフマン応援（生活期連携）: ${escapeHtmlText(st.name)} / ${sym}`;
                    let specialCls = '';
                    let cellBg = '#f0fdf4';
                    if (sym === '早' || sym === 'ハヤ') { specialCls = ' cell-special-early'; cellBg = ''; }
                    else if (sym === '遅') { specialCls = ' cell-special-late'; cellBg = ''; }
                    else if (sym === 'E') { specialCls = ' cell-special-eve'; cellBg = ''; }
                    const bgStyle = cellBg ? `background:${cellBg};` : '';

                    bodyHtml += `<td class="${thickCls} ${cellCls} editable-ha-cell${specialCls}" data-sym="${sym}" data-is-ha="1" data-ha-id="${st.id || ''}" data-ha-idx="${stIdx}" data-d="${d}" style="text-align:center; font-size:0.85rem; ${bgStyle} cursor:pointer;" title="${cellTitle}">${sym}</td>`;
                }

                bodyHtml += `
                    <td style="text-align:center; font-weight:700; background:#f0fdf4; color:#1e293b;">${haWorkCount}</td>
                    <td style="text-align:center; font-weight:700; background:#f0fdf4; color:#1e293b;">${haOffCount}</td>
                    <td style="text-align:center; font-weight:800; background:#f0fdf4; color:#1e293b;">${haPaidCount}</td>
                    <td style="text-align:center; font-weight:600; background:#f0fdf4; color:#1e293b;">${haRefCount}</td>
                    <td style="text-align:center; color:#94a3b8; background:#f0fdf4;">-</td>
                    <td style="text-align:center; color:#94a3b8; background:#f0fdf4;">-</td>
                    <td style="text-align:center; color:#94a3b8; background:#f0fdf4;">-</td>
                    <td style="text-align:center; color:#94a3b8; background:#f0fdf4;">-</td>
                    <td style="font-size:0.78rem; color:#059669; background:#f0fdf4; text-align:left; padding:2px 8px;">生活期テーブル応援連携（実数0.5加算・クリックで修正可能）</td>
                </tr>`;
            });
        }

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

        // ★ STテーブル専用: 添付3準拠の階別集計フッター（1階, 2階, 3階, 南の出勤人数・実数・早）
        if (isST) {
            let footHtml = '';
            const stFloors = [
                { key: '1F', label: '1階', bg: '#f0f8ff', headerBg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
                { key: '2F', label: '2階', bg: '#fff8f0', headerBg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
                { key: '3F', label: '3階', bg: '#f2fcf5', headerBg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
                { key: '南', label: '南', bg: '#faf5ff', headerBg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' }
            ];

            let allFloorsWork = new Array(NUM_DAYS).fill(0);
            let allFloorsReal = new Array(NUM_DAYS).fill(0);
            let allFloorsEarly = new Array(NUM_DAYS).fill(0);

            stFloors.forEach((fl) => {
                const flStaff = validStaffIndices.filter(s => {
                    const st = staffList[s];
                    return st.floor === fl.key || (st.floor && st.floor.includes(fl.key));
                });

                const dWork = new Array(NUM_DAYS).fill(0);
                const dReal = new Array(NUM_DAYS).fill(0);
                const dEarly = new Array(NUM_DAYS).fill(0);

                flStaff.forEach(s => {
                    const st = staffList[s];
                    for (let d = 0; d < NUM_DAYS; d++) {
                        const cell = grid[s] ? grid[s][d] : null;
                        const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                        if (isWorkSymbol(sym)) {
                            dWork[d]++;
                            dReal[d] += (st.isHalf ? 0.5 : 1.0);
                        } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○') {
                            dReal[d] += 0.5;
                        }
                        if (sym === '早') {
                            dEarly[d]++;
                        }
                    }
                });

                for (let d = 0; d < NUM_DAYS; d++) {
                    allFloorsWork[d] += dWork[d];
                    allFloorsReal[d] += dReal[d];
                    allFloorsEarly[d] += dEarly[d];
                }

                const sumWork = dWork.reduce((a, b) => a + b, 0);
                const sumReal = dReal.reduce((a, b) => a + b, 0);
                const sumEarly = dEarly.reduce((a, b) => a + b, 0);

                // 添付3: 階（結合）, 出勤人数
                footHtml += `<tr style="background:${fl.bg}; font-weight:bold;">
                    <th class="sticky-col-1" rowspan="3" style="background:${fl.headerBg}; color:${fl.color}; font-size:1.05rem; font-weight:800; vertical-align:middle; text-align:center; border-right:1px solid ${fl.border}; border-bottom:3px solid #1e293b !important;">${fl.label}</th>
                    <th class="sticky-col-2" style="background:${fl.bg}; border-right:2px solid #475569; text-align:center; color:#1e293b; padding:4px 8px;">出勤人数</th>`;
                for (let d = 0; d < NUM_DAYS; d++) {
                    const thickCls = getDayBorderClass(d);
                    footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#1e293b; text-align:center;">${dWork[d]}</td>`;
                }
                footHtml += `<td style="font-weight:700; color:#1e293b; text-align:center;">${sumWork}</td><td colspan="8"></td></tr>`;

                // 添付3: 実数
                footHtml += `<tr style="background:${fl.bg}; font-weight:bold;">
                    <th class="sticky-col-2" style="background:${fl.bg}; border-right:2px solid #475569; text-align:center; color:#0369a1; padding:4px 8px;">実数</th>`;
                for (let d = 0; d < NUM_DAYS; d++) {
                    const thickCls = getDayBorderClass(d);
                    footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#0369a1; text-align:center;">${dReal[d]}</td>`;
                }
                footHtml += `<td style="font-weight:700; color:#0369a1; text-align:center;">${sumReal}</td><td colspan="8"></td></tr>`;

                // ★ 添付4: 各階の最終行（早の行）は最右端まで太い横罫線（3px solid #1e293b）を貫通！
                footHtml += `<tr style="background:${fl.bg}; font-weight:bold;">
                    <th class="sticky-col-2" style="background:${fl.bg}; border-right:2px solid #475569; border-bottom: 3px solid #1e293b !important; text-align:center; color:#c2410c; padding:4px 8px;">早</th>`;
                for (let d = 0; d < NUM_DAYS; d++) {
                    const thickCls = getDayBorderClass(d);
                    footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#c2410c; text-align:center; border-bottom: 3px solid #1e293b !important;">${dEarly[d]}</td>`;
                }
                footHtml += `<td style="font-weight:700; color:#c2410c; text-align:center; border-bottom: 3px solid #1e293b !important;">${sumEarly}</td><td colspan="8" style="border-bottom: 3px solid #1e293b !important;"></td></tr>`;
            });

            // 全体合計行
            const totalWorkAll = allFloorsWork.reduce((a, b) => a + b, 0);
            const totalRealAll = allFloorsReal.reduce((a, b) => a + b, 0);
            const totalEarlyAll = allFloorsEarly.reduce((a, b) => a + b, 0);

            footHtml += `<tr style="background:#f1f5f9; font-weight:800; border-top: 3px solid #475569;">
                <th class="sticky-col-1" rowspan="3" style="background:#e2e8f0; color:#0f172a; font-size:1.05rem; font-weight:800; vertical-align:middle; text-align:center; border-right:1px solid #cbd5e1;">全階合計</th>
                <th class="sticky-col-2" style="background:#f1f5f9; border-right:2px solid #475569; text-align:center; color:#0f172a; padding:4px 8px;">出勤合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:900; color:#0f172a; text-align:center; font-size:0.95rem;">${allFloorsWork[d]}</td>`;
            }
            footHtml += `<td style="font-weight:900; color:#0f172a; text-align:center;">${totalWorkAll}</td><td colspan="8"></td></tr>`;

            footHtml += `<tr style="background:#f1f5f9; font-weight:800;">
                <th class="sticky-col-2" style="background:#f1f5f9; border-right:2px solid #475569; text-align:center; color:#0369a1; padding:4px 8px;">実数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:900; color:#0369a1; text-align:center; font-size:0.95rem;">${allFloorsReal[d]}</td>`;
            }
            footHtml += `<td style="font-weight:900; color:#0369a1; text-align:center;">${totalRealAll}</td><td colspan="8"></td></tr>`;

            footHtml += `<tr style="background:#f1f5f9; font-weight:800;">
                <th class="sticky-col-2" style="background:#f1f5f9; border-right:2px solid #475569; border-bottom: 3.5px solid #1e293b !important; text-align:center; color:#c2410c; padding:4px 8px;">早合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:900; color:#c2410c; text-align:center; font-size:0.95rem; border-bottom: 3.5px solid #1e293b !important;">${allFloorsEarly[d]}</td>`;
            }
            footHtml += `<td style="font-weight:900; color:#c2410c; text-align:center; border-bottom: 3.5px solid #1e293b !important;">${totalEarlyAll}</td><td colspan="8" style="border-bottom: 3.5px solid #1e293b !important;"></td></tr>`;

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
            return;
        }

                // ★ 生活期テーブル専用フッター集計行 (訪問出勤人数合計, 訪問実数合計, 通所出勤人数合計, 通所実数合計, 8時)
        if (isLife) {
            const lifeDates = term.dates || [];
            // 日別集計用
            const vWorkCounts = new Array(NUM_DAYS).fill(0);
            const vRealCounts = new Array(NUM_DAYS).fill(0);
            const tWorkCounts = new Array(NUM_DAYS).fill(0);
            const tRealCounts = new Array(NUM_DAYS).fill(0);
            const h8Counts = new Array(NUM_DAYS).fill(0);

            for (let d = 0; d < NUM_DAYS; d++) {
                for (let s = 0; s < staffList.length; s++) {
                    const st = staffList[s];
                    if (st.isUnused) continue;
                    const row = (currentGrid && currentGrid[s]) ? currentGrid[s] : (grid && grid[s] ? grid[s] : []);
                    const cell = row[d];
                    const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                    if (!sym || isHolidaySymbol(sym) || sym === 'ー') continue;

                    // 実数ウェイト
                    let weight = 1.0;
                    if (st.isZeroCount || sym === '出張') weight = 0.0;
                    else if (st.isHalf || sym.includes('/')) weight = 0.5;

                    const sec = st.lifeSection || '';
                    const ha = st.haSection || '';

                    // ★ ユーザー指示による生活期集計ルール4点:
                    // ① 訪問出勤人数合計 ＝ 訪問トグルONの〇の合計
                    // ② 訪問実数合計 ＝ 訪問トグルONの出勤者の実数（0.5トグルがONなら0.5で計算）
                    // ③ 通所出勤人数合計 ＝ 通所トグルONの出勤者数 ＋ CLトグルONの出勤者数 ＋ ハ3およびハ南のトグルONの出勤者数合計
                    // ④ 通所実数合計 ＝ 通所トグルONの出勤者実数 ＋ CLトグルONの出勤者実数 ＋ ハ3およびハ南のトグルONの出勤者実数の合計（0.5トグルがONなら0.5で計算）
                    const isVisit = (sec === '訪問');
                    const isTsusho = (sec === '通所') || (sec === 'Cl2') || (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4');

                    if (isVisit) {
                        vWorkCounts[d]++;
                        let vWeight = (st.isZeroCount || sym === '出張') ? 0.0 : (st.isHalf || sym.includes('/') ? 0.5 : 1.0);
                        vRealCounts[d] += vWeight;
                    }
                    if (isTsusho) {
                        tWorkCounts[d]++;
                        // ★ ユーザー指示: ハ3とハ南は0.5換算！通所・CLは通常1.0（0.5なら0.5、0なら0）
                        let tWeight = (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : ((st.isZeroCount || sym === '出張') ? 0.0 : (st.isHalf || sym.includes('/') ? 0.5 : 1.0));
                        tRealCounts[d] += tWeight;
                    }

                    if (sym === '8時') {
                        h8Counts[d]++;
                    }
                }
            }

            // 合計計算
            const vWorkSum = vWorkCounts.reduce((a, b) => a + b, 0);
            const vRealSum = vRealCounts.reduce((a, b) => a + b, 0);
            const tWorkSum = tWorkCounts.reduce((a, b) => a + b, 0);
            const tRealSum = tRealCounts.reduce((a, b) => a + b, 0);
            const h8Sum = h8Counts.reduce((a, b) => a + b, 0);

            let lifeFootHtml = '';

            // 1. 訪問出勤人数合計
            lifeFootHtml += `<tr style="background:#f8fafc; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="background:#f8fafc; color:#0369a1; font-weight:800;">訪問出勤人数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                lifeFootHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#0369a1;">${vWorkCounts[d]}</td>`;
            }
            lifeFootHtml += `<td style="font-weight:700; color:#0369a1;">${vWorkSum}</td><td colspan="7" style="color:#94a3b8;">-</td></tr>`;

            // 2. 訪問実数合計
            lifeFootHtml += `<tr style="background:#f0f9ff; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="background:#f0f9ff; color:#0284c7; font-weight:800;">訪問実数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                const disp = (vRealCounts[d] % 1 === 0) ? vRealCounts[d] : vRealCounts[d].toFixed(1);
                lifeFootHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#0284c7;">${disp}</td>`;
            }
            const dispVRealSum = (vRealSum % 1 === 0) ? vRealSum : vRealSum.toFixed(1);
            lifeFootHtml += `<td style="font-weight:700; color:#0284c7;">${dispVRealSum}</td><td colspan="7" style="color:#94a3b8;">-</td></tr>`;

            // 3. 通所出勤人数合計
            lifeFootHtml += `<tr style="background:#fefce8; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="background:#fefce8; color:#854d0e; font-weight:800;">通所出勤人数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                lifeFootHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#854d0e;">${tWorkCounts[d]}</td>`;
            }
            lifeFootHtml += `<td style="font-weight:700; color:#854d0e;">${tWorkSum}</td><td colspan="7" style="color:#94a3b8;">-</td></tr>`;

            // 4. 通所実数合計
            lifeFootHtml += `<tr style="background:#fffbeb; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="background:#fffbeb; color:#b45309; font-weight:800;">通所実数合計</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const thickCls = getDayBorderClass(d);
                const disp = (tRealCounts[d] % 1 === 0) ? tRealCounts[d] : tRealCounts[d].toFixed(1);
                lifeFootHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#b45309;">${disp}</td>`;
            }
            const dispTRealSum = (tRealSum % 1 === 0) ? tRealSum : tRealSum.toFixed(1);
            lifeFootHtml += `<td style="font-weight:700; color:#b45309;">${dispTRealSum}</td><td colspan="7" style="color:#94a3b8;">-</td></tr>`;

            // 5. 訪問8時勤務 (平日は定数1名、土日は0名。平日で0名または2名以上なら青網掛けエラー表示！)
            lifeFootHtml += `<tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1 border-thick-bottom" colspan="2" style="color:#334155;">訪問8時</th>`;
            for (let d = 0; d < NUM_DAYS; d++) {
                const di = lifeDates[d];
                const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
                const thickCls = getDayBorderClass(d);
                const h8Val = h8Counts[d];
                const needH8 = isWeekend ? 0 : 1;
                const isH8Mismatch = (h8Val !== needH8);
                const h8Cls = isH8Mismatch ? 'conflict-highlight' : '';
                const h8Title = isH8Mismatch ? `8時人数不一致（現在: ${h8Val}名 / 基準: ${needH8}名）` : `8時: ${h8Val}名`;
                lifeFootHtml += `<td class="${thickCls} ${h8Cls} border-thick-bottom col-day-fixed" data-d="${d}" data-footer-stat="h8" title="${h8Title}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${h8Val}</td>`;
            }
            lifeFootHtml += `<td class="border-thick-bottom" style="font-weight:700; color:#334155;">${h8Sum}</td><td class="border-thick-bottom" colspan="7" style="color:#94a3b8;">-</td></tr>`;

            tfoot.innerHTML = lifeFootHtml;
            // ★ 生活期は基本勤務表がそのまま完成版のため、checkTableHead / checkTableBody / checkTableFoot 全てに即時完全同期描画！
            const checkThead = document.getElementById('checkTableHead');
            const checkTbody = document.getElementById('checkTableBody');
            const checkTfoot = document.getElementById('checkTableFoot');
            if (checkThead) checkThead.innerHTML = headHtml;
            if (checkTbody) checkTbody.innerHTML = bodyHtml;
            if (checkTfoot) checkTfoot.innerHTML = lifeFootHtml;
            attachOutputTableEvents();
            return;
        }

        // 1行目: 出勤人数合計（総出勤者数）
        let footHtml = `
            <tr style="background:#f8fafc; font-weight:bold;">
                <th class="sticky-col-1" colspan="2">出勤人数合計</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = getDayBorderClass(d);
            footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; font-weight:800; color:#1e293b; font-size:0.95rem;">${dStat.totalWork}</td>`;
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

        // ★ セクション別出勤人数リストの定義（PT A/2, OT A/2, PT B/3, OT B/3, ST, ﾊｰﾌﾏﾝ出勤）
        const isSouthSec = (currentFloor === '南' || appConfig.deptId === 'south');
        const secList = [
            { name: isSouthSec ? 'PT 2' : 'PT A', label: isSouthSec ? 'PT 2 実数' : 'PT A 実数', cls: 'foot-sec-pt-a', color: '#ea580c' },
            { name: isSouthSec ? 'OT 2' : 'OT A', label: isSouthSec ? 'OT 2 実数' : 'OT A 実数', cls: 'foot-sec-ot-a', color: '#ea580c' },
            { name: isSouthSec ? 'PT 3' : 'PT B', label: isSouthSec ? 'PT 3 実数' : 'PT B 実数', cls: 'foot-sec-pt-b', color: '#1d4ed8' },
            { name: isSouthSec ? 'OT 3' : 'OT B', label: isSouthSec ? 'OT 3 実数' : 'OT B 実数', cls: 'foot-sec-ot-b', color: '#1d4ed8' },
            { name: 'ST',   label: 'ST 実数',   cls: 'foot-sec-st',   color: '#ec4899' }
        ];

        // ★ 添付4準拠: STの下に「ﾊｰﾌﾏﾝ出勤」を作成し、生活期のハ1のトグルONのスタッフが出勤の時には実数0.5を入れる
        if (!isST && !isLife) {
            secList.push({ name: 'HA', label: 'ﾊｰﾌﾏﾝ実数', cls: 'foot-sec-ha', color: '#059669' });
        }

        const linkedLifeWorkArr = (!isST && !isLife) ? getLinkedLifeDailyWork() : null;
        const linkedStWorkArr = getLinkedSTDailyWork();

        // 各セクションの各日出勤実数を算出
        const secDailyMap = {};
        secList.forEach(sec => {
            secDailyMap[sec.name] = new Array(NUM_DAYS).fill(0);
            for (let d = 0; d < NUM_DAYS; d++) {
                const dStat = stats.daily[d];
                let secVal = 0;
                if (sec.name === 'ST') {
                    if (dStat && dStat.sectionWork && dStat.sectionWork['ST'] !== undefined && dStat.sectionWork['ST'] > 0) {
                        secVal = dStat.sectionWork['ST'];
                    } else if (linkedStWorkArr && linkedStWorkArr[d] !== undefined) {
                        secVal = linkedStWorkArr[d];
                    }
                } else if (sec.name === 'HA') {
                    secVal = (linkedLifeWorkArr && linkedLifeWorkArr[d] !== undefined) ? linkedLifeWorkArr[d] : 0;
                } else {
                    secVal = (dStat && dStat.sectionWork && dStat.sectionWork[sec.name] !== undefined)
                        ? dStat.sectionWork[sec.name]
                        : 0;
                    // 南病棟のエイリアス互換 (PT 2 <-> PT A, etc.)
                    if (secVal === 0 && dStat && dStat.sectionWork) {
                        if (sec.name === 'PT 2' && dStat.sectionWork['PT A']) secVal = dStat.sectionWork['PT A'];
                        else if (sec.name === 'PT 3' && dStat.sectionWork['PT B']) secVal = dStat.sectionWork['PT B'];
                        else if (sec.name === 'OT 2' && dStat.sectionWork['OT A']) secVal = dStat.sectionWork['OT A'];
                        else if (sec.name === 'OT 3' && dStat.sectionWork['OT B']) secVal = dStat.sectionWork['OT B'];
                    }
                }
                secDailyMap[sec.name][d] = secVal;
            }
        });

        // 2行目: 実数合計（PT・OT・ST・ハーフマンの実数合計から増員加減枠をオフセットした値）
        // ★ 添付3対応: 各セクションの実数を足した合計と「実数合計」が100%完全に一致するように計算
        const calculatedDailyReal = new Array(NUM_DAYS).fill(0);
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const offset = (dayOffsets && dayOffsets[d] !== undefined) ? dayOffsets[d] : ((dStat && dStat.offset) ? dStat.offset : 0);
            let secSum = 0;
            secList.forEach(sec => {
                secSum += secDailyMap[sec.name][d];
            });
            const realAfterOffset = (offset > 0) ? Math.max(0, secSum - offset) : secSum;
            calculatedDailyReal[d] = Number(realAfterOffset.toFixed(2));
        }
        const totalRealSum = calculatedDailyReal.reduce((sum, v) => sum + v, 0);

        footHtml += `
            <tr style="background:#f8fafc; font-weight:bold;">
                <th class="sticky-col-1" colspan="2" style="color:#1e293b;" title="各セクション（PT・OT・ST・ハーフマン）の出勤実数合計（増員枠オフセット反映）">実数合計</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const thickCls = getDayBorderClass(d);
            const real = calculatedDailyReal[d];
            footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; vertical-align:middle; font-weight:800; color:#1e293b; font-size:0.95rem;">${real}</td>`;
        }
        footHtml += `<td style="font-weight:700; color:#1e293b;">${Number(totalRealSum.toFixed(1))}</td><td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // ★ セクション別出勤人数（PT A/2, OT A/2, PT B/3, OT B/3, ST, ﾊｰﾌﾏﾝ出勤）の描画
        secList.forEach(sec => {
            footHtml += `
                <tr class="${sec.cls}" style="font-weight:700; font-size:0.82rem; background:transparent;">
                    <th class="sticky-col-1" colspan="2" style="color:${sec.color};">${sec.label}</th>
            `;
            let secTotalSum = 0;
            for (let d = 0; d < NUM_DAYS; d++) {
                const secVal = secDailyMap[sec.name][d];
                secTotalSum += secVal;
                const thickCls = getDayBorderClass(d);
                const displayVal = secVal > 0 ? (secVal % 1 === 0 ? secVal : secVal.toFixed(1)) : (sec.name === 'ST' || sec.name === 'HA' ? '0' : '-');
                footHtml += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; color:${sec.color}; font-weight:800;">${displayVal}</td>`;
            }
            const displayTotal = secTotalSum % 1 === 0 ? secTotalSum : secTotalSum.toFixed(1);
            footHtml += `<td style="font-weight:800; color:${sec.color};">${displayTotal}</td><td colspan="8" style="color:#94a3b8;">-</td></tr>`;
        });

        // 早番
        footHtml += `
            <tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#334155;">早番</th>
        `;
        const linkedStEarlyArr = (!isST && !isLife) ? getLinkedSTDailyEarly() : null;
        const linkedStLateArr = (!isST && !isLife) ? getLinkedSTDailyLate() : null;
        const linkedStEveArr = (!isST && !isLife) ? getLinkedSTDailyEve() : null;
        // currentGrid は関数冒頭で宣言済み

        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = getDayBorderClass(d);
            let earlyVal = dStat.early;
            if (!isST && !isLife) {
                let poEarly = 0;
                if (currentGrid && Array.isArray(currentGrid)) {
                    currentGrid.forEach((row, sIdx) => {
                        if (staffList[sIdx] && staffList[sIdx].isUnused) return;
                        const c = row[d];
                        const sym = (c && typeof c === 'object') ? (c.symbol || c) : c;
                        if (sym === '早') poEarly++;
                    });
                } else {
                    poEarly = dStat.early;
                }
                // ST早番人数を linkedStEarlyArr および linkedStStaffData から合算！
                let stEarlyCount = 0;
                if (linkedStEarlyArr && linkedStEarlyArr[d] !== undefined) {
                    stEarlyCount = linkedStEarlyArr[d];
                } else if (linkedStStaffData && linkedStStaffData.staffList && linkedStStaffData.grid) {
                    linkedStStaffData.staffList.forEach((st, sIdx) => {
                        if (st.isUnused) return;
                        const row = linkedStStaffData.grid[sIdx] || [];
                        const c = row[d] || { symbol: '' };
                        const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                        const wish = (st.days && st.days[d]) ? st.days[d] : '';
                        if (sym === '早' || wish === '早') stEarlyCount++;
                    });
                }
                earlyVal = poEarly + stEarlyCount;
            }
            
            const needEarly = isSouth ? 2 : (isST || isLife ? null : 3);
            const isEarlyMismatch = (needEarly !== null && earlyVal !== needEarly);
            const earlyCls = isEarlyMismatch ? 'conflict-highlight' : '';
            const earlyTitle = isEarlyMismatch ? `早番人数不一致（現在: ${earlyVal}名 / 基準: ${needEarly}名）` : `早番: ${earlyVal}名`;
            footHtml += `<td class="${thickCls} ${earlyCls} col-day-fixed" data-d="${d}" data-footer-stat="early" title="${earlyTitle}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${earlyVal}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // 遅番
        footHtml += `
            <tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#334155;">遅番</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = getDayBorderClass(d);
            let lateVal = dStat.late;
            if (!isST && !isLife) {
                let poLate = 0;
                if (currentGrid && Array.isArray(currentGrid)) {
                    currentGrid.forEach((row, sIdx) => {
                        if (staffList[sIdx] && staffList[sIdx].isUnused) return;
                        const c = row[d];
                        const sym = (c && typeof c === 'object') ? (c.symbol || c) : c;
                        if (sym === '遅') poLate++;
                    });
                } else {
                    poLate = dStat.late;
                }
                // ST遅番人数を合算
                let stLateCount = 0;
                if (linkedStLateArr && linkedStLateArr[d] !== undefined) {
                    stLateCount = linkedStLateArr[d];
                } else if (linkedStStaffData && linkedStStaffData.staffList && linkedStStaffData.grid) {
                    linkedStStaffData.staffList.forEach((st, sIdx) => {
                        if (st.isUnused) return;
                        const row = linkedStStaffData.grid[sIdx] || [];
                        const c = row[d] || { symbol: '' };
                        const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                        const wish = (st.days && st.days[d]) ? st.days[d] : '';
                        if (sym === '遅' || wish === '遅') stLateCount++;
                    });
                }
                lateVal = poLate + stLateCount;
            }
            
            const needLate = isSouth ? 2 : (isST || isLife ? null : 1);
            const isLateMismatch = (needLate !== null && lateVal !== needLate);
            const lateCls = isLateMismatch ? 'conflict-highlight' : '';
            const lateTitle = isLateMismatch ? `遅番人数不一致（現在: ${lateVal}名 / 基準: ${needLate}名）` : `遅番: ${lateVal}名`;
            footHtml += `<td class="${thickCls} ${lateCls} col-day-fixed" data-d="${d}" data-footer-stat="late" title="${lateTitle}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${lateVal}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // E (イブニング)
        footHtml += `
            <tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1" colspan="2" style="color:#334155;">E</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = getDayBorderClass(d);
            let eveVal = dStat.eve;
            if (!isST && !isLife) {
                let poEve = 0;
                if (currentGrid && Array.isArray(currentGrid)) {
                    currentGrid.forEach((row, sIdx) => {
                        if (staffList[sIdx] && staffList[sIdx].isUnused) return;
                        const c = row[d];
                        const sym = (c && typeof c === 'object') ? (c.symbol || c) : c;
                        if (sym === 'E') poEve++;
                    });
                } else {
                    poEve = dStat.eve;
                }
                // ST E番人数を合算
                let stEveCount = 0;
                if (linkedStEveArr && linkedStEveArr[d] !== undefined) {
                    stEveCount = linkedStEveArr[d];
                } else if (linkedStStaffData && linkedStStaffData.staffList && linkedStStaffData.grid) {
                    linkedStStaffData.staffList.forEach((st, sIdx) => {
                        if (st.isUnused) return;
                        const row = linkedStStaffData.grid[sIdx] || [];
                        const c = row[d] || { symbol: '' };
                        const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                        const wish = (st.days && st.days[d]) ? st.days[d] : '';
                        if (sym === 'E' || sym === 'イ' || sym === 'イブ' || wish === 'E' || wish === 'イ' || wish === 'イブ') stEveCount++;
                    });
                }
                eveVal = poEve + stEveCount;
            }
            
            const needEve = isSouth ? 2 : (isST || isLife ? null : 2);
            const isEveMismatch = (needEve !== null && eveVal !== needEve);
            const eveCls = isEveMismatch ? 'conflict-highlight' : '';
            const eveTitle = isEveMismatch ? `イブニング人数不一致（現在: ${eveVal}名 / 基準: ${needEve}名）` : `イブニング: ${eveVal}名`;
            footHtml += `<td class="${thickCls} ${eveCls} col-day-fixed" data-d="${d}" data-footer-stat="eve" title="${eveTitle}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${eveVal}</td>`;
        }
        footHtml += `<td colspan="8" style="color:#94a3b8;">-</td></tr>`;

        // 8時勤務
        footHtml += `
            <tr style="background:transparent; font-weight:600; font-size:0.85rem;">
                <th class="sticky-col-1 border-thick-bottom" colspan="2" style="color:#334155;">8時</th>
        `;
        for (let d = 0; d < NUM_DAYS; d++) {
            const dStat = stats.daily[d];
            const thickCls = getDayBorderClass(d);
            
            const h8Val = dStat.h8;
            const needH8 = (!isST) ? 1 : null;
            const isH8Mismatch = (needH8 !== null && h8Val !== needH8);
            const h8Cls = isH8Mismatch ? 'conflict-highlight' : '';
            const h8Title = isH8Mismatch ? `8時人数不一致（現在: ${h8Val}名 / 基準: ${needH8}名）` : `8時: ${h8Val}名`;
            footHtml += `<td class="${thickCls} ${h8Cls} border-thick-bottom col-day-fixed" data-d="${d}" data-footer-stat="h8" title="${h8Title}" style="width:52px; min-width:52px; max-width:52px; color:#334155; font-weight:700;">${h8Val}</td>`;
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

        if (isMaster) {
            renderMasterIntegrationView();
        }

        attachOutputTableEvents();
    }

    // =========================================================================
    // ★ マスターテーブル専用: 全フロア統合ビュー描画 (renderMasterIntegrationView)
    // 添付1準拠: 1階(ブルー), 2階(オレンジ), 3階(みどり), 南階(ラベンダー)
    // ±補正, 出勤人数合計, 実数合計, 早, 遅, E, 8時, 「！表示する」トグル
    // 展開順: PTA → PTB → OTA → OTB → ST
    // =========================================================================
    
    // =========================================================================
    // ★ ユーザー指示: ブレ最小化エンジン（マスター／フロア／ST／生活期）
    // =========================================================================

    // 公休間隔6日以内チェック用ヘルパー（労基法・ハード制約！リフや有休は公休に含めない）
    function checkPureOffIntervalForStaff(grid, s, numDays, staffObj) {
        let streak = 0;
        if (staffObj && staffObj.prevDays) {
            for (let p = staffObj.prevDays.length - 1; p >= 0; p--) {
                if (!isPurePublicOffSymbol(staffObj.prevDays[p])) streak++;
                else break;
            }
        }
        for (let d = 0; d < numDays; d++) {
            const c = grid[s] ? grid[s][d] : null;
            const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
            if (!isPurePublicOffSymbol(sym)) {
                streak++;
                if (streak > 6) return false;
            } else {
                streak = 0;
            }
        }
        return true;
    }

    // ★ ブレ最小化スワップ時の厳格制約検証ヘルパー（連勤・週休2日・公休8日・5連勤直後2連休・特殊翌日休の100%遵守を物理保証）
    function verifyCandidateStaffSchedule(grid, s, numDays, staffObj, term, targetHolidays = 8.0) {
        if (!staffObj || staffObj.isUnused) return false;
        if (staffObj.isSectionChief) return false;

        // 1. 公休日数が targetHolidays と完全一致しているか（公休7日や9日への変動を物理遮断！）
        let offCount = 0;
        for (let d = 0; d < numDays; d++) {
            const c = grid[s] ? grid[s][d] : null;
            const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
            if (sym === SYMBOLS.OFF) offCount += 1.0;
            else if (isHalfDuty(sym)) offCount += 0.5;
        }
        if (Math.abs(offCount - targetHolidays) > 0.01) return false;

        // 2. 公休間隔6日以内チェック（労基法）
        if (!checkPureOffIntervalForStaff(grid, s, numDays, staffObj)) return false;

        // 3. 連勤シーケンスの構築（prevDays 含む）
        const sequence = [];
        const pDays = staffObj.prevDays || [];
        for (let p = 0; p < pDays.length; p++) sequence.push(pDays[p] || '');
        for (let d = 0; d < numDays; d++) {
            const c = grid[s] ? grid[s][d] : null;
            const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
            sequence.push(sym);
        }

        // 4. 連勤制限（原則最大5日、allow6Consecのみ6日）
        const maxConsec = staffObj.allow6Consec ? 6 : 5;
        let consec = 0;
        for (let i = 0; i < sequence.length; i++) {
            const sym = sequence[i];
            if (isWorkSymbol(sym)) {
                consec++;
                if (consec > maxConsec) return false;
            } else {
                consec = 0;
            }
        }

        // 5. 5連勤後の2連休ルール（allow6Consec以外）
        if (!staffObj.allow6Consec) {
            let workStreak = 0;
            for (let i = 0; i < sequence.length; i++) {
                if (isWorkSymbol(sequence[i])) {
                    workStreak++;
                    if (workStreak === 5) {
                        for (let offOffset = 1; offOffset <= 2; offOffset++) {
                            const checkIdx = i + offOffset;
                            if (checkIdx < sequence.length) {
                                const sym = sequence[checkIdx];
                                if (sym !== '' && !isHolidaySymbol(sym)) return false;
                            }
                        }
                    }
                } else {
                    workStreak = 0;
                }
            }
        }

        // 6. 週（日〜土）出勤制限（週出勤最大5日以内、週休2日以上保証）
        const weekSpans = (term && term.weekSpans && term.weekSpans.length > 0)
            ? term.weekSpans
            : (typeof getSunToSatWeekSpans === 'function' ? getSunToSatWeekSpans(term ? term.dates : null, numDays) : []);
        for (const wSpan of weekSpans) {
            let weekWork = 0;
            for (const wd of wSpan) {
                const c = grid[s] ? grid[s][wd] : null;
                const sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                if (isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
                    weekWork++;
                }
            }
            const allowedInWeek = staffObj.allow6Consec ? 6 : 5;
            if (weekWork > allowedInWeek) return false;
        }

        // 7. 特殊勤務翌日休の保護
        for (let d = 0; d < numDays - 1; d++) {
            const cCur = grid[s] ? grid[s][d] : null;
            const symCur = (cCur && typeof cCur === 'object') ? (cCur.symbol || '') : (cCur || '');
            if (isRestrictedSpecial(symCur)) {
                const cNext = grid[s] ? grid[s][d + 1] : null;
                const symNext = (cNext && typeof cNext === 'object') ? (cNext.symbol || '') : (cNext || '');
                if (!isHolidaySymbol(symNext)) return false;
            }
        }

        return true;
    }

    // -------------------------------------------------------------------------
    // 1. マスターテーブル: 平日ブレ最小化 / 休日ブレ最小化
    // -------------------------------------------------------------------------
    function executeMasterBalance(mode) {
        // mode: 'weekday' (平日ブレ最小化) | 'weekend' (休日ブレ最小化)
        const isWeekendMode = (mode === 'weekend');
        const modeTitle = isWeekendMode ? '休日ブレ最小化' : '平日ブレ最小化';

        const termSel = document.getElementById('masterTermSelect') || document.getElementById('termSelect');
        const curStartDate = (termSel && termSel.value) ? termSel.value : (document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01');
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        const floorConfigs = [
            { id: '1f', label: '1階' },
            { id: '2f', label: '2階' },
            { id: '3f', label: '3階' },
            { id: 'south', label: '南' }
        ];

        const floors = [];
        floorConfigs.forEach(fc => {
            const key = `shift_schedule_${fc.id}_term_${curStartDate}`;
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    const grid = parsed.outputGrid || parsed.grid;
                    const sList = parsed.staffList || [];
                    if (grid && grid.length > 0 && sList.length > 0) {
                        floors.push({ id: fc.id, label: fc.label, grid: JSON.parse(JSON.stringify(grid)), staffList: sList, rawData: parsed });
                    }
                } catch (e) {
                    console.error(`Error loading floor ${fc.id}:`, e);
                }
            }
        });

        if (floors.length === 0) {
            showToast('⚠️ 各フロアの勤務表データが見つかりません。先に各病棟で「勤務表を自動生成する」を実行してください。');
            return;
        }

        // 対象日の抽出
        const targetDays = [];
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const isWknd = di ? (di.wIdx === 5 || di.wIdx === 6 || di.isHoliday) : ((d % 7 === 5) || (d % 7 === 6));
            if (isWeekendMode && isWknd) targetDays.push(d);
            else if (!isWeekendMode && !isWknd) targetDays.push(d);
        }

        if (targetDays.length < 2) {
            showToast('⚠️ 平準化対象の日数が不足しています。');
            return;
        }

        // 全館出勤実数合計を計算
        function getMasterDailyReal(d) {
            let total = 0;
            floors.forEach(fl => {
                fl.staffList.forEach((st, s) => {
                    if (st.isUnused) return;
                    const cell = fl.grid[s] ? fl.grid[s][d] : null;
                    const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                    if (isWorkSymbol(sym)) {
                        let w = 1.0;
                        if (st.isZeroCount || sym === '出張') w = 0.0;
                        else if (st.isHalf || sym.includes('/')) w = 0.5;
                        total += w;
                    }
                });
            });
            return total;
        }

        // 各フロア単体の出勤実数
        function getFloorDailyReal(fl, d) {
            let r = 0;
            fl.staffList.forEach((st, s) => {
                if (st.isUnused) return;
                const cell = fl.grid[s] ? fl.grid[s][d] : null;
                const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                if (isWorkSymbol(sym)) {
                    let w = 1.0;
                    if (st.isZeroCount || sym === '出張') w = 0.0;
                    else if (st.isHalf || sym.includes('/')) w = 0.5;
                    r += w;
                }
            });
            return r;
        }

        // スワップ安全性検証
        function canSwapStaff(fl, s, workD, offD) {
            const st = fl.staffList[s];
            if (st.isUnused || st.isSectionChief) return false;

            const cellWork = fl.grid[s][workD];
            const cellOff = fl.grid[s][offD];
            const symWork = (cellWork && typeof cellWork === 'object') ? cellWork.symbol : (cellWork || '');
            const symOff = (cellOff && typeof cellOff === 'object') ? cellOff.symbol : (cellOff || '');

            // 出勤記号（○ または STの早番）と公休（休）のスワップ
            const isValidWork = (symWork === SYMBOLS.WORK || symWork === '〇' || (isST && symWork === '早'));
            if (!isValidWork || symOff !== SYMBOLS.OFF) return false;
            if (cellWork.isFixed || cellOff.isFixed) return false;

            // 特殊勤務翌日休の保護
            if (workD > 0) {
                const prevW = fl.grid[s][workD - 1] ? (fl.grid[s][workD - 1].symbol || fl.grid[s][workD - 1]) : '';
                if (isRestrictedSpecial(prevW)) return false;
            }
            if (offD > 0) {
                const prevO = fl.grid[s][offD - 1] ? (fl.grid[s][offD - 1].symbol || fl.grid[s][offD - 1]) : '';
                if (isRestrictedSpecial(prevO)) return false;
            }

            // スケ可保護
            if (st.canSched) {
                let schedCountWork = 0;
                fl.staffList.forEach((oS, oIdx) => {
                    if (oIdx !== s && !oS.isUnused && oS.canSched) {
                        const oSym = fl.grid[oIdx][workD] ? (fl.grid[oIdx][workD].symbol || fl.grid[oIdx][workD]) : '';
                        if (isWorkSymbol(oSym)) schedCountWork++;
                    }
                });
                if (schedCountWork < 2) return false;
            }

            // 仮想スワップして全ハード制約（連勤・週休2日・公休8日・5連勤直後2連休・特殊翌日休）を厳格検証
            fl.grid[s][workD] = { symbol: SYMBOLS.OFF, isFixed: false };
            fl.grid[s][offD] = { symbol: symWork, isFixed: false };

            const stdHolidayVal = 8.0;
            const isValid = verifyCandidateStaffSchedule(fl.grid, s, numDays, st, term, stdHolidayVal);

            // 元に戻す
            fl.grid[s][workD] = cellWork;
            fl.grid[s][offD] = cellOff;

            return isValid;
        }

        let totalSwaps = 0;
        const maxIter = 50;

        for (let iter = 0; iter < maxIter; iter++) {
            const loads = targetDays.map(d => ({ day: d, load: getMasterDailyReal(d) }));
            loads.sort((a, b) => b.load - a.load);

            const maxItem = loads[0];
            const minItem = loads[loads.length - 1];

            if (maxItem.load - minItem.load <= 1.0) break;

            let swapped = false;
            for (let h = 0; h < Math.min(4, loads.length); h++) {
                const maxD = loads[h].day;
                for (let l = loads.length - 1; l >= Math.max(0, loads.length - 4); l--) {
                    const minD = loads[l].day;
                    if (loads[h].load - loads[l].load <= 1.0) continue;

                    for (const fl of floors) {
                        const flMax = getFloorDailyReal(fl, maxD);
                        const flMin = getFloorDailyReal(fl, minD);
                        if (flMax < flMin) continue; // フロア単体のブレ悪化防止

                        for (let s = 0; s < fl.staffList.length; s++) {
                            if (canSwapStaff(fl, s, maxD, minD)) {
                                fl.grid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                                fl.grid[s][minD] = { symbol: SYMBOLS.WORK, isFixed: false };
                                totalSwaps++;
                                swapped = true;
                                break;
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }

        // 変更を localStorage に保存
        floors.forEach(fl => {
            const key = `shift_schedule_${fl.id}_term_${curStartDate}`;
            const toSave = Object.assign({}, fl.rawData, {
                outputGrid: fl.grid,
                updatedAt: new Date().toISOString()
            });
            try {
                localStorage.setItem(key, JSON.stringify(toSave));
            } catch (e) {
                console.error(`Error saving floor ${fl.id}:`, e);
            }
        });

        if (typeof renderMasterIntegrationView === 'function') {
            renderMasterIntegrationView();
        }
        if (typeof renderStatsDashboard === 'function' && lastSolveResult && lastSolveResult.stats) {
            renderStatsDashboard(lastSolveResult.stats);
        }

        if (totalSwaps > 0) {
            showToast(`⚡ 全フロアの${modeTitle}を実施しました（計 ${totalSwaps} 箇所の公休を安全微調整）`);
        } else {
            showToast(`✅ すでに全フロアの${modeTitle}は最小ブレ（均等状態）に保たれています`);
        }
    }

    function handleMasterBalanceWeekday() {
        executeMasterBalance('weekday');
    }

    function handleMasterBalanceWeekend() {
        executeMasterBalance('weekend');
    }

    // -------------------------------------------------------------------------
    // 2. 単体フロア（1階〜南、ST）: 平日ブレ最小化 / 休日ブレ最小化 / STブレ最小化
    // -------------------------------------------------------------------------
    function executeSingleFloorBalance(mode) {
        // mode: 'weekday' | 'weekend' | 'all' (ST用)
        const isWeekday = (mode === 'weekday');
        const isWeekend = (mode === 'weekend');
        const isAll = (mode === 'all');
        const modeTitle = isAll ? 'ブレ最小化' : (isWeekday ? '平日ブレ最小化' : '休日ブレ最小化');

        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        // ★ ユーザー指示: 何回でも押して試せるよう、targetGrid を画面・メモリ・ストレージから確実に復元
        let targetGrid = null;
        if (lastSolveResult && lastSolveResult.grid && lastSolveResult.grid.length > 0) {
            targetGrid = lastSolveResult.grid;
        } else if (lastScheduler && lastScheduler.grid && lastScheduler.grid.length > 0) {
            targetGrid = lastScheduler.grid;
        } else if (typeof extractCurrentOutputGrid === 'function') {
            targetGrid = extractCurrentOutputGrid();
        }
        if (!targetGrid || targetGrid.length === 0) {
            const key = `shift_schedule_${deptPrefix}term_${curStartDate}`;
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    targetGrid = parsed.outputGrid || parsed.grid;
                } catch(e) {}
            }
        }

        if (!targetGrid || targetGrid.length === 0) {
            showToast('⚠️ 先に「勤務表を自動生成する」を実行してください。');
            return;
        }

        const targetDays = [];
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const isWknd = di ? (di.wIdx === 5 || di.wIdx === 6 || di.isHoliday) : ((d % 7 === 5) || (d % 7 === 6));
            if (isAll) targetDays.push(d);
            else if (isWeekend && isWknd) targetDays.push(d);
            else if (isWeekday && !isWknd) targetDays.push(d);
        }

        if (targetDays.length < 2) {
            showToast('⚠️ 平準化対象の日数が不足しています。');
            return;
        }

        // スタッフの所属チーム（A or B / 南2 or 南3）判定
        const getStaffTeam = (s) => {
            if (isSouth) {
                const st = staffList[s];
                if (!st) return (s % 2 === 0) ? 'A' : 'B';
                const sec = st.section || '';
                if (sec.includes('2') || sec === 'PT A' || sec === 'OT A') return 'A'; // 南2
                if (sec.includes('3') || sec === 'PT B' || sec === 'OT B') return 'B'; // 南3
                return (s % 2 === 0) ? 'A' : 'B';
            }
            const sec = staffList[s]?.section || '';
            if (sec === 'PT A' || sec === 'OT A' || sec.includes('A')) return 'A';
            if (sec === 'PT B' || sec === 'OT B' || sec.includes('B')) return 'B';
            return '';
        };

        function getDailyReal(d) {
            let r = 0;
            staffList.forEach((st, s) => {
                if (st.isUnused) return;
                const cell = targetGrid[s] ? targetGrid[s][d] : null;
                const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                if (isWorkSymbol(sym)) {
                    let w = 1.0;
                    if (st.isZeroCount || sym === '出張') w = 0.0;
                    else if (st.isHalf || sym.includes('/')) w = 0.5;
                    r += w;
                }
            });
            return r;
        }

        function getDailyTeamLoads(d) {
            let tA = 0, tB = 0;
            staffList.forEach((st, s) => {
                if (st.isUnused) return;
                const cell = targetGrid[s] ? targetGrid[s][d] : null;
                const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                if (isWorkSymbol(sym)) {
                    const tm = getStaffTeam(s);
                    const w = (st.isHalf || sym.includes('/')) ? 0.5 : 1.0;
                    if (tm === 'A') tA += w;
                    else if (tm === 'B') tB += w;
                }
            });
            return { tA, tB, diff: tA - tB, absDiff: Math.abs(tA - tB) };
        }

        function canSwapStaff(s, workD, offD) {
            const st = staffList[s];
            if (st.isUnused || st.isSectionChief) return false;

            const cellWork = targetGrid[s][workD];
            const cellOff = targetGrid[s][offD];
            const symWork = (cellWork && typeof cellWork === 'object') ? cellWork.symbol : (cellWork || '');
            const symOff = (cellOff && typeof cellOff === 'object') ? cellOff.symbol : (cellOff || '');

            // 出勤記号（○ または STの早番）と公休（休）のスワップ
            const isValidWork = (symWork === SYMBOLS.WORK || symWork === '〇' || (isST && symWork === '早'));
            if (!isValidWork || symOff !== SYMBOLS.OFF) return false;
            if (cellWork.isFixed || cellOff.isFixed) return false;

            // 特殊勤務翌日休の保護
            if (workD > 0) {
                const prevW = targetGrid[s][workD - 1] ? (targetGrid[s][workD - 1].symbol || targetGrid[s][workD - 1]) : '';
                if (isRestrictedSpecial(prevW)) return false;
            }
            if (offD > 0) {
                const prevO = targetGrid[s][offD - 1] ? (targetGrid[s][offD - 1].symbol || targetGrid[s][offD - 1]) : '';
                if (isRestrictedSpecial(prevO)) return false;
            }

            // スケ可保護
            if (st.canSched) {
                let schedCountWork = 0;
                staffList.forEach((oS, oIdx) => {
                    if (oIdx !== s && !oS.isUnused && oS.canSched) {
                        const oSym = targetGrid[oIdx][workD] ? (targetGrid[oIdx][workD].symbol || targetGrid[oIdx][workD]) : '';
                        if (isWorkSymbol(oSym)) schedCountWork++;
                    }
                });
                if (schedCountWork < 2) return false;
            }

            // 仮想スワップして全ハード制約（連勤・週休2日・公休8日・5連勤直後2連休・特殊翌日休）を厳格検証
            targetGrid[s][workD] = { symbol: SYMBOLS.OFF, isFixed: false };
            targetGrid[s][offD] = { symbol: symWork, isFixed: false };

            const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
            const isValid = verifyCandidateStaffSchedule(targetGrid, s, numDays, st, term, stdHolidayVal);

            // 元に戻す
            targetGrid[s][workD] = cellWork;
            targetGrid[s][offD] = cellOff;

            return isValid;
        }

        let totalSwaps = 0;

        // ★ ユーザー指示: 何回でも試行できるよう、スタッフ探索順を毎回適度にシャッフルして多様な安全パターンを探索
        const staffIndices = staffList.map((_, i) => i);
        staffIndices.sort(() => Math.random() - 0.5);

        // =====================================================================
        // フェーズ1: 全体出勤実数のブレ最小化（高負荷日 ⇄ 低負荷日）
        // =====================================================================
        const maxIterOverall = 20;
        for (let iter = 0; iter < maxIterOverall; iter++) {
            const loads = targetDays.map(d => ({ day: d, load: getDailyReal(d) }));
            loads.sort((a, b) => b.load - a.load);

            const maxItem = loads[0];
            const minItem = loads[loads.length - 1];

            if (maxItem.load - minItem.load <= 0.6) break;

            let swapped = false;
            for (let h = 0; h < Math.min(3, loads.length); h++) {
                const maxD = loads[h].day;
                for (let l = loads.length - 1; l >= Math.max(0, loads.length - 3); l--) {
                    const minD = loads[l].day;
                    if (loads[h].load - loads[l].load <= 0.6) continue;

                    for (const s of staffIndices) {
                        if (canSwapStaff(s, maxD, minD)) {
                            const origSym = (targetGrid[s][maxD] && targetGrid[s][maxD].symbol) || SYMBOLS.WORK;
                            targetGrid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                            targetGrid[s][minD] = { symbol: origSym, isFixed: false };
                            totalSwaps++;
                            swapped = true;
                            break;
                        }
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }

        // =====================================================================
        // フェーズ2: Aチーム vs Bチーム（南病棟は南2階 vs 南3階）の出勤人数平準化
        // （全体実数を1ミリも変えずに、AとBの差が2名以上の日の偏りを均等化！）
        // =====================================================================
        const maxIterTeam = 25;
        for (let iter = 0; iter < maxIterTeam; iter++) {
            const teamLoads = targetDays.map(d => {
                const tl = getDailyTeamLoads(d);
                return { day: d, ...tl };
            });

            // Aチームが過剰な日とBチームが過剰な日を抽出
            teamLoads.sort((a, b) => b.diff - a.diff);
            const mostA = teamLoads[0];
            const mostB = teamLoads[teamLoads.length - 1];

            if (mostA.absDiff <= 1.0 && mostB.absDiff <= 1.0) break; // 全日1名差以内で完璧達成！

            let teamSwapped = false;

            // 1. 2名同時クロススワップ（全体実数維持: d1でA減・B増、d2でA増・B減）
            for (let h = 0; h < Math.min(3, teamLoads.length); h++) {
                const d1 = teamLoads[h].day;
                if (teamLoads[h].diff <= 1.0) continue; // Aが多すぎない日はスキップ

                for (let l = teamLoads.length - 1; l >= Math.max(0, teamLoads.length - 3); l--) {
                    const d2 = teamLoads[l].day;
                    if (teamLoads[l].diff >= -1.0) continue; // Bが多すぎない日はスキップ
                    if (teamLoads[h].diff - teamLoads[l].diff <= 1.5) continue;

                    for (const sA of staffIndices) {
                        if (getStaffTeam(sA) !== 'A') continue;
                        if (!canSwapStaff(sA, d1, d2)) continue;

                        for (const sB of staffIndices) {
                            if (getStaffTeam(sB) !== 'B') continue;
                            if (!canSwapStaff(sB, d2, d1)) continue;

                            // 2名同時にスワップ適用
                            const origSymA = (targetGrid[sA][d1] && targetGrid[sA][d1].symbol) || SYMBOLS.WORK;
                            const origSymB = (targetGrid[sB][d2] && targetGrid[sB][d2].symbol) || SYMBOLS.WORK;
                            targetGrid[sA][d1] = { symbol: SYMBOLS.OFF, isFixed: false };
                            targetGrid[sA][d2] = { symbol: origSymA, isFixed: false };
                            targetGrid[sB][d2] = { symbol: SYMBOLS.OFF, isFixed: false };
                            targetGrid[sB][d1] = { symbol: origSymB, isFixed: false };

                            totalSwaps += 2;
                            teamSwapped = true;
                            break;
                        }
                        if (teamSwapped) break;
                    }
                    if (teamSwapped) break;
                }
                if (teamSwapped) break;
            }

            // 2. 単独スタッフの同週内スワップ（全体実数のブレ許容内での微調整）
            if (!teamSwapped) {
                for (const tm of ['A', 'B']) {
                    const highDays = teamLoads.filter(x => tm === 'A' ? (x.diff >= 2.0) : (x.diff <= -2.0)).map(x => x.day);
                    const lowDays = teamLoads.filter(x => tm === 'A' ? (x.diff <= -0.5) : (x.diff >= 0.5)).map(x => x.day);

                    for (const dH of highDays) {
                        for (const dL of lowDays) {
                            for (const s of staffIndices) {
                                if (getStaffTeam(s) !== tm) continue;
                                if (canSwapStaff(s, dH, dL)) {
                                    // スワップ後の全体実数がブレ範囲内か
                                    const rH = getDailyReal(dH);
                                    const rL = getDailyReal(dL);
                                    if (rH - 1.0 < rL) { // 全体バランスを崩さない
                                        const origSym = (targetGrid[s][dH] && targetGrid[s][dH].symbol) || SYMBOLS.WORK;
                                        targetGrid[s][dH] = { symbol: SYMBOLS.OFF, isFixed: false };
                                        targetGrid[s][dL] = { symbol: origSym, isFixed: false };
                                        totalSwaps++;
                                        teamSwapped = true;
                                        break;
                                    }
                                }
                            }
                            if (teamSwapped) break;
                        }
                        if (teamSwapped) break;
                    }
                    if (teamSwapped) break;
                }
            }

            if (!teamSwapped) break;
        }

        const updatedStats = calculateGridStats(targetGrid);
        if (lastSolveResult) {
            lastSolveResult.grid = targetGrid;
            lastSolveResult.stats = updatedStats;
        }
        if (lastScheduler) {
            lastScheduler.grid = targetGrid;
        }

        renderOutputTable(targetGrid, updatedStats);
        if (typeof renderStatsDashboard === 'function' && updatedStats) {
            renderStatsDashboard(updatedStats);
        }
        saveCurrentTermToStorage();

        const teamLabel = isSouth ? '南2階/南3階' : 'A/Bチーム';
        if (totalSwaps > 0) {
            showToast(`⚡ ${modeTitle}を実施しました（計 ${totalSwaps} 箇所調整: 全体人数および${teamLabel}人数を均等化）`);
        } else {
            showToast(`✅ すでに${modeTitle}は最小ブレ（全体実数および${teamLabel}人数ともに差1名以内の均等状態）に保たれています`);
        }
    }

    function handleFloorBalanceWeekday() {
        executeSingleFloorBalance('weekday');
    }

    function handleFloorBalanceWeekend() {
        executeSingleFloorBalance('weekend');
    }

    function handleSTBalance() {
        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        let targetGrid = (lastSolveResult && lastSolveResult.grid) || (lastScheduler && lastScheduler.grid) || (typeof extractCurrentOutputGrid === 'function' ? extractCurrentOutputGrid() : []);
        if (!targetGrid || targetGrid.length === 0) {
            showToast('⚠️ 先に「勤務表を自動生成する」を実行してください。');
            return;
        }

        // ★ ユーザー指示: STテーブル 2段階調整（①各階平均化 ➔ ②全階平均化）
        // ① 各階（1F, 2F, 3F, 南）の出勤実数を 2.0〜2.5名（整数換算2〜3名）に厳密平準化
        // ② 各階の平準化を崩さずに全階合計実数を 10.0〜11.0名（ブレ幅1.0名以内）に極限まで平均化！
        const stFloors = ['1F', '2F', '3F', '南'];
        let totalSwapsPhase1 = 0;

        function canSwapST(s, workD, offD) {
            const st = staffList[s];
            if (!st || st.isUnused) return false;

            const cellWork = targetGrid[s][workD];
            const cellOff = targetGrid[s][offD];
            const symWork = (cellWork && typeof cellWork === 'object') ? cellWork.symbol : (cellWork || '');
            const symOff = (cellOff && typeof cellOff === 'object') ? cellOff.symbol : (cellOff || '');

            const isValidWork = (symWork === SYMBOLS.WORK || symWork === '〇' || symWork === '早');
            if (!isValidWork || symOff !== SYMBOLS.OFF) return false;
            if (cellWork.isFixed || cellOff.isFixed) return false;

            // スケ可保護（同フロア内で当日のスケ可出勤が1名未満になるのを防止）
            if (st.canSched) {
                let schedWorkCount = 0;
                staffList.forEach((otherSt, oS) => {
                    if (oS !== s && !otherSt.isUnused && otherSt.canSched) {
                        const isSameFloor = (otherSt.floor === st.floor) || (otherSt.floor && st.floor && (otherSt.floor.includes(st.floor) || st.floor.includes(otherSt.floor)));
                        if (isSameFloor) {
                            const oSym = (targetGrid[oS][workD] && targetGrid[oS][workD].symbol) || '';
                            if (isWorkSymbol(oSym)) schedWorkCount++;
                        }
                    }
                });
                if (schedWorkCount === 0) return false;
            }

            // 仮スワップして全ハード制約（連勤・週休2日・公休8日・5連勤直後2連休・労基法公休間隔）を厳格検証
            const origSym = symWork;
            targetGrid[s][workD] = { symbol: SYMBOLS.OFF, isFixed: false };
            targetGrid[s][offD] = { symbol: origSym, isFixed: false };

            const stdHolidayVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
            const isValid = verifyCandidateStaffSchedule(targetGrid, s, numDays, st, term, stdHolidayVal);

            // 元に戻す
            targetGrid[s][workD] = cellWork;
            targetGrid[s][offD] = cellOff;

            return isValid;
        }

        function getFloorDailyReal(flKey, d) {
            let r = 0;
            staffList.forEach((st, s) => {
                if (!st.isUnused && (st.floor === flKey || (st.floor && st.floor.includes(flKey)))) {
                    const cell = targetGrid[s][d];
                    const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                    if (isWorkSymbol(sym)) {
                        const w = st.isZeroCount ? 0.0 : (st.isHalf ? 0.5 : 1.0);
                        r += w;
                    }
                }
            });
            return r;
        }

        // ==========================================
        // 第1段階: 各階平均化（各フロアを2.0〜2.5名へ平準化）
        // ==========================================
        stFloors.forEach(flKey => {
            const flStaff = [];
            staffList.forEach((st, s) => {
                if (!st.isUnused && (st.floor === flKey || (st.floor && st.floor.includes(flKey)))) {
                    flStaff.push(s);
                }
            });
            if (flStaff.length === 0) return;

            for (let iter = 0; iter < 40; iter++) {
                const loads = [];
                for (let d = 0; d < numDays; d++) {
                    loads.push({ day: d, load: getFloorDailyReal(flKey, d) });
                }
                loads.sort((a, b) => b.load - a.load);

                const maxItem = loads[0];
                const minItem = loads[loads.length - 1];
                if (maxItem.load - minItem.load <= 0.6) break;

                let swapped = false;
                for (let h = 0; h < loads.length; h++) {
                    const maxD = loads[h].day;
                    for (let l = loads.length - 1; l >= 0; l--) {
                        const minD = loads[l].day;
                        if (loads[h].load - loads[l].load <= 0.6) continue;

                        for (const s of flStaff) {
                            if (canSwapST(s, maxD, minD)) {
                                const origSym = (targetGrid[s][maxD] && targetGrid[s][maxD].symbol) || SYMBOLS.WORK;
                                targetGrid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                                targetGrid[s][minD] = { symbol: origSym, isFixed: false };
                                totalSwapsPhase1++;
                                swapped = true;
                                break;
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            }
        });

        // ==========================================
        // 第2段階: 全階平均化（全階実数合計を10.0〜11.0名へ極限平均化）
        // ==========================================
        function getTotalDailyReal(d) {
            let r = 0;
            staffList.forEach((st, s) => {
                if (st.isUnused) return;
                const cell = targetGrid[s][d];
                const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                if (isWorkSymbol(sym)) {
                    const w = st.isZeroCount ? 0.0 : (st.isHalf ? 0.5 : 1.0);
                    r += w;
                }
            });
            return r;
        }

        let totalSwapsPhase2 = 0;
        for (let iter = 0; iter < 80; iter++) {
            const totalLoads = [];
            for (let d = 0; d < numDays; d++) {
                totalLoads.push({ day: d, load: getTotalDailyReal(d) });
            }
            totalLoads.sort((a, b) => b.load - a.load);

            const maxItem = totalLoads[0];
            const minItem = totalLoads[totalLoads.length - 1];
            // 全館実数ブレ幅が1.0名以内（例: 10.0〜11.0名）になったら完全平準化達成！
            if (maxItem.load - minItem.load <= 1.0) break;

            let swapped = false;
            for (let h = 0; h < totalLoads.length; h++) {
                const maxD = totalLoads[h].day;
                for (let l = totalLoads.length - 1; l >= 0; l--) {
                    const minD = totalLoads[l].day;
                    if (totalLoads[h].load - totalLoads[l].load <= 1.0) continue;

                    // 全フロアを探索
                    for (const flKey of stFloors) {
                        const flMax = getFloorDailyReal(flKey, maxD);
                        const flMin = getFloorDailyReal(flKey, minD);
                        // フロア単体でも山から谷へのスワップであること
                        if (flMax <= flMin) continue;

                        const flStaff = [];
                        staffList.forEach((st, s) => {
                            if (!st.isUnused && (st.floor === flKey || (st.floor && st.floor.includes(flKey)))) {
                                flStaff.push(s);
                            }
                        });

                        for (const s of flStaff) {
                            const st = staffList[s];
                            const wVal = st.isZeroCount ? 0.0 : (st.isHalf ? 0.5 : 1.0);
                            // スワップ後のフロア実数が 2.0未満 または 3.0超過 にならないこと（フロア平準化を完全防衛！）
                            if (flMax - wVal < 2.0 || flMin + wVal > 3.0) continue;

                            if (canSwapST(s, maxD, minD)) {
                                const origSym = (targetGrid[s][maxD] && targetGrid[s][maxD].symbol) || SYMBOLS.WORK;
                                targetGrid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                                targetGrid[s][minD] = { symbol: origSym, isFixed: false };
                                totalSwapsPhase2++;
                                swapped = true;
                                break;
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }

        const updatedStats = calculateGridStats(targetGrid);
        if (lastSolveResult) {
            lastSolveResult.grid = targetGrid;
            lastSolveResult.stats = updatedStats;
        }
        if (lastScheduler) {
            lastScheduler.grid = targetGrid;
        }

        renderOutputTable(targetGrid, updatedStats);
        if (typeof renderStatsDashboard === 'function' && updatedStats) {
            renderStatsDashboard(updatedStats);
        }
        saveCurrentTermToStorage();

        const totalAllSwaps = totalSwapsPhase1 + totalSwapsPhase2;
        if (totalAllSwaps > 0) {
            showToast('⚡ STブレ最小化（2段階調整完了）: ①各階平準化 ' + totalSwapsPhase1 + '箇所 ＋ ②全階平均化 ' + totalSwapsPhase2 + '箇所微調整（全社実数ブレ幅1名以内に極小化）');
        } else {
            showToast('✅ すでにST各階および全階合計の出勤実数は最小ブレ（均等状態）に保たれています');
        }
    }

    // -------------------------------------------------------------------------
    // 3. 生活期テーブル: 訪問ブレ最小化 / 通所ブレ最小化
    // -------------------------------------------------------------------------
    function handleLifeBalanceVisit() {
        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        let targetGrid = (lastSolveResult && lastSolveResult.grid) || (lastScheduler && lastScheduler.grid) || (typeof extractCurrentOutputGrid === 'function' ? extractCurrentOutputGrid() : []);
        if (!targetGrid || targetGrid.length === 0) {
            showToast('⚠️ 先に「勤務表を自動生成する」を実行してください。');
            return;
        }

        const visitStaff = [];
        staffList.forEach((st, s) => {
            if (st.isUnused || st.isSectionChief) return;
            const sec = st.lifeSection || '';
            if (sec === '訪問') {
                visitStaff.push(s);
            }
        });

        // ★ ユーザー指示: 訪問は祝日も平日扱い（稼働日）！土日のみ除外
        const weekdays = [];
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const isSatSun = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            if (!isSatSun) weekdays.push(d);
        }

        if (visitStaff.length === 0 || weekdays.length < 2) {
            showToast('⚠️ 訪問スタッフデータが不足しています。');
            return;
        }

        function getVisitDailyReal(d) {
            let r = 0;
            visitStaff.forEach(s => {
                const cell = targetGrid[s][d];
                const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                if (isWorkSymbol(sym)) {
                    r += (staffList[s].isZeroCount ? 0.0 : (staffList[s].isHalf ? 0.5 : 1.0));
                }
            });
            return r;
        }

        let totalSwaps = 0;
        for (let iter = 0; iter < 40; iter++) {
            const loads = weekdays.map(d => ({ day: d, load: getVisitDailyReal(d) }));
            loads.sort((a, b) => b.load - a.load);

            const maxItem = loads[0];
            const minItem = loads[loads.length - 1];
            if (maxItem.load - minItem.load <= 0.6) break;

            let swapped = false;
            for (let h = 0; h < Math.min(3, loads.length); h++) {
                const maxD = loads[h].day;
                for (let l = loads.length - 1; l >= Math.max(0, loads.length - 3); l--) {
                    const minD = loads[l].day;
                    if (loads[h].load - loads[l].load <= 0.6) continue;

                    for (const s of visitStaff) {
                        const cellMax = targetGrid[s][maxD];
                        const cellMin = targetGrid[s][minD];
                        const symMax = (cellMax && typeof cellMax === 'object') ? cellMax.symbol : (cellMax || '');
                        const symMin = (cellMin && typeof cellMin === 'object') ? cellMin.symbol : (cellMin || '');

                        if (symMax === SYMBOLS.WORK && !cellMax.isFixed && symMin === SYMBOLS.OFF && !cellMin.isFixed) {
                            if (symMax === SYMBOLS.H8 || symMin === SYMBOLS.H8) continue; // 8時は維持

                            targetGrid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                            targetGrid[s][minD] = { symbol: SYMBOLS.WORK, isFixed: false };

                            if (checkPureOffIntervalForStaff(targetGrid, s, numDays, staffList[s])) {
                                totalSwaps++;
                                swapped = true;
                                break;
                            } else {
                                targetGrid[s][maxD] = cellMax;
                                targetGrid[s][minD] = cellMin;
                            }
                        }
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }

        const updatedStats = calculateGridStats(targetGrid);
        if (lastSolveResult) {
            lastSolveResult.grid = targetGrid;
            lastSolveResult.stats = updatedStats;
        }
        if (lastScheduler) {
            lastScheduler.grid = targetGrid;
        }

        renderOutputTable(targetGrid, updatedStats);
        if (typeof renderStatsDashboard === 'function' && updatedStats) {
            renderStatsDashboard(updatedStats);
        }
        saveCurrentTermToStorage();

        if (totalSwaps > 0) {
            showToast(`⚡ 訪問ブレ最小化を実施しました（計 ${totalSwaps} 箇所の公休を安全微調整）`);
        } else {
            showToast('✅ すでに訪問出勤実数は最小ブレ（均等状態）に保たれています');
        }
    }

    function handleLifeBalanceTsusho() {
        const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        let targetGrid = (lastSolveResult && lastSolveResult.grid) || (lastScheduler && lastScheduler.grid) || (typeof extractCurrentOutputGrid === 'function' ? extractCurrentOutputGrid() : []);
        if (!targetGrid || targetGrid.length === 0) {
            showToast('⚠️ 先に「勤務表を自動生成する」を実行してください。');
            return;
        }

        // 通所スタッフ + CL2 + ハ3 + ハ南
        const tsushoStaff = [];
        const cl2Staff = [];
        staffList.forEach((st, s) => {
            if (st.isUnused || st.isSectionChief) return;
            const sec = st.lifeSection || st.section || '';
            const ha = st.haSection || '';
            const name = st.name || '';
            const isCl2 = (sec === 'Cl2') || !!st.isCl2 || !!st.isCL2 || name.includes('通所トレ') || name.includes('クラーク2') || name.includes('トレーナー');
            if (sec === '通所' || isCl2 || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') {
                tsushoStaff.push(s);
                if (isCl2) cl2Staff.push(s);
            }
        });

        // 稼働日: 月〜土（日曜日は完全に除外！祝日は通常稼働日）
        const tsushoWorkingDays = [];
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
            if (!isSun) tsushoWorkingDays.push(d);
        }

        if (tsushoStaff.length === 0 || tsushoWorkingDays.length < 2) {
            showToast('⚠️ 通所スタッフデータが不足しています。');
            return;
        }

        function getTsushoDailyReal(d) {
            let r = 0;
            tsushoStaff.forEach(s => {
                const cell = targetGrid[s][d];
                const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                if (isWorkSymbol(sym)) {
                    const ha = staffList[s].haSection || '';
                    const w = (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : (staffList[s].isZeroCount ? 0.0 : (staffList[s].isHalf ? 0.5 : 1.0));
                    r += w;
                }
            });
            return r;
        }

        function canSwapTsusho(s, workD, offD) {
            const st = staffList[s];
            if (st.isUnused) return false;

            // 日曜日は絶対に全員休み（日曜日を出勤にスワップすることは物理禁止！）
            const dateWork = term.dates[workD];
            const dateOff = term.dates[offD];
            if (dateWork && dateWork.wIdx === 6) return false;
            if (dateOff && dateOff.wIdx === 6) return false;

            const cellWork = targetGrid[s][workD];
            const cellOff = targetGrid[s][offD];
            const symWork = (cellWork && typeof cellWork === 'object') ? cellWork.symbol : (cellWork || '');
            const symOff = (cellOff && typeof cellOff === 'object') ? cellOff.symbol : (cellOff || '');

            if (symWork !== SYMBOLS.WORK || symOff !== SYMBOLS.OFF) return false;
            if (cellWork.isFixed || cellOff.isFixed) return false;

            // CL2同士の公休重複回避
            if (cl2Staff.includes(s) && cl2Staff.length >= 2) {
                const otherCl2 = cl2Staff.find(o => o !== s);
                if (otherCl2) {
                    const otherSymAtWorkD = (targetGrid[otherCl2][workD] && targetGrid[otherCl2][workD].symbol) || '';
                    if (isHolidaySymbol(otherSymAtWorkD)) return false;
                }
            }

            // 仮スワップ
            targetGrid[s][workD] = { symbol: SYMBOLS.OFF, isFixed: false };
            targetGrid[s][offD] = { symbol: SYMBOLS.WORK, isFixed: false };

            let valid = false;
            if (lastScheduler && typeof lastScheduler.isStaffHardValid === 'function') {
                const origGrid = lastScheduler.grid;
                lastScheduler.grid = targetGrid;
                valid = lastScheduler.isStaffHardValid(s);
                lastScheduler.grid = origGrid;
            } else {
                // フォールバック判定
                let maxConsec = st.allow6Consec ? 6 : 5;
                let consec = 0, consecValid = true;
                for (let d = 0; d < numDays; d++) {
                    const sym = (targetGrid[s][d] && targetGrid[s][d].symbol) || '';
                    if (isWorkSymbol(sym)) {
                        consec++;
                        if (consec > maxConsec) { consecValid = false; break; }
                    } else consec = 0;
                }
                let weekValid = true;
                if (term.weekSpans) {
                    for (const wSpan of term.weekSpans) {
                        let wWork = 0;
                        for (const wd of wSpan) {
                            const sym = (targetGrid[s][wd] && targetGrid[s][wd].symbol) || '';
                            if (isWorkSymbol(sym)) wWork++;
                        }
                        if (wWork > 5) { weekValid = false; break; }
                    }
                }
                let pureOffValid = checkPureOffIntervalForStaff(targetGrid, s, numDays, st);
                valid = consecValid && weekValid && pureOffValid;
            }

            // 元に戻す
            targetGrid[s][workD] = cellWork;
            targetGrid[s][offD] = cellOff;

            return valid;
        }

        let totalSwaps = 0;
        for (let iter = 0; iter < 80; iter++) {
            const loads = tsushoWorkingDays.map(d => ({ day: d, load: getTsushoDailyReal(d) }));
            loads.sort((a, b) => b.load - a.load);

            const maxItem = loads[0];
            const minItem = loads[loads.length - 1];
            if (maxItem.load - minItem.load <= 0.6) break;

            let swapped = false;
            for (let h = 0; h < loads.length; h++) {
                const maxD = loads[h].day;
                for (let l = loads.length - 1; l >= 0; l--) {
                    const minD = loads[l].day;
                    if (loads[h].load - loads[l].load <= 0.6) continue;

                    for (const s of tsushoStaff) {
                        if (canSwapTsusho(s, maxD, minD)) {
                            targetGrid[s][maxD] = { symbol: SYMBOLS.OFF, isFixed: false };
                            targetGrid[s][minD] = { symbol: SYMBOLS.WORK, isFixed: false };
                            totalSwaps++;
                            swapped = true;
                            break;
                        }
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }

        const updatedStats = calculateGridStats(targetGrid);
        if (lastSolveResult) {
            lastSolveResult.grid = targetGrid;
            lastSolveResult.stats = updatedStats;
        }
        if (lastScheduler) {
            lastScheduler.grid = targetGrid;
        }

        renderOutputTable(targetGrid, updatedStats);
        if (typeof renderStatsDashboard === 'function' && updatedStats) {
            renderStatsDashboard(updatedStats);
        }
        saveCurrentTermToStorage();

        if (totalSwaps > 0) {
            showToast('⚡ 通所ブレ最小化を実施しました（制約を厳守し計 ' + totalSwaps + ' 箇所の公休を安全微調整）');
        } else {
            showToast('✅ すでに通所出勤実数は最小ブレ（均等状態）に保たれています');
        }
    }

    // ★ ユーザー指示: マスターテーブルリアルタイム制約チェック（連勤・週休・特殊勤務翌日休・不可フラグ）
    function evaluateStaffScheduleRow(staff, rowDays, dates, options = {}) {
        const numDays = rowDays.length;
        const dayConflicts = {}; // d -> Array<string>
        const errors = [];
        if (!staff || staff.isUnused || staff.isZeroCount || staff.lifeSection === '管理' || staff.lifeSection === 'Cl1') {
            return { dayConflicts, errors };
        }

        const sName = staff.name || 'スタッフ';
        const allow6Consec = !!staff.allow6Consec;
        const isSectionChief = !!staff.isSectionChief;
        const maxAllowed = allow6Consec ? 6 : 5;

        const addConflict = (d, reason) => {
            if (d >= 0 && d < numDays) {
                if (!dayConflicts[d]) dayConflicts[d] = [];
                if (!dayConflicts[d].includes(reason)) {
                    dayConflicts[d].push(reason);
                }
            }
        };

        const formatDate = (d) => {
            if (dates && dates[d]) {
                const di = dates[d];
                if (di.m && di.day) return `${di.m}/${di.day}`;
                if (di.label) return di.label;
            }
            return `${d + 1}日目`;
        };

        const getSym = (d) => (rowDays && rowDays[d] !== undefined) ? String(rowDays[d] || '') : '';

        // 1. 個別不可フラグチェック
        if (!isSectionChief) {
            for (let d = 0; d < numDays; d++) {
                const sym = getSym(d);
                const dLabel = formatDate(d);
                if (sym === '8時' && !staff.can8) {
                    errors.push(`【${sName}】${dLabel}に「8時」が入っていますが「8時可」ではありません。`);
                    addConflict(d, `${dLabel}: 8時可フラグOFF`);
                }
                if ((sym === '早' || sym === 'ハヤ') && staff.noEarly) {
                    errors.push(`【${sName}】${dLabel}に「${sym}」が入っていますが「早番不可」です。`);
                    addConflict(d, `${dLabel}: 早番不可`);
                }
                if ((sym === '遅' || sym === 'オソ') && staff.noLate) {
                    errors.push(`【${sName}】${dLabel}に「${sym}」が入っていますが「遅番不可」です。`);
                    addConflict(d, `${dLabel}: 遅番不可`);
                }
                if ((sym === 'E' || sym === 'イブ') && staff.noEve) {
                    errors.push(`【${sName}】${dLabel}に「${sym}」が入っていますが「E不可」です。`);
                    addConflict(d, `${dLabel}: E不可`);
                }
            }
        }

        // 2. 特殊勤務（早・遅・E・ハヤ・オソ・イブ）翌日休日チェック
        if (!isSectionChief) {
            for (let d = 0; d < numDays - 1; d++) {
                const sym = getSym(d);
                const isRestricted = (typeof isRestrictedSpecial === 'function')
                    ? isRestrictedSpecial(sym)
                    : (sym === '早' || sym === '遅' || sym === 'E' || sym === 'ハヤ' || sym === 'オソ' || sym === 'イブ');
                if (isRestricted) {
                    const nextSym = getSym(d + 1);
                    const isHoliday = (typeof isHolidaySymbol === 'function')
                        ? isHolidaySymbol(nextSym)
                        : (nextSym === '休' || nextSym === '有' || nextSym.includes('リフ') || nextSym.startsWith('上') || nextSym.startsWith('下') || nextSym === '特休' || nextSym === '慶弔');
                    if (!isHoliday) {
                        const curLabel = formatDate(d);
                        const nextLabel = formatDate(d + 1);
                        errors.push(`【${sName}】${curLabel}の特殊勤務「${sym}」の翌日（${nextLabel}）が休日ではありません（現在:「${nextSym || '空欄'}」）。`);
                        addConflict(d, `特殊勤務「${sym}」の翌日は原則休日が必要です`);
                        addConflict(d + 1, `前日が「${sym}」のため原則休日にする必要があります`);
                    }
                }
            }
        }

        // 3. 連勤チェック（公休なし連続期間、allow6Consecなら6、通常5）
        const sequence = [];
        const pDays = staff.prevDays || [];
        const pLen = pDays.length;
        const firstDateObj = (dates && dates[0]) ? new Date(dates[0].dateStr + 'T00:00:00') : null;
        for (let p = 0; p < pLen; p++) {
            let pSym = pDays[p] || '';
            let isSatOrSun = false;
            if (firstDateObj) {
                const prevD = new Date(firstDateObj);
                prevD.setDate(prevD.getDate() - (pLen - p));
                const dow = prevD.getDay();
                if (dow === 0 || dow === 6) isSatOrSun = true;
            } else {
                if (pLen === 7 && (p === 3 || p === 4)) isSatOrSun = true;
                if (pLen === 5 && (p === 1 || p === 2)) isSatOrSun = true;
            }
            if (isSectionChief && isSatOrSun && (typeof isWorkSymbol === 'function' ? isWorkSymbol(pSym) : pSym === '○')) pSym = '休';
            sequence.push(pSym);
        }
        for (let d = 0; d < numDays; d++) sequence.push(getSym(d));

        let streakBlocks = [];
        let currentStreak = [];
        for (let idx = 0; idx < sequence.length; idx++) {
            const sym = sequence[idx];
            const isFullOff = (typeof isFullOffSymbol === 'function')
                ? isFullOffSymbol(sym)
                : (sym === '休' || sym === '-' || sym.includes('リフ') || sym.startsWith('上') || sym.startsWith('下') || sym === '特休' || sym === '慶弔');
            if (sym === '' || isFullOff) {
                if (currentStreak.length > 0) {
                    streakBlocks.push(currentStreak);
                    currentStreak = [];
                }
            } else {
                currentStreak.push(idx);
            }
        }
        if (currentStreak.length > 0) {
            streakBlocks.push(currentStreak);
        }

        streakBlocks.forEach(streak => {
            if (streak.length > maxAllowed) {
                const sIdxSeq = streak[0];
                const eIdxSeq = streak[streak.length - 1];
                const sLabel = sIdxSeq < pLen ? `前${pLen - sIdxSeq}日` : formatDate(sIdxSeq - pLen);
                const eLabel = eIdxSeq < pLen ? `前${pLen - eIdxSeq}日` : formatDate(eIdxSeq - pLen);
                const ruleMsg = allow6Consec ? '6連勤許可（7日以上連続は不可）' : '最大5連勤（6日以上連続は不可）';
                errors.push(`【${sName}】${sLabel}〜${eLabel}で公休なし${streak.length}連勤となっています（要件: ${ruleMsg}）。`);
                streak.forEach(seqDay => {
                    if (seqDay >= pLen) {
                        addConflict(seqDay - pLen, `公休なし${streak.length}連勤（上限: ${maxAllowed}日）`);
                    }
                });
            }
        });

        // 4. 5連勤後の2連休チェック
        if (!allow6Consec && !isSectionChief) {
            streakBlocks.forEach(streak => {
                if (streak.length >= 5) {
                    const endIdx = streak[streak.length - 1];
                    for (let offOffset = 1; offOffset <= 2; offOffset++) {
                        const checkIdx = endIdx + offOffset;
                        if (checkIdx < sequence.length) {
                            const nSym = sequence[checkIdx];
                            const isHol = (typeof isHolidaySymbol === 'function')
                                ? isHolidaySymbol(nSym)
                                : (nSym === '休' || nSym === '有' || nSym.includes('リフ') || nSym.startsWith('上') || nSym.startsWith('下') || nSym === '特休' || nSym === '慶弔');
                            if (nSym !== '' && !isHol) {
                                const targetD = checkIdx - pLen;
                                const targetLabel = (targetD >= 0 && targetD < numDays) ? formatDate(targetD) : `${targetD + 1}日目`;
                                errors.push(`【${sName}】連勤直後の${targetLabel}は2連休（休・有・リフ）が必要です（現在:「${nSym}」）。`);
                                if (targetD >= 0 && targetD < numDays) {
                                    addConflict(targetD, `連勤直後は2連休が必要です（現在:「${nSym}」）`);
                                }
                            }
                        }
                    }
                }
            });
        }

        // 5. 週（日〜土）出勤制限チェック（出張・半休除き最大5出勤、allow6Consecがfalseのスタッフ）
        if (!allow6Consec) {
            const weekSpans = (typeof getSunToSatWeekSpans === 'function')
                ? getSunToSatWeekSpans(dates, numDays)
                : [];
            weekSpans.forEach((wSpan, wIdx) => {
                let weekWorkCount = 0;
                const workDaysInWeek = [];
                wSpan.forEach(d => {
                    const sym = getSym(d);
                    const isWork = (typeof isWorkSymbol === 'function') ? isWorkSymbol(sym) : (sym === '○' || sym === '早' || sym === '遅' || sym === 'E' || sym === '8時');
                    const isHalf = (typeof isHalfDuty === 'function') ? isHalfDuty(sym) : (sym.includes('/'));
                    if (sym && isWork && sym !== '張' && sym !== '出張' && !isHalf) {
                        weekWorkCount++;
                        workDaysInWeek.push(d);
                    }
                });
                if (weekWorkCount > 5) {
                    const sDay = formatDate(wSpan[0]);
                    const eDay = formatDate(wSpan[wSpan.length - 1]);
                    errors.push(`【${sName}】第${wIdx + 1}週（${sDay}〜${eDay}の日〜土）に出勤が${weekWorkCount}日あります（週休2日が必要です。出張・半休を除く）。`);
                    workDaysInWeek.forEach(d => {
                        addConflict(d, `第${wIdx + 1}週（日〜土）に出勤${weekWorkCount}日（週休2日違反）`);
                    });
                }
            });
        }

        return { dayConflicts, errors };
    }

function renderMasterIntegrationView() {
        const checkThead = document.getElementById('checkTableHead');
        const checkTbody = document.getElementById('checkTableBody');
        const checkTfoot = document.getElementById('checkTableFoot');
        if (!checkTbody) return;

        const termSel = document.getElementById('masterTermSelect') || document.getElementById('termSelect');
        const curStartDate = (termSel && termSel.value) ? termSel.value : (document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01');
        const term = getTermInfo(curStartDate);
        const numDays = term.dates.length;

        const checkTitle = document.getElementById('checkTitleDisplay');
        if (checkTitle) {
            checkTitle.textContent = `🏢 ${term.title}（全フロア統合サマリー＆勤務詳細集約）`;
        }
        const endDisplay = document.getElementById('termEndDateDisplay');
        if (endDisplay && term && term.last) {
            const lastY = term.last.dateObj.getFullYear();
            const lastM = String(term.last.m).padStart(2, '0');
            const lastD = String(term.last.day).padStart(2, '0');
            endDisplay.textContent = `${lastY}-${lastM}-${lastD}`;
        }
        const badge = document.getElementById('termTitleBadge');
        if (badge && term) badge.textContent = term.badgeText;
        const daysBadge = document.getElementById('termDaysBadge');
        if (daysBadge) daysBadge.textContent = `${numDays}日間`;


        const floorConfigs = [
            { id: '1f', floorKey: '1F', label: '1階', bg: '#f0f8ff', headerBg: '#e0f2fe', border: '#bae6fd', badgeColor: '#0369a1' },
            { id: '2f', floorKey: '2F', label: '2階', bg: '#fff8f0', headerBg: '#ffedd5', border: '#fed7aa', badgeColor: '#c2410c' },
            { id: '3f', floorKey: '3F', label: '3階', bg: '#ecfdf5', headerBg: '#a7f3d0', border: '#34d399', badgeColor: '#065f46' },
            { id: 'south', floorKey: '南', label: '南', bg: '#faf5ff', headerBg: '#f3e8ff', border: '#e9d5ff', badgeColor: '#7e22ce' }
        ];

        // 全フロア合算集計用配列
        const grandTotal = new Array(numDays).fill(0);
        const grandReal = new Array(numDays).fill(0);
        const grandEarly = new Array(numDays).fill(0);
        const grandLate = new Array(numDays).fill(0);
        const grandEve = new Array(numDays).fill(0);
        const grandH8 = new Array(numDays).fill(0);

        // ★ マスターテーブル「勤務分析・平準化ダッシュボード」用の全フロアスタッフ統計集計用
        const allMasterStaffStats = [];
        const allMasterErrors = []; // ★ ユーザー指示: マスターテーブルリアルタイム制約違反エラー集約
        const allRefSyms = ['上1', '上2', '上3', '上4', '上5', '下1', '下2', '下3'];
        const masterRefBreakdownMap = {};
        allRefSyms.forEach(sym => {
            masterRefBreakdownMap[sym] = { symbol: sym, days: 0, staffSet: new Set() };
        });

        // 1. 各階およびSTの保存データをLocalStorageから読み込み
        const floorDataMap = {};
        floorConfigs.forEach(fc => {
            try {
                const raw = localStorage.getItem(`shift_schedule_${fc.id}_term_${curStartDate}`);
                floorDataMap[fc.id] = raw ? JSON.parse(raw) : null;
            } catch (e) {
                floorDataMap[fc.id] = null;
            }
        });

        let stData = null;
        try {
            const rawSt = localStorage.getItem(`shift_schedule_st_term_${curStartDate}`);
            if (rawSt) stData = JSON.parse(rawSt);
        } catch (e) {}

        let lifeData = null;
        try {
            const rawLife = localStorage.getItem(`shift_schedule_life_term_${curStartDate}`);
            if (rawLife) lifeData = JSON.parse(rawLife);
        } catch (e) {}

        let lifeMaster = null;
        try {
            const rawLifeMaster = localStorage.getItem('shift_schedule_life_staff_master');
            if (rawLifeMaster) lifeMaster = JSON.parse(rawLifeMaster);
        } catch (e) {}

        // ★ 生活期のハ応援データ（フロア別: 1f→ハ1, 2f→ハ2, 3f→ハ3, south→ハ南）
        const lifeHaDataMap = { '1f': new Array(numDays).fill(0), '2f': new Array(numDays).fill(0), '3f': new Array(numDays).fill(0), 'south': new Array(numDays).fill(0) };
        const baseLifeStaff = (lifeData && Array.isArray(lifeData.staffList)) ? lifeData.staffList : (Array.isArray(lifeMaster) ? lifeMaster : []);

        if (Array.isArray(lifeMaster)) {
            lifeMaster.forEach((ms, idx) => {
                if (baseLifeStaff[idx]) {
                    if (ms.haSection !== undefined) baseLifeStaff[idx].haSection = ms.haSection;
                    if (ms.isUnused !== undefined) baseLifeStaff[idx].isUnused = ms.isUnused;
                }
            });
        }

        const haFloorDefs = [
            { flId: '1f', target: 'ハ1', isWeekendOff: true },
            { flId: '2f', target: 'ハ2', isWeekendOff: true },
            { flId: '3f', target: 'ハ3', isWeekendOff: false },
            { flId: 'south', target: 'ハ4', isWeekendOff: false }
        ];

        haFloorDefs.forEach(def => {
            let staffFound = false;
            baseLifeStaff.forEach((st, idx) => {
                if (st.isUnused || st.isZeroCount) return;
                const matches = (st.haSection === def.target || (def.target === 'ハ4' && st.haSection === 'ハ南'));
                if (!matches) return;
                staffFound = true;
                const gridRow = (lifeData && lifeData.outputGrid && lifeData.outputGrid[idx]) ? lifeData.outputGrid[idx] : null;
                for (let d = 0; d < numDays; d++) {
                    const c = gridRow ? gridRow[d] : null;
                    // ★ ユーザー指示: まだ組んでいない時（gridRowが空、またはセルが空欄）は出勤とみなさず加算しない！
                    // 実際に生活期テーブルで自動生成・確定された出勤記号がある場合のみ加算！
                    let sym = (c && typeof c === 'object') ? (c.symbol || '') : (c || '');
                    if (isWorkSymbol(sym) && sym !== '研' && sym !== '張') {
                        lifeHaDataMap[def.flId][d] += 0.5; // ★ 生活期ハ応援スタッフが出勤している日は病棟実数に0.5加算！
                    } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○' || sym === '〇/休' || sym === '休/〇' || sym === '〇/有' || sym === '有/〇') {
                        lifeHaDataMap[def.flId][d] += 0.25;
                    }
                }
            });
            // ★ ユーザー指示: まだ組んでいない時は勝手なハーフマン加算を行わず正確に0にする（フォールバック加算完全撤廃）
        });

        // checkThead / checkTfoot のクリア（全フロア統合テーブルはtbody内で自律完結）
        if (checkThead) checkThead.innerHTML = '';
        if (checkTfoot) checkTfoot.innerHTML = '';

        let html = '';

        floorConfigs.forEach((fc, fIdx) => {
            const fData = floorDataMap[fc.id];
            const rawStaffList = (fData && Array.isArray(fData.staffList)) ? fData.staffList : [];
            // ★ 生活期テーブルのセクション（訪問、通所、Cl1、Cl2、管理）はマスターテーブルに記載しない
            const fStaffList = rawStaffList.filter(s => {
                const sec = s.lifeSection || s.section || '';
                return !['訪問', '通所', 'Cl1', 'Cl2', '管理'].includes(sec);
            });
            const fGrid = (fData && Array.isArray(fData.outputGrid)) ? fData.outputGrid : null;
            const fOffsets = (fData && Array.isArray(fData.dayOffsets)) ? fData.dayOffsets : createDefaultDayOffsets(term.dates);

            // 所属STスタッフの抽出（生活期スタッフ除外）
            const floorStStaff = [];
            const floorStGrid = [];
            if (stData && Array.isArray(stData.staffList)) {
                stData.staffList.forEach((st, sIdx) => {
                    const sec = st.lifeSection || st.section || '';
                    if (['訪問', '通所', 'Cl1', 'Cl2', '管理'].includes(sec)) return;
                    if (!st.isUnused && (st.floor === fc.floorKey || (st.floor && st.floor.includes(fc.floorKey)))) {
                        floorStStaff.push(st);
                        if (stData.outputGrid && stData.outputGrid[sIdx]) {
                            floorStGrid.push(stData.outputGrid[sIdx]);
                        } else {
                            floorStGrid.push(st.days || new Array(numDays).fill(''));
                        }
                    }
                });
            }

            // 日別集計（±補正, 出勤人数合計, 実数合計, 早, 遅, E, 8時）
            const dailyOffsets = [];
            const dailyReal = [];
            const dailyTotal = [];
            const dailyEarly = [];
            const dailyLate = [];
            const dailyEve = [];
            const dailyH8 = [];

            for (let d = 0; d < numDays; d++) {
                const offset = (fOffsets && fOffsets[d] !== undefined) ? fOffsets[d] : 0;
                dailyOffsets.push(offset);

                let headCount = 0;
                let realCount = 0;
                let earlyCount = 0;
                let lateCount = 0;
                let eveCount = 0;
                let h8Count = 0;

                // 病棟スタッフ集計
                if (fGrid && fStaffList.length > 0) {
                    for (let s = 0; s < fStaffList.length; s++) {
                        const staff = fStaffList[s];
                        if (staff.isUnused) continue;
                        const cell = fGrid[s] ? fGrid[s][d] : null;
                        const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                        // ★ ハヤ・オソ・イブは特殊勤務カウントから除外、通常出勤（〇）としてカウント
                        if (sym === '早') {
                            earlyCount++;
                            headCount += 1.0;
                            realCount += (staff.isHalf ? 0.5 : 1.0);
                        } else if (sym === '遅') {
                            lateCount++;
                            headCount += 1.0;
                            realCount += (staff.isHalf ? 0.5 : 1.0);
                        } else if (sym === 'E') {
                            eveCount++;
                            headCount += 1.0;
                            realCount += (staff.isHalf ? 0.5 : 1.0);
                        } else if (sym === '8時') {
                            h8Count++;
                            headCount += 1.0;
                            realCount += (staff.isHalf ? 0.5 : 1.0);
                        } else if (sym === '○' || sym === '出' || sym === '研' || sym === '張' || sym === 'ハヤ' || sym === 'オソ' || sym === 'イブ') {
                            headCount += 1.0;
                            realCount += (staff.isHalf ? 0.5 : 1.0);
                        } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○' || sym === '〇/休' || sym === '休/〇' || sym === '〇/有' || sym === '有/〇') {
                            headCount += 0.5;
                            realCount += (staff.isHalf ? 0.25 : 0.5);
                        }
                    }
                }

                // 所属STスタッフ集計の合算（1〜3階・南病棟ともにPT+OT+ST合算で早・遅・E・8時を集計）
                for (let si = 0; si < floorStStaff.length; si++) {
                    const st = floorStStaff[si];
                    const cell = floorStGrid[si] ? floorStGrid[si][d] : null;
                    const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                    if (sym === '早') {
                        earlyCount++;
                        headCount += 1.0;
                        realCount += (st.isHalf ? 0.5 : 1.0);
                    } else if (sym === '遅') {
                        lateCount++;
                        headCount += 1.0;
                        realCount += (st.isHalf ? 0.5 : 1.0);
                    } else if (sym === 'E') {
                        eveCount++;
                        headCount += 1.0;
                        realCount += (st.isHalf ? 0.5 : 1.0);
                    } else if (sym === '8時') {
                        h8Count++;
                        headCount += 1.0;
                        realCount += (st.isHalf ? 0.5 : 1.0);
                    } else if (sym === '○' || sym === '出' || sym === '研' || sym === '張' || sym === 'ハヤ' || sym === 'オソ' || sym === 'イブ') {
                        headCount += 1.0;
                        realCount += (st.isHalf ? 0.5 : 1.0);
                    } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○' || sym === '〇/休' || sym === '休/〇' || sym === '〇/有' || sym === '有/〇') {
                        headCount += 0.5;
                        realCount += (st.isHalf ? 0.25 : 0.5);
                    }
                }

                // ★ 生活期ハ応援実数の合算（ハ1→1F, ハ2→2F, ハ3→3F, ハ南→南）
                // ※ ユーザー指示: まだどのテーブルも組んでいない状態ではハーフマンの数字を加算しない（headCount > 0 の場合のみ加算）
                const lifeHaWork = (lifeHaDataMap[fc.id] && lifeHaDataMap[fc.id][d]) ? lifeHaDataMap[fc.id][d] : 0;
                if (headCount > 0) {
                    realCount += lifeHaWork;
                }

                dailyReal.push(realCount);
                dailyEarly.push(earlyCount);
                dailyLate.push(lateCount);
                dailyEve.push(eveCount);
                dailyH8.push(h8Count);
                const displayTotal = headCount > 0 ? (headCount + (offset > 0 ? offset : 0)) : 0;
                dailyTotal.push(displayTotal);

                // 全フロア合算に加算
                grandTotal[d] += displayTotal;
                grandReal[d] += realCount;
                grandEarly[d] += earlyCount;
                grandLate[d] += lateCount;
                grandEve[d] += eveCount;
                grandH8[d] += h8Count;
            }

            // テーブルヘッダー1: 日付ヘッダー（最右端まで太い横罫線を引く: border-top: 4px solid #334155 !important;）
            html += `<tr class="floor-boundary-row" style="background:${fc.headerBg}; font-weight:700;">
                <th class="sticky-col-1" style="background:${fc.headerBg}; color:${fc.badgeColor}; width:44px; min-width:44px; max-width:44px; text-align:center; padding:2px; border-right:1px solid ${fc.border}; border-top: 4px solid #334155 !important;">階</th>
                <th class="sticky-col-2" style="background:${fc.headerBg}; color:#1e293b; width:125px; min-width:125px; max-width:125px; text-align:left; padding:2px 4px; border-right:2px solid #475569; border-top: 4px solid #334155 !important;">項目</th>`;
            for (let d = 0; d < numDays; d++) {
                const di = term.dates[d];
                const thickCls = getDayBorderClass(d);
                html += `<th class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${fc.headerBg}; font-size:0.78rem; padding:4px 2px; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; text-align:center; white-space:nowrap;">${di.m}/${di.day}</th>`;
            }
            html += `
                <th title="出勤日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">出勤</th>
                <th title="公休日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">公休</th>
                <th title="有給休暇日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem; font-weight:800;">有休</th>
                <th title="リフレッシュ休暇日数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">リフ</th>
                <th title="早番回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">早</th>
                <th title="遅番回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">遅</th>
                <th title="イブニング回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">E</th>
                <th title="8時開始回数" style="background:${fc.headerBg}; color:#1e293b; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">8時</th>
                <th style="background:${fc.headerBg}; color:${fc.badgeColor}; min-width:160px; max-width:260px; font-size:0.8rem; text-align:center; border-bottom:1px solid ${fc.border}; border-top: 4px solid #334155 !important;">備考（メモ）</th>
            </tr>`;

            // テーブルヘッダー2: 曜日ヘッダー
            html += `<tr style="background:${fc.headerBg}; font-weight:700;">
                <th class="sticky-col-1" style="background:${fc.headerBg}; border-right:1px solid ${fc.border}; width:44px; min-width:44px; max-width:44px;"></th>
                <th class="sticky-col-2" style="background:${fc.headerBg}; border-right:2px solid #475569; width:125px; min-width:125px; max-width:125px;"></th>`;
            for (let d = 0; d < numDays; d++) {
                const di = term.dates[d];
                const thickCls = getDayBorderClass(d);
                const wColor = di.wIdx === 5 ? '#2563eb' : ((di.wIdx === 6 || di.isHoliday) ? '#dc2626' : '#334155');
                const wBg = di.wIdx === 5 ? '#eff6ff' : ((di.wIdx === 6 || di.isHoliday) ? '#fef2f2' : fc.headerBg);
                html += `<th class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${wBg}; color:${wColor}; font-size:0.8rem; padding:2px; border-bottom:1px solid ${fc.border}; text-align:center;">${di.weekday}</th>`;
            }
            html += `<th colspan="9" style="background:${fc.headerBg}; border-bottom:1px solid ${fc.border};"></th></tr>`;

            // サマリー行1: ±補正 (5行目相当)
            html += `<tr style="background:${fc.bg}; font-weight:700;">
                <td class="sticky-col-1" rowspan="8" style="background:${fc.headerBg}; color:${fc.badgeColor}; font-size:1.05rem; font-weight:800; vertical-align:middle; text-align:center; border-right:1px solid ${fc.border}; width:44px; min-width:44px; max-width:44px;">${fc.label}</td>
                <td class="sticky-col-2" style="background:${fc.bg}; color:#1e293b; border-right:2px solid #475569; font-weight:700; width:125px; min-width:125px; max-width:125px;">±補正</td>`;
            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                const off = dailyOffsets[d];
                const offText = off > 0 ? `+${off}` : `${off}`;
                const offColor = off > 0 ? '#15803d' : (off < 0 ? '#dc2626' : '#64748b');
                html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${fc.bg}; color:${offColor}; font-weight:700; border-bottom:1px solid ${fc.border}; text-align:center;">${offText}</td>`;
            }
            html += `<td colspan="9" style="background:${fc.bg};"></td></tr>`;

            // サマリー行2: 出勤人数合計 (6行目相当) ★ご要望: 集計はグレー背景に！
            html += `<tr style="background:#f1f5f9; font-weight:700;">
                <td class="sticky-col-2" style="background:#f1f5f9; color:#0f172a; border-right:2px solid #475569; font-weight:800; width:125px; min-width:125px; max-width:125px;">出勤人数合計</td>`;
            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:#f1f5f9; color:#0f172a; font-weight:800; border-bottom:1px solid #cbd5e1; text-align:center;">${dailyTotal[d]}</td>`;
            }
            html += `<td colspan="9" style="background:#f1f5f9;"></td></tr>`;

            // サマリー行3: 実数合計 (7行目相当) ★ご要望: 集計はグレー背景に！
            html += `<tr style="background:#e2e8f0; font-weight:700;">
                <td class="sticky-col-2" style="background:#e2e8f0; color:#0369a1; border-right:2px solid #475569; font-weight:800; width:125px; min-width:125px; max-width:125px;">実数合計</td>`;
            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:#e2e8f0; color:#0369a1; font-weight:800; border-bottom:1px solid #cbd5e1; text-align:center;">${dailyReal[d]}</td>`;
            }
            html += `<td colspan="9" style="background:#e2e8f0;"></td></tr>`;

            // 定数定義（1〜3階: 早3/遅1/E2/8時1、南: 早2/遅2/E2/8時1 ★南病棟も8時毎日1名！）
            const isSouthFloor = (fc.id === 'south');
            const targetEarly = isSouthFloor ? 2 : 3;
            const targetLate = isSouthFloor ? 2 : 1;
            const targetEve = 2;
            const targetH8 = 1;

            // サマリー行4: 早 (8行目相当)
            html += `<tr style="background:${fc.bg}; font-weight:600;">
                <td class="sticky-col-2" style="background:${fc.bg}; color:#1e293b; border-right:2px solid #475569; width:125px; min-width:125px; max-width:125px;">早</td>`;
            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                const cnt = dailyEarly[d];
                const isConflict = (cnt !== targetEarly);
                const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : `background:${fc.bg}; color:#ea580c;`;
                const titleStr = isConflict ? `title="⚠️ 定数エラー: ${cnt}名（定数: ${targetEarly}名）"` : '';
                html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:700; border-bottom:1px solid ${fc.border}; text-align:center;">${cnt}</td>`;
            }
            html += `<td colspan="9" style="background:${fc.bg};"></td></tr>`;

            // サマリー行5: 遅 (9行目相当)
            html += `<tr style="background:${fc.bg}; font-weight:600;">
                <td class="sticky-col-2" style="background:${fc.bg}; color:#1e293b; border-right:2px solid #475569; width:125px; min-width:125px; max-width:125px;">遅</td>`;
            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                const cnt = dailyLate[d];
                const isConflict = (cnt !== targetLate);
                const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : `background:${fc.bg}; color:#0284c7;`;
                const titleStr = isConflict ? `title="⚠️ 定数エラー: ${cnt}名（定数: ${targetLate}名）"` : '';
                html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:700; border-bottom:1px solid ${fc.border}; text-align:center;">${cnt}</td>`;
            }
            html += `<td colspan="9" style="background:${fc.bg};"></td></tr>`;

            // サマリー行6: E (10行目相当)
            html += `<tr style="background:${fc.bg}; font-weight:600;">
                <td class="sticky-col-2" style="background:${fc.bg}; color:#1e293b; border-right:2px solid #475569; width:125px; min-width:125px; max-width:125px;">E</td>`;
            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                const cnt = dailyEve[d];
                const isConflict = (cnt !== targetEve);
                const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : `background:${fc.bg}; color:#7c3aed;`;
                const titleStr = isConflict ? `title="⚠️ 定数エラー: ${cnt}名（定数: ${targetEve}名）"` : '';
                html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:700; border-bottom:1px solid ${fc.border}; text-align:center;">${cnt}</td>`;
            }
            html += `<td colspan="9" style="background:${fc.bg};"></td></tr>`;

            // サマリー行7: 8時 (11行目相当)
            html += `<tr style="background:${fc.bg}; font-weight:600;">
                <td class="sticky-col-2" style="background:${fc.bg}; color:#1e293b; border-right:2px solid #475569; width:125px; min-width:125px; max-width:125px;">8時</td>`;
            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                const cnt = dailyH8[d];
                const isConflict = (cnt !== targetH8);
                const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : `background:${fc.bg}; color:#059669;`;
                const titleStr = isConflict ? `title="⚠️ 定数エラー: ${cnt}名（定数: ${targetH8}名）"` : '';
                html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:700; border-bottom:1px solid ${fc.border}; text-align:center;">${cnt}</td>`;
            }
            html += `<td colspan="9" style="background:${fc.bg};"></td></tr>`;

            const isExp = masterExpandedFloors.has(fc.id);

            // サマリー行8: 「！表示する」トグルボタン行 (12行目相当)
            html += `<tr style="background:${fc.bg}; border-bottom: 2px solid ${fc.border};">
                <td class="sticky-col-2" style="background:${fc.bg}; border-right:2px solid #475569; padding:4px 6px; width:125px; min-width:125px; max-width:125px;">
                    <button type="button" class="btn btn-outline toggle-master-floor-btn" data-floor="${fc.id}" style="width:100%; font-size:0.75rem; padding:2px 6px; font-weight:700; background:${isExp ? '#f1f5f9' : '#ffffff'}; color:${fc.badgeColor}; border-color:${fc.border}; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor:pointer;">
                        ${isExp ? '▲折りたたむ' : '⚡表示する'}
                    </button>
                </td>`;
            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${fc.bg}; border-bottom:2px solid ${fc.border};"></td>`;
            }
            html += `<td colspan="9" style="background:${fc.bg};"></td></tr>`;

            // 詳細行群: デフォルト非表示、並び順: PTA → PTB → OTA → OTB → ST
            const orderedStaffList = [];
            const sections = ['PT A', 'PT B', 'OT A', 'OT B'];

            sections.forEach(sec => {
                fStaffList.forEach((s, sIdx) => {
                    if (!s.isUnused && s.section === sec) {
                        const gridRow = fGrid ? fGrid[sIdx] : (s.days || []);
                        orderedStaffList.push({ staff: s, sec: sec, gridRow: gridRow, isST: false });
                    }
                });
            });

            // セクション未設定のその他スタッフ
            fStaffList.forEach((s, sIdx) => {
                if (!s.isUnused && !sections.includes(s.section)) {
                    const gridRow = fGrid ? fGrid[sIdx] : (s.days || []);
                    orderedStaffList.push({ staff: s, sec: s.section || '一般', gridRow: gridRow, isST: false });
                }
            });

            // STスタッフ
            floorStStaff.forEach((st, si) => {
                const gridRow = floorStGrid[si] || (st.days || []);
                orderedStaffList.push({ staff: st, sec: 'ST', gridRow: gridRow, isST: true });
            });

            // ★ 添付2要件: ST最下端の下にハーフマン（生活期ハ応援）の出勤を表示（記号パレットで修正可能に）
            const haDef = haFloorDefs.find(d => d.flId === fc.id);
            if (haDef) {
                let haStaffFound = false;
                baseLifeStaff.forEach((st, idx) => {
                    if (st.isUnused || st.isZeroCount) return;
                    const matches = (st.haSection === haDef.target || (haDef.target === 'ハ4' && st.haSection === 'ハ南'));
                    if (!matches) return;
                    haStaffFound = true;
                    const rawRow = (lifeData && lifeData.outputGrid && lifeData.outputGrid[idx]) ? lifeData.outputGrid[idx] : null;
                    const row = [];
                    for (let d = 0; d < numDays; d++) {
                        let cellVal = rawRow ? rawRow[d] : null;
                        let sym = (cellVal && typeof cellVal === 'object') ? (cellVal.symbol || '') : (cellVal || '');
                        if (!sym && st.days && st.days[d]) sym = st.days[d];
                        if (!sym) {
                            const dInfo = (term && term.dates && term.dates[d]) ? term.dates[d] : null;
                            const wDay = dInfo ? dInfo.weekday : (d % 7 === 5 ? '土' : (d % 7 === 6 ? '日' : '月'));
                            sym = haDef.isWeekendOff ? ((wDay === '土' || wDay === '日') ? '休' : '○') : ((wDay === '日') ? '休' : '○');
                        }
                        const isFixed = (cellVal && typeof cellVal === 'object') ? !!cellVal.isFixed : false;
                        row.push({ symbol: sym, isFixed: isFixed });
                    }
                    orderedStaffList.push({
                        staff: st,
                        sec: 'ﾊｰﾌﾏﾝ',
                        gridRow: row,
                        isST: false,
                        isHa: true,
                        lifeStaffIdx: idx
                    });
                });
                // ★ ユーザー指示: まだ生活期で組んでいない場合や該当スタッフがいない場合は、勝手にダミーのハーフマンを生成しない！
                if (!haStaffFound && lifeData && lifeData.outputGrid && lifeData.outputGrid.length > 0) {
                    // 生活期の勤務表が存在するが担当者が未設定の場合のみ空枠として待機（○で勝手に埋めない）
                    const dummyStaff = {
                        id: (haDef.target === 'ハ1' ? 41 : (haDef.target === 'ハ2' ? 42 : (haDef.target === 'ハ3' ? 43 : 44))),
                        name: `ハーフマン (${haDef.target})`,
                        haSection: haDef.target
                    };
                    const row = [];
                    for (let d = 0; d < numDays; d++) {
                        row.push({ symbol: '', isFixed: false });
                    }
                    orderedStaffList.push({
                        staff: dummyStaff,
                        sec: 'ﾊｰﾌﾏﾝ',
                        gridRow: row,
                        isST: false,
                        isHa: true,
                        lifeStaffIdx: -1
                    });
                }
            }

            if (orderedStaffList.length === 0) {
                html += `<tr class="master-detail-row master-detail-${fc.id}" style="display:${isExp ? 'table-row' : 'none'}; background:#ffffff;">
                    <td class="sticky-col-1" style="background:#f8fafc; color:#64748b; font-size:0.75rem; text-align:center; border-right:1px solid #cbd5e1;">-</td>
                    <td class="sticky-col-2" style="background:#ffffff; color:#94a3b8; font-size:0.8rem; text-align:left; border-right:2px solid #475569; padding-left:8px;">※${fc.label}のデータは未保存です（${fc.label}テーブルで保存すると集約表示されます）</td>
                    <td colspan="${numDays + 9}" style="background:#ffffff; color:#94a3b8; font-size:0.8rem; text-align:center; border-bottom:1px solid #e2e8f0;">-</td>
                </tr>`;
            }

            orderedStaffList.forEach(item => {
                const s = item.staff;
                const secBadgeBg = item.sec === 'PT A' ? '#e0e7ff' : (item.sec === 'PT B' ? '#ede9fe' : (item.sec === 'OT A' ? '#fae8ff' : (item.sec === 'OT B' ? '#fce7f3' : (item.isST ? '#fdf2f8' : (item.isHa ? '#d1fae5' : '#f1f5f9')))));
                const secBadgeColor = item.sec === 'PT A' ? '#3730a3' : (item.sec === 'PT B' ? '#5b21b6' : (item.sec === 'OT A' ? '#86198f' : (item.sec === 'OT B' ? '#9d174d' : (item.isST ? '#be185d' : (item.isHa ? '#065f46' : '#475569')))));

                html += `<tr class="master-detail-row master-detail-${fc.id}" style="display:${isExp ? 'table-row' : 'none'}; background:#ffffff;">
                    <td class="sticky-col-1" style="background:${secBadgeBg}; color:${secBadgeColor}; font-size:0.75rem; font-weight:700; text-align:center; border-right:1px solid #cbd5e1;">${item.sec}</td>
                    <td class="sticky-col-2" style="background:#ffffff; font-weight:600; text-align:left; border-right:2px solid #475569; padding-left:8px;">${escapeHtmlText(s.name)}</td>`;

                // ★ 勤務の右端に「出勤・公休などのスタッフ毎の集計」を計算
                let sWork = 0, sOff = 0, sPaid = 0, sRef = 0, sEarly = 0, sLate = 0, sEve = 0, sH8 = 0;
                const isZero = !!(s.isZeroCount || s.lifeSection === '管理' || s.lifeSection === 'Cl1');
                const isHalf = !!s.isHalf;

                // ★ ユーザー指示: マスターテーブルリアルタイム制約チェック実行
                const sRowSyms = [];
                for (let d = 0; d < numDays; d++) {
                    const c = item.gridRow ? item.gridRow[d] : null;
                    sRowSyms.push((c && typeof c === 'object') ? (c.symbol || '') : (c || ''));
                }
                const sCheck = evaluateStaffScheduleRow(s, sRowSyms, term.dates);
                if (sCheck.errors && sCheck.errors.length > 0) {
                    allMasterErrors.push(...sCheck.errors);
                }

                for (let d = 0; d < numDays; d++) {
                    const thickCls = getDayBorderClass(d);
                    const cell = item.gridRow ? item.gridRow[d] : null;
                    const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                    
                    if (sym) {
                        if (sym === '休') {
                            sOff++;
                        } else if (sym === '有') {
                            sPaid++;
                        } else if (sym.includes('リフ') || sym.startsWith('上') || sym.startsWith('下')) {
                            sRef++;
                            if (allRefSyms.includes(sym)) {
                                masterRefBreakdownMap[sym].days += 1.0;
                                masterRefBreakdownMap[sym].staffSet.add(s.id || s.name);
                            }
                        } else if (sym === '早' || sym === 'ハヤ') {
                            if (sym === '早') sEarly++;
                            if (!isZero) sWork += 1.0;
                        } else if (sym === '遅' || sym === 'オソ') {
                            if (sym === '遅') sLate++;
                            if (!isZero) sWork += 1.0;
                        } else if (sym === 'E' || sym === 'イブ') {
                            if (sym === 'E') sEve++;
                            if (!isZero) sWork += 1.0;
                        } else if (sym === '8時') {
                            sH8++;
                            if (!isZero) sWork += 1.0;
                        } else if (isWorkSymbol(sym)) {
                            if (!isZero) sWork += 1.0;
                        } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○') {
                            if (!isZero) sWork += (isHalf ? 0.25 : 0.5);
                            if (sym.includes('休')) sOff += 0.5;
                            if (sym.includes('有')) sPaid += 0.5;
                        }
                    }

                    // ★ ご要望: 特殊勤務などに色が付いているが不要（白背景・通常文字、事前希望のみ赤字保持）
                    const originalWish = (s.days && s.days[d]) ? s.days[d] : '';
                    const isRef = isRefreshHolidaySymbol(sym) || isRefreshHolidaySymbol(originalWish);
                    const isCellFixed = !isRef && !!(
                        (originalWish !== '' && originalWish === sym) ||
                        (cell && typeof cell === 'object' && cell.isFixed && originalWish !== '')
                    );

                    const color = isCellFixed ? '#dc2626' : (isRef ? '#0f172a' : '#334155');
                    let specialCls = '';
                    if (sym === '早') specialCls = ' cell-special-early';
                    else if (sym === '遅') specialCls = ' cell-special-late';
                    else if (sym === 'E') specialCls = ' cell-special-eve';

                    // ★ ユーザー指示: 制約違反セル（連勤10や週休2日違反、特殊勤務翌日休違反等）に青い網掛け（.conflict-highlight）を適用
                    const hasConflict = !!(sCheck.dayConflicts && sCheck.dayConflicts[d] && sCheck.dayConflicts[d].length > 0);
                    const conflictCls = hasConflict ? ' conflict-highlight' : '';
                    const conflictReasons = hasConflict ? sCheck.dayConflicts[d].join(' / ') : '';
                    const conflictTitle = hasConflict ? `⚠️ 【制約違反】${conflictReasons}` : '';
                    const titleText = conflictTitle || (isCellFixed ? '🔒 事前固定希望枠（赤字・クリックで修正可能）' : 'システム自動配置（クリックで修正可能）');
                    const bgStyle = (hasConflict || sym === '早' || sym === '遅' || sym === 'E') ? '' : 'background:#ffffff;';

                    const fixedCls = isCellFixed ? 'fixed-cell' : (isRef ? 'auto-ref-cell' : 'auto-cell');

                    html += `<td class="${thickCls} ${fixedCls}${specialCls}${conflictCls} master-editable-cell col-day-fixed" data-sym="${sym}" data-floor="${fc.id}" data-is-st="${item.isST ? '1' : '0'}" data-is-ha="${item.isHa ? '1' : '0'}" data-ha-idx="${item.lifeStaffIdx !== undefined ? item.lifeStaffIdx : -1}" data-staff-id="${s.id || ''}" data-staff-name="${escapeHtmlText(s.name)}" data-day="${d}" data-conflict-reason="${escapeHtmlText(conflictReasons)}" title="${escapeHtmlText(titleText)}" style="width:52px; min-width:52px; max-width:52px; ${bgStyle} color:${color}; font-weight:700; border-bottom:1px solid #e2e8f0; text-align:center; cursor:pointer;">${sym}</td>`;
                }

                // ★ ユーザー指示: 公休を丸にするなどして公休数が8日以外になった場合、ブルー網掛けでエラー検知
                const isOffConflict = (!s.isUnused && !isZero && Number(sOff.toFixed(1)) !== 8);
                if (isOffConflict) {
                    allMasterErrors.push(`【${s.name}】公休日数が8日ではありません（現在:${Number(sOff.toFixed(1))}日 / 定数:8日）。`);
                }
                const offCls = isOffConflict ? 'conflict-highlight' : '';
                const offStyle = isOffConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : 'background:#ffffff; color:#1e293b;';
                const offTitle = isOffConflict ? `title="⚠️ 公休が8日ではありません（現在:${Number(sOff.toFixed(1))}日 / 定数:8日）"` : 'title="公休8日"';

                html += `
                    <td class="stat-cell" style="font-weight:700; text-align:center; background:#ffffff; color:#1e293b; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${Number(sWork.toFixed(1))}</td>
                    <td class="stat-cell ${offCls}" ${offTitle} style="font-weight:700; text-align:center; ${offStyle} border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${Number(sOff.toFixed(1))}</td>
                    <td class="stat-cell" style="font-weight:800; text-align:center; background:#ffffff; color:#1e293b; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${Number(sPaid.toFixed(1))}</td>
                    <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#1e293b; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${Number(sRef.toFixed(1))}</td>
                    <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#334155; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${sEarly}</td>
                    <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#334155; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${item.isST ? '-' : sLate}</td>
                    <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#334155; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${item.isST ? '-' : sEve}</td>
                    <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#334155; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${item.isST ? '-' : sH8}</td>
                    <td class="remarks-cell" style="background:#ffffff; color:#475569; font-size:0.78rem; text-align:left; padding:2px 8px; border-bottom:1px solid #e2e8f0; white-space:normal; word-break:break-all;">${escapeHtmlText(s.remarks || '')}</td>
                </tr>`;

                allMasterStaffStats.push({
                    staff: s,
                    isUnused: false,
                    paidDays: sPaid,
                    refDays: sRef,
                    early: sEarly,
                    late: sLate,
                    eve: sEve,
                    h8: sH8
                });
            });

            // ★ 添付1・2準拠: 最下端STの下に当該フロアの集計部分を表示（展開時連動）！
            // 項目: 出勤人数合計, 実数合計, PT A/2出勤, OT A/2出勤, PT B/3出勤, OT B/3出勤, ST出勤, 早, 遅, E, 8時
            const secPta = isSouthFloor ? 'PT 2' : 'PT A';
            const secOta = isSouthFloor ? 'OT 2' : 'OT A';
            const secPtb = isSouthFloor ? 'PT 3' : 'PT B';
            const secOtb = isSouthFloor ? 'OT 3' : 'OT B';

            const dailyPta = new Array(numDays).fill(0);
            const dailyOta = new Array(numDays).fill(0);
            const dailyPtb = new Array(numDays).fill(0);
            const dailyOtb = new Array(numDays).fill(0);
            const dailyStWork = new Array(numDays).fill(0);
            const dailyHaWork = (lifeHaDataMap[fc.id] && Array.isArray(lifeHaDataMap[fc.id])) ? [...lifeHaDataMap[fc.id]] : new Array(numDays).fill(0);

            orderedStaffList.forEach(item => {
                const s = item.staff;
                if (s.isUnused || s.isZeroCount) return;
                for (let d = 0; d < numDays; d++) {
                    const cell = item.gridRow ? item.gridRow[d] : null;
                    const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                    if (item.isHa) {
                        // ハ応援スタッフの出勤実数集計（出勤0.5、半勤0.25）
                        if (isWorkSymbol(sym) && sym !== '研' && sym !== '張') {
                            dailyHaWork[d] = 0.5;
                        } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○' || sym === '〇/休' || sym === '休/〇' || sym === '〇/有' || sym === '有/〇') {
                            dailyHaWork[d] = 0.25;
                        } else if (sym === '休' || sym === '有' || sym.includes('リフ') || sym.startsWith('上') || sym.startsWith('下')) {
                            dailyHaWork[d] = 0;
                        }
                    } else if (isWorkSymbol(sym) && sym !== '研' && sym !== '張') {
                        if (item.isST) {
                            dailyStWork[d] += (s.isHalf ? 0.5 : 1.0);
                        } else {
                            if (item.sec === secPta) dailyPta[d] += (s.isHalf ? 0.5 : 1.0);
                            else if (item.sec === secOta) dailyOta[d] += (s.isHalf ? 0.5 : 1.0);
                            else if (item.sec === secPtb) dailyPtb[d] += (s.isHalf ? 0.5 : 1.0);
                            else if (item.sec === secOtb) dailyOtb[d] += (s.isHalf ? 0.5 : 1.0);
                        }
                    } else if (sym === '○/休' || sym === '休/○' || sym === '○/有' || sym === '有/○') {
                        if (item.isST) dailyStWork[d] += 0.5;
                        else {
                            if (item.sec === secPta) dailyPta[d] += 0.5;
                            else if (item.sec === secOta) dailyOta[d] += 0.5;
                            else if (item.sec === secPtb) dailyPtb[d] += 0.5;
                            else if (item.sec === secOtb) dailyOtb[d] += 0.5;
                        }
                    }
                }
            });

            // 集計フッター行のリスト定義
            const floorFooterRows = [
                { label: '出勤人数合計', vals: dailyTotal, color: '#0f172a', bg: '#f1f5f9', bold: true },
                { label: '実数合計', vals: dailyReal, color: '#0369a1', bg: '#e2e8f0', bold: true },
                { label: `${secPta} 実数`, vals: dailyPta, color: '#ea580c', bg: '#fffaf5', bold: false },
                { label: `${secOta} 実数`, vals: dailyOta, color: '#ea580c', bg: '#fffaf5', bold: false },
                { label: `${secPtb} 実数`, vals: dailyPtb, color: '#1d4ed8', bg: '#f5f8ff', bold: false },
                { label: `${secOtb} 実数`, vals: dailyOtb, color: '#1d4ed8', bg: '#f5f8ff', bold: false },
                { label: 'ST 実数', vals: dailyStWork, color: '#db2777', bg: '#fdf2f8', bold: false },
                { label: 'ﾊｰﾌﾏﾝ実数', vals: dailyHaWork, color: '#059669', bg: '#f0fdf4', bold: false },
                { label: '早番', vals: dailyEarly, color: '#ea580c', bg: '#fff7ed', bold: true },
                { label: '遅番', vals: dailyLate, color: '#0284c7', bg: '#f0f9ff', bold: true },
                { label: 'E', vals: dailyEve, color: '#7c3aed', bg: '#faf5ff', bold: true },
                { label: '8時', vals: dailyH8, color: '#059669', bg: '#f0fdf4', bold: true }
            ];

            floorFooterRows.forEach(fr => {
                const totalSum = fr.vals.reduce((a, b) => a + b, 0);
                const displayTotal = totalSum % 1 === 0 ? totalSum : totalSum.toFixed(1);
                html += `<tr class="master-detail-row master-detail-${fc.id}" style="display:${isExp ? 'table-row' : 'none'}; background:${fr.bg}; font-weight:${fr.bold ? '800' : '700'};">
                    <td class="sticky-col-1" style="background:${fr.bg}; color:${fr.color}; font-size:0.75rem; text-align:center; border-right:1px solid #cbd5e1;">集計</td>
                    <td class="sticky-col-2" style="background:${fr.bg}; color:${fr.color}; font-weight:${fr.bold ? '800' : '700'}; font-size:0.82rem; text-align:left; border-right:2px solid #475569; padding-left:8px;">${fr.label}</td>`;
                for (let d = 0; d < numDays; d++) {
                    const thickCls = getDayBorderClass(d);
                    const v = fr.vals[d];
                    const dispV = (v > 0) ? (v % 1 === 0 ? v : v.toFixed(1)) : (['早番', '遅番', 'E', '8時', '出勤人数合計', '実数合計'].includes(fr.label) ? v : '-');

                    // ★ ユーザー指示: 各階の特殊勤務（早・遅・E・8時）が集計で定数と異なればブルー網掛けでエラー検知！
                    let isConflict = false;
                    let conflictTitle = '';
                    if (fr.label === '早番') {
                        const target = (fc.id === 'south') ? 2 : 3;
                        if (v !== target) {
                            isConflict = true;
                            conflictTitle = `⚠️ ${fc.label}早番定数エラー: ${v}名（定数: ${target}名）`;
                        }
                    } else if (fr.label === '遅番') {
                        const target = (fc.id === 'south') ? 2 : 1;
                        if (v !== target) {
                            isConflict = true;
                            conflictTitle = `⚠️ ${fc.label}遅番定数エラー: ${v}名（定数: ${target}名）`;
                        }
                    } else if (fr.label === 'E') {
                        const target = 2;
                        if (v !== target) {
                            isConflict = true;
                            conflictTitle = `⚠️ ${fc.label}E定数エラー: ${v}名（定数: ${target}名）`;
                        }
                    } else if (fr.label === '8時') {
                        const target = 1;
                        if (v !== target) {
                            isConflict = true;
                            conflictTitle = `⚠️ ${fc.label}8時定数エラー: ${v}名（定数: ${target}名）`;
                        }
                    }

                    const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : `background:${fr.bg}; color:${fr.color};`;
                    const titleAttr = conflictTitle ? `title="${conflictTitle}"` : '';
                    const conflictCls = isConflict ? 'conflict-highlight' : '';

                    html += `<td class="${thickCls} ${conflictCls} col-day-fixed" ${titleAttr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} text-align:center; border-bottom:1px solid #cbd5e1; font-weight:${fr.bold ? '800' : '700'};">${dispV}</td>`;
                }
                html += `<td style="background:${fr.bg}; color:${fr.color}; font-weight:800; text-align:center; font-size:0.82rem;">${displayTotal}</td><td colspan="8" style="background:${fr.bg};"></td></tr>`;
            });

            // フロア間の仕切り余白行
            html += `<tr style="height:12px; background:#f8fafc;"><td colspan="${numDays + 11}" style="border:none; background:#f8fafc;"></td></tr>`;
        });

        // ==========================================
        // ★ ユーザー指示: マスターテーブル全館「集計」の表示変更（病棟6項目のみ厳選）
        // 配置順序: 3階 → 南 → 集計 → 生活期
        // ・(病棟)出勤人数合計
        // ・(病棟)実数合計
        // ・(病棟)早（定数: 11名、文字色・背景色は勤務表セルと統一）
        // ・(病棟)遅（定数: 5名、文字色・背景色は勤務表セルと統一）
        // ・(病棟)E（定数: 8名、文字色・背景色は勤務表セルと統一）
        // ・(病棟)8時（定数: 4名、文字色・背景色は勤務表セルと統一）
        // ※項目のフォント色は黒（#0f172a）、罫線はみ出し解消（width:125px）
        // ==========================================
        // 1. (病棟)出勤人数合計
        html += `<tr style="background:#f1f5f9; font-weight:700; border-top: 3px solid #334155;">
            <th class="sticky-col-1" rowspan="6" style="background:#e2e8f0; color:#0f172a; font-size:1.05rem; font-weight:900; vertical-align:middle; text-align:center; border-right:1px solid #cbd5e1; width:44px; min-width:44px; max-width:44px;">集計</th>
            <td class="sticky-col-2" style="background:#f8fafc; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">(病棟)出勤人数合計</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:#f8fafc; color:#0f172a; font-weight:800; font-size:0.95rem; border-bottom:1px solid #cbd5e1; text-align:center;">${grandTotal[d]}</td>`;
        }
        html += `<td colspan="9" style="background:#f8fafc;"></td></tr>`;

        // 2. (病棟)実数合計
        html += `<tr style="background:#f8fafc; font-weight:700;">
            <td class="sticky-col-2" style="background:#f8fafc; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">(病棟)実数合計</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:#f8fafc; color:#0f172a; font-weight:800; font-size:0.95rem; border-bottom:1px solid #cbd5e1; text-align:center;">${Number(grandReal[d].toFixed(1))}</td>`;
        }
        html += `<td colspan="9" style="background:#f8fafc;"></td></tr>`;

        // 3. (病棟)早（全館定数: 11名、背景:#fef08a, 文字色:#854d0e）
        html += `<tr style="background:#f8fafc; font-weight:700;">
            <td class="sticky-col-2" style="background:#f8fafc; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">(病棟)早</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const cnt = grandEarly[d];
            const isConflict = (cnt !== 11);
            const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : 'background:#fef08a; color:#854d0e;';
            const titleStr = isConflict ? `title="⚠️ 全館早番定数エラー: ${cnt}名（定数: 11名）"` : '';
            html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:800; border-bottom:1px solid #cbd5e1; text-align:center;">${cnt}</td>`;
        }
        html += `<td colspan="9" style="background:#f8fafc;"></td></tr>`;

        // 4. (病棟)遅（全館定数: 5名、背景:#a5f3fc, 文字色:#164e63）
        html += `<tr style="background:#f8fafc; font-weight:700;">
            <td class="sticky-col-2" style="background:#f8fafc; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">(病棟)遅</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const cnt = grandLate[d];
            const isConflict = (cnt !== 5);
            const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : 'background:#a5f3fc; color:#164e63;';
            const titleStr = isConflict ? `title="⚠️ 全館遅番定数エラー: ${cnt}名（定数: 5名）"` : '';
            html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:800; border-bottom:1px solid #cbd5e1; text-align:center;">${cnt}</td>`;
        }
        html += `<td colspan="9" style="background:#f8fafc;"></td></tr>`;

        // 5. (病棟)E（全館定数: 8名、背景:#fbcfe8, 文字色:#831843）
        html += `<tr style="background:#f8fafc; font-weight:700;">
            <td class="sticky-col-2" style="background:#f8fafc; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">(病棟)E</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const cnt = grandEve[d];
            const isConflict = (cnt !== 8);
            const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : 'background:#fbcfe8; color:#831843;';
            const titleStr = isConflict ? `title="⚠️ 全館E定数エラー: ${cnt}名（定数: 8名）"` : '';
            html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:800; border-bottom:1px solid #cbd5e1; text-align:center;">${cnt}</td>`;
        }
        html += `<td colspan="9" style="background:#f8fafc;"></td></tr>`;

        // 6. (病棟)8時（全館定数: 4名、背景:#dcfce7, 文字色:#166534）
        html += `<tr style="background:#f8fafc; font-weight:700; border-bottom:3px solid #334155;">
            <td class="sticky-col-2" style="background:#f8fafc; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">(病棟)8時</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const cnt = grandH8[d];
            const isConflict = (cnt !== 4);
            const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : 'background:#dcfce7; color:#166534;';
            const titleStr = isConflict ? `title="⚠️ 全館8時定数エラー: ${cnt}名（定数: 4名）"` : '';
            html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:800; border-bottom:1px solid #cbd5e1; text-align:center;">${cnt}</td>`;
        }
        html += `<td colspan="9" style="background:#f8fafc;"></td></tr>`;

        // フロア間の仕切り余白行
        html += `<tr style="height:14px; background:#f8fafc;"><td colspan="${numDays + 11}" style="border:none; background:#f8fafc;"></td></tr>`;

        // ==========================================
        // ★ ユーザー指示: 生活期テーブル（集計の下に配置、他フロアと構造・UI統一）
        // 順序: 3階 → 南 → 集計 → 生活期
        // ・縦結合「生活期」セル（rowspan="6"）
        // ・サマリー6項目: 訪問出勤人数合計, 訪問実数合計, 通所出勤人数合計, 通所実数合計, 訪問8時, ⚡表示するボタン
        // ・表示するボタン位置: サマリー最下端行の sticky-col-2 に配置
        // ・項目フォント色: 黒（#0f172a）
        // ・人数集計: lifeMaster とスタッフプロパティ・名前から100%正確に集計
        // ==========================================
        const isLifeExp = masterExpandedFloors.has('life');
        const lifeFc = { id: 'life', label: '生活期', bg: '#f0fdfa', headerBg: '#ccfbf1', border: '#5eead4', badgeColor: '#0f766e' };

        // 生活期の最新スタッフデータとグリッドを正確に集約計算
        const lifeRawStaffList = (lifeData && Array.isArray(lifeData.staffList) && lifeData.staffList.length > 0) ? lifeData.staffList : (Array.isArray(lifeMaster) ? lifeMaster : []);
        const lifeGrid = (lifeData && Array.isArray(lifeData.outputGrid)) ? lifeData.outputGrid : [];

        // lifeMaster から属性（lifeSection, haSection, isZeroCount, isHalf, isUnused）を補正統合
        const lifeStaffList = lifeRawStaffList.map(st => {
            const copy = { ...st };
            const ms = (Array.isArray(lifeMaster)) ? lifeMaster.find(m => m.id === st.id || m.name === st.name) : null;
            if (ms) {
                if (!copy.lifeSection && ms.lifeSection) copy.lifeSection = ms.lifeSection;
                if (!copy.haSection && ms.haSection) copy.haSection = ms.haSection;
                if (copy.isZeroCount === undefined && ms.isZeroCount !== undefined) copy.isZeroCount = ms.isZeroCount;
                if (copy.isHalf === undefined && ms.isHalf !== undefined) copy.isHalf = ms.isHalf;
                if (copy.isUnused === undefined && ms.isUnused !== undefined) copy.isUnused = ms.isUnused;
            }
            // 名前からのフォールバック補正
            const name = copy.name || '';
            if (!copy.lifeSection) {
                if (name.includes('訪問')) copy.lifeSection = '訪問';
                else if (name.includes('通所')) copy.lifeSection = '通所';
                else if (name.includes('クラーク')) copy.lifeSection = 'Cl2';
                else if (name.includes('ハーフ')) copy.lifeSection = '通所';
            }
            if (!copy.haSection && name.includes('ハ')) {
                if (name.includes('南')) copy.haSection = 'ハ南';
                else if (name.includes('3')) copy.haSection = 'ハ3';
            }
            return copy;
        });

        const lifeVWorkCounts = new Array(numDays).fill(0);
        const lifeVRealCounts = new Array(numDays).fill(0);
        const lifeTWorkCounts = new Array(numDays).fill(0);
        const lifeTRealCounts = new Array(numDays).fill(0);
        const lifeH8Counts = new Array(numDays).fill(0);

        lifeStaffList.forEach((st, sIdx) => {
            if (st.isUnused) return;
            const row = (lifeGrid && lifeGrid[sIdx]) ? lifeGrid[sIdx] : (st.days || []);
            const sec = st.lifeSection || '';
            const ha = st.haSection || '';
            const name = st.name || '';
            const isVisit = (sec === '訪問') || name.includes('訪問');
            const isTsusho = (sec === '通所') || (sec === 'Cl2') || (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') || name.includes('通所') || name.includes('ハーフ') || name.includes('クラーク');

            for (let d = 0; d < numDays; d++) {
                const cell = row[d];
                const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                if (!sym || isHolidaySymbol(sym) || sym === 'ー') continue;

                if (isVisit) {
                    lifeVWorkCounts[d]++;
                    let vWeight = (st.isZeroCount || sym === '出張') ? 0.0 : (st.isHalf || sym.includes('/') ? 0.5 : 1.0);
                    lifeVRealCounts[d] += vWeight;
                }
                if (isTsusho) {
                    lifeTWorkCounts[d]++;
                    let tWeight = (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : ((st.isZeroCount || sym === '出張') ? 0.0 : (st.isHalf || sym.includes('/') ? 0.5 : 1.0));
                    lifeTRealCounts[d] += tWeight;
                }
                if (sym === '8時') {
                    lifeH8Counts[d]++;
                }
            }
        });

        // 生活期 テーブルヘッダー1: 日付ヘッダー（他フロアと完全統一）
        html += `<tr class="floor-boundary-row" style="background:${lifeFc.headerBg}; font-weight:700;">
            <th class="sticky-col-1" style="background:${lifeFc.headerBg}; color:${lifeFc.badgeColor}; width:44px; min-width:44px; max-width:44px; text-align:center; padding:2px; border-right:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important;">階</th>
            <th class="sticky-col-2" style="background:${lifeFc.headerBg}; color:#1e293b; width:125px; min-width:125px; max-width:125px; text-align:left; padding:2px 4px; border-right:2px solid #475569; border-top: 4px solid #334155 !important;">項目</th>`;
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const thickCls = getDayBorderClass(d);
            html += `<th class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${lifeFc.headerBg}; font-size:0.78rem; padding:4px 2px; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; text-align:center; white-space:nowrap;">${di.m}/${di.day}</th>`;
        }
        html += `
            <th title="出勤日数" style="background:${lifeFc.headerBg}; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">出勤</th>
            <th title="公休日数" style="background:${lifeFc.headerBg}; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">公休</th>
            <th title="有給休暇日数" style="background:${lifeFc.headerBg}; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem; font-weight:800;">有休</th>
            <th title="リフレッシュ休暇日数" style="background:${lifeFc.headerBg}; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; width:38px; min-width:38px; text-align:center; font-size:0.75rem;">リフ</th>
            <th title="早番回数" style="background:${lifeFc.headerBg}; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">早</th>
            <th title="遅番回数" style="background:${lifeFc.headerBg}; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">遅</th>
            <th title="イブニング回数" style="background:${lifeFc.headerBg}; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">E</th>
            <th title="8時開始回数" style="background:${lifeFc.headerBg}; color:#1e293b; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important; width:32px; min-width:32px; text-align:center; font-size:0.75rem;">8時</th>
            <th style="background:${lifeFc.headerBg}; color:${lifeFc.badgeColor}; min-width:160px; max-width:260px; font-size:0.8rem; text-align:center; border-bottom:1px solid ${lifeFc.border}; border-top: 4px solid #334155 !important;">備考（メモ）</th>
        </tr>`;

        // 生活期 テーブルヘッダー2: 曜日ヘッダー
        html += `<tr style="background:${lifeFc.headerBg}; font-weight:700;">
            <th class="sticky-col-1" style="background:${lifeFc.headerBg}; border-right:1px solid ${lifeFc.border}; width:44px; min-width:44px; max-width:44px;"></th>
            <th class="sticky-col-2" style="background:${lifeFc.headerBg}; border-right:2px solid #475569; width:125px; min-width:125px; max-width:125px;"></th>`;
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const thickCls = getDayBorderClass(d);
            const wColor = di.wIdx === 5 ? '#2563eb' : ((di.wIdx === 6 || di.isHoliday) ? '#dc2626' : '#334155');
            const wBg = di.wIdx === 5 ? '#eff6ff' : ((di.wIdx === 6 || di.isHoliday) ? '#fef2f2' : lifeFc.headerBg);
            html += `<th class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${wBg}; color:${wColor}; font-size:0.8rem; padding:2px; border-bottom:1px solid ${lifeFc.border}; text-align:center;">${di.weekday}</th>`;
        }
        html += `<th colspan="9" style="background:${lifeFc.headerBg}; border-bottom:1px solid ${lifeFc.border};"></th></tr>`;

        // 生活期 サマリー行1: 訪問出勤人数合計（sticky-col-1 に rowspan="6" で「生活期」を縦書き配置！）
        const lifeVWorkSum = lifeVWorkCounts.reduce((a, b) => a + b, 0);
        html += `<tr style="background:${lifeFc.bg}; font-weight:700;">
            <td class="sticky-col-1" rowspan="6" style="background:${lifeFc.headerBg}; color:${lifeFc.badgeColor}; font-size:1.05rem; font-weight:800; vertical-align:middle; text-align:center; border-right:1px solid ${lifeFc.border}; width:44px; min-width:44px; max-width:44px; line-height:1.3;">
                <div style="writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 3px; margin: 0 auto; display: inline-block;">生活期</div>
            </td>
            <td class="sticky-col-2" style="background:${lifeFc.bg}; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">訪問出勤人数合計</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${lifeFc.bg}; color:#0369a1; font-weight:800; border-bottom:1px solid ${lifeFc.border}; text-align:center;">${lifeVWorkCounts[d]}</td>`;
        }
        html += `<td style="background:${lifeFc.bg}; color:#0369a1; font-weight:800; text-align:center; font-size:0.85rem;">${lifeVWorkSum}</td><td colspan="8" style="background:${lifeFc.bg};"></td></tr>`;

        // 生活期 サマリー行2: 訪問実数合計
        const lifeVRealSum = lifeVRealCounts.reduce((a, b) => a + b, 0);
        const dispVRealSum = (lifeVRealSum % 1 === 0) ? lifeVRealSum : lifeVRealSum.toFixed(1);
        html += `<tr style="background:${lifeFc.bg}; font-weight:700;">
            <td class="sticky-col-2" style="background:${lifeFc.bg}; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">訪問実数合計</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const v = lifeVRealCounts[d];
            const dispV = (v > 0) ? (v % 1 === 0 ? v : v.toFixed(1)) : v;
            html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${lifeFc.bg}; color:#0284c7; font-weight:800; border-bottom:1px solid ${lifeFc.border}; text-align:center;">${dispV}</td>`;
        }
        html += `<td style="background:${lifeFc.bg}; color:#0284c7; font-weight:800; text-align:center; font-size:0.85rem;">${dispVRealSum}</td><td colspan="8" style="background:${lifeFc.bg};"></td></tr>`;

        // 生活期 サマリー行3: 通所出勤人数合計
        const lifeTWorkSum = lifeTWorkCounts.reduce((a, b) => a + b, 0);
        html += `<tr style="background:${lifeFc.bg}; font-weight:700;">
            <td class="sticky-col-2" style="background:${lifeFc.bg}; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">通所出勤人数合計</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${lifeFc.bg}; color:#854d0e; font-weight:800; border-bottom:1px solid ${lifeFc.border}; text-align:center;">${lifeTWorkCounts[d]}</td>`;
        }
        html += `<td style="background:${lifeFc.bg}; color:#854d0e; font-weight:800; text-align:center; font-size:0.85rem;">${lifeTWorkSum}</td><td colspan="8" style="background:${lifeFc.bg};"></td></tr>`;

        // 生活期 サマリー行4: 通所実数合計
        const lifeTRealSum = lifeTRealCounts.reduce((a, b) => a + b, 0);
        const dispTRealSum = (lifeTRealSum % 1 === 0) ? lifeTRealSum : lifeTRealSum.toFixed(1);
        html += `<tr style="background:${lifeFc.bg}; font-weight:700;">
            <td class="sticky-col-2" style="background:${lifeFc.bg}; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">通所実数合計</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const v = lifeTRealCounts[d];
            const dispV = (v > 0) ? (v % 1 === 0 ? v : v.toFixed(1)) : v;
            html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${lifeFc.bg}; color:#b45309; font-weight:800; border-bottom:1px solid ${lifeFc.border}; text-align:center;">${dispV}</td>`;
        }
        html += `<td style="background:${lifeFc.bg}; color:#b45309; font-weight:800; text-align:center; font-size:0.85rem;">${dispTRealSum}</td><td colspan="8" style="background:${lifeFc.bg};"></td></tr>`;

        // 生活期 サマリー行5: 訪問8時
        const lifeH8Sum = lifeH8Counts.reduce((a, b) => a + b, 0);
        html += `<tr style="background:${lifeFc.bg}; font-weight:700;">
            <td class="sticky-col-2" style="background:${lifeFc.bg}; color:#0f172a !important; border-right:2px solid #475569; font-weight:800; font-size:0.85rem; width:125px; min-width:125px; max-width:125px; padding:2px 4px; white-space:nowrap;">訪問8時</td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            const di = term.dates[d];
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            const cnt = lifeH8Counts[d];
            const needH8 = isWeekend ? 0 : 1;
            const isConflict = (cnt !== needH8);
            const bgStyle = isConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : `background:${lifeFc.bg}; color:#059669;`;
            const titleStr = isConflict ? `title="⚠️ 訪問8時定数エラー: ${cnt}名（定数: ${needH8}名）"` : '';
            html += `<td class="${thickCls} col-day-fixed ${isConflict ? 'conflict-highlight' : ''}" ${titleStr} style="width:52px; min-width:52px; max-width:52px; ${bgStyle} font-weight:800; border-bottom:1px solid ${lifeFc.border}; text-align:center;">${cnt}</td>`;
        }
        html += `<td style="background:${lifeFc.bg}; color:#059669; font-weight:800; text-align:center; font-size:0.85rem;">${lifeH8Sum}</td><td colspan="8" style="background:${lifeFc.bg};"></td></tr>`;

        // 生活期 サマリー行6: 「⚡表示する」トグルボタン行（他フロアと完全統一して sticky-col-2 に配置！）
        html += `<tr style="background:${lifeFc.bg}; border-bottom: 2px solid ${lifeFc.border};">
            <td class="sticky-col-2" style="background:${lifeFc.bg}; border-right:2px solid #475569; padding:4px 6px; width:125px; min-width:125px; max-width:125px;">
                <button type="button" class="btn btn-outline toggle-master-floor-btn" data-floor="life" style="width:100%; font-size:0.75rem; padding:2px 6px; font-weight:700; background:${isLifeExp ? '#f1f5f9' : '#ffffff'}; color:${lifeFc.badgeColor}; border-color:${lifeFc.border}; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor:pointer;">
                    ${isLifeExp ? '▲折りたたむ' : '⚡表示する'}
                </button>
            </td>`;
        for (let d = 0; d < numDays; d++) {
            const thickCls = getDayBorderClass(d);
            html += `<td class="${thickCls} col-day-fixed" style="width:52px; min-width:52px; max-width:52px; background:${lifeFc.bg}; border-bottom:2px solid ${lifeFc.border};"></td>`;
        }
        html += `<td colspan="9" style="background:${lifeFc.bg};"></td></tr>`;

        // 生活期スタッフ詳細行（isLifeExpのとき展開表示、master-editable-cellで直接微修正可能！）
        if (lifeStaffList.length === 0) {
            html += `<tr class="master-detail-row master-detail-life" style="display:${isLifeExp ? 'table-row' : 'none'}; background:#ffffff;">
                <td class="sticky-col-1" style="background:#f8fafc; color:#64748b; font-size:0.75rem; text-align:center; border-right:1px solid #cbd5e1;">-</td>
                <td class="sticky-col-2" style="background:#ffffff; color:#94a3b8; font-size:0.8rem; text-align:left; border-right:2px solid #475569; padding-left:8px;">※生活期のデータは未保存です</td>
                <td colspan="${numDays + 9}" style="background:#ffffff; color:#94a3b8; font-size:0.8rem; text-align:center; border-bottom:1px solid #e2e8f0;">-</td>
            </tr>`;
        }

        lifeStaffList.forEach((s, sIdx) => {
            if (s.isUnused) return;
            const sec = s.lifeSection || (s.haSection || '訪問');
            const row = (lifeGrid && lifeGrid[sIdx]) ? lifeGrid[sIdx] : (s.days || []);
            const secBadgeBg = sec === '訪問' ? '#e0f2fe' : (sec === '通所' ? '#fef3c7' : (sec === 'Cl1' || sec === 'Cl2' ? '#ffedd5' : '#d1fae5'));
            const secBadgeColor = sec === '訪問' ? '#0369a1' : (sec === '通所' ? '#92400e' : (sec === 'Cl1' || sec === 'Cl2' ? '#c2410c' : '#065f46'));

            html += `<tr class="master-detail-row master-detail-life" style="display:${isLifeExp ? 'table-row' : 'none'}; background:#ffffff;">
                <td class="sticky-col-1" style="background:${secBadgeBg}; color:${secBadgeColor}; font-size:0.75rem; font-weight:700; text-align:center; border-right:1px solid #cbd5e1;">${sec}</td>
                <td class="sticky-col-2" style="background:#ffffff; font-weight:600; text-align:left; border-right:2px solid #475569; padding-left:8px;">${escapeHtmlText(s.name)}</td>`;

            let sWork = 0, sOff = 0, sPaid = 0, sRef = 0, sEarly = 0, sLate = 0, sEve = 0, sH8 = 0;
            const isZero = !!(s.isZeroCount || s.lifeSection === '管理' || s.lifeSection === 'Cl1');

            // ★ ユーザー指示: マスターテーブルリアルタイム制約チェック実行（生活期スタッフ）
            const sRowSyms = [];
            for (let d = 0; d < numDays; d++) {
                const c = row ? row[d] : null;
                sRowSyms.push((c && typeof c === 'object') ? (c.symbol || '') : (c || ''));
            }
            const sCheck = evaluateStaffScheduleRow(s, sRowSyms, term.dates);
            if (sCheck.errors && sCheck.errors.length > 0) {
                allMasterErrors.push(...sCheck.errors);
            }

            for (let d = 0; d < numDays; d++) {
                const thickCls = getDayBorderClass(d);
                const cell = row ? row[d] : null;
                const sym = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                if (sym) {
                    if (sym === '休') sOff += 1.0;
                    else if (isPaidHolidaySymbol(sym)) sPaid += 1.0;
                    else if (isRefreshHolidaySymbol(sym)) sRef += 1.0;
                    else if (sym === '早' || sym === 'ハヤ') { sEarly++; if (!isZero) sWork += 1.0; }
                    else if (sym === '遅') { sLate++; if (!isZero) sWork += 1.0; }
                    else if (sym === 'E') { sEve++; if (!isZero) sWork += 1.0; }
                    else if (sym === '8時') { sH8++; if (!isZero) sWork += 1.0; }
                    else if (isWorkSymbol(sym)) { if (!isZero) sWork += 1.0; }
                }

                const originalWish = (s.days && s.days[d]) ? s.days[d] : '';
                const isRefCell = isRefreshHolidaySymbol(sym) || isRefreshHolidaySymbol(originalWish);
                const isCellFixed = !isRefCell && !!((originalWish !== '' && originalWish === sym) || (cell && typeof cell === 'object' && cell.isFixed && originalWish !== ''));
                const color = isCellFixed ? '#dc2626' : (isRefCell ? '#0f172a' : '#334155');
                let specialCls = '';
                if (sym === '早') specialCls = ' cell-special-early';
                else if (sym === '遅') specialCls = ' cell-special-late';
                else if (sym === 'E') specialCls = ' cell-special-eve';

                // ★ ユーザー指示: 制約違反セル（連勤10や週休2日違反、特殊勤務翌日休違反等）に青い網掛け（.conflict-highlight）を適用
                const hasConflict = !!(sCheck.dayConflicts && sCheck.dayConflicts[d] && sCheck.dayConflicts[d].length > 0);
                const conflictCls = hasConflict ? ' conflict-highlight' : '';
                const conflictReasons = hasConflict ? sCheck.dayConflicts[d].join(' / ') : '';
                const conflictTitle = hasConflict ? `⚠️ 【制約違反】${conflictReasons}` : '';
                const titleText = conflictTitle || (isCellFixed ? '🔒 事前固定希望枠（赤字・クリックで修正可能）' : 'システム自動配置（クリックで修正可能）');
                const bgStyle = (hasConflict || sym === '早' || sym === '遅' || sym === 'E') ? '' : 'background:#ffffff;';

                const fixedCls = isCellFixed ? 'fixed-cell' : (isRefCell ? 'auto-ref-cell' : 'auto-cell');

                html += `<td class="${thickCls} ${fixedCls}${specialCls}${conflictCls} master-editable-cell col-day-fixed" data-sym="${sym}" data-floor="life" data-is-st="0" data-is-ha="0" data-staff-id="${s.id || ''}" data-staff-name="${escapeHtmlText(s.name)}" data-day="${d}" data-conflict-reason="${escapeHtmlText(conflictReasons)}" title="${escapeHtmlText(titleText)}" style="width:52px; min-width:52px; max-width:52px; ${bgStyle} color:${color}; font-weight:700; border-bottom:1px solid #e2e8f0; text-align:center; cursor:pointer;">${sym}</td>`;
            }

            const isOffConflict = (!s.isUnused && !isZero && Number(sOff.toFixed(1)) !== 8);
            if (isOffConflict) {
                allMasterErrors.push(`【${s.name}】公休日数が8日ではありません（現在:${Number(sOff.toFixed(1))}日 / 定数:8日）。`);
            }
            const offCls = isOffConflict ? 'conflict-highlight' : '';
            const offStyle = isOffConflict ? 'background:#dbeafe !important; color:#1d4ed8 !important;' : 'background:#ffffff; color:#1e293b;';
            const offTitle = isOffConflict ? `title="⚠️ 公休が8日ではありません（現在:${Number(sOff.toFixed(1))}日 / 定数:8日）"` : 'title="公休8日"';

            html += `
                <td class="stat-cell" style="font-weight:700; text-align:center; background:#ffffff; color:#1e293b; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${Number(sWork.toFixed(1))}</td>
                <td class="stat-cell ${offCls}" ${offTitle} style="font-weight:700; text-align:center; ${offStyle} border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${Number(sOff.toFixed(1))}</td>
                <td class="stat-cell" style="font-weight:800; text-align:center; background:#ffffff; color:#1e293b; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${Number(sPaid.toFixed(1))}</td>
                <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#1e293b; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${Number(sRef.toFixed(1))}</td>
                <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#334155; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${sEarly}</td>
                <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#334155; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${sLate}</td>
                <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#334155; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${sEve}</td>
                <td class="stat-cell" style="font-weight:600; text-align:center; background:#ffffff; color:#334155; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">${sH8}</td>
                <td class="remarks-cell" style="background:#ffffff; color:#475569; font-size:0.78rem; text-align:left; padding:2px 8px; border-bottom:1px solid #e2e8f0; white-space:normal; word-break:break-all;">${escapeHtmlText(s.remarks || '')}</td>
            </tr>`;
        });

        checkTbody.innerHTML = html;

        // ★ ユーザー指示: マスターテーブル上部のアラートバナーに制約指摘事項を表示
        const masterBanner = document.getElementById('checkConflictAlertBanner');
        if (masterBanner) {
            if (allMasterErrors.length > 0) {
                masterBanner.classList.add('show');
                const errorListHtml = allMasterErrors.slice(0, 10).map(err => `<li style="margin-bottom:2px;">${err}</li>`).join('');
                const moreMsg = allMasterErrors.length > 10 ? `<li style="color:#64748b; font-style:italic;">...他 ${allMasterErrors.length - 10} 件の指摘事項</li>` : '';
                masterBanner.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                        <div style="display:flex; align-items:flex-start; gap:10px;">
                            <span style="font-size:1.4rem;">⚠️</span>
                            <div>
                                <strong style="color:#1e3a8a; font-size:0.95rem;">
                                    マスターテーブル制約チェック: ${allMasterErrors.length}件の指摘事項（青い網掛けセル）
                                </strong>
                                <div style="font-size:0.82rem; color:#2563eb; margin: 3px 0 6px 0;">
                                    該当セルをクリックまたはコピペで勤務や休日を修正してください。条件が解決すると網掛けは自動的に消えます。（最終判断としてこのまま保存・印刷することも可能です）
                                </div>
                                <ul style="font-size:0.8rem; color:#1e293b; margin:0; padding-left:18px; max-height:130px; overflow-y:auto;">
                                    ${errorListHtml}
                                    ${moreMsg}
                                </ul>
                            </div>
                        </div>
                        <button class="btn btn-outline" style="font-size:0.75rem; padding:4px 10px; margin-left:12px; white-space:nowrap;" onclick="document.getElementById('checkConflictAlertBanner').classList.remove('show');">閉じる</button>
                    </div>
                `;
            } else {
                masterBanner.classList.remove('show');
                masterBanner.innerHTML = '';
            }
        }

        // トグルボタンのイベントリスナー付与（masterExpandedFloorsに展開状態を記録し、再描画時も100%維持）
        document.querySelectorAll('.toggle-master-floor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const floorId = btn.dataset.floor;
                const isCurrentlyHidden = !masterExpandedFloors.has(floorId);
                if (isCurrentlyHidden) {
                    masterExpandedFloors.add(floorId);
                } else {
                    masterExpandedFloors.delete(floorId);
                }
                const rows = document.querySelectorAll(`.master-detail-${floorId}`);
                rows.forEach(r => {
                    r.style.display = isCurrentlyHidden ? 'table-row' : 'none';
                });
                btn.innerHTML = isCurrentlyHidden ? '▲折りたたむ' : '⚡表示する';
                btn.style.background = isCurrentlyHidden ? '#f1f5f9' : '#ffffff';
            });
        });

        // ★ 添付1準拠: マスターテーブル上で展開されたスタッフのセルを記号パレットまたはコピペで直接修正可能に！
        document.querySelectorAll('.master-editable-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                // ★ ユーザー指示: コピペモード時は選択枠を付与してCtrl+C/Ctrl+Vの準備（誤上書き防止）
                if (isCopyMode) {
                    if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                    selectedCopyCell = cell;
                    cell.classList.add('copy-selected-cell');
                    cell.focus();
                    return;
                }

                // 選択されているパレット記号を取得（チェック画面パレット優先、なければ入力画面パレット）
                const activeCheckBtn = document.querySelector('.check-palette-btn.selected');
                const activeInpBtn = document.querySelector('.palette-btn.selected');
                let selectedSym = activeCheckBtn ? activeCheckBtn.dataset.sym : (activeInpBtn ? activeInpBtn.dataset.sym : null);

                if (!selectedSym && selectedSym !== '') {
                    showToast('⚠️ 上部の記号パレットから変更したい記号（休、有、○など）を選択してください');
                    return;
                }

                if (selectedSym === 'CLEAR') selectedSym = '';
                updateMasterIntegrationCell(cell, selectedSym);
            });
        });

        // ★ マスターテーブル「📈 勤務分析・平準化ダッシュボード」に全館統合統計を反映！
        const masterRefBreakdown = [];
        allRefSyms.forEach(sym => {
            const item = masterRefBreakdownMap[sym];
            if (item && item.days > 0) {
                masterRefBreakdown.push({
                    symbol: item.symbol,
                    days: item.days,
                    staffCount: item.staffSet.size
                });
            }
        });

        const masterDaily = [];
        for (let d = 0; d < numDays; d++) {
            masterDaily.push({
                day: d + 1,
                totalWork: grandTotal[d],
                realWork: Number(grandReal[d].toFixed(1)),
                early: grandEarly[d],
                late: grandLate[d],
                eve: grandEve[d],
                h8: grandH8[d],
                sectionWork: { 'ST': 1 } // 二重加算防止フラグ
            });
        }

        const masterStats = {
            daily: masterDaily,
            staffStats: allMasterStaffStats,
            refBreakdown: masterRefBreakdown
        };

        renderStatsDashboard(masterStats);
        updateUndoRedoUI();

        // ★ ユーザー指示: マスターテーブル最新確定最終7日データを自動集約・保存
        // （次ターム作成時に各階がマスターテーブルで微調整された最新実績を引っ張れるようにする）
        if (typeof saveMasterConfirmedLast7Days === 'function') {
            saveMasterConfirmedLast7Days(curStartDate);
        }
    }

    // ★ 添付1要件: 修正作業エリア／最終チェックでのSTセル直接修正
    function handleStCellEdit(cell) {
        const stId = cell.dataset.stId;
        const stIdx = parseInt(cell.dataset.stIdx, 10);
        const d = parseInt(cell.dataset.d, 10);
        let newSym = getActivePaletteSymbol(true);
        const activePaletteBtn = document.querySelector('.output-palette-btn.selected, .check-palette-btn.selected');
        if (activePaletteBtn && activePaletteBtn.dataset.sym !== undefined) {
            newSym = activePaletteBtn.dataset.sym;
        }
        if (newSym === 'CLEAR') newSym = '';

        const curStartDate = document.getElementById('masterTermSelect')?.value || document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        const stKey = `shift_schedule_st_term_${curStartDate}`;
        let stData = null;
        try {
            const raw = localStorage.getItem(stKey);
            if (raw) stData = JSON.parse(raw);
        } catch (e) {}

        if (!stData) {
            stData = {
                staffList: (linkedStStaffData && linkedStStaffData.staffList) ? linkedStStaffData.staffList : [],
                outputGrid: (linkedStStaffData && linkedStStaffData.grid) ? linkedStStaffData.grid : []
            };
        }

        let targetIdx = -1;
        if (stData.staffList && Array.isArray(stData.staffList)) {
            targetIdx = stData.staffList.findIndex(s => (stId && String(s.id) === String(stId)));
        }
        if (targetIdx === -1) targetIdx = stIdx;

        if (!stData.outputGrid) stData.outputGrid = [];
        if (!stData.outputGrid[targetIdx]) {
            stData.outputGrid[targetIdx] = new Array(NUM_DAYS).fill(null).map(() => ({ symbol: '', isFixed: false }));
        }

        const curCell = stData.outputGrid[targetIdx][d];
        const oldSym = (curCell && typeof curCell === 'object') ? (curCell.symbol || '') : (curCell || '');
        const isFixed = (curCell && typeof curCell === 'object') ? !!curCell.isFixed : false;

        if (newSym === 'P') {
            pushHistory();
            stData.outputGrid[targetIdx][d] = { symbol: oldSym || '○', isFixed: !isFixed };
            localStorage.setItem(stKey, JSON.stringify(stData));
            loadLinkedSTData();
            renderOutputTable(lastSolveResult ? lastSolveResult.grid : [], lastSolveResult ? lastSolveResult.stats : null);
            showToast(`🛡️ STスタッフの保護を${!isFixed ? '設定' : '解除'}しました`);
            return;
        }

        if (oldSym === newSym) return;

        pushHistory();
        stData.outputGrid[targetIdx][d] = { symbol: newSym, isFixed: isFixed };
        localStorage.setItem(stKey, JSON.stringify(stData));
        loadLinkedSTData();
        if (lastScheduler) {
            lastScheduler.stDailyWork = getLinkedSTDailyWork();
            lastScheduler.stDailyHeadCount = getLinkedSTDailyHeadCount();
            lastScheduler.stDailyFtWork = getLinkedSTDailyFtWork();
            lastScheduler.stDailyEarly = getLinkedSTDailyEarly();
            lastScheduler.stDailyLate = getLinkedSTDailyLate();
            lastScheduler.stDailyEve = getLinkedSTDailyEve();
            lastScheduler.stFloorFtCount = getLinkedSTFloorFtCount();
            const newStats = lastScheduler.calculateStats();
            if (lastSolveResult) lastSolveResult.stats = newStats;
            renderOutputTable(lastSolveResult ? lastSolveResult.grid : [], newStats);
            renderStatsDashboard(newStats);
        } else {
            renderOutputTable(lastSolveResult ? lastSolveResult.grid : [], lastSolveResult ? lastSolveResult.stats : null);
        }
        showToast(`✏️ STスタッフの勤務を「${newSym || '消去'}」に修正しました`);
    }

    // ★ 添付1要件: 修正作業エリア／最終チェックでのハーフマンセル直接修正
    function handleHaCellEdit(cell) {
        const haId = cell.dataset.haId;
        const haIdx = parseInt(cell.dataset.haIdx, 10);
        const d = parseInt(cell.dataset.d, 10);
        let newSym = getActivePaletteSymbol(true);
        const activePaletteBtn = document.querySelector('.output-palette-btn.selected, .check-palette-btn.selected');
        if (activePaletteBtn && activePaletteBtn.dataset.sym !== undefined) {
            newSym = activePaletteBtn.dataset.sym;
        }
        if (newSym === 'CLEAR') newSym = '';

        const curStartDate = document.getElementById('masterTermSelect')?.value || document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';
        const lifeKey = `shift_schedule_life_term_${curStartDate}`;
        let lifeData = null;
        try {
            const raw = localStorage.getItem(lifeKey);
            if (raw) lifeData = JSON.parse(raw);
        } catch (e) {}

        if (!lifeData) {
            lifeData = {
                staffList: (linkedLifeStaffData && linkedLifeStaffData.staffList) ? linkedLifeStaffData.staffList : [],
                outputGrid: (linkedLifeStaffData && linkedLifeStaffData.grid) ? linkedLifeStaffData.grid : []
            };
        }

        let targetIdx = -1;
        if (lifeData.staffList && Array.isArray(lifeData.staffList)) {
            targetIdx = lifeData.staffList.findIndex(s => (haId && String(s.id) === String(haId)));
        }
        if (targetIdx === -1) targetIdx = haIdx;

        if (!lifeData.outputGrid) lifeData.outputGrid = [];
        if (!lifeData.outputGrid[targetIdx]) {
            lifeData.outputGrid[targetIdx] = new Array(NUM_DAYS).fill(null).map(() => ({ symbol: '', isFixed: false }));
        }

        const curCell = lifeData.outputGrid[targetIdx][d];
        const oldSym = (curCell && typeof curCell === 'object') ? (curCell.symbol || '') : (curCell || '');
        const isFixed = (curCell && typeof curCell === 'object') ? !!curCell.isFixed : false;

        if (newSym === 'P') {
            pushHistory();
            lifeData.outputGrid[targetIdx][d] = { symbol: oldSym || '○', isFixed: !isFixed };
            localStorage.setItem(lifeKey, JSON.stringify(lifeData));
            loadLinkedLifeData();
            renderOutputTable(lastSolveResult ? lastSolveResult.grid : [], lastSolveResult ? lastSolveResult.stats : null);
            showToast(`🛡️ ハーフマンの保護を${!isFixed ? '設定' : '解除'}しました`);
            return;
        }

        if (oldSym === newSym) return;

        pushHistory();
        lifeData.outputGrid[targetIdx][d] = { symbol: newSym, isFixed: isFixed };
        localStorage.setItem(lifeKey, JSON.stringify(lifeData));
        loadLinkedLifeData();
        if (lastScheduler) {
            lastScheduler.lifeDailyWork = getLinkedLifeDailyWork();
            const newStats = lastScheduler.calculateStats();
            if (lastSolveResult) lastSolveResult.stats = newStats;
            renderOutputTable(lastSolveResult ? lastSolveResult.grid : [], newStats);
            renderStatsDashboard(newStats);
        } else {
            renderOutputTable(lastSolveResult ? lastSolveResult.grid : [], lastSolveResult ? lastSolveResult.stats : null);
        }
        showToast(`✏️ ハーフマンの勤務を「${newSym || '消去'}」に修正しました`);
    }

    // 出力シートおよびチェックシートでのセルクリックによる手動調整イベント
    function attachOutputTableEvents() {
        document.querySelectorAll('#outputTableBody .day-cell, #checkTableBody .day-cell').forEach(cell => {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', () => {
                // ★ STスタッフセルの修正（記号パレットでの直接修正）
                if (cell.dataset.isSt === '1') {
                    handleStCellEdit(cell);
                    return;
                }

                // ★ ハーフマンセルの修正（記号パレットでの直接修正）
                if (cell.dataset.isHa === '1') {
                    handleHaCellEdit(cell);
                    return;
                }

                const s = parseInt(cell.dataset.s, 10);
                const d = parseInt(cell.dataset.d, 10);
                if (!lastSolveResult || !lastSolveResult.grid) return;

                // ★ コピペモード時の処理（出力シート/修正作業エリア）:
                // ユーザー指示: セルクリックでの勝手な貼り付けは完全廃止し、セルのフォーカス選択のみ行う。
                // コピーは Ctrl+C、貼り付けは Ctrl+V のみで行う！
                if (isCopyMode) {
                    if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                    selectedCopyCell = cell;
                    cell.classList.add('copy-selected-cell');
                    return;
                }

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
                    saveCurrentTermToStorage(); // ★ 修正作業エリアでのプロテクト操作を即時自動保存！
                    return;
                }

                let newSym = getActivePaletteSymbol(true);
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
                    saveCurrentTermToStorage(); // ★ 修正作業エリアでのセル編集を即時自動保存！
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

        // 1. 「平日」と「土日祝（その他）」に完全に2区分（★実数合計 realWork を基準に表示）
        const weekdayDaily = [];
        const holidayDaily = []; // 土日祝

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = dates[d];
            let totalWork = stats.daily[d].totalWork;
            let realWork = stats.daily[d].realWork !== undefined ? stats.daily[d].realWork : totalWork;

            const alreadyHasST = stats.daily[d].sectionWork && (stats.daily[d].sectionWork['ST'] !== undefined && stats.daily[d].sectionWork['ST'] > 0);

            // ★ 所属階STスタッフの実数を合算（ソルバー集計で未加算の場合のみ）
            let stReal = 0;
            let stTotal = 0;
            if (!alreadyHasST && !isST && currentFloor && linkedStStaffData && linkedStStaffData.staffList) {
                linkedStStaffData.staffList.forEach((st, stIdx) => {
                    const row = linkedStStaffData.grid[stIdx] || [];
                    const c = row[d] || { symbol: '' };
                    const sym = c.symbol || '';
                    if (isWorkSymbol(sym)) {
                        stTotal++;
                        stReal += (st.isHalf ? 0.5 : 1.0);
                    }
                });
            }

            if (!alreadyHasST) {
                totalWork += stTotal;
                realWork = Number((realWork + stReal).toFixed(2));
            }
            stats.daily[d].stReal = stReal;
            stats.daily[d].combinedReal = realWork;

            const item = { d, totalWork, realWork, label: di.label, weekday: di.weekday, isHoliday: di.isHoliday };

            // 土曜(wIdx=5), 日曜(wIdx=6), 国民の祝日(isHoliday)
            const isWeekendOrHoliday = (di.wIdx === 5 || di.wIdx === 6 || di.isHoliday);
            if (isLife) {
                // ★ 生活期専用集計:
                // 青カード: 訪問稼働日（月〜金、祝日除く）の訪問実数
                // 赤カード: 通所稼働日（月〜土、日曜除く）の通所実数
                let visitReal = 0, visitTotal = 0;
                let tsushoReal = 0, tsushoTotal = 0;
                staffList.forEach((st, s) => {
                    if (st.isUnused) return;
                    const activeGrid = (lastSolveResult && lastSolveResult.grid) || (lastScheduler && lastScheduler.grid) || (stats && stats.grid) || [];
                    const cell = (activeGrid && activeGrid[s]) ? activeGrid[s][d] : null;
                    const sym = (cell && typeof cell === 'object') ? cell.symbol : (cell || '');
                    if (!sym || isHolidaySymbol(sym) || sym === 'ー') return;
                    const sec = st.lifeSection || '';
                    const ha = st.haSection || '';
                    if (sec === '訪問') {
                        visitTotal++;
                        visitReal += (st.isZeroCount || sym === '出張') ? 0.0 : (st.isHalf || sym.includes('/') ? 0.5 : 1.0);
                    }
                    if (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') {
                        tsushoTotal++;
                        tsushoReal += (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : ((st.isZeroCount || sym === '出張') ? 0.0 : (st.isHalf || sym.includes('/') ? 0.5 : 1.0));
                    }
                });

                // ★ ユーザー指示: 訪問・通所は祝日も平日扱い（稼働日）！
                // 訪問稼働日: 月曜日〜金曜日（土日のみ除外、祝日も通常稼働集計）
                if (di.wIdx !== 5 && di.wIdx !== 6) {
                    weekdayDaily.push({ d, totalWork: visitTotal, realWork: visitReal, label: di.label, weekday: di.weekday });
                }
                // 通所稼働日: 月曜日〜土曜日（日曜日のみ休館・除外、祝日も通常稼働集計）
                if (di.wIdx !== 6) {
                    holidayDaily.push({ d, totalWork: tsushoTotal, realWork: tsushoReal, label: di.label, weekday: di.weekday });
                }
            } else {
                if (isWeekendOrHoliday) {
                    holidayDaily.push(item);
                } else {
                    weekdayDaily.push(item);
                }
            }
        }

        // 生活期ダッシュボード専用タイトルDOM切り替え
        if (isLife) {
            const wTitleEl = document.querySelector('#statsTab .stat-card:nth-child(1) .stat-card-title span:first-child');
            if (wTitleEl) wTitleEl.textContent = '🏢 訪問稼働日（月曜日～金曜日）の実数';
            const hTitleEl = document.querySelector('#statsTab .stat-card:nth-child(2) .stat-card-title span:first-child');
            if (hTitleEl) hTitleEl.textContent = '🏥 通所稼働日（月曜日～土曜日）の実数';
        }

        // --- 平日の集計（最小・最大・平均：実数合計ベース） ---
        const weekdayBadgeEl = document.getElementById('statWeekdayBadge');
        const weekdayRangeEl = document.getElementById('statWeekdayWorkRange');
        const weekdayAvgEl = document.getElementById('statWeekdayAvgWork');

        if (weekdayDaily.length > 0) {
            const realWorks = weekdayDaily.map(item => item.realWork);
            const rMin = Math.min(...realWorks);
            const rMax = Math.max(...realWorks);
            const rSum = realWorks.reduce((a, b) => a + b, 0);
            const rAvg = (rSum / weekdayDaily.length).toFixed(1);

            const totalWorks = weekdayDaily.map(item => item.totalWork);
            const wSum = totalWorks.reduce((a, b) => a + b, 0);
            const wAvg = (wSum / weekdayDaily.length).toFixed(1);

            if (weekdayBadgeEl) weekdayBadgeEl.textContent = `${weekdayDaily.length} 日間`;
            if (weekdayRangeEl) weekdayRangeEl.textContent = `実数 ${rMin} 〜 ${rMax} 名 (ブレ幅: 実数 ${Number((rMax - rMin).toFixed(2))} 名)`;
            if (weekdayAvgEl) {
                weekdayAvgEl.innerHTML = `実数 ${rAvg} 名 <span style="font-size:0.78rem; color:#64748b; font-weight:normal;">(出勤計: ${wAvg}名)</span>`;
            }
        } else {
            if (weekdayBadgeEl) weekdayBadgeEl.textContent = '0 日間';
            if (weekdayRangeEl) weekdayRangeEl.textContent = '- 名';
            if (weekdayAvgEl) weekdayAvgEl.textContent = '- 名';
        }

        // --- 土日祝（その他）の集計（最小・最大・平均：実数合計ベース） ---
        const holidayBadgeEl = document.getElementById('statHolidayBadge');
        const holidayRangeEl = document.getElementById('statHolidayWorkRange');
        const holidayAvgEl = document.getElementById('statHolidayAvgWork');
        const sunHolSubInfoEl = document.getElementById('statSunHolSubInfo');

        if (holidayDaily.length > 0) {
            const realWorks = holidayDaily.map(item => item.realWork);
            const rMin = Math.min(...realWorks);
            const rMax = Math.max(...realWorks);
            const rSum = realWorks.reduce((a, b) => a + b, 0);
            const rAvg = (rSum / holidayDaily.length).toFixed(1);

            const totalWorks = holidayDaily.map(item => item.totalWork);
            const hSum = totalWorks.reduce((a, b) => a + b, 0);
            const hAvg = (hSum / holidayDaily.length).toFixed(1);

            if (holidayBadgeEl) holidayBadgeEl.textContent = `${holidayDaily.length} 日間`;
            if (holidayRangeEl) holidayRangeEl.textContent = `実数 ${rMin} 〜 ${rMax} 名 (ブレ幅: 実数 ${Number((rMax - rMin).toFixed(2))} 名)`;
            if (holidayAvgEl) {
                holidayAvgEl.innerHTML = `実数 ${rAvg} 名 <span style="font-size:0.78rem; color:#64748b; font-weight:normal;">(出勤計: ${hAvg}名)</span>`;
            }
            if (sunHolSubInfoEl) sunHolSubInfoEl.textContent = isLife ? `月〜土（日曜日のみ休館・祝日も通常稼働、計${holidayDaily.length}日間）` : `土曜日・日曜日・国民の祝日（計${holidayDaily.length}日間）`;
        } else {
            if (holidayBadgeEl) holidayBadgeEl.textContent = '0 日間';
            if (holidayRangeEl) holidayRangeEl.textContent = '- 名';
            if (holidayAvgEl) holidayAvgEl.textContent = '- 名';
        }

        // --- 有休 ＆ リフレッシュ休暇（上1〜上5、下1〜下3）取得合計数 ---
        const validStaffStats = stats.staffStats.filter(s => !s.isUnused);
        const totalPaidDays = validStaffStats.reduce((sum, s) => sum + s.paidDays, 0);
        const paidStaffCount = validStaffStats.filter(s => s.paidDays > 0).length;
        const totalRefDays = validStaffStats.reduce((sum, s) => sum + (s.refDays || 0), 0);
        const refStaffCount = validStaffStats.filter(s => (s.refDays || 0) > 0).length;

        const totalPaidEl = document.getElementById('statTotalPaidDays');
        const paidStaffEl = document.getElementById('statPaidStaffCount');
        if (totalPaidEl) {
            const formattedPaid = (totalPaidDays % 1 === 0) ? totalPaidDays.toFixed(0) : totalPaidDays.toFixed(1);
            const formattedRef = (totalRefDays % 1 === 0) ? totalRefDays.toFixed(0) : totalRefDays.toFixed(1);
            totalPaidEl.innerHTML = `有休 ${formattedPaid} 日 <span style="font-size:1.15rem; color:#047857; font-weight:800; margin-left:6px;">/ リフ ${formattedRef} 日</span>`;
        }
        if (paidStaffEl) {
            paidStaffEl.innerHTML = `有休 ${paidStaffCount} 名 <span style="color:#047857; font-weight:700;">/ リフ ${refStaffCount} 名</span>`;
        }

        // 当タームで取得しているリフレッシュ休暇の記号別内訳（上1、下2など）を表示
        let refDetailEl = document.getElementById('statRefBreakdownDetail');
        if (!refDetailEl && totalPaidEl && totalPaidEl.parentElement) {
            refDetailEl = document.createElement('div');
            refDetailEl.id = 'statRefBreakdownDetail';
            refDetailEl.style.cssText = 'margin-top: 6px; padding-top: 6px; border-top: 1px dashed #fed7aa; font-size: 0.8rem; color: #065f46; line-height: 1.5;';
            totalPaidEl.parentElement.appendChild(refDetailEl);
        }
        if (refDetailEl) {
            const breakdown = stats.refBreakdown || [];
            if (breakdown.length > 0) {
                const badgesHtml = breakdown.map(item =>
                    `<span style="display:inline-block; background:#ecfdf5; border:1px solid #6ee7b7; color:#047857; font-weight:700; padding:1px 7px; border-radius:9999px; margin-right:4px; margin-bottom:2px; font-size:0.76rem;">${item.symbol}: ${item.days}日 (${item.staffCount}名)</span>`
                ).join('');
                refDetailEl.innerHTML = `<div style="font-weight:700; color:#047857; margin-bottom:2px;">🌴 当ターム取得リフレッシュ休暇内訳:</div><div>${badgesHtml}</div>`;
            } else {
                refDetailEl.innerHTML = `<span style="color:#64748b;">🌴 当ターム取得リフレッシュ休暇: 0日（取得なし）</span>`;
            }
        }

        // --- 全日（期間内）の実数合計 ---
        const allDailyReal = stats.daily.map(d => d.realWork !== undefined ? d.realWork : d.totalWork);
        const allMin = Math.min(...allDailyReal);
        const allMax = Math.max(...allDailyReal);
        const allAvg = (allDailyReal.reduce((a, b) => a + b, 0) / NUM_DAYS).toFixed(1);

        const workRangeEl = document.getElementById('statWorkRange');
        const avgWorkEl = document.getElementById('statAvgWork');
        let stNote = '';
        if (isMaster) {
            stNote = ` <span style="font-size:0.75rem; color:#1e40af; font-weight:700;">(全フロア 1階・2階・3階・南・ST 統合)</span>`;
        } else if (!isST && currentFloor && linkedStStaffData && linkedStStaffData.staffList && linkedStStaffData.staffList.length > 0) {
            stNote = ` <span style="font-size:0.75rem; color:#047857; font-weight:700;">(ST所属 ${linkedStStaffData.staffList.length}名 合算中)</span>`;
        }
        if (workRangeEl) workRangeEl.innerHTML = `実数 ${allMin} 〜 ${allMax} 名 (ブレ幅: 実数 ${Number((allMax - allMin).toFixed(2))} 名)${stNote}`;
        if (avgWorkEl) avgWorkEl.innerHTML = `実数 ${allAvg} 名${stNote}`;

        // --- 特殊勤務（早・遅・E・8時）の配置累計 ---
        const totalEarly = validStaffStats.reduce((sum, s) => sum + s.early, 0);
        const totalLate = validStaffStats.reduce((sum, s) => sum + s.late, 0);
        const totalEve = validStaffStats.reduce((sum, s) => sum + s.eve, 0);
        const totalH8 = validStaffStats.reduce((sum, s) => sum + s.h8, 0);
        const specEl = document.getElementById('statSpecialCounts');
        if (specEl) {
            if (isST) {
                specEl.textContent = `早: ${totalEarly}回（各人3回割当・遅/E/8時はST対象外）`;
            } else if (isMaster) {
                specEl.textContent = `全館合計 早: ${totalEarly}回 / 遅: ${totalLate}回 / E: ${totalEve}回 / 8時: ${totalH8}回`;
            } else {
                specEl.textContent = `早: ${totalEarly}回 / 遅: ${totalLate}回 / E: ${totalEve}回 / 8時: ${totalH8}回`;
            }
        }

        // --- 日別実数合計グラフ（添付3準拠: 流動的スケール MAX最大値+10/MIN最小値-10、各病棟は+5/-5） ---
        const chartEl = document.getElementById('dailyWorkChart');
        if (chartEl) {
            let chartHtml = '';
            // ★ 流動的スケール算出: マスターテーブルは実数最小値-10〜最大値+10、病棟は-5〜+5、STは-2〜+2
            const minScale = isST ? Math.max(0, Math.floor(allMin - 2)) : (isMaster ? Math.max(0, Math.floor(allMin - 10)) : Math.max(0, Math.floor(allMin - 5)));
            const maxScale = isST ? Math.ceil(allMax + 2) : (isMaster ? Math.ceil(allMax + 10) : Math.ceil(allMax + 5));
            const range = Math.max(1, maxScale - minScale);

            // 右上の縦目盛りバッジも動的に連動更新！
            const scaleBadgeEl = document.getElementById('chartScaleBadge') || document.querySelector('#statsTab [style*="縦目盛り"]');
            if (scaleBadgeEl) {
                scaleBadgeEl.textContent = `縦目盛り: MAX ${maxScale}名 〜 MIN ${minScale}名`;
            }

            stats.daily.forEach((d, idx) => {
                const di = dates[idx];
                const dispReal = d.realWork !== undefined ? d.realWork : d.totalWork;
                let pct = 5;
                if (dispReal >= maxScale) {
                    pct = 100;
                } else if (dispReal >= minScale) {
                    pct = 5 + ((dispReal - minScale) / range) * 95;
                } else {
                    pct = Math.max(3, (dispReal / minScale) * 5);
                }
                pct = Math.min(100, Math.max(3, pct));

                let barColor = '#10b981'; // 平日: 緑 (エメラルドグリーン) ★土曜・平日を明確識別
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
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;" title="${di.label} (${di.weekday})${di.isHoliday ? ' 祝日' : ''}: 実数合計 ${dispReal}名 (出勤人数合計 ${d.totalWork}名 / スケール: ${minScale}〜${maxScale}名)">
                        <span style="font-size:0.65rem; font-weight:700; color:#1e293b; white-space:nowrap;"><span style="font-size:0.55rem; color:#475569; font-weight:600;">実数</span>${dispReal}</span>
                        <div style="width:100%; background:#f1f5f9; height:110px; border-radius:4px; display:flex; align-items:flex-end; position:relative;">
                            <div style="width:100%; background:${barColor}; height:${pct}%; border-radius:4px; transition:height 0.3s;"></div>
                        </div>
                        <span style="font-size:0.62rem; font-weight:700; color:${dayLabelColor}; white-space:nowrap;">${di.label || d.day}</span>
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
            if (confirm('すべての事前入力枠（希望休・備考等）をクリアしますか？（※スタッフ氏名・役職・所属設定は保持されます）')) {
                pushHistory();
                clearConflictHighlights();
                loadStaffMaster();
                staffList.forEach(s => {
                    enforceRoleExclusivity(s);
                    s.remarks = '';
                    s.prevDays = new Array(7).fill('');
                    s.days = new Array(NUM_DAYS).fill('');
                });
                autoAssignedRefKeys.clear();
                autoAssignedStaffIds.clear();
                lastSolveResult = null;
                lastScheduler = null;
                clearOutputTables();
                renderInputTable();
                saveCurrentTermToStorage();
                pushStateToCloud(false);
                showToast('🧹 事前入力枠を全消去しました（「↩ 戻る」で元に戻せます）');
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
            const fEarly = `=COUNTIF(${rng},"早")`;
            const fLate = `=COUNTIF(${rng},"遅")`;
            const fEve = `=COUNTIF(${rng},"E")`;
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
            const fEarly = `=COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-8)),"早")`;
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
            const fLate = `=COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-9)),"遅")`;
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
            const fEve = `=COUNTIF(INDIRECT("${col}$4:${col}"&(ROW()-10)),"E")`;
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
    // ★ マスターテーブル「⚡ 平日ブレ最小化」「⚡ 休日ブレ最小化」ボタンイベント登録
    const masterBalanceWeekdayBtn = document.getElementById('masterBalanceWeekdayBtn');
    if (masterBalanceWeekdayBtn) {
        masterBalanceWeekdayBtn.addEventListener('click', handleMasterBalanceWeekday);
    }
    const masterBalanceWeekdayBtnStats = document.getElementById('masterBalanceWeekdayBtnStats');
    if (masterBalanceWeekdayBtnStats) {
        masterBalanceWeekdayBtnStats.addEventListener('click', handleMasterBalanceWeekday);
    }
    const masterBalanceWeekendBtn = document.getElementById('masterBalanceWeekendBtn') || document.getElementById('masterBalanceWeekendOffBtn');
    if (masterBalanceWeekendBtn) {
        masterBalanceWeekendBtn.addEventListener('click', handleMasterBalanceWeekend);
    }
    const masterBalanceWeekendBtnStats = document.getElementById('masterBalanceWeekendBtnStats') || document.getElementById('masterBalanceWeekendOffBtnStats');
    if (masterBalanceWeekendBtnStats) {
        masterBalanceWeekendBtnStats.addEventListener('click', handleMasterBalanceWeekend);
    }
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
                    dayOffsets: [...dayOffsets],
                    isST: isST,
                    isSouth: isSouth,
                    isLife: isLife,
                    lifeDailyWork: getLinkedLifeDailyWork(),
                    stDailyWork: getLinkedSTDailyWork(),
                    stDailyHeadCount: getLinkedSTDailyHeadCount(),
                    stDailyFtWork: getLinkedSTDailyFtWork(),
                    stDailyEarly: getLinkedSTDailyEarly(),
                    stDailyLate: getLinkedSTDailyLate(),
                    stDailyEve: getLinkedSTDailyEve(),
                    stFloorFtCount: getLinkedSTFloorFtCount()
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
        if (isST) {
            downloadBlankXlsxForST();
            return;
        }
        const term = getTermInfo();

        const numDays = term.dates.length;
        const floorPrefix = (function() {
            if (window.APP_CONFIG) {
                if (window.APP_CONFIG.deptId === '1f' || window.APP_CONFIG.floor === '1F') return '1階';
                if (window.APP_CONFIG.deptId === '2f' || window.APP_CONFIG.floor === '2F') return '2階';
                if (window.APP_CONFIG.deptId === '3f' || window.APP_CONFIG.floor === '3F') return '3階';
                if (window.APP_CONFIG.deptId === 'south' || window.APP_CONFIG.floor === '南') return '南';
                if (window.APP_CONFIG.deptName) {
                    if (window.APP_CONFIG.deptName.includes('1階')) return '1階';
                    if (window.APP_CONFIG.deptName.includes('2階')) return '2階';
                    if (window.APP_CONFIG.deptName.includes('3階')) return '3階';
                    if (window.APP_CONFIG.deptName.includes('南')) return '南';
                }
            }
            const path = window.location.pathname;
            if (path.includes('1f') || path.includes('1階')) return '1階';
            if (path.includes('2f') || path.includes('2階')) return '2階';
            if (path.includes('3f') || path.includes('3階')) return '3階';
            if (path.includes('south') || path.includes('南')) return '南';
            return currentFloor ? (currentFloor === '南' ? '南' : `${currentFloor.replace('F', '階')}`) : '';
        })();
        const title = `${floorPrefix}${term.first.m}月${term.first.day}日～${term.last.m}月${term.last.day}日 スタッフ希望勤務入力シート（希望勤務はプルダウンから選択してください）`;

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
            // ★ スタッフ入力用の空白勤務表では、備考欄も完全に空欄で出力する（他タームの備考が残らないようにする）
            sheet1 += `\n      <c r="${colOff}${r}" s="7"><f>${fOff}</f><v>0</v></c>
      <c r="${colPaid}${r}" s="7"><f>${fPaid}</f><v>0</v></c>
      <c r="${colRemarks}${r}" s="6"/>
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

    // ★ ST専用スタッフ希望勤務入力シート (.xlsx) のダウンロード実行
    function downloadBlankXlsxForST() {
        const term = getTermInfo();

        const numDays = term.dates.length;
        const title = `${term.first.m}月${term.first.day}日～${term.last.m}月${term.last.day}日 スタッフ希望勤務入力シート（希望勤務はプルダウンから選択してください）`;

        const lastColLetter = toColLetter(1 + numDays); // 28日ならAC(列29), 29日ならAD(列30)

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
  <fonts count="5">
    <font><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="12"/><name val="游ゴシック"/><color rgb="1E293B"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/><color rgb="2563EB"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/><color rgb="DC2626"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="EFF6FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FEF2F2"/></patternFill></fill>
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
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

        // ★ 各階への振り分けと役職ソート（係長→主任→副主任→希望入力ページの記載順）
        const floors = [
            { key: '1F', label: '1階' },
            { key: '2F', label: '2階' },
            { key: '3F', label: '3階' },
            { key: '南', label: '南' }
        ];

        function getRoleRank(s) {
            if (s.isSectionChief) return 1;
            if (s.isChief) return 2;
            if (s.isSubChief) return 3;
            return 4;
        }

        const validStaff = staffList.filter(s => !s.isUnused);
        const floorStaffMap = {
            '1F': [],
            '2F': [],
            '3F': [],
            '南': []
        };

        validStaff.forEach(s => {
            let matchedKey = floors.find(f => f.key === s.floor || (s.floor && s.floor.includes(f.key)))?.key;
            if (!matchedKey) matchedKey = '1F';
            floorStaffMap[matchedKey].push(s);
        });

        floors.forEach(f => {
            floorStaffMap[f.key].sort((a, b) => {
                const rankA = getRoleRank(a);
                const rankB = getRoleRank(b);
                if (rankA !== rankB) return rankA - rankB;
                return a.id - b.id; // 希望入力ページの記載順（id順）
            });
        });

        let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>
    <col min="2" max="${1 + numDays}" width="6" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="24" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>${title}</t></is></c>
    </row>`;

        let currentRow = 2;
        const validationRanges = [];

        floors.forEach((f, fIdx) => {
            const list = floorStaffMap[f.key];

            // 1. 日付ヘッダー行
            const rHeaderDate = currentRow++;
            sheet1 += `\n    <row r="${rHeaderDate}" ht="22" customHeight="1">
      <c r="A${rHeaderDate}" s="2" t="inlineStr"><is><t>氏名</t></is></c>`;
            for (let d = 0; d < numDays; d++) {
                const di = term.dates[d];
                const colLetter = toColLetter(2 + d);
                sheet1 += `\n      <c r="${colLetter}${rHeaderDate}" s="2" t="inlineStr"><is><t>${di.m}/${di.day}</t></is></c>`;
            }
            sheet1 += `\n    </row>`;

            // 2. 曜日ヘッダー行
            const rHeaderDay = currentRow++;
            sheet1 += `\n    <row r="${rHeaderDay}" ht="20" customHeight="1">
      <c r="A${rHeaderDay}" s="2"/>`;
            for (let d = 0; d < numDays; d++) {
                const di = term.dates[d];
                const colLetter = toColLetter(2 + d);
                let sIdx = 2;
                if (di.weekday === '土' || di.wIdx === 5) sIdx = 3;
                else if (di.weekday === '日' || di.wIdx === 6 || di.isHoliday) sIdx = 4;
                sheet1 += `\n      <c r="${colLetter}${rHeaderDay}" s="${sIdx}" t="inlineStr"><is><t>${di.weekday || di.w}</t></is></c>`;
            }
            sheet1 += `\n    </row>`;

            // 3. スタッフ行（トグルで選ばれた人数分に柔軟に対応）
            if (list.length > 0) {
                const startStaffRow = currentRow;
                list.forEach(staff => {
                    const rStaff = currentRow++;
                    sheet1 += `\n    <row r="${rStaff}" ht="20" customHeight="1">
      <c r="A${rStaff}" s="6" t="inlineStr"><is><t>${escapeXmlText(staff.name)}</t></is></c>`;
                    for (let d = 0; d < numDays; d++) {
                        const colLetter = toColLetter(2 + d);
                        sheet1 += `\n      <c r="${colLetter}${rStaff}" s="5"/>`;
                    }
                    sheet1 += `\n    </row>`;
                });
                const endStaffRow = currentRow - 1;
                validationRanges.push(`B${startStaffRow}:${lastColLetter}${endStaffRow}`);
            }

            // 4. 各フロア間の空行（1行）
            sheet1 += `\n    <row r="${currentRow}" ht="18"/>`;
            currentRow++;
        });

        sheet1 += `\n  </sheetData>`;

        // ドロップダウンリスト（プルダウンデータ入力規則）を全フロアの希望枠に適用
        if (validationRanges.length > 0) {
            sheet1 += `\n  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="${validationRanges.join(' ')}" promptTitle="希望勤務の選択" prompt="プルダウンから希望勤務記号を選択してください。" errorTitle="入力値エラー" error="一覧（プルダウン）にある記号のみ入力できます。">
      <formula1>&quot;休,有,○,出,早,遅,E,8時,ハヤ,オソ,イブ,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3,ー&quot;</formula1>
    </dataValidation>
  </dataValidations>`;
        }

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
        // ★ ユーザー指示: ST用空白シートファイル名は「ST4月1日～4月28日スタッフ希望勤務入力シート.xlsx」
        link.setAttribute('download', `ST${term.first.m}月${term.first.day}日～${term.last.m}月${term.last.day}日スタッフ希望勤務入力シート.xlsx`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 2000);
        showToast('📄 ST用スタッフ希望勤務入力シート (.xlsx) をダウンロードしました！');
    }
    const ALLOWED_SYMBOLS = new Set([
        '○', '休', '有', '出', '早', '遅', 'E', '8時',
        'ハヤ', 'オソ', 'イブ',
        '○/休', '休/○', '○/有', '有/○',
        '上1', '上2', '上3', '上4', '上5',
        '下1', '下2', '下3', '下4', '下5',
        'ー'
    ]);

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
        if (s === 'ー' || s === '―' || s === '─' || s === '-' || s === 'ｰ' || s === '対象外') return 'ー';

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

        // mode: 'replace' の場合は既存の入力希望および当タームの備考を一度クリア
        if (mode === 'replace') {
            for (let s = 0; s < NUM_STAFF; s++) {
                staffList[s].remarks = '';
                for (let d = 0; d < NUM_DAYS; d++) {
                    staffList[s].days[d] = '';
                }
            }
            autoAssignedRefKeys.clear();
            autoAssignedStaffIds.clear();
            lastSolveResult = null;
            lastScheduler = null;
            clearOutputTables();
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
                    writer.write(compData).catch(() => {});
                    writer.close().catch(() => {});
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
                if (!ce.name.endsWith('.xml') && !ce.name.endsWith('.rels')) continue;
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
                    if (name.endsWith('.xml') || name.endsWith('.rels')) {
                        const compData = bytes.subarray(dataStart, dataStart + compSize);
                        const decompData = await inflateEntry(method, compData);
                        if (decompData) {
                            entries[name] = textDecoder.decode(decompData);
                        }
                    }
                    pos = dataStart + (compSize || 1);
                } else {
                    pos++;
                }
            }
        }

        // sharedStrings.xml の抽出（★ <rPh> ふりがなタグを完全除外！）
        const sharedStrings = [];
        const sharedKey = Object.keys(entries).find(k => k.toLowerCase() === 'xl/sharedstrings.xml');
        if (sharedKey && entries[sharedKey]) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(entries[sharedKey], 'text/xml');
            const siNodes = xmlDoc.getElementsByTagName('si');
            for (let i = 0; i < siNodes.length; i++) {
                sharedStrings.push(extractXmlTextWithoutPhonetic(siNodes[i]));
            }
        }

        const sheetKey = Object.keys(entries).find(k => k.toLowerCase() === 'xl/worksheets/sheet1.xml')
            || Object.keys(entries).find(k => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
        const sheetXml = sheetKey ? entries[sheetKey] : null;
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
            const rawName = cellMap.get(`${row},${nameCol}`)?.text || '';
            const rowName = cleanTextValue(rawName);

            // フッター集計行（出勤人数合計・実数合計・早番等）に達したら終了
            if (['出勤人数合計', '実数合計', 'PT A 出勤', 'OT A 出勤', 'PT B 出勤', 'OT B 出勤', 'ST 出勤', 'PT A 実数', 'OT A 実数', 'PT B 実数', 'OT B 実数', 'ST 実数', 'ﾊｰﾌﾏﾝ実数', '早番', '遅番', 'E', '8時', '専従'].some(k => rowName.startsWith(k))) {
                break;
            }

            // スタッフの特定（実在スタッフ名の一致を最優先）
            let staffIdx = -1;
            if (rowName && !['氏名', 'No', '役職', '所属', 'フロア'].includes(rowName)) {
                const byName = staffList.findIndex(st => !st.isUnused && cleanTextValue(st.name) === rowName);
                if (byName >= 0) staffIdx = byName;
            }

            // もしnameColで見つからない場合、A列またはB列でスタッフ名を探す
            if (staffIdx === -1) {
                const altCol = (nameCol === 1 ? 2 : 1);
                const altName = cleanTextValue(cellMap.get(`${row},${altCol}`)?.text || '');
                if (altName && !['氏名', 'No', '役職', '所属', 'フロア'].includes(altName)) {
                    const byAltName = staffList.findIndex(st => !st.isUnused && cleanTextValue(st.name) === altName);
                    if (byAltName >= 0) staffIdx = byAltName;
                }
            }

            // A列が明確なスタッフ番号(1〜NUM_STAFF)である場合のフォールバック（※曜日ヘッダー行や空行は完全に弾く）
            if (staffIdx === -1) {
                const noText = cleanTextValue(cellMap.get(`${row},1`)?.text || '');
                const noVal = parseInt(noText, 10);
                if (!isNaN(noVal) && noVal >= 1 && noVal <= NUM_STAFF && !['水', '木', '金', '土', '日', '月', '火'].includes(noText)) {
                    staffIdx = noVal - 1;
                }
            }

            // 実在スタッフと特定できなかった行（曜日ヘッダー行・フロア区切り空行など）は100%安全にスキップ！
            if (staffIdx < 0 || staffIdx >= NUM_STAFF || staffList[staffIdx].isUnused) continue;

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
                    dayOffsets: [...dayOffsets],
                    isST: isST,
                    isSouth: isSouth,
                    isLife: isLife,
                    lifeDailyWork: getLinkedLifeDailyWork(),
                    stDailyWork: getLinkedSTDailyWork(),
                    stDailyHeadCount: getLinkedSTDailyHeadCount(),
                    stDailyFtWork: getLinkedSTDailyFtWork(),
                    stDailyEarly: getLinkedSTDailyEarly(),
                    stDailyLate: getLinkedSTDailyLate(),
                    stDailyEve: getLinkedSTDailyEve(),
                    stFloorFtCount: getLinkedSTFloorFtCount()
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
                    dayOffsets: [...dayOffsets],
                    isST: isST,
                    isSouth: isSouth,
                    isLife: isLife,
                    lifeDailyWork: getLinkedLifeDailyWork(),
                    stDailyWork: getLinkedSTDailyWork(),
                    stDailyHeadCount: getLinkedSTDailyHeadCount(),
                    stDailyFtWork: getLinkedSTDailyFtWork(),
                    stDailyEarly: getLinkedSTDailyEarly(),
                    stDailyLate: getLinkedSTDailyLate(),
                    stDailyEve: getLinkedSTDailyEve(),
                    stFloorFtCount: getLinkedSTFloorFtCount()
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
            const fEarly = `COUNTIF(${rng},&quot;早&quot;)`;
            const fLate = `COUNTIF(${rng},&quot;遅&quot;)`;
            const fEve = `COUNTIF(${rng},&quot;E&quot;)`;
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

        renderSpecialRow(endRow + 3, '早番 (早)', 10, ['早']);
        renderSpecialRow(endRow + 4, '遅番 (遅)', 11, ['遅']);
        renderSpecialRow(endRow + 5, 'イブニング (E)', 12, ['E']);
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

    const lastActiveDate = localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || localStorage.getItem('shift_schedule_current_start_date') || localStorage.getItem(STORAGE_KEY_LAST_ACTIVE) || localStorage.getItem('shift_schedule_last_active_start_date');
    const defaultDate = document.getElementById('termStartDate')?.value || '2026-04-01';
    // ★ ユーザー指示: どこかのテーブルでタームを指定したらすべてのテーブルが同一のタームを開く！
    const globalActiveDate = localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || localStorage.getItem('shift_schedule_current_start_date');
    const chosenDate = globalActiveDate || lastActiveDate || defaultDate;
    const matchedTerm = findTermByStartDate(chosenDate);
    const targetDate = matchedTerm ? matchedTerm.startDate : defaultDate;

    currentWorkingStartDate = targetDate;
    const dateInput = document.getElementById('termStartDate');
    if (dateInput) dateInput.value = targetDate;

    // ★ 13ターム選択プルダウンの初期化とイベント登録
    initTermSelector();
    // ★ 生活期テーブルでは「✨ 特殊勤務を入れる」ボタンは不要のため完全非表示化
    if (isLife) {
        const specBtn = document.getElementById('assignSpecialDutiesBtn');
        if (specBtn) specBtn.style.display = 'none';
        const fSpecBtn = document.getElementById('forceAssignSpecialBtn');
        if (fSpecBtn) fSpecBtn.style.display = 'none';
    }


    // ★ 病棟テーブル起動時、STおよび生活期ハ応援連携データを確実に初期ロード
    if (!isST && !isLife && currentFloor) {
        loadLinkedSTData(targetDate);
        loadLinkedLifeData(targetDate);
    }

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

    if (isMaster) {
        renderMasterIntegrationView();
        switchTab('checkTab');
    }

    // ★ 起動時にクラウドから最新データ（トグル設定・勤務表）を自動同期！
    pullStateFromCloud(true, false);

    // ★ ヘッダーの「🔄 最新同期」ボタン
    const manualSyncBtn = document.getElementById('manualCloudSyncBtn');
    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', () => {
            pullStateFromCloud(false, true);
        });
    }

    // ★ タブが非表示になった瞬間に未送信のローカル変更があれば直ちにクラウドへフラッシュ同期
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (cloudSyncTimer) {
                clearTimeout(cloudSyncTimer);
                cloudSyncTimer = null;
                pushStateToCloud(false);
            }
        }
    });

    // ★ タブを離れる直前や別ページ（PO病棟等）へ移動する直前に、未送信のクラウド同期があれば即座に送信
    const flushCloudSync = () => {
        if (cloudSyncTimer) {
            clearTimeout(cloudSyncTimer);
            cloudSyncTimer = null;
            pushStateToCloud(false);
        }
    };
    window.addEventListener('pagehide', flushCloudSync);
    window.addEventListener('beforeunload', flushCloudSync);


// ★ ユーザー指示: コピペモード（セル選択 Ctrl+C / Ctrl+V またはクリック貼付、全テーブルでデフォルトON）
    const syncInitialCopyModeBtns = () => {
        const allCopyBtns = document.querySelectorAll('#copyModeToggleBtn, .copy-mode-btn');
        allCopyBtns.forEach(b => {
            if (isCopyMode) {
                b.classList.remove('btn-outline-primary');
                b.classList.add('btn-primary');
                b.textContent = '📋 コピペモードON';
            } else {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline-primary');
                b.textContent = '📋 コピペモード';
            }
        });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncInitialCopyModeBtns);
    } else {
        syncInitialCopyModeBtns();
    }

    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('#copyModeToggleBtn, .copy-mode-btn');
        if (toggleBtn) {
            isCopyMode = !isCopyMode;
            const allCopyBtns = document.querySelectorAll('#copyModeToggleBtn, .copy-mode-btn');
            if (isCopyMode) {
                allCopyBtns.forEach(b => {
                    b.classList.remove('btn-outline-primary');
                    b.classList.add('btn-primary');
                    b.textContent = '📋 コピペモードON';
                });
                showToast('📋 コピペモードON: セルをクリックして選択し、Ctrl+C でコピー、Ctrl+V で貼り付けを行ってください');
            } else {
                allCopyBtns.forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-outline-primary');
                    b.textContent = '📋 コピペモード';
                });
                if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                selectedCopyCell = null;
                clipboardSymbol = null;
                showToast('📋 コピペモードOFF');
            }
        }
    });

    // キーボードショートカット Ctrl+C / Ctrl+V
    // ★ ユーザー指示: クリックによる誤貼り付けを廃止し、Ctrl+Cでコピー、Ctrl+Vで貼り付けを確実に実行
    window.addEventListener('keydown', (e) => {
        if (!isCopyMode) return;
        const activeCell = selectedCopyCell || document.querySelector('.copy-selected-cell') || (document.activeElement && document.activeElement.classList.contains('day-cell') ? document.activeElement : null);
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            if (activeCell) {
                clipboardSymbol = activeCell.textContent.trim();
                showToast(`📋 【${clipboardSymbol || '空欄'}】をコピーしました (Ctrl+C)`);
                e.preventDefault();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            if (activeCell && clipboardSymbol !== null) {
                let newSym = clipboardSymbol;

                // ★ マスターテーブルのセル（.master-editable-cell）への貼り付け処理
                if (activeCell.classList.contains('master-editable-cell')) {
                    updateMasterIntegrationCell(activeCell, newSym);
                    e.preventDefault();
                    return;
                }

                const s = parseInt(activeCell.dataset.s, 10);
                const d = parseInt(activeCell.dataset.d, 10);
                const type = activeCell.dataset.type;
                pushHistory();

                // 1. 入力データ（staffList）の更新
                if (!isNaN(s) && staffList[s]) {
                    if (type === 'prev') {
                        const p = parseInt(activeCell.dataset.p, 10);
                        if (!isNaN(p)) staffList[s].prevDays[p] = newSym;
                    } else if (!isNaN(d)) {
                        staffList[s].days[d] = newSym;
                    }
                }

                // 2. 出力データ（lastSolveResult / lastScheduler）の更新
                let updatedOutput = false;
                if (!isNaN(s) && !isNaN(d)) {
                    if (lastSolveResult && lastSolveResult.grid && lastSolveResult.grid[s] && lastSolveResult.grid[s][d]) {
                        lastSolveResult.grid[s][d].symbol = newSym;
                        updatedOutput = true;
                    }
                    if (lastScheduler && lastScheduler.grid && lastScheduler.grid[s] && lastScheduler.grid[s][d]) {
                        lastScheduler.grid[s][d].symbol = newSym;
                        updatedOutput = true;
                    }
                }

                activeCell.textContent = newSym;
                applySpecialDutyCellClass(activeCell, newSym);

                // 3. リアルタイム再集計＆画面再描画（個人集計列＆フッター日別集計行の即時更新）
                if (updatedOutput && lastScheduler) {
                    const newStats = lastScheduler.calculateStats();
                    if (lastSolveResult) lastSolveResult.stats = newStats;
                    renderOutputTable(lastSolveResult.grid, newStats);
                    if (typeof renderStatsDashboard === 'function') renderStatsDashboard(newStats);
                } else if (document.getElementById('inputTab')?.classList.contains('active')) {
                    renderInputTable();
                }

                if (isMaster && typeof renderMasterIntegrationView === 'function') {
                    renderMasterIntegrationView();
                }

                // 貼り付け後もセルの選択表示（.copy-selected-cell）を維持
                if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                const newActiveCell = document.querySelector(`.day-cell[data-s="${s}"][data-d="${d}"]`) || activeCell;
                if (newActiveCell) {
                    newActiveCell.classList.add('copy-selected-cell');
                    selectedCopyCell = newActiveCell;
                }

                saveCurrentTermToStorage();
                showToast(`📋 【${newSym || '空欄'}】を貼り付けました (Ctrl+V)`);
                e.preventDefault();
            }
        }
    });

    // ★ ユーザー指示: クリップボード paste イベント対応（Excel等からの貼付けも100%サポート）
    window.addEventListener('paste', (e) => {
        if (!isCopyMode) return;
        const activeCell = selectedCopyCell || document.querySelector('.copy-selected-cell') || (document.activeElement && (document.activeElement.classList.contains('day-cell') || document.activeElement.classList.contains('master-editable-cell')) ? document.activeElement : null);
        if (!activeCell) return;

        let pastedText = '';
        if (e.clipboardData) {
            pastedText = e.clipboardData.getData('text') || '';
        }
        pastedText = pastedText.trim();
        if (!pastedText && clipboardSymbol !== null) {
            pastedText = clipboardSymbol;
        }
        if (!pastedText && pastedText !== '') return;

        pastedText = pastedText.replace(/[◦•･◯〇●]/g, '○');
        clipboardSymbol = pastedText;

        if (activeCell.classList.contains('master-editable-cell')) {
            updateMasterIntegrationCell(activeCell, pastedText);
            e.preventDefault();
        } else {
            const s = parseInt(activeCell.dataset.s, 10);
            const d = parseInt(activeCell.dataset.d, 10);
            const type = activeCell.dataset.type;
            pushHistory();
            if (!isNaN(s) && staffList[s]) {
                if (type === 'prev') {
                    const p = parseInt(activeCell.dataset.p, 10);
                    if (!isNaN(p)) staffList[s].prevDays[p] = pastedText;
                } else if (!isNaN(d)) {
                    staffList[s].days[d] = pastedText;
                }
            }
            let updatedOutput = false;
            if (!isNaN(s) && !isNaN(d)) {
                if (lastSolveResult && lastSolveResult.grid && lastSolveResult.grid[s] && lastSolveResult.grid[s][d]) {
                    lastSolveResult.grid[s][d].symbol = pastedText;
                    updatedOutput = true;
                }
                if (lastScheduler && lastScheduler.grid && lastScheduler.grid[s] && lastScheduler.grid[s][d]) {
                    lastScheduler.grid[s][d].symbol = pastedText;
                    updatedOutput = true;
                }
            }
            activeCell.textContent = pastedText;
            applySpecialDutyCellClass(activeCell, pastedText);
            if (updatedOutput && lastScheduler) {
                const newStats = lastScheduler.calculateStats();
                if (lastSolveResult) lastSolveResult.stats = newStats;
                renderOutputTable(lastSolveResult.grid, newStats);
                if (typeof renderStatsDashboard === 'function') renderStatsDashboard(newStats);
            } else if (document.getElementById('inputTab')?.classList.contains('active')) {
                renderInputTable();
            }
            if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
            const newActiveCell = document.querySelector(`.day-cell[data-s="${s}"][data-d="${d}"]`) || activeCell;
            if (newActiveCell) {
                newActiveCell.classList.add('copy-selected-cell');
                selectedCopyCell = newActiveCell;
            }
            saveCurrentTermToStorage();
            showToast(`📋 【${pastedText || '空欄'}】を貼り付けました`);
            e.preventDefault();
        }
    });


    // ★ ユーザー指示: マスターテーブルでも他テーブル（PO/各病棟）と同様に確実にタームを選択・即時切替可能にする！
    function initMasterTermSelect() {
        const masterSel = document.getElementById('masterTermSelect');
        if (!masterSel) return;

        const curStart = localStorage.getItem(STORAGE_KEY_GLOBAL_CURRENT_TERM) || currentWorkingStartDate || localStorage.getItem('shift_schedule_current_start_date') || '2026-04-01';

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
            localStorage.setItem(STORAGE_KEY_GLOBAL_CURRENT_TERM, newStart);
            localStorage.setItem('shift_schedule_current_start_date', newStart);
            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, newStart);

            // hidden input も更新
            const dateInput = document.getElementById('termStartDate');
            if (dateInput) dateInput.value = newStart;

            // termSelect（もし存在すれば）も同期
            const otherTermSel = document.getElementById('termSelect');
            if (otherTermSel && otherTermSel !== masterSel) otherTermSel.value = newStart;

            updateTermBadges(newStart);

            const curTermDef = findTermByStartDate(newStart);
            const selText = (masterSel.options && masterSel.selectedIndex >= 0) ? masterSel.options[masterSel.selectedIndex]?.text : (curTermDef ? curTermDef.label : newStart);
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
    setTimeout(initMasterTermSelect, 150);

    // ==========================================
    // ★ ユーザー指示: 統括ファイルのマスターテーブル「情報更新」ボタン
    // 各階（1階・2階・3階・南・生活期・ST）の情報を吸い取られ最新情報に更新！
    // ==========================================
    function initMasterMegaSyncButton() {
        const syncBtn = document.getElementById('masterMegaSyncBtn');
        if (!syncBtn) return;

        syncBtn.onclick = async () => {
            const originalHtml = syncBtn.innerHTML;
            syncBtn.disabled = true;
            syncBtn.style.opacity = '0.75';
            syncBtn.innerHTML = `
                <span style="display:inline-block; animation: spin 1s linear infinite; font-size:1.25rem;">🔄</span>
                <span>各階データを吸い上げ中...</span>
            `;

            try {
                // 1. クラウド/共有フォルダ同期が有効なら最新データを取得
                if (typeof pullStateFromCloud === 'function') {
                    try {
                        await pullStateFromCloud(true, false);
                    } catch (e) {
                        console.warn('Sync notice:', e);
                    }
                }

                // 2. マスター統合テーブルの再計算＆全館再描画
                if (typeof renderMasterIntegrationView === 'function') {
                    renderMasterIntegrationView();
                }

                // 3. ダッシュボードの再描画
                if (typeof renderStatsDashboard === 'function' && lastSolveResult && lastSolveResult.stats) {
                    renderStatsDashboard(lastSolveResult.stats);
                }

                const nowStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                showToast(`✅ 各階の最新データを吸い上げました（更新時刻: ${nowStr}）`);
                
                const badgeText = document.getElementById('autoSaveStatusText');
                if (badgeText) badgeText.textContent = `🟢 最新同期完了 (${nowStr})`;

            } catch (err) {
                console.error('マスター同期エラー:', err);
                showToast(`⚠️ 同期中に一部エラーが発生しました: ${err.message || err}`);
            } finally {
                setTimeout(() => {
                    syncBtn.disabled = false;
                    syncBtn.style.opacity = '1';
                    syncBtn.innerHTML = originalHtml;
                }, 600);
            }
        };
    }

    initMasterMegaSyncButton();
    setTimeout(initMasterMegaSyncButton, 200);

});
