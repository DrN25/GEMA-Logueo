import os
import uvicorn

def load_dotenv():
    for path in [".env", "../.env", "app/.env"]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        parts = line.split("=", 1)
                        if len(parts) == 2:
                            key, val = parts[0].strip(), parts[1].strip()
                            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                                val = val[1:-1]
                            if key not in os.environ:
                                os.environ[key] = val
            break

if __name__ == "__main__":
    load_dotenv()
    
    # Asegurar la creación de tablas en la base de datos configurada (SQL Server o SQLite)
    try:
        from app.database import Base, engine
        from app import models
        print("Verificando/creando tablas de la base de datos...")
        Base.metadata.create_all(bind=engine)
        print("Tablas de base de datos verificadas con éxito.")
        
        # Ejecutar migraciones automáticas del esquema de base de datos para todas las tablas/columnas
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        
        print("Iniciando auditoría y migración automática del esquema...")
        with engine.connect() as conn:
            for table in Base.metadata.tables.values():
                table_name = table.name
                
                # Crear tabla si no existe
                if not inspector.has_table(table_name):
                    print(f"Migración: La tabla '{table_name}' no existe. Creándola...")
                    try:
                        table.create(bind=engine)
                        print(f"Tabla '{table_name}' creada con éxito.")
                    except Exception as ex:
                        print(f"Error al crear tabla '{table_name}': {ex}")
                    continue
                
                # Obtener columnas existentes en la BD
                db_cols = {col["name"].lower(): col for col in inspector.get_columns(table_name)}
                
                for col in table.columns:
                    col_name_lower = col.name.lower()
                    
                    if col_name_lower not in db_cols:
                        print(f"Migración: La columna '{col.name}' falta en la tabla '{table_name}'. Agregando...")
                        
                        # Determinar tipo de dato según el dialecto
                        type_str = str(col.type)
                        if "sqlite" in str(engine.url).lower():
                            if "float" in type_str.lower():
                                type_str = "REAL"
                            elif "varchar" in type_str.lower() or "string" in type_str.lower():
                                type_str = "TEXT"
                        else:  # SQL Server
                            if "string" in type_str.lower() or "varchar" in type_str.lower():
                                type_str = "VARCHAR(1000)"
                            elif "float" in type_str.lower():
                                type_str = "FLOAT"
                            elif "integer" in type_str.lower() or "int" in type_str.lower():
                                type_str = "INT"
                        
                        nullable_str = "NULL" if col.nullable else "NOT NULL"
                        alter_sql = f"ALTER TABLE [{table_name}] ADD [{col.name}] {type_str} {nullable_str};"
                        print(f"Ejecutando: {alter_sql}")
                        try:
                            conn.execute(text(alter_sql))
                            if hasattr(conn, 'commit'):
                                conn.commit()
                            print(f"Columna '{col.name}' agregada con éxito a la tabla '{table_name}'.")
                        except Exception as ex:
                            print(f"Error al agregar columna '{col.name}' a '{table_name}': {ex}")
                    else:
                        # Si la columna ya existe, verificar si debe ser alterada a NULL en SQL Server
                        db_col_info = db_cols[col_name_lower]
                        if db_col_info.get("nullable", True) == False and col.nullable == True:
                            if "sqlite" not in str(engine.url).lower():
                                print(f"Migración: Modificando columna '{col.name}' en '{table_name}' para permitir NULL...")
                                type_str = str(col.type)
                                if "string" in type_str.lower() or "varchar" in type_str.lower():
                                    type_str = "VARCHAR(1000)"
                                elif "float" in type_str.lower():
                                    type_str = "FLOAT"
                                elif "integer" in type_str.lower() or "int" in type_str.lower():
                                    type_str = "INT"
                                
                                alter_null_sql = f"ALTER TABLE [{table_name}] ALTER COLUMN [{col.name}] {type_str} NULL;"
                                try:
                                    conn.execute(text(alter_null_sql))
                                    if hasattr(conn, 'commit'):
                                        conn.commit()
                                    print(f"Columna '{col.name}' modificada con éxito a NULL.")
                                except Exception as ex:
                                    print(f"Advertencia al modificar columna '{col.name}' a NULL: {ex}")
        print("Migraciones automáticas completadas y verificadas.")
    except Exception as e:
        print(f"Advertencia al inicializar/migrar la base de datos: {e}")
        print("El servidor intentará continuar...")

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)

