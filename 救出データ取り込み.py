import json
import os
import glob
import sys

def import_rescue_data(json_file_path=None):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)

    if not json_file_path:
        # 救出データ*.json を探索
        matches = glob.glob(os.path.join(base_dir, "救出データ*.json"))
        if not matches:
            matches = glob.glob(os.path.join(base_dir, "..", "救出データ*.json"))
        if not matches:
            print("救出データJSONファイルが見つかりません。")
            return False
        json_file_path = matches[0]

    print(f"取り込み対象ファイル: {json_file_path}")
    with open(json_file_path, "r", encoding="utf-8") as f:
        rescue = json.load(f)

    all_keys = rescue.get("allRawKeys", {})
    depts = ["1f", "2f", "3f", "south", "life", "st", "master"]

    imported_total = 0

    for d in depts:
        master_key = f"shift_schedule_{d}_staff_master"
        staff_master = all_keys.get(master_key)
        
        target_json = os.path.join(data_dir, f"dept_{d}.json")
        current_data = {}
        if os.path.exists(target_json):
            try:
                with open(target_json, "r", encoding="utf-8") as f:
                    current_data = json.load(f)
            except Exception:
                current_data = {}

        updated = False
        if staff_master and isinstance(staff_master, list):
            valid_names = [s for s in staff_master if s and s.get("name") and not s.get("name").startswith("スタッフ ")]
            if valid_names:
                print(f"【{d}】 有効なスタッフ名 {len(valid_names)} 名を反映します")
                current_data["staffMaster"] = staff_master
                imported_total += len(valid_names)
                updated = True

        # タームデータも反映
        terms_map = current_data.get("terms", {})
        saved_terms = set(current_data.get("savedTerms", []))
        
        for k, v in all_keys.items():
            if k.startswith(f"shift_schedule_{d}_term_"):
                term_date = k.replace(f"shift_schedule_{d}_term_", "")
                terms_map[term_date] = v
                saved_terms.add(term_date)
                updated = True

        if updated:
            current_data["deptId"] = d
            current_data["terms"] = terms_map
            current_data["savedTerms"] = list(saved_terms)
            with open(target_json, "w", encoding="utf-8") as f:
                json.dump(current_data, f, ensure_ascii=False, indent=2)
            print(f"  -> {target_json} を更新完了")

    print(f"\n合計 {imported_total} 名のスタッフデータを正規の場所へ復旧・転記完了しました！")
    return True

if __name__ == "__main__":
    import_rescue_data()
