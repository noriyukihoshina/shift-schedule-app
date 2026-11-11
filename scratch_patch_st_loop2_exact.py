with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old = """                // フロア出勤人数の範囲チェック（2〜3名を維持）
                let flWorkHigh = 0;
                let flWorkLow = 0;
                for (let oS = 0; oS < this.numStaff; oS++) {
                    if (oS !== s && !this.staffList[oS].isUnused && this.staffList[oS].floor === fl) {
                        if (isWorkSymbol(this.grid[oS][highD.d].symbol)) flWorkHigh++;
                    }
                    if (!this.staffList[oS].isUnused && this.staffList[oS].floor === fl) {
                        if (isWorkSymbol(this.grid[oS][lowD.d].symbol)) flWorkLow++;
                    }
                }
                if (flWorkHigh < 2 || flWorkLow >= 3) continue;"""

target_new = """                // フロア出勤実数の範囲チェック（1.5〜3.0実数を維持）
                let flRealHigh = 0;
                let flRealLow = 0;
                for (let oS = 0; oS < this.numStaff; oS++) {
                    if (oS !== s && !this.staffList[oS].isUnused && this.staffList[oS].floor === fl) {
                        flRealHigh += getSTRealWork(oS, highD.d);
                    }
                    if (!this.staffList[oS].isUnused && this.staffList[oS].floor === fl) {
                        flRealLow += getSTRealWork(oS, lowD.d);
                    }
                }
                if (flRealHigh < 1.5 || flRealLow >= 3.0) continue;"""

if target_old in content:
    content = content.replace(target_old, target_new)
    print("Replaced ST loop2 bounds check with real work")
else:
    print("ST loop2 target not found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js successfully!")
