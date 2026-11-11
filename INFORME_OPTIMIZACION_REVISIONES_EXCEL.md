# Resultados de la optimización de revisiones Excel en GEMA-Logueo

La revisión PLT con cruce LGG pasó de un pico observado de **2 387,70 MiB** a **181,80 MiB**. En DDH, la versión actual completó la revisión con LGG, Collar y Survey y alcanzó **321,90 MiB**. La selección de los tres archivos, que antes podía congelar el navegador durante varios minutos, terminó en segundos en la última prueba.

## Comparación desde la interfaz

Pruebas locales en Windows. La referencia es el backend del commit `b579435`. El monitor registró el pico de memoria residente del proceso del backend y del árbol de procesos. Ambos picos coincidieron en las corridas de la tabla.

| Flujo | Backend anterior | Backend actual | Resultado |
|---|---|---|---|
| PLT Regulares con cruce LGG | **2 387,70 MiB** · 9 151 muestras. Generó el XLSX. | **181,80 MiB** · 1 455 muestras. Completó en segundos y generó el XLSX. | **92,4 % menos pico de RAM observado**, si se comparan los mismos archivos y la misma configuración de cruce. |
| DDH con LGG, Collar y Survey | Sin pico comparable. La interfaz quedó congelada durante la selección de LGG y la revisión no se inició. | **321,90 MiB** · 6 934 muestras. Selección de los tres Excel en segundos, ≈5 min de procesamiento y ≈2 min adicionales hasta habilitar la descarga. Dashboard y XLSX generados. | DDH quedó validado de punta a punta en la versión actual. La reducción de RAM frente al backend anterior queda sin cuantificar. |

La cantidad de muestras indica la cobertura del monitor. Los tiempos de cada etapa son observaciones de la prueba manual. Para comprobar el presupuesto compartido de **512 MB** del despliegue, queda medir los tres sistemas activos en el mismo entorno con una revisión grande en ejecución.

## Cambios implementados

- **Lectura de DDH.** El backend abre los Excel en modo de solo lectura, recorre las filas secuencialmente y cierra los libros al terminar. Proyecta las columnas necesarias y usa índices de taladro, corrida y profundidad para consultar los cruces.
- **Diagnóstico e historial.** Las colecciones voluminosas de auditoría se guardan temporalmente en disco. El backend reutiliza el diagnóstico que acaba de generar y recorre las incidencias del historial de forma incremental para filtrar y paginar.
- **Reportes.** Los exportadores mantienen un búfer acotado de filas y escriben el XLSX de forma incremental. Usan almacenamiento temporal privado para conservar la composición de los reportes, incluidos estilos, gráficos, fórmulas y la hoja de faltantes.
- **PLT.** El backend recibe los Excel por bloques, reduce el LGG de cruce a las columnas necesarias y usa profundidades ordenadas para contar muestras por corrida. Se corrigió el registro de la ruta de carga que provocaba el HTTP 422 al enviar el formulario multipart.
- **Selección del LGG en DDH.** El asistente prepara el mapeo en un Web Worker y recibe hasta 15 filas por hoja. El archivo original completo se envía al backend al confirmar la revisión. La prueba aislada de lectura de cabeceras del LGG de ejemplo tardó 1,36 s y detectó las hojas LGG, Estructural y RMR.

Los temporales son locales al backend. La implementación conserva el esquema de SQL Server, las reglas geotécnicas y el formato de los diagnósticos históricos.

## Validación

- **32 pruebas de backend aprobadas**. Se verificó el formulario multipart de PLT y la generación del XLSX con un cruce LGG sintético.
- Los diagnósticos y reportes de los casos sintéticos DDH y PLT coincidieron con los de la versión anterior, salvo la fecha y el ID propios de cada corrida.
- Compilación del frontend aprobada. Se comprobaron las cabeceras de los tres Excel DDH y el mapeo de hojas sintéticas con dimensiones infladas y con cabecera más abajo.
- Prueba manual final de DDH con `LGG_2020-2025_V2.xlsx`, `Collar_ferrob_chalco.xlsx` y `Survey_Ferrob_chalco.xlsx`. Prueba manual PLT con `BD_PLT_Regulares_Compilado_2020-2025.xlsx` y el mismo LGG para el cruce.

El protocolo de medición y los comandos para repetir las pruebas están en la [guía de benchmarks](backend/benchmarks/README.md).
