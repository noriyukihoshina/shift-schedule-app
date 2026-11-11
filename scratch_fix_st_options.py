with open('scratch_test_st_sim.js', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace("deptId: 'st'", "isST: true, deptId: 'st'")
with open('scratch_test_st_sim.js', 'w', encoding='utf-8') as f:
    f.write(c)
