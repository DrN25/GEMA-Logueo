import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Función simple para cargar archivo .env sin dependencias externas
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

load_dotenv()

# Obtener URL de conexión directa si está definida (ej. SQLite o URL completa)
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    # Construir conexión de SQL Server
    db_server = os.environ.get("DB_SERVER", "localhost\\SQLEXPRESS")
    db_name = os.environ.get("DB_NAME", "db_ingreso_data_v1")
    db_trusted = os.environ.get("DB_TRUSTED", "yes").lower() == "yes"
    db_user = os.environ.get("DB_USER", "")
    db_password = os.environ.get("DB_PASSWORD", "")
    db_driver = os.environ.get("DB_DRIVER", "SQL Server") # fallback simple

    if db_trusted:
        conn_str = f"DRIVER={{{db_driver}}};SERVER={db_server};DATABASE={db_name};Trusted_Connection=yes;"
    else:
        conn_str = f"DRIVER={{{db_driver}}};SERVER={db_server};DATABASE={db_name};UID={db_user};PWD={db_password};"
    
    params = urllib.parse.quote_plus(conn_str)
    DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={params}"

# Configuraciones específicas por dialecto
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

