# GeoLog Pro 2.0

Sistema de logueo geotécnico y cálculo de Rock Mass Rating (RMR'76 y RMR'89) para testigos de perforación diamantina.

## Requisitos del Sistema

* **Node.js** (versión 18 o superior)
* **Python** (versión 3.10 o superior)

---

## Cómo Iniciar el Proyecto

### En Windows (Recomendado)
El proyecto incluye un script de automatización en la raíz. Solo debes ejecutar el archivo haciendo doble clic:

* **[iniciar_proyecto.bat](./iniciar_proyecto.bat)**

Este script verificará el entorno, creará el entorno virtual de Python, instalará las dependencias necesarias y levantará tanto el frontend como el backend de manera simultánea.

### Compartir el Proyecto a Internet (Túnel de Cloudflare)
Si deseas que otras personas fuera de tu red local puedan ver y probar tu avance en tiempo real desde cualquier lugar:

* Haz doble clic en **[iniciar_compartido.bat](./iniciar_compartido.bat)**.

Este script es "Todo en Uno". Se encargará de:
1. Liberar los puertos `5173` y `8000` de cualquier proceso colgado anterior para evitar conflictos de puerto.
2. Iniciar automáticamente el backend y el frontend.
3. Descargar e iniciar el túnel seguro de Cloudflare.
4. Modificar temporalmente el `.env` del frontend con la URL pública generada.
5. **Abrir tu navegador de forma automática** con el enlace público listo para compartir.

*Nota:* Al presionar `ENTER` o cerrar la consola principal, el script apagará de forma limpia los servidores de React y FastAPI, cerrará el túnel de Cloudflare y restaurará el archivo `.env` a su estado local original.

---

### En Linux / macOS (Manual)

#### 1. Backend (FastAPI)
Desde la carpeta raíz:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```
El servidor backend iniciará en [http://127.0.0.1:8000](http://127.0.0.1:8000).

#### 2. Frontend (React + Vite)
Desde la carpeta raíz en otra terminal:
```bash
cd frontend
npm install
npm run dev
```
La interfaz web estará disponible en [http://localhost:5173](http://localhost:5173).

---

## Base de Datos

Por defecto se utiliza una base de datos local SQLite para desarrollo local sin configuraciones adicionales.

* **Archivo de base de datos:** `backend/app/geolog.db`
* **Semilla / Datos iniciales:** Incluye los catálogos geológicos base (litologías, resistencias, rellenos) y un taladro de prueba histórico (`FEGT20-001`).

### Producción (MS SQL Server / PostgreSQL)
Para cambiar de motor de base de datos, configure la variable de entorno `DATABASE_URL` antes de iniciar el servidor backend.

Ejemplo para MS SQL Server:
```bash
set DATABASE_URL=mssql+pymssql://usuario:contrasena@servidor:1433/database
python run.py
```

---

## Funcionalidades Principales

* **Cálculo de RMR Rápido:** Implementación de fórmulas continuas para RQD (polinomio cúbico) y espaciamiento (curvas logarítmicas de Bieniawski).
* **Validación QA/QC Reactiva:** Alertas en el navegador al ingresar datos incongruentes (ej. RQD mayor que la longitud recuperada).
* **Mapeo de Discontinuidades:** Asociación automática de las estructuras registradas en `LG EST.` a sus respectivas corridas de `LGG` mediante análisis espacial.
* **Respaldo Local:** Almacenamiento automático en localStorage en caso de desconexión.
