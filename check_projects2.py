from orchestrator.db import get_conn
conn = get_conn()
cur = conn.cursor()
cur.execute('SELECT id, "currentStageId" FROM "Project"')
for row in cur.fetchall():
    print(row)
