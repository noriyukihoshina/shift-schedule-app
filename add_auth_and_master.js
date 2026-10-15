// add_auth_and_master.js
// パスワード認証モーダルとスタッフマスター共通保存・復元機能を app.js に組み込む

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let code = fs.readFileSync(appPath, 'utf8');

// 1. スタッフマスター保存・復元関数
const staffMasterLogic = `
    // ★ スタッフ属性マスターの保存（タームを切り替えてもトグルや設定を完全維持）
    function saveStaffMaster() {
        try {
            const masterList = staffList.map(s => ({
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
                remarks: s.remarks || ''
            }));
            localStorage.setItem(STORAGE_KEY_STAFF_MASTER, JSON.stringify(masterList));
        } catch (e) {
            console.error('スタッフマスターの保存に失敗:', e);
        }
    }

    function loadStaffMaster() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_STAFF_MASTER);
            if (!raw) return false;
            const masterList = JSON.parse(raw);
            if (!Array.isArray(masterList)) return false;
            masterList.forEach((ms, idx) => {
                if (staffList[idx]) {
                    staffList[idx].name = ms.name || staffList[idx].name;
                    staffList[idx].isUnused = ms.isUnused !== undefined ? ms.isUnused : staffList[idx].isUnused;
                    staffList[idx].section = ms.section || '';
                    staffList[idx].can8 = !!ms.can8;
                    staffList[idx].noEarly = !!ms.noEarly;
                    staffList[idx].noLate = !!ms.noLate;
                    staffList[idx].noEve = !!ms.noEve;
                    staffList[idx].canSched = !!ms.canSched;
                    staffList[idx].isSectionChief = !!ms.isSectionChief;
                    staffList[idx].isChief = !!ms.isChief;
                    staffList[idx].isSubChief = !!ms.isSubChief;
                    staffList[idx].isHalf = !!ms.isHalf;
                    staffList[idx].isFullTime = !!ms.isFullTime;
                    staffList[idx].allow6Consec = !!ms.allow6Consec;
                    staffList[idx].prevName = ms.prevName || '';
                    staffList[idx].remarks = ms.remarks || '';
                }
            });
            return true;
        } catch (e) {
            console.error('スタッフマスターの読込に失敗:', e);
            return false;
        }
    }
`;

// saveCurrentTermToStorage の末尾で saveStaffMaster() を呼ぶ
code = code.replace(
    /updateSavedTermsList\(startDate\);\r?\n\s+updateSaveStatusUI\(new Date\(\)\);/,
    `updateSavedTermsList(startDate);\n            saveStaffMaster();\n            updateSaveStatusUI(new Date());`
);

// initNewTerm の先頭で loadStaffMaster() を呼ぶ
code = code.replace(
    /function initNewTerm\(newStartDate\) \{\r?\n\s+staffList\.forEach\(s => \{/,
    `function initNewTerm(newStartDate) {\n        // スタッフ基本設定マスターを引き継ぎ復元！\n        loadStaffMaster();\n        staffList.forEach(s => {`
);

// 2. パスワード認証モーダルの初期化処理
const authModalLogic = `
    // ==========================================
    // ★ 部署別パスワード認証モーダル制御
    // ==========================================
    function checkDeptAuthentication() {
        if (!window.APP_CONFIG || !window.APP_CONFIG.password) return;
        const config = window.APP_CONFIG;

        // ヘッダータイトルの更新
        const titleEl = document.querySelector('.header-title h1');
        if (titleEl && config.deptName) {
            titleEl.textContent = \`勤務予定表 自動作成システム 【\${config.deptName}】\`;
            document.title = \`勤務予定表 自動作成システム - \${config.deptName}\`;
        }

        const authKey = \`auth_\${config.deptId}\`;
        if (sessionStorage.getItem(authKey) === 'true') {
            return; // 認証済み
        }

        // 認証モーダルを動的生成して画面全体を安全にロック
        const overlay = document.createElement('div');
        overlay.id = 'deptAuthOverlay';
        overlay.style.cssText = \`
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
        \`;

        overlay.innerHTML = \`
            <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); text-align: center;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔒</div>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: #1e293b; margin-bottom: 0.25rem;">【\${config.deptName}】認証</h3>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem;">パスワードを入力して勤務表を開いてください</p>
                <div style="margin-bottom: 1rem;">
                    <input type="password" id="deptAuthPasswordInput" placeholder="パスワードを入力" style="width: 100%; padding: 10px 14px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 1.1rem; text-align: center; letter-spacing: 4px; outline: none; box-sizing: border-box;">
                    <div id="deptAuthErrorMsg" style="color: #dc2626; font-size: 0.8rem; margin-top: 6px; display: none; font-weight: 600;">パスワードが正しくありません</div>
                </div>
                <button type="button" id="deptAuthSubmitBtn" style="width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background 0.2s;">
                    ロック解除
                </button>
            </div>
        \`;

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
`;

// DOMContentLoaded の先頭に authModalLogic と checkDeptAuthentication() を追加
code = code.replace(
    /document\.addEventListener\('DOMContentLoaded', \(\) => \{\r?\n/,
    `document.addEventListener('DOMContentLoaded', () => {\n${staffMasterLogic}\n${authModalLogic}\n    checkDeptAuthentication();\n`
);

fs.writeFileSync(appPath, code, 'utf8');
console.log('SUCCESS: add_auth_and_master.js finished!');
