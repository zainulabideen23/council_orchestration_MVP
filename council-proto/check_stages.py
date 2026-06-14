from orchestrator.db import get_conn
conn = get_conn()
cur = conn.cursor()
cur.execute('SELECT id, "roundsDone", "roundsTotal", status FROM "Stage"')
for row in cur.fetchall():
    print(row)
