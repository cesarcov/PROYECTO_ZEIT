"""
Ejecuta las migraciones SQL en orden.
Uso:  python run_migrations.py
"""
import os
import sys
from app.core.database import db_connection

import glob as _glob
MIGRATIONS = sorted(_glob.glob("migrations/*.sql"))

def run():
    ok = 0
    for path in MIGRATIONS:
        if not os.path.exists(path):
            print(f"  SKIP  {path} (no existe)")
            continue
        print(f"  Ejecutando {path} ...")
        try:
            with open(path, encoding="utf-8") as f:
                sql = f.read()
            with db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                conn.commit()
            print(f"  OK    {path}")
            ok += 1
        except Exception as e:
            print(f"  WARN  {path}: {e}")
    print(f"\n{ok}/{len(MIGRATIONS)} migraciones aplicadas.")

if __name__ == "__main__":
    run()
