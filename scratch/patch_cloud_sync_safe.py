import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """                // 2. 全保存タームデータのクラウド復元
                if (cloud.terms && typeof cloud.terms === 'object') {
                    Object.keys(cloud.terms).forEach(tDate => {
                        if (cloud.terms[tDate]) {
                            const curLocal = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${tDate}`);
                            let shouldApplyTerm = (!curLocal || showToastMsg || isInitialBoot);
                            if (curLocal && !showToastMsg && !isInitialBoot) {
                                try {
                                    const localT = JSON.parse(curLocal);
                                    const isLocalEmpty = !localT.outputGrid || localT.outputGrid.length === 0;
                                    const hasCloudData = (cloud.terms[tDate].outputGrid && cloud.terms[tDate].outputGrid.length > 0) || (cloud.terms[tDate].staffList && cloud.terms[tDate].staffList.some(s => s.days && s.days.some(d => d)));
                                    if (isLocalEmpty && hasCloudData) shouldApplyTerm = true;
                                } catch (e) {
                                    shouldApplyTerm = true;
                                }
                            }
                            if (shouldApplyTerm) {
                                window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${tDate}`, JSON.stringify(cloud.terms[tDate]));
                            }
                        }
                    });
                }"""

replacement = """                // 2. 全保存タームデータのクラウド同期（ローカル最新編集データおよび白紙化データの絶対保護）
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
                }"""

assert target in text, "target not found in app.js"
text = text.replace(target, replacement)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("app.js cloud terms sync patched with timestamp protection!")
