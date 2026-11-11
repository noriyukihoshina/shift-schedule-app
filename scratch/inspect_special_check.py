import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function validateScheduleGrid')
if pos != -1:
    body = text[pos:pos+20000]
    # 早番（早）の人数チェックを探す
    p = body.find('早番')
    if p != -1:
        print("Found '早番' in validateScheduleGrid:")
        print(body[p-100:p+800])
