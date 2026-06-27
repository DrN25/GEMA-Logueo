# Estándar de Nomenclatura de Archivos y Arquitectura Web

Este documento define el estándar oficial de nomenclatura de archivos y organización de componentes para el frontend de Geolog Pro 2.0 y futuros sistemas geomecánicos/geotécnicos. Su aplicación garantiza que el código sea predecible, simétrico y mantenga una alta legibilidad.

---

## 1. Reglas Generales de Capitalización

1.  **PascalCase (UpperCamelCase):** Reservado estrictamente para **Componentes React** que renderizan JSX (ej. `LggView.tsx`, `StructuralView.tsx`, `LggExportModal.tsx`).
2.  **camelCase (lowerCamelCase):** Reservado para archivos lógicos, helpers, hooks de estado, schemas de columnas o utilidades de TypeScript que no son componentes visuales (ej. `useLggState.ts`, `lggColumns.tsx`).
3.  **kebab-case (dash-case):** Reservado para hojas de estilo, archivos de configuración de compilación o documentación (ej. `tailwind.config.js`, `index.css`).

---

## 2. Nomenclatura de la Vista Principal (`*View.tsx`)

El punto de entrada principal (orquestador) de cada pestaña o feature del sistema debe llevar el sufijo **`View.tsx`**.
*   **Por qué `View`:** En patrones profesionales como MVC o MVVM, representa la "Vista Completa" de un módulo. No debe llamarse `Grid` o `Form` porque la pantalla orquesta más elementos que una sola grilla (como barras de herramientas, dashboards de KPIs, modales y validadores).

### Simetría de Vistas Principales:
*   `src/features/lgg/LggView.tsx`
*   `src/features/structural/StructuralView.tsx`
*   `src/features/plt/PltView.tsx`
*   `src/features/collar/CollarView.tsx`
*   `src/features/dashboard/MainDashboard.tsx`

---

## 3. Nomenclatura de Archivos del Módulo (Feature Folder Map)

Para evitar colisiones de nombres y facilitar la búsqueda, todos los subcomponentes de una característica deben llevar el prefijo de la feature correspondiente:

### Módulo Logueo General (`src/features/lgg/`)
*   `LggView.tsx`: Vista principal y layout.
*   `useLggState.ts`: Custom hook con la máquina de estado y cálculo RMR.
*   `lggColumns.tsx`: Schema de las 37 columnas.
*   `components/LggExportModal.tsx`: Modal para configurar y procesar XLSX.
*   `components/LggImportModal.tsx`: Modal para la lectura y mapeo de datos Excel.
*   `components/LggQaqcPanel.tsx`: Panel interactivo de auditoría QA/QC.
*   `components/CollarModals.tsx`: Modales locales de creación/renombrado del collar.

### Módulo Logueo Estructural (`src/features/structural/`)
*   `StructuralView.tsx`: Vista principal de discontinuidades orientadas.
*   `useStructuralState.ts`: Hook de estado y mutación.
*   `structuralColumns.tsx`: Schema de columnas y selectores.
*   `components/StructuralQaqcPanel.tsx`: Panel QA/QC.

### Módulo Ensayos PLT (`src/features/plt/`)
*   `PltView.tsx`: Vista principal de carga de ensayos de carga puntual (Point Load Test).
*   `usePltState.ts`: Hook con cálculos de factor K e índice UCS en milisegundos.
*   `pltColumns.tsx`: Schema de columnas.
*   `components/PltQaqcPanel.tsx`: Panel de validación de consistencia.
*   `components/PltDashboardPanel.tsx`: Gráficos e histogramas locales de PLT.

---

## 4. Checklist de Validación para Nuevos Archivos

Al crear un nuevo archivo, el desarrollador o agente de IA debe validar:
- [ ] ¿El archivo exporta un componente React? Si es así, usa **PascalCase** (`MiComponente.tsx`).
- [ ] ¿El archivo solo contiene lógica/funciones helpers? Si es así, usa **camelCase** (`misHelpers.ts`).
- [ ] ¿Tiene el prefijo de la feature correspondiente para evitar colisiones? (`MiFeatureComponente.tsx`).
- [ ] ¿Se respeta la simetría con los módulos hermanos? (ej. si uno es `*View.tsx`, todos son `*View.tsx`).
