// 4人(s0, s1=0.5, s2, s3)の公休パターン検証
const days = 28;
// s0 (スケ可A, 1.0): [0, 4, 7, 11, 14, 18, 21, 25]
// s1 (スケ可B, 0.5): [2, 5, 9, 12, 16, 19, 23, 26] (s0と完全直交)
// s2 (1.0):          [1, 6, 8, 13, 15, 20, 22, 27]
// s3 (1.0):          [2, 5, 9, 12, 16, 19, 23, 26] -> s1と同じ日に休む！

const p0 = [0, 4, 7, 11, 14, 18, 21, 25];
const p1 = [2, 5, 9, 12, 16, 19, 23, 26];
const p2 = [1, 6, 8, 13, 15, 20, 22, 27];
const p3 = [2, 5, 9, 12, 16, 19, 23, 26];

const realLoads = [];
const workLoads = [];
for (let d = 0; d < 28; d++) {
    let r = 0;
    let w = 0;
    if (!p0.includes(d)) { r += 1.0; w++; }
    if (!p1.includes(d)) { r += 0.5; w++; }
    if (!p2.includes(d)) { r += 1.0; w++; }
    if (!p3.includes(d)) { r += 1.0; w++; }
    realLoads.push(r);
    workLoads.push(w);
}
console.log('Work loads:', workLoads.join(' '));
console.log('Real loads:', realLoads.join(' '));
console.log('Min Real:', Math.min(...realLoads), 'Max Real:', Math.max(...realLoads), 'Spread:', Math.max(...realLoads) - Math.min(...realLoads));
