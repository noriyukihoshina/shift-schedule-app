with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_sc_ref = """            let freeDays = grp.dayIndices.filter(d => st.days[d] === '');
            if (st.isSectionChief) {
                const weekdayFreeDays = freeDays.filter(d => dates[d] && !dates[d].isSat && !dates[d].isSun);
                if (weekdayFreeDays.length > 0) {
                    freeDays = weekdayFreeDays;
                }
            }"""

target_new_sc_ref = """            let freeDays = grp.dayIndices.filter(d => st.days[d] === '');
            // ★ 係長および土日固定休（生活期PatternA・土日休トグル等）は、土日の公休8日を侵食せず公休8日＋リフ1日を満額確保するため平日を優先抽出！
            const isSatSunOffStaff = st.isSectionChief || !!st.isSatSunOff || (st.lifeSection === '訪問' || st.lifeSection === '管理' || st.lifeSection === 'Cl1' || st.haSection === 'ハ1' || st.haSection === 'ハ2');
            if (isSatSunOffStaff) {
                const weekdayFreeDays = freeDays.filter(d => dates[d] && !dates[d].isSat && !dates[d].isSun);
                if (weekdayFreeDays.length > 0) {
                    freeDays = weekdayFreeDays;
                }
            }"""

if target_old_sc_ref in content:
    content = content.replace(target_old_sc_ref, target_new_sc_ref)
    print("Replaced sc ref freedays")
else:
    print("sc ref freedays NOT found!")

target_old_score = """                // 3. 土日祝日の適正分散（係長は土日公休と連休になる金曜・月曜等の平日を高評価）
                const dObj = dates[d];
                if (st.isSectionChief) {
                    if (!dObj.isSun && !dObj.isSat) score += 50;
                    if (dObj.wIdx === 0 || dObj.wIdx === 4) score += 25; // 月曜・金曜は土日と3連休になるため優遇
                } else if (dObj.isSun || dObj.isSat || dObj.isHol) {
                    score += 5;
                }"""

target_new_score = """                // 3. 土日祝日の適正分散（係長・土日固定休スタッフは土日公休と連休になる金曜・月曜等の平日を高評価）
                const dObj = dates[d];
                const isSatSunStaff = st.isSectionChief || !!st.isSatSunOff || (st.lifeSection === '訪問' || st.lifeSection === '管理' || st.lifeSection === 'Cl1' || st.haSection === 'ハ1' || st.haSection === 'ハ2');
                if (isSatSunStaff) {
                    if (!dObj.isSun && !dObj.isSat) score += 50;
                    if (dObj.wIdx === 0 || dObj.wIdx === 4) score += 35; // 月曜・金曜は土日と3連休になるため超優遇
                    if (dObj.isSun || dObj.isSat) score -= 200; // 土日は公休枠のためリフ配置を避ける
                } else if (dObj.isSun || dObj.isSat || dObj.isHol) {
                    score += 5;
                }"""

if target_old_score in content:
    content = content.replace(target_old_score, target_new_score)
    print("Replaced score ref")
else:
    print("score ref NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js ref allocation successfully!")
