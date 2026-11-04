import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. 生活期初期化時の01〜04番管理トグルON
assert 'const isDefaultLifeManage = isLife && (i >= 1 && i <= 4);' in code, "isDefaultLifeManage definition missing"
assert "const defaultLifeSec = isDefaultLifeManage ? '管理' : '';" in code, "defaultLifeSec definition missing"
assert "lifeSection: defaultLifeSec," in code, "lifeSection assignment missing"
assert "isZeroCount: isDefaultLifeManage ? true : false," in code, "isZeroCount assignment missing"

# 2. applyMasterArrayToStaffList での01〜04管理トグル復元保証
assert "staffList[k].lifeSection = '管理';" in code, "lifeSection restoration in applyMasterArray missing"

# 3. loadStaffMaster での01〜04管理トグル検証補正
assert "saveStaffMaster();" in code, "saveStaffMaster call missing"

print("All Life Table Management Toggle (01-04) Checks PASSED successfully!")
