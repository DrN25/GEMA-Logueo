# Guía de Patrones de Optimización para Grillas Geotécnicas de Alto Rendimiento (LOGUEO 2026)

Este documento detalla los **seis patrones de optimización e ingeniería de frontend** aplicados al módulo de Logueo Geotécnico General (LGG). Su objetivo es garantizar una respuesta del sistema en microsegundos, scrolls fluidos a 60 FPS, navegación instantánea entre pestañas y un área útil máxima en pantalla, incluso al manejar bases de datos con miles de registros en navegadores estándar.

---

## Patrón 1: Preservación de Referencias en Memoria (*useMemo + useRef*)
### El Problema
Al actualizar una sola celda, React ejecuta de forma síncrona el cálculo del RMR para todo el array de datos. Aunque se use un caché para evitar cálculos repetidos, el mapeo tradicional (`.map()`) retorna referencias de objeto totalmente nuevas en cada renderizado (p. ej., usando desestructuración `{ ...row }`). Esto invalida `React.memo` en todas las filas de la tabla, provocando que se renderice todo el DOM completo de la cuadrícula en cada pulsación de tecla o cambio.

### La Solución (Aplicar en: *Hooks de Estado de Grillas*)
Almacenar un `useRef` con las filas enriquecidas del renderizado anterior. Antes de recalcular una fila, realizar una comparación superficial rápida y limpia de sus propiedades base. Si no han cambiado, **retornar exactamente la misma referencia del renderizado anterior**.

```typescript
// IMPLEMENTACIÓN EN HOOKS DE ESTADO (ej. useLggState.ts)
const rmrCache = useRef<Map<string, CorridaEnriquecida>>(new Map());
const prevEnrichedRef = useRef<CorridaEnriquecida[]>([]);

const corridasEnriquecidas = useMemo(() => {
  const prevEnriched = prevEnrichedRef.current;

  const enriched = corridas.map((row, idx) => {
    const prev = prevEnriched[idx];

    // Comparación superficial dinámica ultrarrápida
    const isSameRow = prev &&
                      prev.originalIndex === idx &&
                      Object.keys(row).every(key => row[key] === prev[key]);

    if (isSameRow) {
      return prev; // Retorna exactamente la misma referencia en memoria
    }

    // ... Ejecutar cálculo pesado o consulta de caché ...
    const enrichedRow = { ...row, calculatedData, originalIndex: idx };
    return enrichedRow;
  });

  prevEnrichedRef.current = enriched;
  return enriched;
}, [corridas]);
```

---

## Patrón 2: Modo de Edición Condicional (*Excel-Mode*)
### El Problema
Mantener miles de inputs interactivos y dropdowns `<select>` pesados en las filas que no están activas congestiona gravemente el árbol DOM del navegador. Un solo selector con 20 opciones multiplicado por 500 filas genera **10,000 nodos `<option>` inútiles** que destruyen el rendimiento del scroll y provocan un elevado consumo de memoria.

### La Solución (Aplicar en: *Componentes de Celdas / BaseEditableGrid.tsx*)
Convertir la tabla en una hoja de cálculo reactiva. Si la fila no está seleccionada (`isSelected` es `false`), **se renderiza texto plano (`<span>`)**. El input o dropdown interactivo con todas sus opciones de catálogo solo se monta cuando el usuario selecciona activamente la fila.

```typescript
// IMPLEMENTACIÓN EN FILAS (ej. BaseEditableGrid.tsx)
return (
  <td onClick={() => {
    if (!isSelected) {
      onSelect(rowIndex);
      // Foco suave de 40ms para dar tiempo a que se monte el input físico
      setTimeout(() => {
        const inputEl = document.getElementById(`${idPrefix}-${rowIndex}-${colIdx}`);
        if (inputEl) {
          inputEl.focus();
          if (inputEl.tagName === 'INPUT') (inputEl as HTMLInputElement).select();
        }
      }, 40);
    }
  }}>
    {col.type === 'readonly' ? (
      <span className="text-slate-400 font-medium truncate block">{row[col.key]}</span>
    ) : !isSelected ? (
      // MODO LECTURA: Texto plano ultra liviano. El DOM queda limpio y libre de inputs/selects dormidos
      <span className="text-slate-200 block text-center truncate py-1 font-semibold">
        {String(row[col.key] ?? '') === '-1' ? '-' : String(row[col.key])}
      </span>
    ) : (
      // MODO EDICIÓN: Solo se monta si la fila está seleccionada
      <input
        id={`${idPrefix}-${rowIndex}-${colIdx}`}
        type={col.type}
        value={localValue}
        onChange={...}
        onBlur={...}
      />
    )}
  </td>
);
```

---

## Patrón 3: Flujo de Props Reactivas sobre Consultas al DOM
### El Problema
Ejecutar búsquedas en el DOM nativo con métodos como `document.getElementById` u obtener `.textContent` dentro de ciclos de renderizado activos provoca *Layout Thrashing* (recalculado síncrono del diseño de la página por parte del navegador). Si la tabla se re-renderiza con la navegación del teclado, el rendimiento cae a menos de 10 FPS.

### La Solución (Aplicar en: *Vistas de Contenedores y Renderizadores*)
Prohibido usar `document.getElementById` para extraer datos de cabeceras dentro del renderizado. Los valores de administración (como el nombre del geólogo, fecha, o campaña) deben descender como **props reactivas de React** desde la base de datos principal en `App.tsx` y ser consumidos de forma directa.

```typescript
// IMPLEMENTACIÓN EN COMPONENTES DE VISTA (ej. LggView.tsx)
interface LggViewProps {
  activeTaladroGeologo: string; // Pasa la información como prop directa
  activeTaladroFecha: string;
}

// En lugar de ir al DOM, las funciones de mapeo leen directamente el prop reactivo
const lastRowGeologo = useCallback(() => {
  return activeTaladroGeologo || "S/D";
}, [activeTaladroGeologo]);
```

---

## Patrón 4: Keep-Alive en Navegación de Vistas Centrales
### El Problema
El uso de renderizado condicional con `switch` desmonta físicamente las vistas al cambiar de menú. Al salir de LGG para ver el perfil Estructural, todo el DOM de la tabla se destruye. Al volver a entrar, se deben reconstruir miles de nodos DOM desde cero, lo que genera retrasos notables y pérdidas en la posición de scroll del usuario.

### La Solución (Aplicar en: *App.tsx*)
Mantener las cuatro vistas geotécnicas principales (`collar`, `lgg`, `lgest`, `reports_plt`) montadas constantemente en el DOM. Utilizar la clase CSS `hidden` (`display: none` de Tailwind) para ocultar las pestañas inactivas. El cambio de menú se convierte en una alternancia CSS instantánea de menos de **1 microsegundo**.

```typescript
// IMPLEMENTACIÓN EN EL CONTENEDOR PRINCIPAL (ej. App.tsx)
<div className="flex-1 p-6 relative flex flex-col overflow-hidden">
  
  {/* LGG View (Se mantiene montado siempre y se oculta con CSS si no es la vista activa) */}
  <div className={currentView === 'lgg' ? "flex-1 flex flex-col min-h-0" : "hidden"}>
    <LggView
      corridas={activeTaladro.corridas}
      // ... props ...
    />
  </div>

  {/* Vista Estructural (Keep-Alive activo) */}
  <div className={currentView === 'lgest' ? "flex-1 flex flex-col min-h-0" : "hidden"}>
    <StructuralView
      discontinuidades={activeTaladro.discontinuidades}
      // ... props ...
    />
  </div>

</div>
```

---

## Patrón 5: Contención Flexbox para Scrollbars Fijas en el Viewport
### El Problema
Cuando una grilla contiene cientos de registros, la tabla se expande en su altura máxima natural dentro del documento general. Esto empuja la barra de desplazamiento horizontal de la base hacia la parte inferior del documento (muy por debajo de la pantalla visible), obligando al geólogo a desplazarse hacia abajo de la tabla solo para moverse lateralmente.

### La Solución (Aplicar en: *Estructura de Contenedores de Vistas*)
Eliminar el scroll vertical en el cuerpo principal de la vista utilizando la propiedad `overflow-hidden` combinada con Flexbox. El área de control y KPIs queda anclada arriba (`shrink-0`), y el componente de la grilla se expande flexiblemente en el espacio restante (`flex-1 min-h-0`). La tabla manejará su propia caja de desplazamiento, manteniendo la barra horizontal siempre visible en la parte inferior de la pantalla.

```html
<!-- DISEÑO DE CONTENEDOR EN VISTA (ej. LggView.tsx) -->
<div class="h-full flex flex-col min-h-0 overflow-hidden">
  <!-- Pestañas superiores (Estáticas) -->
  <div class="shrink-0">...</div>

  <div class="flex-1 flex flex-col p-1 space-y-3 min-h-0 overflow-hidden relative">
    <!-- Bloque de KPIs y Filtros (Estático arriba) -->
    <div class="shrink-0 space-y-3">...</div>

    <!-- Bloque de la Grilla (Toma todo el espacio libre y habilita scroll interno) -->
    <div class="flex-1 min-h-0 flex flex-col">
      <BaseEditableGrid ... />
    </div>
  </div>
</div>
```

---

## Patrón 6: Modo Enfoque / KPIs Dinámicos
### El Problema
Anclar de manera estática las tarjetas de KPIs de geomecánica, los títulos y las barras de control arriba de la tabla puede consumir más de 350 píxeles de altura de la pantalla en laptops. Esto reduce gravemente la cantidad de filas que un geólogo puede ver simultáneamente para ingresar datos.

### La Solución (Aplicar en: *Encabezados de Vistas*)
Agregar un interruptor reactivo `showKpis`. Al apagarse, oculta por completo las tarjetas pesadas de KPIs. Para no perder el contexto del sondaje en el que se trabaja, la barra de herramientas hereda dinámicamente un resumen de datos compactos (`Taladro | Metraje | Geólogo`) y los botones de Importación/Exportación se trasladan allí automáticamente.

```typescript
// IMPLEMENTACIÓN EN TOOLBAR (ej. LggView.tsx)
<div className="shrink-0 flex justify-between items-center bg-navy-900/50 p-2.5 rounded-xl border border-navy-800/35 shadow-md">
  <div className="flex items-center gap-2">
    {/* Resumen compacto visible únicamente si el panel superior está oculto */}
    {!showKpis && (
      <div className="flex items-center gap-2 border-r border-navy-800 pr-3 mr-1">
        <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
          {activeTaladroName}
        </span>
        <span className="text-[10px] font-bold text-slate-400">
          {totalPerf.toFixed(2)}m
        </span>
      </div>
    )}

    {/* ...Botones de la grilla... */}
  </div>
</div>
```

---

## Lista de Verificación de Optimización para Nuevas Vistas
Cuando vayas a crear o rediseñar un componente de logueo geotécnico (ej. `StructuralView` o `PltView`), asegúrate de cumplir con la siguiente lista de verificación:

* [ ] **¿La grilla utiliza `BaseEditableGrid`?**
* [ ] **¿Se le inyecta la propiedad `isSelected` a los renderizadores de celdas personalizados en las columnas para habilitar el *Excel-Mode*?**
* [ ] **¿Las importaciones de cabeceras se inyectan como props desde `App.tsx` en lugar de buscarlas en el DOM?**
* [ ] **¿La nueva pestaña se agregó a `App.tsx` bajo la envoltura con clase `hidden` (Keep-Alive) en lugar de un `switch` condicional que destruye el DOM?**
* [ ] **¿El contenedor padre del componente tiene la clase `overflow-hidden flex flex-col h-full` para garantizar que la barra de scroll horizontal esté siempre visible al final de la pantalla?**
* [ ] **¿La grilla de datos está envuelta en un contenedor con clase `flex-1 min-h-0` para optimizar el alto restante?**
