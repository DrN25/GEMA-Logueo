# Medición de auditorías Excel en GEMA-Logueo

Ejecutar desde el directorio backend con el mismo Python y las mismas versiones de
dependencias para cada par de corridas.

```powershell
$py = (Resolve-Path '.\venv\Scripts\python.exe').Path
& $py -m pip install -r requirements-benchmark.txt
& $py -m pytest -q
```

## Medir el backend real en Windows

Arrancar Logueo con su configuración local ya comprobada, un worker y sin
`--reload`. En otra terminal, iniciar el monitor antes de subir el archivo por
la interfaz. Dejar unos segundos de reposo inicial y final, y detener el monitor
con Ctrl+C cuando se haya podido consultar y descargar el reporte.

```powershell
$workerId = Get-NetTCPConnection -LocalPort 8001 -State Listen |
    Select-Object -ExpandProperty OwningProcess -Unique
& $py benchmarks/monitor.py --pid $workerId --output 'C:/Users/Rodrigo/Documents/Codex/ram-logueo-ddh-01'
```

El directorio de salida debe ser nuevo. `samples.csv` contiene RSS cada 50 ms;
`summary.json` contiene picos observados, máximo histórico del SO cuando está
disponible y tiempo. El máximo histórico incluye toda la vida del proceso.
En Windows el lanzador del venv puede tener un hijo Python con la RAM real:
revisar también `largest_process_peak_rss_bytes` y los PID del CSV. El agregado
de RSS de procesos puede contar páginas compartidas varias veces.

## Comparar código anterior y candidato sin SQL ni interfaz

`run_case.py` invoca el pipeline DDH y el handler PLT reales, sin importar
`app.main`. Redirige el diagnóstico, el resumen y el XLSX a un directorio de
corrida nuevo. Esto incluye la generación del reporte, pero excluye arranque de
Uvicorn, middleware, red y base SQL. El monitor inicia antes del proceso y
`worker.log` conserva los puntos de inicio y publicación.

Para DDH, crear un archivo JSON de configuración con los nombres exactos
confirmados en el asistente. Por ejemplo, para el libro tradicional:

```json
{
  "formato": "tradicional",
  "lgg": {"sheet": "BD LGG"},
  "est": {"sheet": "BD LG EST. (2)"},
  "rmr": {"sheet": "Validación_RMR"}
}
```

```powershell
$books = 'C:/PROYECTO-GEMA/LOGUEO/Excel-Ejemplo'
$runs = 'C:/Users/Rodrigo/Documents/Codex/ram-logueo'
& $py benchmarks/monitor.py --output "$runs/ddh-01-metrics" -- $py benchmarks/run_case.py --mode ddh --output "$runs/ddh-01" --excel "$books/LGG_2020-2025_V2.xlsx" --config "$runs/ddh-config.json"
& $py benchmarks/monitor.py --output "$runs/plt-01-metrics" -- $py benchmarks/run_case.py --mode plt --output "$runs/plt-01" --excel "$books/BD_PLT_Regulares_Compilado_2020-2025.xlsx" --lgg "$books/LGG_2020-2025_V2.xlsx"
```

Para DDH con auxiliares, agregar `--collar` y `--survey`, y usar el mismo
mapeo de columnas que selecciona la interfaz. Para PLT autónomo, omitir
`--lgg`. Usar `--source` con la ruta absoluta de una copia aislada del
backend anterior para medirlo con el mismo monitor. Hacer tres corridas en
procesos nuevos por escenario, alternando anterior y candidato. Conservar
versiones, configuración, hashes de entrada y carpetas de salida.

Ejecutar `compare_outputs.py` aparte. Recibe `--before-json`, `--after-json`,
`--before-xlsx` y `--after-xlsx`. Compara incidencias, métricas, contenido y
metadatos de hojas; ignora fecha e ID de la revisión. En PLT comparar el
diagnóstico y reporte que el runner publica como `latest_diag.json` y
`latest_report.xlsx`.

## Aceptación del presupuesto compartido

Repetir después la prueba HTTP con los tres sistemas activos en un entorno
Linux con un límite compartido equivalente al del hosting. Medir el reposo
conjunto y ejecutar una revisión grande a la vez, verificando publicación del
XLSX, paginación, filtros y la descarga. En cgroup v2 registrar
`memory.current`, `memory.peak` y `memory.events` del grupo que contiene los tres
sistemas. También registrar tiempo, espacio temporal en disco y memoria
después del trabajo. Usar temporales en disco, no tmpfs. La prueba aislada
de Windows no certifica los 512 MB compartidos.
