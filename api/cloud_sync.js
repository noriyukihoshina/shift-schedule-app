// api/cloud_sync.js
// Vercel Serverless Function: クラウド自動保存・別PC間リアルタイム同期API
// 保存先: 非公開(Private)リポジトリ shift-schedule-cloud-data 内の部署別JSONファイル
// ※ 認証トークンは Vercel の暗号化環境変数 (process.env.GITHUB_STORAGE_TOKEN) から取得するためソースコードには一切含まれません。

module.exports = async function handler(req, res) {
    // キャッシュ完全無効化（常に最新のクラウドデータを返す）
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const token = process.env.GITHUB_STORAGE_TOKEN;
    const owner = process.env.GITHUB_STORAGE_OWNER || 'noriyukihoshina';
    const repo = process.env.GITHUB_STORAGE_REPO || 'shift-schedule-cloud-data';

    if (!token) {
        return res.status(503).json({
            ok: false,
            error: 'CLOUD_NOT_CONFIGURED'
        });
    }

    // 部署IDのサニタイズ (master, 1f, 2f, 3f, south, st, life_admin)
    const rawDeptId = (req.method === 'GET' ? req.query?.deptId : req.body?.deptId) || 'master';
    const deptId = String(rawDeptId).replace(/[^a-zA-Z0-9_-]/g, '') || 'master';
    const filePath = `data/dept_${deptId}.json`;
    const ghApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const ghHeaders = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ShiftScheduleApp-CloudSync',
        'Content-Type': 'application/json'
    };

    function slimTermData(tData) {
        if (!tData || typeof tData !== 'object') return tData;
        const copy = { ...tData };
        // lastSolveStats はクライアント側で outputGrid から瞬時に再計算されるため除外して1MB制限超過を防止
        delete copy.lastSolveStats;
        return copy;
    }

    async function fetchCurrentCloudFile() {
        const resp = await fetch(`${ghApiUrl}?t=${Date.now()}`, {
            method: 'GET',
            headers: ghHeaders,
            cache: 'no-store'
        });
        if (resp.status === 404) {
            return { exists: false, sha: null, data: null };
        }
        if (!resp.ok) {
            const errTxt = await resp.text();
            throw new Error(`GitHub GET error (${resp.status}): ${errTxt}`);
        }
        const json = await resp.json();
        let base64Raw = json.content || '';

        // GitHub Contents API は 1MB 超のファイルで content が空になるため Git Blobs API (最大100MB) で取得
        if (!base64Raw && json.sha) {
            const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${json.sha}`;
            const blobResp = await fetch(blobUrl, {
                method: 'GET',
                headers: ghHeaders,
                cache: 'no-store'
            });
            if (blobResp.ok) {
                const blobJson = await blobResp.json();
                base64Raw = blobJson.content || '';
            }
        }

        const contentStr = Buffer.from(base64Raw, 'base64').toString('utf8');
        let parsed = null;
        try {
            parsed = JSON.parse(contentStr);
        } catch (e) {
            parsed = null;
        }
        return { exists: true, sha: json.sha, data: parsed };
    }

    try {
        // 1. GET: クラウド上の最新データを取得
        if (req.method === 'GET') {
            const current = await fetchCurrentCloudFile();
            return res.status(200).json({
                ok: true,
                deptId,
                exists: current.exists,
                cloudState: current.data
            });
        }

        // 2. POST: クラウド上に最新データを保存（最大3回リトライで同時更新競合を自動吸収）
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { staffMaster, lastActiveDate, savedTerms, termDate, termData, fullTermsMap } = body;

            for (let attempt = 0; attempt < 3; attempt++) {
                const current = await fetchCurrentCloudFile();
                const merged = (current.data && typeof current.data === 'object') ? current.data : {
                    deptId,
                    staffMaster: null,
                    lastActiveDate: '2026-04-01',
                    savedTerms: [],
                    terms: {},
                    updatedAt: null
                };

                if (Array.isArray(staffMaster)) {
                    merged.staffMaster = staffMaster;
                }
                if (lastActiveDate) {
                    merged.lastActiveDate = lastActiveDate;
                }
                if (Array.isArray(savedTerms)) {
                    const termSet = new Set([...(merged.savedTerms || []), ...savedTerms]);
                    merged.savedTerms = Array.from(termSet).sort();
                }
                if (!merged.terms || typeof merged.terms !== 'object') {
                    merged.terms = {};
                }
                // 既存のタームデータからも冗長な lastSolveStats を除去してスリム化
                Object.keys(merged.terms).forEach(k => {
                    merged.terms[k] = slimTermData(merged.terms[k]);
                });
                if (fullTermsMap && typeof fullTermsMap === 'object') {
                    Object.keys(fullTermsMap).forEach(k => {
                        merged.terms[k] = slimTermData(fullTermsMap[k]);
                    });
                }
                if (termDate && termData) {
                    merged.terms[termDate] = slimTermData(termData);
                    if (!merged.savedTerms.includes(termDate)) {
                        merged.savedTerms.push(termDate);
                        merged.savedTerms.sort();
                    }
                }
                merged.updatedAt = new Date().toISOString();

                const payloadStr = JSON.stringify(merged);
                const base64Content = Buffer.from(payloadStr, 'utf8').toString('base64');

                const putBody = {
                    message: `Cloud sync ${deptId} at ${merged.updatedAt}`,
                    content: base64Content
                };
                if (current.sha) {
                    putBody.sha = current.sha;
                }

                const putResp = await fetch(ghApiUrl, {
                    method: 'PUT',
                    headers: ghHeaders,
                    body: JSON.stringify(putBody)
                });

                if (putResp.ok) {
                    return res.status(200).json({
                        ok: true,
                        deptId,
                        updatedAt: merged.updatedAt
                    });
                }

                // 409 Conflict（同時更新）の場合は再取得してリトライ
                if (putResp.status === 409 && attempt < 2) {
                    await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
                    continue;
                }

                const errText = await putResp.text();
                throw new Error(`GitHub PUT error (${putResp.status}): ${errText}`);
            }
        }

        return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    } catch (err) {
        console.error('Cloud Sync API Error:', err);
        return res.status(500).json({
            ok: false,
            error: err.message || 'Internal Server Error'
        });
    }
};
