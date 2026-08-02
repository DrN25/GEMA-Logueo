from collections import Counter, defaultdict
from dataclasses import dataclass, field

from app.core.report_config import (
    CAMPO_LABELS,
    EXCLUIDOS_DE_TABLAS,
    PARRAFOS_OPCIONALES,
    REQUIRED_FIELDS_POR_MODULO,
    RMR_AFFECTING_POR_MODULO,
    SUBRATING_PREFIXES,
)

TIPOS_FALTANTE = {"VACIO", "SIN_INFORMACION"}
MODULOS = ["LGG", "Estructural", "Validación RMR"]


def _nivel_atencion(modulo, clave, pct):
    if clave not in REQUIRED_FIELDS_POR_MODULO.get(modulo, set()):
        return "Sin acción"
    if pct < 1.0:
        return "Puntual"
    if pct <= 10.0:
        return "Media"
    return "Alta"


def _nuevo_grupo():
    return {
        "v": 0,
        "s": 0,
        "celdas": set(),
        "anios": defaultdict(lambda: {
            "v": 0, "s": 0, "celdas_v": set(), "celdas_s": set(), "celdas_t": set(),
        }),
    }


def _agrupar(registros):
    grupos = defaultdict(_nuevo_grupo)
    for reg in registros:
        modulo = reg.get("modulo", "")
        clave = reg.get("columna", "")
        if not clave or clave in EXCLUIDOS_DE_TABLAS.get(modulo, set()):
            continue
        tipo = reg.get("tipo_incidencia")
        if tipo not in TIPOS_FALTANTE:
            continue
        g = grupos[(modulo, clave)]
        anio = str(reg.get("campania") or "N/A")
        celda = reg.get("celda_padre", "N/A")
        g["celdas"].add(celda)
        detalle_anio = g["anios"][anio]
        detalle_anio["celdas_t"].add(celda)
        if tipo == "VACIO":
            g["v"] += 1
            detalle_anio["v"] += 1
            detalle_anio["celdas_v"].add(celda)
        else:
            g["s"] += 1
            detalle_anio["s"] += 1
            detalle_anio["celdas_s"].add(celda)
    return grupos


def _filas_campo(grupos, incluir_subratings):
    filas = []
    for (modulo, clave), g in grupos.items():
        es_sub = clave.startswith(SUBRATING_PREFIXES)
        if es_sub != incluir_subratings:
            continue
        filas.append({
            "modulo": modulo,
            "clave": clave,
            "etiqueta": CAMPO_LABELS.get(modulo, {}).get(clave, clave),
            "v": g["v"],
            "s": g["s"],
            "total": g["v"] + g["s"],
            "celdas": len(g["celdas"]),
            "afecta_rmr": clave in RMR_AFFECTING_POR_MODULO.get(modulo, set()),
            "requerido": clave in REQUIRED_FIELDS_POR_MODULO.get(modulo, set()),
            "es_subrating": es_sub,
        })
    return filas


def _sumas_por_modulo(filas, campo):
    totales = defaultdict(int)
    for f in filas:
        totales[f["modulo"]] += f[campo]
    return totales


def _construir_tabla(filas, campo, gran_total):
    suma_modulo = _sumas_por_modulo(filas, campo)
    tabla = []
    for f in filas:
        n = f[campo]
        pct_m = (n / suma_modulo[f["modulo"]] * 100.0) if suma_modulo[f["modulo"]] else 0.0
        pct_g = (n / gran_total * 100.0) if gran_total else 0.0
        tabla.append({
            **f,
            "pct_m": pct_m,
            "pct_g": pct_g,
            "nivel": _nivel_atencion(f["modulo"], f["clave"], pct_m),
        })
    return sorted(tabla, key=lambda x: x[campo], reverse=True)


def _resumen_anios(diag):
    resumen = {}
    for celda, data in (diag.get("resumen_por_celda_padre") or {}).items():
        anio = str(data.get("campania") or "N/A")
        if anio == "N/A":
            continue
        if anio not in resumen:
            resumen[anio] = {"n_taladros": 0, "total_filas": 0}
        resumen[anio]["n_taladros"] += 1
        resumen[anio]["total_filas"] += int(data.get("total_hijas", 0) or 0)
    return resumen


@dataclass
class AnalisisResult:
    total_vacias: int = 0
    total_sin_info: int = 0
    total_faltantes: int = 0
    total_taladros_afectados: int = 0
    num_campos_alta: int = 0
    registros_afectados: int = 0
    no_oblig_total: int = 0
    tablas: dict = field(default_factory=dict)
    no_oblig: list = field(default_factory=list)
    vista_alta: list = field(default_factory=list)
    detalles: list = field(default_factory=list)
    parrafos: list = field(default_factory=list)
    parrafos_secundarios: list = field(default_factory=list)
    modulos: list = field(default_factory=list)
    pareto: list = field(default_factory=list)
    anios: list = field(default_factory=list)


def _p1_concentracion(filas, grand_total, n_registros, n_taladros):
    if len(filas) < 2:
        return None
    t1, t2 = filas[0], filas[1]
    pct_top2 = (t1["total"] + t2["total"]) / grand_total * 100.0 if grand_total else 0.0
    restos = filas[2:5]
    acum = pct_top2
    resto_txt = ""
    if restos:
        resto_txt = ", y junto con " + ", ".join(f"«{r['etiqueta']}»" for r in restos)
        acum += sum(r["total"] for r in restos) / grand_total * 100.0 if grand_total else 0.0
    return (f"«{t1['etiqueta']}» y «{t2['etiqueta']}» (campos obligatorios) concentran el "
            f"{pct_top2:.1f}% de los {n_registros} registros con datos faltantes "
            f"({n_taladros} taladros){resto_txt} y explican el {acum:.1f}% del total.")


def _p2_impacto_rmr(filas, registros):
    afectan = [f for f in filas if f["afecta_rmr"] and f["total"] > 0]
    if not afectan:
        return None
    claves = {(f["modulo"], f["clave"]) for f in afectan}
    n_registros = len({(r.get("modulo"), r.get("fila_excel")) for r in registros
                       if (r.get("modulo"), r.get("columna")) in claves})
    n_taladros = len({r.get("celda_padre") for r in registros
                      if (r.get("modulo"), r.get("columna")) in claves})
    n_campos = len({f["clave"] for f in filas if f["total"] > 0})
    return (f"{len(afectan)} de los {n_campos} campos con datos faltantes son parámetros "
            f"obligatorios de entrada para el cálculo del RMR (Bieniawski); su ausencia "
            f"compromete la clasificación geomecánica en {n_taladros} taladros "
            f"({n_registros} registros).")


def _p3_tendencia(registros):
    por_anio = Counter()
    for r in registros:
        anio = str(r.get("campania") or "N/A")
        if anio == "N/A":
            continue
        por_anio[anio] += 1
    if len(por_anio) < 2:
        return None
    peor = max(por_anio, key=por_anio.get)
    mejor = min(por_anio, key=por_anio.get)
    total = sum(por_anio.values())
    pct_peor = por_anio[peor] / total * 100.0
    return (f"La campaña {peor} concentra el {pct_peor:.1f}% de los datos faltantes "
            f"({por_anio[peor]}), el peor periodo evaluado; {mejor} registra la menor "
            f"incidencia ({por_anio[mejor]}).")


def _p4_vacio_vs_sin_info(total_vacias, total_sin_info, grand_total):
    if grand_total <= 0:
        return None
    pct_v = total_vacias / grand_total * 100.0
    pct_s = total_sin_info / grand_total * 100.0
    return (f"El {pct_v:.1f}% de los datos faltantes corresponde a celdas vacías (posible "
            f"descuido de registro) y el {pct_s:.1f}% a valores -1 (sin información "
            f"declarada).")


def _p8_no_obligatorios(filas, grand_total):
    if len(filas) < 2:
        return None
    t1, t2 = filas[0], filas[1]
    pct = (t1["total"] + t2["total"]) / grand_total * 100.0 if grand_total else 0.0
    return (f"«{t1['etiqueta']}» y «{t2['etiqueta']}» (campos NO obligatorios) concentran "
            f"el {pct:.1f}% de los datos faltantes no obligatorios "
            f"({t1['total'] + t2['total']} registros).")


def _p5_geologo(registros):
    por_geo = Counter(r.get("geotecnico", "N/A") for r in registros
                      if r.get("geotecnico") and r.get("geotecnico") != "N/A")
    if not por_geo:
        return None
    top_geo, n_top = por_geo.most_common(1)[0]
    resto = sum(n for g, n in por_geo.items() if g != top_geo)
    pct = n_top / (n_top + resto) * 100.0 if (n_top + resto) else 0.0
    return (f"El geólogo {top_geo} concentra el {pct:.1f}% de los datos faltantes "
            f"({n_top} registros), muy por encima del resto ({resto} registros).")


def _p6_taladros(registros, n_taladros_totales):
    por_taladro = Counter(r.get("celda_padre", "N/A") for r in registros)
    total = sum(por_taladro.values())
    if total <= 0:
        return None
    acum = 0
    n_top = 0
    for _, n in por_taladro.most_common():
        acum += n
        n_top += 1
        if acum / total >= 0.5:
            break
    pct_top = acum / total * 100.0
    pct_taladros = n_top / n_taladros_totales * 100.0 if n_taladros_totales else 0.0
    return (f"Solo {n_top} taladros ({pct_taladros:.1f}% del total) concentran el "
            f"{pct_top:.1f}% de todos los datos faltantes.")


def _p7_modulo(registros, grand_total):
    por_modulo = Counter(r.get("modulo", "N/A") for r in registros)
    if not por_modulo:
        return None
    top_mod, n_top = por_modulo.most_common(1)[0]
    pct = n_top / grand_total * 100.0 if grand_total else 0.0
    return f"El módulo {top_mod} concentra el {pct:.1f}% de los datos faltantes ({n_top})."


def _stats_modulos(grupos, filas, tabla_c):
    modulos = []
    for m in MODULOS:
        celdas_mod = set()
        for (mod, _), g in grupos.items():
            if mod == m:
                celdas_mod |= g["celdas"]
        fs = [f for f in filas if f["modulo"] == m and f["total"] > 0]
        top3 = sorted(fs, key=lambda x: x["total"], reverse=True)[:3]
        modulos.append({
            "modulo": m,
            "taladros_afectados": len(celdas_mod),
            "faltantes": sum(f["total"] for f in fs),
            "vacias": sum(f["v"] for f in fs),
            "sin_info": sum(f["s"] for f in fs),
            "n_campos": len(fs),
            "n_alta": len([f for f in tabla_c if f["modulo"] == m and f["nivel"] == "Alta"]),
            "top3": [{"etiqueta": t["etiqueta"], "total": t["total"]} for t in top3],
        })
    return modulos


def compute_analysis(diag, incidencias, faltantes_extra=None):
    registros = [r for r in (incidencias or []) if r.get("tipo_incidencia") in TIPOS_FALTANTE]
    if faltantes_extra:
        registros += [r for r in faltantes_extra if r.get("tipo_incidencia") in TIPOS_FALTANTE]

    grupos = _agrupar(registros)
    filas_main = _filas_campo(grupos, incluir_subratings=False)
    filas_sub = _filas_campo(grupos, incluir_subratings=True)

    req_main = [f for f in filas_main if f["requerido"]]
    no_oblig_main = [f for f in filas_main if not f["requerido"]]
    no_oblig_sub = [f for f in filas_sub if not f["requerido"]]

    gran_total = sum(f["total"] for f in req_main)
    total_vacias = sum(f["v"] for f in req_main)
    total_sin_info = gran_total - total_vacias
    no_oblig_total = sum(f["total"] for f in no_oblig_main) + sum(f["total"] for f in no_oblig_sub)

    celdas_afectadas = set()
    for f in req_main:
        celdas_afectadas |= grupos[(f["modulo"], f["clave"])]["celdas"]

    claves_req = {(f["modulo"], f["clave"]) for f in req_main}
    registros_oblig = [r for r in registros
                       if (r.get("modulo"), r.get("columna")) in claves_req]
    n_registros = len({(r.get("modulo"), r.get("fila_excel")) for r in registros_oblig})

    tablas = {}
    tablas["A"] = _construir_tabla([f for f in req_main if f["v"] > 0], "v", gran_total)
    tablas["B"] = _construir_tabla([f for f in req_main if f["s"] > 0], "s", gran_total)
    tablas["C"] = _construir_tabla([f for f in req_main if f["total"] > 0], "total", gran_total)
    vista_alta = [f for f in tablas["C"] if f["nivel"] == "Alta"]

    no_oblig = []
    no_oblig_rows = sorted(no_oblig_main, key=lambda x: x["total"], reverse=True)
    no_oblig_sub_rows = sorted(no_oblig_sub, key=lambda x: x["total"], reverse=True)
    for f in no_oblig_rows:
        if f["total"] <= 0:
            continue
        pct = f["total"] / no_oblig_total * 100.0 if no_oblig_total else 0.0
        no_oblig.append({**f, "pct": pct, "divisor": False})
    if no_oblig_sub_rows:
        no_oblig.append({"divisor": True})
        for f in no_oblig_sub_rows:
            if f["total"] <= 0:
                continue
            pct = f["total"] / no_oblig_total * 100.0 if no_oblig_total else 0.0
            no_oblig.append({**f, "pct": pct, "divisor": False})

    resumen_anios = _resumen_anios(diag)
    anios = sorted(set(list(resumen_anios.keys()) + [
        str(r.get("campania")) for r in registros
        if r.get("campania") and str(r.get("campania")) != "N/A"
    ]))

    detalles = []
    for f in vista_alta:
        g = grupos[(f["modulo"], f["clave"])]
        anual = []
        taladros_por_anio = []
        for anio in anios:
            rs = resumen_anios.get(anio, {"n_taladros": 0, "total_filas": 0})
            a = g["anios"].get(anio, {"v": 0, "s": 0, "celdas_v": set(),
                                      "celdas_s": set(), "celdas_t": set()})
            total_anio = a["v"] + a["s"]
            anual.append({
                "anio": anio,
                "n_taladros": rs["n_taladros"],
                "total_filas": rs["total_filas"],
                "v": a["v"],
                "s": a["s"],
                "total": total_anio,
                "pct_anio": (total_anio / rs["total_filas"] * 100.0)
                if rs["total_filas"] else 0.0,
            })
            taladros_por_anio.append({
                "anio": anio,
                "t_v": len(a["celdas_v"]),
                "t_s": len(a["celdas_s"]),
                "t_t": len(a["celdas_t"]),
            })
        detalles.append({
            "modulo": f["modulo"],
            "clave": f["clave"],
            "etiqueta": f["etiqueta"],
            "anual": anual,
            "taladros": taladros_por_anio,
            "total_taladros": len(g["celdas"]),
        })

    main_orden = sorted(req_main, key=lambda x: x["total"], reverse=True)
    pareto = []
    acum = 0.0
    for f in main_orden:
        if f["total"] <= 0:
            continue
        pct = f["total"] / gran_total * 100.0 if gran_total else 0.0
        acum += pct
        pareto.append({**f, "pct": pct, "acum": acum, "divisor": False})

    parrafos = []
    p1 = _p1_concentracion(main_orden, gran_total, n_registros, len(celdas_afectadas))
    if p1 is not None:
        parrafos.append(p1)
    p2 = _p2_impacto_rmr(main_orden, registros_oblig)
    if p2 is not None:
        parrafos.append(p2)
    p3 = _p3_tendencia(registros_oblig)
    if p3 is not None:
        parrafos.append(p3)
    p4 = _p4_vacio_vs_sin_info(total_vacias, total_sin_info, gran_total)
    if p4 is not None:
        parrafos.append(p4)
    if PARRAFOS_OPCIONALES:
        p5 = _p5_geologo(registros_oblig)
        if p5 is not None:
            parrafos.append(p5)
        p6 = _p6_taladros(registros_oblig, len(celdas_afectadas))
        if p6 is not None:
            parrafos.append(p6)
        p7 = _p7_modulo(registros_oblig, gran_total)
        if p7 is not None:
            parrafos.append(p7)

    parrafos_secundarios = []
    p8 = _p8_no_obligatorios(
        sorted(no_oblig_main, key=lambda x: x["total"], reverse=True), no_oblig_total)
    if p8 is not None:
        parrafos_secundarios.append(p8)

    return AnalisisResult(
        total_vacias=total_vacias,
        total_sin_info=total_sin_info,
        total_faltantes=gran_total,
        total_taladros_afectados=len(celdas_afectadas),
        num_campos_alta=len(vista_alta),
        registros_afectados=n_registros,
        no_oblig_total=no_oblig_total,
        tablas=tablas,
        no_oblig=no_oblig,
        vista_alta=vista_alta,
        detalles=detalles,
        parrafos=parrafos,
        parrafos_secundarios=parrafos_secundarios,
        modulos=_stats_modulos(grupos, req_main, tablas["C"]),
        pareto=pareto,
        anios=anios,
    )
