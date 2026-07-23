@echo off
title GeoLog Pro 2.0 - Iniciar Local (localhost)
color 0B

echo =======================================================================
echo               GEOLOG PRO 2.0 - INICIAR SERVIDORES LOCALES
echo =======================================================================
echo.
echo Este script realizara las siguientes tareas de forma automatica:
echo   1. Verificara dependencias del sistema (Node.js y Python).
echo   2. Instalara las dependencias si no existen (venv, npm install).
echo   3. Iniciara el Backend (FastAPI) y el Frontend (React + Vite).
echo   4. Abrira tu navegador de forma automatica en localhost.
echo.
echo Al cerrar esta ventana o presionar ENTER, se detendran los servidores
echo de manera limpia.
echo =======================================================================
echo.
:: 0. Restauración de Emergencia de Entorno Local (.env)
echo [0/3] Verificando estado del archivo de configuracion .env...

:: Restaurar respaldo si compartir_proyecto.bat fue cerrado de forma imprevista
if exist frontend\.env.backup (
    echo [RESTORE] Restableciendo frontend\.env desde la copia de seguridad...
    copy /y frontend\.env.backup frontend\.env >nul
    del /f /q frontend\.env.backup >nul
    echo OK: Configuracion .env restaurada correctamente desde backup.
)

:: Verificar si el .env actual contiene URLs de Cloudflare no deseadas
findstr /i "trycloudflare.com" frontend\.env >nul 2>&1
if %errorlevel% equ 0 (
    echo [CLEANUP] Limpiando enlace residual de Cloudflare en frontend\.env...
    (
        echo # URL base para la API en el frontend
        echo VITE_API_BASE=
        echo.
        echo # Target del proxy local de Vite ^(adonde se redirigen las peticiones locales a /api^)
        echo VITE_PROXY_TARGET=http://127.0.0.1:8000
    ) > frontend\.env
    echo OK: frontend\.env limpiado para trabajo en localhost.
)

:: Detener cualquier proceso residual de cloudflared
taskkill /f /im cloudflared.exe >nul 2>&1
echo OK: Entorno local verificado.
echo.

:: 1. Verificar dependencias
echo [1/3] Verificando instalacion de herramientas en el sistema...
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Python no esta instalado o no fue agregado al PATH.
    pause
    exit /b
)
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Node.js no esta instalado o no fue agregado al PATH.
    pause
    exit /b
)
echo OK: Herramientas listas.
echo.

:: 2. Configurar backend y frontend si no tienen dependencias
echo [2/3] Comprobando dependencias de servidores...
cd backend
if not exist venv (
    echo Creando entorno virtual de Python [venv]...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Instalando dependencias de Python (requirements.txt)...
pip install -r requirements.txt >nul 2>&1
cd ..

cd frontend
if not exist node_modules (
    echo Instalando modulos de Node.js [esto puede tardar]...
    call npm install >nul 2>&1
)
cd ..
echo OK: Dependencias instaladas y listas.
echo.

:: 3. Liberar puertos 5173 y 8000 si estuvieran en uso
echo [3/3] Liberando puertos 5173 y 8000 e iniciando servidores...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Iniciar Backend
start "GeoLog Pro 2.0 - Backend (FastAPI)" cmd /k "cd backend && call venv\Scripts\activate.bat && python run.py"

:: Iniciar Frontend
start "GeoLog Pro 2.0 - Frontend (React + Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo =======================================================================
echo ¡Servidores locales iniciados correctamente!
echo.
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo =======================================================================
echo.
echo Presiona ENTER en esta ventana para apagar los servidores...
echo.

:: Esperar 3 segundos y abrir navegador
timeout /t 3 /nobreak >nul 2>&1
start http://localhost:5173

pause >nul

:: Apagar los servidores al presionar ENTER
echo Apagando servidores...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo Todo limpio. ¡Hasta luego!
