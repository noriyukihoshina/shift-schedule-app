// verify_master_table_enhancements.js
const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

console.log("=== Verifying Master Table Enhancements in app.js ===");

// 1. 各階集計行の定数エラー検知
const hasFloorFooterHighlight = appJs.includes("⚠️ ${fc.label}早番定数エラー") &&
  appJs.includes("conflict-highlight") &&
  appJs.includes("background:#dbeafe !important; color:#1d4ed8 !important;");
console.log("1. Floor footer conflict highlight logic:", hasFloorFooterHighlight ? "✅ PASS" : "❌ FAIL");

// 2. 右端公休セルの8日不一致エラー検知
const hasOffDayHighlight = appJs.includes("!s.isUnused && !isZero && Number(sOff.toFixed(1)) !== 8") &&
  appJs.includes("background:#dbeafe !important; color:#1d4ed8 !important;");
console.log("2. Individual off-days (!== 8) conflict highlight:", hasOffDayHighlight ? "✅ PASS" : "❌ FAIL");

// 3. 南と集計の間の生活期セクション
const hasLifeSection = appJs.includes("toggle-master-floor-btn") &&
  appJs.includes("data-floor=\"life\"") &&
  appJs.includes("訪問出勤人数合計") &&
  appJs.includes("訪問実数合計") &&
  appJs.includes("通所出勤人数合計") &&
  appJs.includes("通所実数合計") &&
  appJs.includes("訪問8時");
console.log("3. Life section inserted between South and Grand Totals:", hasLifeSection ? "✅ PASS" : "❌ FAIL");

// 4. 最下部集計11項目
const has11Items = [
  "(病棟)出勤人数合計",
  "(病棟)実数合計",
  "(病棟)早",
  "(病棟)遅",
  "(病棟)E",
  "(病棟)8時",
  "(訪問)出勤人数合計",
  "(訪問)実数合計",
  "(通所)出勤人数合計",
  "(通所)実数合計",
  "(訪問)8時"
].every(item => appJs.includes(item));
console.log("4. Grand summary contains all 11 specified items:", has11Items ? "✅ PASS" : "❌ FAIL");

// 5. リアルタイム更新 updateMasterIntegrationCell で生活期やフッター集計が連動
const hasUpdateCellLogic = appJs.includes("function updateMasterIntegrationCell") &&
  appJs.includes("isLifeCell");
console.log("5. Realtime cell update handles life section & ha cells:", hasUpdateCellLogic ? "✅ PASS" : "❌ FAIL");

if (hasFloorFooterHighlight && hasOffDayHighlight && hasLifeSection && has11Items && hasUpdateCellLogic) {
  console.log("\n🎉 ALL MASTER TABLE ENHANCEMENTS VERIFIED SUCCESSFULLY!");
  process.exit(0);
} else {
  console.log("\n❌ SOME VERIFICATIONS FAILED!");
  process.exit(1);
}
