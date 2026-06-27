# Manual de Buenas Prácticas y Estrategias de Desarrollo - Geolog Pro 2.0

Este documento sirve como guía metodológica y técnica para documentar las decisiones de arquitectura, patrones de diseño y estrategias de optimización implementadas durante el refactoring de Geolog Pro 2.0. El objetivo es que sirva como referencia para futuros sistemas geotécnicos y geomecánicos dentro del departamento.

---

## 1. Patrones de Arquitectura y Modularidad

### A. Arquitectura por Características (Feature-Driven Architecture)
*   **Enfoque:** Agrupar todos los componentes visuales, hooks de estado y lógica de negocio bajo carpetas de dominio funcional (`features/lgg`, `features/structural`, `features/plt`) en lugar de usar carpetas genéricas como `components/` donde se mezclaban lógicas de distintos módulos.
*   **Beneficio:** Alta cohesión y bajo acoplamiento. Si necesitas modificar el logueo estructural, todo su código vive encapsulado en un único lugar sin contaminar otras áreas.

### B. Separación de Concernimientos (Separation of Concerns - SoC)
*   **Enfoque:** Dividir la interfaz de usuario (presentación visual) de la lógica de procesamiento matemático e importación.
*   **Beneficio:** Evita la creación de archivos gigantes ("monolitos" de más de 2000 líneas). Facilita el mantenimiento y las pruebas automatizadas al separar la UI del motor de cálculo.

---

## 2. Principios SOLID Aplicados

### A. Principio de Responsabilidad Única (Single Responsibility Principle - SRP)
*   **Enfoque:** Cada clase, función o archivo debe tener una única razón para cambiar.
    *   `DataGridLGG.tsx` solo se encarga del Layout de la vista.
    *   `useLggGridState.ts` maneja puramente el estado de datos y el motor de cálculo RMR.
    *   `ExcelImportModal.tsx` se encarga de la interfaz visual de carga y mapeo de columnas.
    *   `excelMapper.ts` maneja el procesamiento matemático del parseo de XLSX.

### B. Principio de Abierto/Cerrado (Open/Closed Principle - OCP)
*   **Enfoque:** El código debe estar abierto a la extensión pero cerrado a la modificación.
    *   **Implementación:** Diseñamos el componente `BaseEditableGrid.tsx` de forma abstracta para que maneje la navegación de teclado y estilos comunes. Mediante la inyección de `renderCell` en la configuración de columnas, podemos extender visualmente el comportamiento de celdas específicas (como colores de litología o botones de acción) sin tocar la lógica central del grid.

---

## 3. Fuente Única de la Verdad (Single Source of Truth - SSOT)

*   **Enfoque:** Todos los catálogos geomecánicos (litologías, resistencias ISRM, tipos de relleno, etc.) que se utilizaban de forma redundante en múltiples archivos visuales, fueron unificados y centralizados en `catalogData.ts`.
*   **Beneficio:** Si se agrega una nueva litología o cambia una puntuación RMR en las tablas de clasificación del RMR76/89, solo se edita en un único punto del proyecto y los cambios se propagan de forma instantánea a todas las vistas, validadores e importadores.

---

## 4. Estrategias de Rendimiento para Carga Masiva (Resiliencia)

Para garantizar que el sistema mantenga una tasa constante de **60 FPS** en el navegador tecleando y haciendo scroll, incluso con más de 10,000 registros, implementamos tres pilares de optimización:

### A. Virtualización de Listas (Windowing)
*   **Concepto:** En lugar de renderizar miles de celdas HTML complejas (lo cual satura la memoria del navegador y congela el DOM), el componente `BaseEditableGrid` calcula el tamaño del scroll y **solo dibuja en el DOM físico las filas que están visibles en la pantalla** (Viewport) más un pequeño buffer. 
*   **Resultado:** El navegador siempre siente que está renderizando solo 25-30 filas, logrando un scroll fluido e instantáneo.

### B. Memoización de Componentes (`React.memo` y `useCallback`)
*   **Concepto:** Evitar re-renders redundantes. Si el usuario modifica una celda en la fila 5, el estado principal cambia, lo que por defecto obligaría a React a reconstruir todas las filas de la grilla.
*   **Solución:** Al envolver el renderizador de fila en `React.memo` e implementar referencias estables de callbacks con `useCallback`, React ignora todas las filas cuyos datos no hayan cambiado, reduciendo el costo de cómputo en la UI a **0ms**.

### C. Actualizaciones Diferidas (Debouncing / Evento `onBlur`)
*   **Concepto:** Escribir comentarios largos actualiza el estado principal letra por letra. Esto gatilla auditorías QA/QC y recálculos matemáticos innecesarios múltiples veces por segundo.
*   **Solución:** Mantenemos la escritura fluida de forma local y actualizamos el estado principal de React únicamente al salir de la celda (`onBlur`) o tras una pausa en la escritura (`Debounce`).

---

## 5. Validación de Consistencia Geomecánica y QA/QC Reactivo

*   **Validaciones Cruzadas Multitabla:** Conservar al 100% las dependencias de datos físicas del Excel.
    *   *Balance Físico:* La sumatoria de sub-longitudes (`RQD + Roca Fracturada + Fragmentos <10cm`) no debe superar el avance de la corrida.
    *   *Integridad Geotécnica:* Si cambia el metraje de una corrida en LGG, el sistema recalcula automáticamente las asociaciones espaciales de las discontinuidades estructurales correspondientes (`LGG_Corrida.de <= Discontinuidad.Profundidad <= LGG_Corrida.a`), actualizando de forma reactiva y en tiempo real cualquier error de "profundidad huérfana".

---

## 6. Modularización Profunda y Desacoplamiento de Vista (DataGridLGG Refactor)

Para eliminar el monolito visual de la grilla de logueo geotécnico (que superaba las 1900 líneas de código y violaba el principio SRP), aplicamos un desacoplamiento estratégico en capas independientes:

### A. Desacoplamiento del Schema de Columnas (`lggColumns.tsx`)
*   **Decisión:** Extraer la definición estática y los estilos condicionales cromáticos de las 37 columnas del grid a un archivo independiente.
*   **Patrón:** Inyección de Dependencias. El Schema de columnas ahora se define como una función pura `getLggColumns` que recibe callbacks para mutación de celdas (`handleCellChange`), eliminación de filas (`deleteCorridaRow`) y resolutores de metadatos context-aware del taladro activo.
*   **Beneficio:** El componente visual de la grilla no conoce las reglas estéticas de colores de litología ni validadores individuales de celda, reduciendo drásticamente su carga cognitiva.

### B. Desacoplamiento del Motor de Exportación XLSX (`LggExportModal.tsx`)
*   **Decisión:** Extraer toda la lógica de parseo, formateo y escritura de reportes de Excel usando `xlsx` a un modal interactivo autocontenido.
*   **Patrón:** Desacoplamiento de Estados. El modal lee directamente las corridas inyectadas por el padre y utiliza el árbol del DOM (`document.getElementById`) para acceder a metadatos complementarios volátiles (como el geólogo, fecha y código de taladro), liberando a `DataGridLGG` de almacenar variables temporales de configuración de exportación.
*   **Beneficio:** Evita importar bibliotecas de gran tamaño (`xlsx`) y lógicas complejas de tramos y promedios geomecánicos dentro de la grilla principal.

### C. Desacoplamiento de Diálogos Flotantes de Collar (`CollarModals.tsx`)
*   **Decisión:** Extraer los formularios pop-up de creación y renombrado de taladros geotécnicos a componentes funcionales modulares.
*   **Patrón:** Controladores de Ciclo de Vida. El padre únicamente controla los booleanos de visibilidad (`isOpen`) y recibe los payloads procesados mediante callbacks declarativos (`onCreate` y `onRename`).
*   **Beneficio:** Limpieza absoluta del árbol JSX del componente de presentación visual.

### **Resultado Estadístico:**
*   **Líneas de código originales en `DataGridLGG.tsx`:** `1988 LOC`
*   **Líneas de código actuales tras modularizar:** `859 LOC`
*   **Reducción de tamaño del archivo:** **`~57%`** de reducción directa, incrementando sustancialmente la legibilidad, mantenimiento y facilitando pruebas unitarias.

