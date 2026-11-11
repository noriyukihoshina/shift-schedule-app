with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''            });
            // ★ ユーザー指示: まだ組んでいない時は勝手なハーフマン加算を行わず正確に0にする（フォールバック加算完全撤廃）

            }
        });'''

replacement = '''            });
            // ★ ユーザー指示: まだ組んでいない時は勝手なハーフマン加算を行わず正確に0にする（フォールバック加算完全撤廃）
        });'''

if target in text:
    text = text.replace(target, replacement, 1)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed extra closing brace successfully.")
else:
    print("Warning: target not found.")
