import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# pullStateFromCloud 内の terms 同期処理を確認
pos = text.find('// 2. 全保存タームデータのクラウド同期')
if pos != -1:
    print(text[pos:pos+1200])
else:
    print("terms sync comment not found")
    pos2 = text.find('cloud.terms')
    print(text[pos2:pos2+1000])
