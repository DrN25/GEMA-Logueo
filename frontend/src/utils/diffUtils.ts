/**
 * diffUtils.ts — Calculador de auditoría de cambios para Geolog Pro 2.0
 *
 * Compara la versión original del taladro en BD (snapshot) contra el estado actual
 * en memoria (activeTaladro) y genera un desglose exacto de lo que cambió:
 * - Celdas/campos modificados (cuántas y en qué módulos)
 * - Filas agregadas o eliminadas por módulo (LGG, Estructural, PLT, Surveys)
 * - Cambios en datos generales del Collar
 */

import { extractPersistible } from './hashUtils.ts';
import { getUnsavedTaladros } from './storageManager.ts';

export interface ModuleDiff {
  added: number;
  deleted: number;
  modifiedRows: number;
  fieldsChanged: number;
}

export interface CollarChange {
  label: string;
  from: any;
  to: any;
}

export interface TaladroDiffSummary {
  isNewTaladro: boolean;
  totalFieldsChanged: number;
  totalRowsAdded: number;
  totalRowsDeleted: number;
  totalRowsModified: number;

  collar: {
    changed: boolean;
    changes: CollarChange[];
  };
  corridas: ModuleDiff;
  discontinuidades: ModuleDiff;
  ensayosPlt: ModuleDiff;
  surveys: ModuleDiff;
}

export interface AllTaladrosDiffSummary {
  unsavedTaladrosCount: number;
  unsavedTaladrosNames: string[];
  totalFieldsChanged: number;
  totalRowsAdded: number;
  totalRowsDeleted: number;
}

/**
 * Formatea valores para visualización amigable en el reporte de auditoría
 */
function fmt(val: any): string {
  if (val === null || val === undefined || val === '') return '(vacío)';
  if (val === -1 || val === '-1') return '(vacío)';
  return String(val);
}

/**
 * Compara de forma determinística dos objetos de taladro y extrae las diferencias exactas.
 */
export function computeTaladroDiff(before: any, after: any): TaladroDiffSummary {
  const emptyModule: ModuleDiff = { added: 0, deleted: 0, modifiedRows: 0, fieldsChanged: 0 };

  // Si no hay objeto 'after' (ej. activeTaladro es null en el dashboard), retornar resumen vacío
  if (!after) {
    return {
      isNewTaladro: false,
      totalFieldsChanged: 0,
      totalRowsAdded: 0,
      totalRowsDeleted: 0,
      totalRowsModified: 0,
      collar: { changed: false, changes: [] },
      corridas: emptyModule,
      discontinuidades: emptyModule,
      ensayosPlt: emptyModule,
      surveys: emptyModule,
    };
  }

  // Garantizar que 'before' pertenezca al mismo taladro que 'after'
  if (before && after?.name && before?.name && before.name.toUpperCase() !== after.name.toUpperCase()) {
    before = null;
  }

  // Si no hay snapshot 'before' (o pertenecía a otro taladro), intentar cargar la copia de respaldo de BD para `after.name` desde localStorage
  if (!before && after?.name) {
    try {
      const cachedSnapshot = localStorage.getItem(`geolog_snapshot_data_${after.name}`);
      if (cachedSnapshot) {
        before = JSON.parse(cachedSnapshot);
      }
    } catch (e) {}
  }

  // Si sigue sin haber 'before', verificar si el taladro existe en el resumen de BD
  if (!before) {
    let existsInDbSummaries = false;
    try {
      const summariesStr = localStorage.getItem('geolog_taladros_summaries');
      if (summariesStr && after?.name) {
        const summaries = JSON.parse(summariesStr);
        existsInDbSummaries = Array.isArray(summaries) && summaries.some((s: any) => s.name === after.name);
      }
    } catch (e) {}

    // Si el taladro existe en BD pero no tenemos snapshot, intentar crear baseline minimo para comparar
    if (existsInDbSummaries) {
      before = {
        name: after.name,
        proyecto: after.proyecto,
        geologo: after.geologo,
        diametro: after.diametro,
        inclinacion: after.inclinacion,
        collar_este: after.collar_este,
        collar_norte: after.collar_norte,
        collar_cota: after.collar_cota,
        prof_final_eoh: after.prof_final_eoh,
        corridas: [],
        discontinuidades: [],
        ensayos_plt: [],
        surveys: [],
      };
    } else {
      // Es un taladro totalmente nuevo que nunca ha sido guardado en BD
      const corridasAdded = after?.corridas?.length || 0;
      const discsAdded = after?.discontinuidades?.length || 0;
      const pltsAdded = after?.ensayos_plt?.length || 0;
      const surveysAdded = after?.surveys?.length || 0;

      return {
        isNewTaladro: true,
        totalFieldsChanged: 0,
        totalRowsAdded: corridasAdded + discsAdded + pltsAdded + surveysAdded,
        totalRowsDeleted: 0,
        totalRowsModified: 0,
        collar: { changed: false, changes: [] },
        corridas: { added: corridasAdded, deleted: 0, modifiedRows: 0, fieldsChanged: 0 },
        discontinuidades: { added: discsAdded, deleted: 0, modifiedRows: 0, fieldsChanged: 0 },
        ensayosPlt: { added: pltsAdded, deleted: 0, modifiedRows: 0, fieldsChanged: 0 },
        surveys: { added: surveysAdded, deleted: 0, modifiedRows: 0, fieldsChanged: 0 },
      };
    }
  }

  // Normalizar ambos objetos a su estructura estricta persistible
  const normBefore = extractPersistible(before);
  const normAfter = extractPersistible(after);

  // 1. Auditoría del Collar y Datos Generales
  const collarChanges: CollarChange[] = [];
  const collarFieldsMap: Record<string, string> = {
    name: 'Nombre Sondaje',
    proyecto: 'Proyecto',
    geologo: 'Geólogo',
    diametro: 'Diámetro',
    inclinacion: 'Inclinación',
    campana: 'Campaña',
    turno: 'Turno',
    collar_este: 'Coordenada Este (Oficial)',
    collar_norte: 'Coordenada Norte (Oficial)',
    collar_cota: 'Cota (Oficial)',
    prof_final_eoh: 'Prof. Final EOH (Oficial)',
    comentarios: 'Comentarios',
  };

  for (const [key, label] of Object.entries(collarFieldsMap)) {
    const vBefore = fmt(normBefore[key]);
    const vAfter = fmt(normAfter[key]);
    if (vBefore !== vAfter) {
      collarChanges.push({ label, from: vBefore, to: vAfter });
    }
  }

  // 2. Auditoría de Corridas LGG
  const corridasDiff = compareArrays(
    normBefore.corridas || [],
    normAfter.corridas || [],
    'corrida',
    [
      'de', 'a', 'rec_m', 'rqd_m', 'lrf_m', 'frf', 'lito1', 'lito2', 'lito3',
      'resistencia', 'tipo_est1', 'tipo_est2', 'frac_nat', 'frac_buz30', 'frac_buz60',
      'frac_buz90', 'abertura', 'rugosidad', 'jrc10', 'intemperismo', 'relleno1',
      'relleno2', 'espesor', 'agua_obs', 'comentarios'
    ]
  );

  // 3. Auditoría de Discontinuidades Estructurales (EST)
  const discsDiff = compareArrays(
    normBefore.discontinuidades || [],
    normAfter.discontinuidades || [],
    'id',
    [
      'profundidad', 'tipo_estructura', 'alfa', 'beta', 'forma', 'rugosidad', 'jrc10',
      'abertura', 'weathering', 'espesor', 'relleno1', 'relleno2', 'dureza_pared',
      'agua', 'comentario'
    ]
  );

  // 4. Auditoría de Ensayos PLT
  const pltsDiff = compareArrays(
    normBefore.ensayos_plt || [],
    normAfter.ensayos_plt || [],
    'nro_muestra',
    [
      'from_m', 'to_m', 'nro_caja', 'd_mm', 'p_instr_kn', 'tipo_rotura_code',
      'direccion_rotura_code', 'litologia_1', 'litologia_2', 'observaciones'
    ]
  );

  // 5. Auditoría de Surveys
  const surveysDiff = compareArrays(
    normBefore.surveys || [],
    normAfter.surveys || [],
    'depth',
    ['dip', 'azimuth']
  );

  const totalFieldsChanged =
    collarChanges.length +
    corridasDiff.fieldsChanged +
    discsDiff.fieldsChanged +
    pltsDiff.fieldsChanged +
    surveysDiff.fieldsChanged;

  const totalRowsAdded =
    corridasDiff.added + discsDiff.added + pltsDiff.added + surveysDiff.added;

  const totalRowsDeleted =
    corridasDiff.deleted + discsDiff.deleted + pltsDiff.deleted + surveysDiff.deleted;

  const totalRowsModified =
    corridasDiff.modifiedRows +
    discsDiff.modifiedRows +
    pltsDiff.modifiedRows +
    surveysDiff.modifiedRows;

  return {
    isNewTaladro: false,
    totalFieldsChanged,
    totalRowsAdded,
    totalRowsDeleted,
    totalRowsModified,
    collar: {
      changed: collarChanges.length > 0,
      changes: collarChanges,
    },
    corridas: corridasDiff,
    discontinuidades: discsDiff,
    ensayosPlt: pltsDiff,
    surveys: surveysDiff,
  };
}

/**
 * Calcula un resumen de cambios no guardados acumulados en TODOS los taladros.
 * Solo incluye aquellos taladros que realmente tienen modificaciones pendientes registradas.
 */
export function computeAllTaladrosDiff(
  activeTaladro: any,
  activeSnapshot: any
): AllTaladrosDiffSummary {
  const unsavedNames: string[] = [];
  let totalFields = 0;
  let totalAdded = 0;
  let totalDeleted = 0;

  // 1. Obtener el registro de taladros con cambios no guardados
  let registeredUnsaved: string[] = getUnsavedTaladros();

  // 2. Evaluar el taladro activo en RAM
  if (activeTaladro && activeSnapshot) {
    const activeDiff = computeTaladroDiff(activeSnapshot, activeTaladro);
    if (
      activeDiff.totalFieldsChanged > 0 ||
      activeDiff.totalRowsAdded > 0 ||
      activeDiff.totalRowsDeleted > 0
    ) {
      unsavedNames.push(activeTaladro.name);
      totalFields += activeDiff.totalFieldsChanged;
      totalAdded += activeDiff.totalRowsAdded;
      totalDeleted += activeDiff.totalRowsDeleted;
    }
  }

  // 3. Incluir otros taladros que realmente estén en geolog_unsaved_taladros
  registeredUnsaved.forEach(name => {
    if (!unsavedNames.includes(name)) {
      unsavedNames.push(name);
      totalFields += 1;
    }
  });

  return {
    unsavedTaladrosCount: unsavedNames.length,
    unsavedTaladrosNames: unsavedNames,
    totalFieldsChanged: totalFields,
    totalRowsAdded: totalAdded,
    totalRowsDeleted: totalDeleted,
  };
}

/**
 * Función auxiliar para comparar arreglos de registros por clave primaria
 */
function compareArrays(
  beforeArr: any[],
  afterArr: any[],
  _keyProp: string,
  fieldsToCompare: string[]
): ModuleDiff {
  let added = 0;
  let deleted = 0;
  let modifiedRows = 0;
  let fieldsChanged = 0;

  const maxLen = Math.max(beforeArr.length, afterArr.length);

  for (let i = 0; i < maxLen; i++) {
    const b = beforeArr[i];
    const a = afterArr[i];

    if (!b && a) {
      added++;
    } else if (b && !a) {
      deleted++;
    } else if (b && a) {
      let rowHasChange = false;
      for (const field of fieldsToCompare) {
        const valB = fmt(b[field]);
        const valA = fmt(a[field]);
        if (valB !== valA) {
          fieldsChanged++;
          rowHasChange = true;
        }
      }
      if (rowHasChange) {
        modifiedRows++;
      }
    }
  }

  return { added, deleted, modifiedRows, fieldsChanged };
}
