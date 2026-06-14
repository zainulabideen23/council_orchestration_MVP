from orchestrator.db import get_conn
conn = get_conn()
cur = conn.cursor()
cur.execute('SELECT id, "stageId", "roundNumber", status FROM "Round"')
for row in cur.fetchall():
    print(row)
