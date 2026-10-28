$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appJsPath = Join-Path $scriptDir "app.js"
$code = [System.IO.File]::ReadAllText($appJsPath, [System.Text.Encoding]::UTF8)

# 1. setCloudStatusBadge と updateSaveStatusUI の強化
$target1 = @'
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
            badgeText.textContent = customText || `☁️ クラウド自動保存済 (${nowStr}) [クラウド専用]`;
            if (badge) { badge.style.background = '#ecfdf5'; badge.style.color = '#047857'; badge.style.borderColor = '#a7f3d0'; }
            if (dot) dot.style.background = '#10b981';
        } else {
            badgeText.textContent = customText || `☁️ クラウド保存待機中 (${nowStr})`;
            if (badge) { badge.style.background = '#fef3c7'; badge.style.color = '#b45309'; badge.style.borderColor = '#fcd34d'; }
            if (dot) dot.style.background = '#f59e0b';
        }
    }

    function updateSaveStatusUI(savedDate) {
        const timeStr = (savedDate || new Date()).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        if (isCloudInitialSyncDone && !isRestoringFromCloud) {
            scheduleCloudSync();
        } else {
            setCloudStatusBadge('syncing', `☁️ クラウド同期中 (${timeStr})`);
        }
    }
'@

$replace1 = @'
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
'@

# 改行コードの差異を吸収して置換
$target1Norm = $target1.Replace("`r`n", "`n")
$codeNorm = $code.Replace("`r`n", "`n")
if ($codeNorm.Contains($target1Norm)) {
    $codeNorm = $codeNorm.Replace($target1Norm, $replace1.Replace("`r`n", "`n"))
    Write-Output "Applied fix 1 (setCloudStatusBadge & updateSaveStatusUI)"
} else {
    Write-Error "Failed to find target1"
}

# 2. attachInputTableEvents の day-cell での保存
$target2 = @'
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
'@

$replace2 = @'
                        } else {
                            staffList[s].days[d] = '○';
                            cell.textContent = '○';
                            cell.classList.add('fixed-cell');
                            showToast(`🛡️ No.${staffList[s].id} を事前固定「○」（赤字保護）に設定しました`);
                        }
                        saveCurrentTermToStorage(); // ★ Pトグル時も即時自動保存
                    }
                    return;
                }

                if (type === 'prev') {
                    const p = parseInt(cell.dataset.p, 10);
                    if (staffList[s].prevDays[p] !== newSym) {
                        pushHistory();
                        staffList[s].prevDays[p] = newSym;
                        cell.textContent = newSym;
                        saveCurrentTermToStorage(); // ★ 前月実績編集時も即時自動保存
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
                            saveCurrentTermToStorage(); // ★ 希望セル編集時も即時自動保存！
                        };
'@

$target2Norm = $target2.Replace("`r`n", "`n")
if ($codeNorm.Contains($target2Norm)) {
    $codeNorm = $codeNorm.Replace($target2Norm, $replace2.Replace("`r`n", "`n"))
    Write-Output "Applied fix 2 (input day-cell saveCurrentTermToStorage)"
} else {
    Write-Error "Failed to find target2"
}

# 3. attachOutputTableEvents の day-cell での保存
$target3 = @'
                    showToast(cellData.isFixed
                        ? `🛡️ 【No.${staff.id} ${staff.name}】${dateInfo.label} をプロテクト（固定希望・赤字）に設定しました`
                        : `🔓 【No.${staff.id} ${staff.name}】${dateInfo.label} のプロテクトを解除しました`);
                    return;
                }
'@

$replace3 = @'
                    showToast(cellData.isFixed
                        ? `🛡️ 【No.${staff.id} ${staff.name}】${dateInfo.label} をプロテクト（固定希望・赤字）に設定しました`
                        : `🔓 【No.${staff.id} ${staff.name}】${dateInfo.label} のプロテクトを解除しました`);
                    saveCurrentTermToStorage(); // ★ 修正作業エリアでのプロテクト操作を即時自動保存！
                    return;
                }
'@

$target3Norm = $target3.Replace("`r`n", "`n")
if ($codeNorm.Contains($target3Norm)) {
    $codeNorm = $codeNorm.Replace($target3Norm, $replace3.Replace("`r`n", "`n"))
    Write-Output "Applied fix 3 (output protect saveCurrentTermToStorage)"
} else {
    Write-Error "Failed to find target3"
}

$target4 = @'
                    // ★ リアルタイム制約チェック＆網掛け更新（現在開いているタブに合わせてチェック）
                    const activeTab = document.querySelector('.tab-panel.active')?.id;
                    if (activeTab === 'outputTab') {
                        checkWorkAreaConstraints(false);
                    } else {
                        checkFinalConstraints(false);
                    }
                };
'@

$replace4 = @'
                    // ★ リアルタイム制約チェック＆網掛け更新（現在開いているタブに合わせてチェック）
                    const activeTab = document.querySelector('.tab-panel.active')?.id;
                    if (activeTab === 'outputTab') {
                        checkWorkAreaConstraints(false);
                    } else {
                        checkFinalConstraints(false);
                    }
                    saveCurrentTermToStorage(); // ★ 修正作業エリアでの記号編集を即時自動保存！
                };
'@

$target4Norm = $target4.Replace("`r`n", "`n")
if ($codeNorm.Contains($target4Norm)) {
    $codeNorm = $codeNorm.Replace($target4Norm, $replace4.Replace("`r`n", "`n"))
    Write-Output "Applied fix 4 (output day-cell saveCurrentTermToStorage)"
} else {
    Write-Error "Failed to find target4"
}

# 4. STテーブル描画ロジックのフロア判定拡張 & フォールバック救済
$target5 = @'
            stFloors.forEach((fl) => {
                const flStaffIndices = validStaffIndices.filter(s => {
                    const st = staffList[s];
                    return st.floor === fl.key || (st.floor && st.floor.includes(fl.key));
                });
'@

$replace5 = @'
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
'@

$target5Norm = $target5.Replace("`r`n", "`n")
if ($codeNorm.Contains($target5Norm)) {
    $codeNorm = $codeNorm.Replace($target5Norm, $replace5.Replace("`r`n", "`n"))
    Write-Output "Applied fix 5 (ST floor matching logic)"
} else {
    Write-Error "Failed to find target5"
}

# ST未設定スタッフ救済ブロックの追加（stFloors.forEach の直後）
$target6 = @'
                });
            });
        } else {
            validStaffIndices.forEach((s, outIdx) => {
'@

$replace6 = @'
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
                        const cls = cell.isFixed ? 'day-cell fixed-cell' : 'day-cell auto-cell';
                        const thickCls = ((d + 1) % 7 === 0) ? 'border-thick-right' : '';
                        bodyHtml += `<td class="${cls} ${thickCls}" data-s="${s}" data-d="${d}">${displaySym}</td>`;
                    }
                    bodyHtml += `
                        <td class="stat-cell" data-s="${s}" data-stat="work">${staffStat.workDays}</td>
                        <td class="stat-cell" data-s="${s}" data-stat="off">${staffStat.offDays}</td>
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
'@

$target6Norm = $target6.Replace("`r`n", "`n")
if ($codeNorm.Contains($target6Norm)) {
    $codeNorm = $codeNorm.Replace($target6Norm, $replace6.Replace("`r`n", "`n"))
    Write-Output "Applied fix 6 (ST unassigned staff fallback)"
} else {
    Write-Error "Failed to find target6"
}

# ファイル書き戻し
[System.IO.File]::WriteAllText($appJsPath, $codeNorm, [System.Text.Encoding]::UTF8)
Write-Output "Successfully updated app.js!"
