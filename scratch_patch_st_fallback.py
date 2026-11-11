# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

t_iter = """                for (const pair of candidatePairs) {
                    for (const s of floorStaff) {
                        if (this.grid[s][pair.h].isFixed || this.grid[s][pair.l].isFixed) continue;
                        const symH = this.grid[s][pair.h].symbol;
                        const symL = this.grid[s][pair.l].symbol;
                        if (!isWorkSymbol(symH) || symL !== SYMBOLS.OFF) continue;

                        // スケ可保護: pair.h から s が抜けても残りのスケ可スタッフがいるか
                        if (this.staffList[s].canSched) {
                            let remSched = 0;
                            floorStaff.forEach(oS => {
                                if (oS !== s && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][pair.h].symbol)) {
                                    remSched++;
                                }
                            });
                            if (remSched < 1) continue;
                        }

                        // スワップ試行
                        const nextSymL = (symH === '早') ? '早' : SYMBOLS.WORK;
                        this.setSymbol(s, pair.h, SYMBOLS.OFF, false);
                        this.setSymbol(s, pair.l, nextSymL, false);

                        if (this.isStaffHardValid(s)) {
                            improved = true;
                            break;
                        } else {
                            this.setSymbol(s, pair.h, symH, false);
                            this.setSymbol(s, pair.l, symL, false);
                        }
                    }
                    if (improved) break;
                }
                if (!improved) break;"""

r_iter = """                for (const pair of candidatePairs) {
                    for (const s of floorStaff) {
                        if (this.grid[s][pair.h].isFixed || this.grid[s][pair.l].isFixed) continue;
                        const symH = this.grid[s][pair.h].symbol;
                        const symL = this.grid[s][pair.l].symbol;
                        if (!isWorkSymbol(symH) || symL !== SYMBOLS.OFF) continue;

                        // スケ可保護: pair.h から s が抜けても残りのスケ可スタッフがいるか
                        if (this.staffList[s].canSched) {
                            let remSched = 0;
                            floorStaff.forEach(oS => {
                                if (oS !== s && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][pair.h].symbol)) {
                                    remSched++;
                                }
                            });
                            if (remSched < 1) continue;
                        }

                        // スワップ試行
                        const nextSymL = (symH === '早') ? '早' : SYMBOLS.WORK;
                        this.setSymbol(s, pair.h, SYMBOLS.OFF, false);
                        this.setSymbol(s, pair.l, nextSymL, false);

                        if (this.isStaffHardValid(s)) {
                            improved = true;
                            break;
                        } else {
                            this.setSymbol(s, pair.h, symH, false);
                            this.setSymbol(s, pair.l, symL, false);
                        }
                    }
                    if (improved) break;
                }
                if (!improved) {
                    // 距離ソートで届かなかった場合、超過日(realSum >= 3.0)と全公休日でフォールバックスワップ探索
                    for (let dH = 0; dH < this.numDays; dH++) {
                        let rH = 0;
                        floorStaff.forEach(s => { rH += getSTRealWork(s, dH); });
                        if (rH < 3.0) continue;

                        for (let dL = 0; dL < this.numDays; dL++) {
                            if (dH === dL) continue;
                            let rL = 0;
                            floorStaff.forEach(s => { rL += getSTRealWork(s, dL); });
                            if (rL > 2.0) continue;

                            for (const s of floorStaff) {
                                if (this.grid[s][dH].isFixed || this.grid[s][dL].isFixed) continue;
                                const symH = this.grid[s][dH].symbol;
                                const symL = this.grid[s][dL].symbol;
                                if (!isWorkSymbol(symH) || symL !== SYMBOLS.OFF) continue;

                                if (this.staffList[s].canSched) {
                                    let remSched = 0;
                                    floorStaff.forEach(oS => {
                                        if (oS !== s && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][dH].symbol)) {
                                            remSched++;
                                        }
                                    });
                                    if (remSched < 1) continue;
                                }

                                const nextSymL = (symH === '早') ? '早' : SYMBOLS.WORK;
                                this.setSymbol(s, dH, SYMBOLS.OFF, false);
                                this.setSymbol(s, dL, nextSymL, false);

                                if (this.isStaffHardValid(s)) {
                                    improved = true;
                                    break;
                                } else {
                                    this.setSymbol(s, dH, symH, false);
                                    this.setSymbol(s, dL, symL, false);
                                }
                            }
                            if (improved) break;
                        }
                        if (improved) break;
                    }
                }
                if (!improved) break;"""

if t_iter in content:
    content = content.replace(t_iter, r_iter, 1)
    print("ST fallback swap added.")
else:
    print("Warning: t_iter not found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
