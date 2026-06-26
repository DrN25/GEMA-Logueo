import sqlite3
import os

db_path = r"c:\Users\Rafael\UNSA\Projects\Ing. Materiales\backend\app\geolog.db"

if not os.path.exists(db_path):
    print("Database path not found:", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Clean whitespace and newlines from lookup tables
tables_to_clean = [
    ("Litologia1", "nombre"),
    ("Litologia2", "nombre"),
    ("Litologia3", "nombre"),
    ("TipoRotura", "descripcion"),
    ("DireccionRotura", "descripcion"),
    ("GradoIntemperismo", "descripcion"),
    ("PresenAgua", "presen_water"),
    ("TipoEstructura", "tipoEstructura"),
    ("TipoEstructura", "traslacion"),
    ("TipoRelleno", "descripcion"),
    ("RugosidadForma", "descripcion"),
]

for table, col in tables_to_clean:
    try:
        cursor.execute(f"UPDATE {table} SET {col} = trim(replace(replace({col}, char(13), ''), char(10), ''));")
        print(f"Cleaned table '{table}', column '{col}'")
    except Exception as e:
        print(f"Error cleaning table '{table}', column '{col}':", e)

# 2. Insert missing entries in TipoRotura
tipo_roturas = [
    ('M', 'Rotura por matriz (Si la muestra no se rompe no se considera M)'),
    ('E', 'Rotura por estructura'),
    ('C', 'Rotura combinada, por matriz y estructura')
]
for code, desc in tipo_roturas:
    cursor.execute("SELECT COUNT(*) FROM TipoRotura WHERE code = ?;", (code,))
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO TipoRotura (code, descripcion) VALUES (?, ?);", (code, desc))
        print(f"Inserted TipoRotura: {code}")
    else:
        cursor.execute("UPDATE TipoRotura SET descripcion = ? WHERE code = ?;", (desc, code))
        print(f"Updated TipoRotura: {code}")

# 3. Insert missing entries in DireccionRotura
direccion_roturas = [
    ('Pa', 'Paralela a los planos de debilidad (estratificacion, foliacion)'),
    ('Pe', 'Perpendicular a los planos de debilidad (estratificacion, foliacion)'),
    ('NA', 'No aplica (rocas masivas sin planos de debilidad)')
]
for code, desc in direccion_roturas:
    cursor.execute("SELECT COUNT(*) FROM DireccionRotura WHERE code = ?;", (code,))
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO DireccionRotura (code, descripcion) VALUES (?, ?);", (code, desc))
        print(f"Inserted DireccionRotura: {code}")
    else:
        cursor.execute("UPDATE DireccionRotura SET descripcion = ? WHERE code = ?;", (desc, code))
        print(f"Updated DireccionRotura: {code}")

# 4. Insert missing entries in DiametroPerforacion
diametros = [
    ('BQ', 36.5),
    ('NQ', 47.6),
    ('HQ', 61.1),
    ('PQ', 85.0)
]
for nom, val in diametros:
    cursor.execute("SELECT COUNT(*) FROM DiametroPerforacion WHERE nominacion = ?;", (nom,))
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO DiametroPerforacion (nominacion, diametro_nominal_mm) VALUES (?, ?);", (nom, val))
        print(f"Inserted DiametroPerforacion: {nom} ({val} mm)")
    else:
        cursor.execute("UPDATE DiametroPerforacion SET diametro_nominal_mm = ? WHERE nominacion = ?;", (val, nom))
        print(f"Updated DiametroPerforacion: {nom} ({val} mm)")

conn.commit()
conn.close()
print("Database seeding and cleaning completed successfully!")
