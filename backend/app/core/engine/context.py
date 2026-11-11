"""
app.core.engine.context
Contexto de datos en memoria para la evaluación desacoplada de reglas geomecánicas.
Indexa los datos por sondaje, corrida e intervalo espacial para consultas sin releer todas las filas completas.
"""

from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple


class ValidationContext:
    """
    Contenedor de datos geomecánicos pre-procesados en memoria.
    Aísla las reglas de la interacción con archivos físicos Excel / CSV / Base de Datos.
    """

    def __init__(
        self,
        lgg_runs: Optional[List[Dict[str, Any]]] = None,
        est_structures: Optional[List[Dict[str, Any]]] = None,
        rmr_runs: Optional[List[Dict[str, Any]]] = None,
        collar_data: Optional[Dict[str, float]] = None,
        survey_data: Optional[Dict[str, float]] = None,
        is_2026: bool = True,
        formato_str: str = "2026",
        metadata: Optional[Dict[str, Any]] = None,
        lgg_by_taladro: Optional[Dict[str, List[Dict[str, Any]]]] = None,
        est_by_taladro: Optional[Dict[str, List[Dict[str, Any]]]] = None,
        rmr_by_taladro: Optional[Dict[str, List[Dict[str, Any]]]] = None
    ):
        self.lgg_runs: List[Dict[str, Any]] = lgg_runs or []
        self.est_structures: List[Dict[str, Any]] = est_structures or []
        self.rmr_runs: List[Dict[str, Any]] = rmr_runs or []
        self.collar_data: Dict[str, float] = collar_data or {}
        self.survey_data: Dict[str, float] = survey_data or {}
        self.is_2026: bool = is_2026
        self.formato_str: str = formato_str
        self.metadata: Dict[str, Any] = metadata or {}

        # Índices estructurados por taladro
        self.lgg_by_taladro: Dict[str, List[Dict[str, Any]]] = defaultdict(list, lgg_by_taladro) if lgg_by_taladro is not None else defaultdict(list)
        self.est_by_taladro: Dict[str, List[Dict[str, Any]]] = defaultdict(list, est_by_taladro) if est_by_taladro is not None else defaultdict(list)
        self.rmr_by_taladro: Dict[str, List[Dict[str, Any]]] = defaultdict(list, rmr_by_taladro) if rmr_by_taladro is not None else defaultdict(list)

        # Máximas profundidades detectadas por módulo
        self.max_lgg_by_taladro: Dict[str, float] = {}
        self.max_est_by_taladro: Dict[str, float] = {}

        self._lgg_intervals = {}
        self._lgg_corridas = {}
        self._build_indices()

    def _build_indices(self):
        """Genera índices en memoria para acelerar la resolución de cruces espaciales."""
        if not self.lgg_by_taladro and self.lgg_runs:
            for run in self.lgg_runs:
                t = run.get("taladro")
                if t:
                    self.lgg_by_taladro[t].append(run)

        # Retain scalar search keys, and read a complete row only for a match.
        # The original worksheet order decides ties and overlapping runs.
        for t, runs in self.lgg_by_taladro.items():
            runs.sort(key=lambda r: (r.get("_fila_excel", 0) if "_fila_excel" in r else (r.get("de", 0.0) or 0.0)))
            intervals, corridas = [], {}
            for index, run in enumerate(runs):
                start, end = run.get("de"), run.get("a")
                a = end or 0.0
                if t not in self.max_lgg_by_taladro or a > self.max_lgg_by_taladro[t]:
                    self.max_lgg_by_taladro[t] = a
                intervals.append((start, end))
                corrida = run.get("corrida")
                if corrida is not None:
                    corridas.setdefault(corrida, index)
            self._lgg_intervals[t] = intervals
            self._lgg_corridas[t] = corridas

        if not self.est_by_taladro and self.est_structures:
            for struct in self.est_structures:
                t = struct.get("taladro")
                if t:
                    self.est_by_taladro[t].append(struct)

        for t, structs in self.est_by_taladro.items():
            for struct in structs:
                prof = struct.get("profundidad", 0.0) or 0.0
                if t not in self.max_est_by_taladro or prof > self.max_est_by_taladro[t]:
                    self.max_est_by_taladro[t] = prof

        if not self.rmr_by_taladro and self.rmr_runs:
            for rmr in self.rmr_runs:
                t = rmr.get("sondaje") or rmr.get("taladro")
                if t:
                    self.rmr_by_taladro[t].append(rmr)

    def get_lgg_runs(self, taladro: str) -> List[Dict[str, Any]]:
        """Devuelve todas las corridas de LGG para un sondaje ordenadas por profundidad."""
        return self.lgg_by_taladro.get(taladro, [])

    def get_est_structures(self, taladro: str) -> List[Dict[str, Any]]:
        """Devuelve todas las estructuras registradas para un taladro."""
        return self.est_by_taladro.get(taladro, [])

    def get_rmr_runs(self, taladro: str) -> List[Dict[str, Any]]:
        """Devuelve todas las corridas de RMR para un taladro."""
        return self.rmr_by_taladro.get(taladro, [])

    def find_matching_lgg_run(
        self, taladro: str, corrida_num: Optional[int] = None,
        de: Optional[float] = None, a: Optional[float] = None, tol: float = 0.05
    ) -> Optional[Dict[str, Any]]:
        """Encuentra la corrida de LGG correspondiente por número correlativo o intervalo Desde/Hasta."""
        runs = self.lgg_by_taladro.get(taladro, [])
        if not runs:
            return None

        if corrida_num is not None and corrida_num > 0:
            index = self._lgg_corridas[taladro].get(corrida_num)
            if index is not None:
                return runs[index]

        if de is not None and a is not None:
            for index, (start, end) in enumerate(self._lgg_intervals[taladro]):
                if abs((start or 0.0) - de) <= tol and abs((end or 0.0) - a) <= tol:
                    return runs[index]
        return None

    def find_lgg_run_containing_depth(self, taladro: str, depth: float) -> Optional[Dict[str, Any]]:
        """Devuelve el primer intervalo, en orden de origen, que contiene la profundidad."""
        for index, (start, end) in enumerate(self._lgg_intervals.get(taladro, ())):
            if start is not None and end is not None and start <= depth <= end:
                return self.lgg_by_taladro[taladro][index]
        return None

    def _exact_lgg_index(self, taladro, de, a, tol):
        for index, (start, end) in enumerate(self._lgg_intervals.get(taladro, ())):
            if start is not None and end is not None and abs(start - de) < tol and abs(end - a) < tol:
                return index
        return None

    def find_lgg_run_for_structure(self, taladro: str, de: Optional[float], a: Optional[float], depth: Optional[float]) -> Optional[Dict[str, Any]]:
        """Prefiere el tramo exacto; si no existe, busca una profundidad contenida."""
        if de is not None and a is not None:
            index = self._exact_lgg_index(taladro, de, a, 0.01)
            if index is not None:
                return self.lgg_by_taladro[taladro][index]
        return self.find_lgg_run_containing_depth(taladro, depth) if depth is not None else None

    def has_exact_lgg_run(self, taladro: str, de: float, a: float, tol: float = 0.001) -> bool:
        return self._exact_lgg_index(taladro, de, a, tol) is not None
